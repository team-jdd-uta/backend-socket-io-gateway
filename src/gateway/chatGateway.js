const { incrementSessionCount, decrementSessionCount } = require('../redis/sessionCounter');
const { createChatServiceClient } = require('../client/chatServiceClient');
const { ChannelManager } = require('../pubsub/channelManager');

function safeParse(message) {
  try {
    return JSON.parse(message);
  } catch (error) {
    return null;
  }
}

function createChatGateway({ io, redisClients }) {
  const chatServiceClient = createChatServiceClient();
  const channelManager = new ChannelManager(redisClients.subscriberClient, (roomId, message) => {
    const payload = safeParse(message);
    if (!payload) {
      return;
    }

    console.log(`[gateway] pubsub fan-out room=${roomId} type=${payload.type || 'unknown'}`);
    io.to(roomId).emit('TALK', payload);
  });

  io.on('connection', (socket) => {
    console.log(`[gateway] connected socket=${socket.id}`);
    socket.data.joinedRooms = new Set();

    socket.on('ENTER', async (payload = {}) => {
      try {
        const roomId = payload.roomId;
        if (!roomId || socket.data.joinedRooms.has(roomId)) {
          return;
        }

        console.log(`[gateway] ENTER socket=${socket.id} room=${roomId}`);
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

        console.log(`[gateway] TALK socket=${socket.id} room=${roomId} sender=${payload.sender || socket.id}`);
        await chatServiceClient.publishTalk({
          type: 'TALK',
          roomId,
          sender: payload.sender || socket.id,
          message: payload.message || '',
          msgId: payload.msgId || undefined,
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
