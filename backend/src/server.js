const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const config = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { initSocketIO } = require('./sockets/socketHandler');

const server = http.createServer(app);

// Initialize Socket.io attached to HTTP server
const io = new Server(server, {
  cors: {
    origin: config.clientUrl,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

initSocketIO(io);

const startServer = async () => {
  // Connect to MongoDB (fails fast if connection error occurs)
  await connectDB();

  server.listen(config.port, () => {
    console.log(`[Server] ChatRoom backend running on port ${config.port} in ${config.nodeEnv} mode`);
    console.log(`[Server] Client URL allowed: ${config.clientUrl}`);
  });
};

// Graceful shutdown handling
const shutdown = async (signal) => {
  console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);
  io.close(() => {
    console.log('[Server] Socket.io server closed.');
  });
  server.close(async () => {
    console.log('[Server] HTTP server closed.');
    await disconnectDB();
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = { server, io };
