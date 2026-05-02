const http = require('http');
const { Server } = require('socket.io');

const config = require('./config');
const { ensureRedisClients, closeRedisClients } = require('./redis/client');
const { createChatGateway } = require('./gateway/chatGateway');
const { installGracefulShutdown } = require('./lifecycle/gracefulShutdown');

async function main() {
  const redisClients = await ensureRedisClients();
  let draining = false;

  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(draining ? 503 : 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: !draining }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  });

  const io = new Server(server, {
    path: config.socketPath,
    cors: {
      origin: config.clientOrigin === '*' ? true : config.clientOrigin,
      credentials: false,
    },
  });

  const gateway = createChatGateway({
    io,
    redisClients,
  });

  installGracefulShutdown({
    server,
    io,
    closeGateway: gateway.close,
    closeRedisClients,
    drainTimeoutMs: config.drainTimeoutMs,
    setDraining: (value) => {
      draining = value;
    },
  });

  server.listen(config.port, () => {
    console.log(`[gateway] listening on :${config.port}`);
  });
}

main().catch((error) => {
  console.error('[gateway] fatal startup error:', error);
  closeRedisClients()
    .catch(() => undefined)
    .finally(() => {
      process.exit(1);
    });
});
