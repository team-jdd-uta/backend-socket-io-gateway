function installGracefulShutdown({ server, io, closeGateway, closeRedisClients, setDraining, drainTimeoutMs }) {
  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`[lifecycle] received ${signal}, starting graceful shutdown`);
    setDraining(true);

    const forceExitTimer = setTimeout(() => {
      console.warn('[lifecycle] shutdown timeout reached, forcing exit');
      process.exit(0);
    }, drainTimeoutMs);
    forceExitTimer.unref();

    await new Promise((resolve) => server.close(resolve));
    io.close();
    if (closeGateway) {
      await closeGateway();
    }
    await closeRedisClients();

    clearTimeout(forceExitTimer);
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch((error) => {
      console.error('[lifecycle] shutdown failed:', error);
      process.exit(1);
    });
  });

  process.on('SIGINT', () => {
    shutdown('SIGINT').catch((error) => {
      console.error('[lifecycle] shutdown failed:', error);
      process.exit(1);
    });
  });

  return {
    isShuttingDown: () => shuttingDown,
  };
}

module.exports = {
  installGracefulShutdown,
};
