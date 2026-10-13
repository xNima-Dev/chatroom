/**
 * Per-socket sliding window rate limiter
 * Allows max 5 messages per 3 seconds by default
 */
class SocketRateLimiter {
  constructor(maxLimit = 5, windowMs = 3000) {
    this.maxLimit = maxLimit;
    this.windowMs = windowMs;
    this.socketTimestamps = new Map(); // socketId -> number[]
  }

  isRateLimited(socketId) {
    const now = Date.now();
    const timestamps = this.socketTimestamps.get(socketId) || [];

    // Filter out timestamps outside the active sliding window
    const recentTimestamps = timestamps.filter(
      (time) => now - time < this.windowMs
    );

    if (recentTimestamps.length >= this.maxLimit) {
      this.socketTimestamps.set(socketId, recentTimestamps);
      return true;
    }

    recentTimestamps.push(now);
    this.socketTimestamps.set(socketId, recentTimestamps);
    return false;
  }

  cleanSocket(socketId) {
    this.socketTimestamps.delete(socketId);
  }
}

const socketRateLimiter = new SocketRateLimiter(5, 3000);

module.exports = { SocketRateLimiter, socketRateLimiter };
