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

    async issueJoinToken(roomId, userId, headers = {}) {
      const response = await http.post(`/rooms/${encodeURIComponent(roomId)}/join-token`, null, {
        params: { userId },
        headers,
      });
      return response.data;
    },

    async joinRoom(roomId, payload, headers = {}) {
      const response = await http.post(`/rooms/${encodeURIComponent(roomId)}/join`, null, {
        params: payload,
        headers,
      });
      return response.data;
    },
  };
}

module.exports = {
  createRoomServiceClient,
};
