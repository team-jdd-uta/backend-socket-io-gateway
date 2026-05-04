const { incrementSessionCount, decrementSessionCount } = require('../redis/sessionCounter');
const { createRoomServiceClient } = require('../client/roomServiceClient');
const { createChatServiceClient } = require('../client/chatServiceClient');
const { ChannelManager } = require('../pubsub/channelManager');
const config = require('../config');
const { createCognitoJwtVerifier } = require('../auth/cognitoJwtVerifier');
const { createLoginUserMappingClient } = require('../auth/loginUserMappingClient');

function safeParse(message) {
  try {
    return JSON.parse(message);
  } catch (error) {
    return null;
  }
}

function normalizeBoolean(value) {
  return value === true || value === 'true';
}

function normalizeChatPayload(payload) {
  return {
    ...payload,
    isSuperChat: normalizeBoolean(payload.isSuperChat) || normalizeBoolean(payload.superChat),
  };
}

function createChatGateway({ io, redisClients }) {
  const roomServiceClient = createRoomServiceClient();
  const chatServiceClient = createChatServiceClient();
  const tokenVerifier = createCognitoJwtVerifier();
  const userMappingClient = createLoginUserMappingClient();
  const channelManager = new ChannelManager(redisClients.subscriberClient, (roomId, message) => {
    const payload = safeParse(message);
    if (!payload) {
      return;
    }

    const normalizedPayload = normalizeChatPayload(payload);
    console.log(`[gateway] pubsub fan-out room=${roomId} type=${normalizedPayload.type || 'unknown'} super=${normalizedPayload.isSuperChat}`);
    io.to(roomId).emit('TALK', normalizedPayload);
  });

  io.on('connection', (socket) => {
    console.log(`[gateway] connected socket=${socket.id}`);
    socket.data.joinedRooms = new Set();
    socket.data.userId = String(socket.handshake.headers['x-user-id'] || '').trim();
    socket.data.sender = '';
    socket.data.roomOwnerUserId = '';
    socket.data.roomName = '';

    const authenticateSocket = async () => {
      if (socket.data.userId) {
        return;
      }
      const token = typeof socket.handshake.auth?.token === 'string'
        ? socket.handshake.auth.token.trim()
        : '';
      if (!token) {
        return;
      }
      const verified = await tokenVerifier.verify(token);
      const mappedUser = await userMappingClient.findByCognitoSub(verified.cognitoSub);
      if (!mappedUser?.userId) {
        throw new Error('user mapping not found');
      }
      socket.data.userId = mappedUser.userId;
      socket.data.sender = mappedUser.username || verified.username || mappedUser.userId;
      socket.data.cognitoSub = verified.cognitoSub;
    };

    socket.on('ENTER', async (payload = {}) => {
      try {
        await authenticateSocket();
        const roomId = payload.roomId;
        const joinToken = typeof payload.joinToken === 'string' ? payload.joinToken.trim() : '';
        const requestedUserId = typeof payload.userId === 'string' ? payload.userId.trim() : '';
        const joinUserId = socket.data.userId || requestedUserId;
        const sender = typeof payload.sender === 'string' ? payload.sender.trim() : '';

        if (!roomId || socket.data.joinedRooms.has(roomId)) {
          return;
        }

        if (socket.data.userId && requestedUserId && socket.data.userId !== requestedUserId) {
          throw new Error('authenticated user does not match requested user');
        }

        if (!socket.data.userId) {
          const room = await roomServiceClient.getRoom(roomId);
          socket.data.sender = sender || 'guest';
          socket.data.roomOwnerUserId = room?.broadcasterId || '';
          socket.data.roomName = room?.name || '';
          socket.join(roomId);
          socket.data.joinedRooms.add(roomId);
          await incrementSessionCount(redisClients.commandClient, roomId);
          socket.emit('ENTER_ACK', { roomId, readOnly: true });
          channelManager.addRoom(roomId).catch((error) => {
            console.error(`[gateway] subscribe failed socket=${socket.id} room=${roomId}`, error);
            socket.emit('error', {
              code: 'ENTER_SUBSCRIBE_FAILED',
              message: error.message,
            });
          });
          return;
        }

        if (!joinUserId || !joinToken) {
          throw new Error('join token or userId is missing');
        }

        const joinedRoom = await roomServiceClient.joinRoom(roomId, {
          userId: joinUserId,
          sender: sender || joinUserId,
          joinToken,
        }, socket.data.userId ? { 'X-User-Id': socket.data.userId } : {});

        console.log(`[gateway] ENTER socket=${socket.id} room=${roomId}`);
        socket.data.userId = joinUserId;
        socket.data.sender = sender || joinUserId;
        socket.data.roomOwnerUserId = joinedRoom?.broadcasterId || '';
        socket.data.roomName = joinedRoom?.name || '';
        socket.join(roomId);
        socket.data.joinedRooms.add(roomId);

        await incrementSessionCount(redisClients.commandClient, roomId);
        socket.emit('ENTER_ACK', { roomId });

        channelManager.addRoom(roomId).catch((error) => {
          console.error(`[gateway] subscribe failed socket=${socket.id} room=${roomId}`, error);
          socket.emit('error', {
            code: 'ENTER_SUBSCRIBE_FAILED',
            message: error.message,
          });
        });
      } catch (error) {
        socket.emit('error', {
          code: 'ENTER_FAILED',
          message: error.message,
        });
      }
    });

    socket.on('TALK', async (payload = {}) => {
      try {
        const roomId = payload.roomId;
        if (!roomId || !socket.data.joinedRooms.has(roomId)) {
          return;
        }
        if (!socket.data.userId) {
          throw new Error('authentication is required to send chat messages');
        }

        const isSuperChat = normalizeBoolean(payload.isSuperChat) || normalizeBoolean(payload.superChat);
        console.log(`[gateway] TALK socket=${socket.id} room=${roomId} sender=${payload.sender || socket.id} super=${isSuperChat}`);
        await chatServiceClient.publishTalk({
          type: 'TALK',
          roomId,
          sender: socket.data.sender || payload.sender || socket.id,
          senderUserId: socket.data.userId || payload.userId || '',
          roomOwnerUserId: socket.data.roomOwnerUserId || payload.roomOwnerUserId || '',
          roomName: socket.data.roomName || payload.roomName || '',
          message: payload.message || '',
          isSuperChat,
          msgId: payload.msgId || undefined,
        }, {
          'X-Auth-Gateway': 'socket-io-gateway',
          'X-User-Id': socket.data.userId,
        });
      } catch (error) {
        socket.emit('error', {
          code: 'TALK_FAILED',
          message: error.message,
        });
      }
    });

    const leaveRoom = async (roomId, notify = true) => {
      if (!roomId || !socket.data.joinedRooms.has(roomId)) {
        return;
      }

      console.log(`[gateway] QUIT socket=${socket.id} room=${roomId}`);
      socket.data.joinedRooms.delete(roomId);
      socket.leave(roomId);
      await decrementSessionCount(redisClients.commandClient, roomId);
      await channelManager.removeRoom(roomId);
      if (notify) {
        socket.emit('QUIT_ACK', { roomId });
      }
    };

    socket.on('QUIT', async (payload = {}) => {
      try {
        await leaveRoom(payload.roomId);
      } catch (error) {
        socket.emit('error', {
          code: 'QUIT_FAILED',
          message: error.message,
        });
      }
    });

    socket.on('disconnect', async () => {
      console.log(`[gateway] disconnect socket=${socket.id}`);
      const rooms = Array.from(socket.data.joinedRooms);
      for (const roomId of rooms) {
        await leaveRoom(roomId, false);
      }
    });
  });

  return {
    async close() {
      await channelManager.clear();
    },
  };
}

module.exports = {
  createChatGateway,
};
