function roomChannel(roomId) {
  return `chat:msg:${roomId}`;
}

class ChannelManager {
  constructor(subscriberClient, onMessage) {
    this.subscriberClient = subscriberClient;
    this.onMessage = onMessage;
    this.rooms = new Map();

    this.subscriberClient.on('message', (channel, message) => {
      const prefix = 'chat:msg:';
      if (!channel.startsWith(prefix)) {
        return;
      }
      const roomId = channel.slice(prefix.length);
      this.onMessage(roomId, message);
    });
  }

  async addRoom(roomId) {
    const existing = this.rooms.get(roomId);
    if (existing) {
      existing.refCount += 1;
      return;
    }

    const handler = (message) => {
      this.onMessage(roomId, message);
    };

    await this.subscriberClient.subscribe(roomChannel(roomId));
    this.rooms.set(roomId, { refCount: 1, handler });
  }

  async removeRoom(roomId) {
    const state = this.rooms.get(roomId);
    if (!state) {
      return;
    }

    state.refCount -= 1;
    if (state.refCount > 0) {
      return;
    }

    await this.subscriberClient.unsubscribe(roomChannel(roomId));
    this.rooms.delete(roomId);
  }

  async clear() {
    const rooms = Array.from(this.rooms.keys());
    for (const roomId of rooms) {
      await this.removeRoom(roomId);
    }
  }
}

module.exports = {
  ChannelManager,
  roomChannel,
};
