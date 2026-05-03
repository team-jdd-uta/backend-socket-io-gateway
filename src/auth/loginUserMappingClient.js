const axios = require('axios');
const config = require('../config');

function createLoginUserMappingClient() {
  const http = axios.create({
    baseURL: config.loginService.baseUrl,
    timeout: config.loginService.timeoutMs,
  });

  return {
    async findByCognitoSub(cognitoSub) {
      if (!cognitoSub) {
        return null;
      }
      const response = await http.get(`/internal/users/by-cognito-sub/${encodeURIComponent(cognitoSub)}`, {
        headers: {
          'X-Internal-Token': config.loginService.internalToken,
        },
      });
      return response.data;
    },
  };
}

module.exports = { createLoginUserMappingClient };
