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
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
  drainTimeoutMs: toNumber(process.env.DRAIN_TIMEOUT_MS, 5000),
};
