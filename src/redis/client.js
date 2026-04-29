const Redis = require('ioredis');
const config = require('../config');

let commandClient;
let subscriberClient;

async function ensureRedisClients() {
  if (commandClient && subscriberClient) {
    return { commandClient, subscriberClient };
  }

  commandClient = new Redis.Cluster(config.redis.nodes, {
    redisOptions: {
      lazyConnect: false,
    },
  });
  subscriberClient = new Redis.Cluster(config.redis.nodes, {
    redisOptions: {
      lazyConnect: false,
    },
  });

  commandClient.on('error', (error) => {
    console.error('[redis] command client error:', error);
  });

  subscriberClient.on('error', (error) => {
    console.error('[redis] subscriber client error:', error);
  });

  // ping()으로 연결을 기다리지 않는다.
  // ioredis Cluster는 연결을 비동기로 관리하며 자동 재연결한다.
  // ping() 대기 시 Kubernetes liveness probe 타임아웃 전에 포트가 열리지 않아 CrashLoopBackOff 발생.
  return { commandClient, subscriberClient };
}

async function closeRedisClients() {
  const closes = [];

  if (subscriberClient) {
    closes.push(subscriberClient.quit().catch(() => subscriberClient.disconnect()));
  }

  if (commandClient) {
    closes.push(commandClient.quit().catch(() => commandClient.disconnect()));
  }

  await Promise.allSettled(closes);
  commandClient = undefined;
  subscriberClient = undefined;
}

function getRedisClients() {
  return { commandClient, subscriberClient };
}

module.exports = {
  ensureRedisClients,
  closeRedisClients,
  getRedisClients,
};
