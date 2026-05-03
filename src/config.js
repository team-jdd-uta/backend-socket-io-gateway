require('dotenv').config();

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseRedisNodes(value) {
  return (value || '127.0.0.1:7000')
    .split(',')
    .map((node) => node.trim())
    .filter(Boolean)
    .map((node) => {
      const [host, port] = node.split(':');
      return { host, port: Number(port || 6379) };
    });
}

module.exports = {
  port: toNumber(process.env.PORT, 3000),
  socketPath: process.env.SOCKET_PATH || '/socket.io',
  redis: {
    nodes: parseRedisNodes(process.env.REDIS_NODES),
  },
  roomService: {
    baseUrl: process.env.ROOM_SERVICE_URL || 'http://127.0.0.1:8082',
    timeoutMs: toNumber(process.env.ROOM_SERVICE_TIMEOUT_MS, 3000),
  },
  chatService: {
    baseUrl: process.env.CHAT_SERVICE_URL || 'http://127.0.0.1:8083',
    timeoutMs: toNumber(process.env.CHAT_SERVICE_TIMEOUT_MS, 3000),
  },
  loginService: {
    baseUrl: process.env.LOGIN_SERVICE_BASE_URL || 'http://backend-login-service:8081',
    timeoutMs: toNumber(process.env.LOGIN_SERVICE_TIMEOUT_MS, 3000),
    internalToken: process.env.LOGIN_SERVICE_INTERNAL_TOKEN || '',
  },
  cognito: {
    issuerUri: process.env.COGNITO_ISSUER_URI || '',
    userPoolId: process.env.COGNITO_USER_POOL_ID || '',
    region: process.env.COGNITO_REGION || process.env.AWS_REGION || 'ap-northeast-2',
    clientId: process.env.COGNITO_CLIENT_ID || '',
  },
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
  gatewayAuthRequired: String(process.env.GATEWAY_AUTH_REQUIRED || 'false').toLowerCase() === 'true',
  drainTimeoutMs: toNumber(process.env.DRAIN_TIMEOUT_MS, 5000),
};
