const axios = require('axios');
const config = require('../config');

function createChatServiceClient() {
  const http = axios.create({
    baseURL: config.chatService.baseUrl,
    timeout: config.chatService.timeoutMs,
  });

  return {
<<<<<<< Updated upstream
    async publishTalk(payload, headers = {}) {
      await http.post('/message', payload, {
        headers,
=======
    async publishTalk(payload) {
      await http.post('/message', payload, {
        headers: {
          'X-Auth-Gateway': 'team9',
          'X-User-Id': payload.senderUserId || '',
          'X-User-Name': payload.sender || '',
        },
>>>>>>> Stashed changes
      });
    },
  };
}

module.exports = {
  createChatServiceClient,
};
