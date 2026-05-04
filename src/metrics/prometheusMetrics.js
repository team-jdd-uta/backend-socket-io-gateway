function escapeLabelValue(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/"/g, '\\"');
}

function createGatewayMetrics() {
  let activeConnections = 0;
  let totalConnections = 0;

  const render = () => {
    const lines = [
      '# HELP socketio_active_connections Active Socket.IO connections currently handled by the gateway.',
      '# TYPE socketio_active_connections gauge',
      `socketio_active_connections ${activeConnections}`,
      '# HELP socketio_connection_events Total Socket.IO connection events observed by the gateway.',
      '# TYPE socketio_connection_events counter',
      `socketio_connection_events ${totalConnections}`,
    ];

    return `${lines.join('\n')}\n`;
  };

  return {
    onConnection() {
      activeConnections += 1;
      totalConnections += 1;
    },
    onDisconnect() {
      activeConnections = Math.max(0, activeConnections - 1);
    },
    snapshot() {
      return { activeConnections };
    },
    render,
    escapeLabelValue,
  };
}

module.exports = {
  createGatewayMetrics,
  escapeLabelValue,
};
