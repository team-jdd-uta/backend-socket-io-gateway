const axios = require('axios');
const config = require('../config');

function createChatServiceClient() {
  const http = axios.create({
    baseURL: config.chatService.baseUrl,
    timeout: config.chatService.timeoutMs,
  });

  return {
    async publishTalk(payload) {
      await http.post('/chat/message', payload);
    },
  };
}

module.exports = {
  createChatServiceClient,
};
