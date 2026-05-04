const axios = require('axios');
const config = require('../config');

function createChatServiceClient() {
  const http = axios.create({
    baseURL: config.chatService.baseUrl,
    timeout: config.chatService.timeoutMs,
  });

  return {
    async publishTalk(payload, headers = {}) {
      await http.post('/message', payload, {
        headers,
      });
    },
  };
}

module.exports = {
  createChatServiceClient,
};
