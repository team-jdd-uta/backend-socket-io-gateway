const axios = require('axios');
const config = require('../config');

function createRoomServiceClient() {
  const http = axios.create({
    baseURL: config.roomService.baseUrl,
    timeout: config.roomService.timeoutMs,
  });

  return {
    async getRoom(roomId) {
      const response = await http.get(`/rooms/${encodeURIComponent(roomId)}`);
      return response.data;
    },

    async issueJoinToken(roomId, userId) {
      const response = await http.post(`/rooms/${encodeURIComponent(roomId)}/join-token`, null, {
        params: { userId },
      });
      return response.data;
    },

    async joinRoom(roomId, payload) {
      const response = await http.post(`/rooms/${encodeURIComponent(roomId)}/join`, null, {
        params: payload,
      });
      return response.data;
    },
  };
}

module.exports = {
  createRoomServiceClient,
};
