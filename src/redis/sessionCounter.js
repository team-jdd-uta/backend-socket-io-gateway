function sessionCountKey(roomId) {
  return `sessions:count:${roomId}`;
}

async function incrementSessionCount(redisClient, roomId) {
  return redisClient.incr(sessionCountKey(roomId));
}

async function decrementSessionCount(redisClient, roomId) {
  const count = await redisClient.decr(sessionCountKey(roomId));
  if (count <= 0) {
    await redisClient.del(sessionCountKey(roomId));
    return 0;
  }
  return count;
}

async function getSessionCount(redisClient, roomId) {
  const value = await redisClient.get(sessionCountKey(roomId));
  return value ? Number(value) : 0;
}

module.exports = {
  sessionCountKey,
  incrementSessionCount,
  decrementSessionCount,
  getSessionCount,
};
