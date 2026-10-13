/**
 * In-memory presence tracker managing online users across multiple sockets/tabs
 */
class PresenceManager {
  constructor() {
    // Map of userId string -> { userData: { id, name, email }, socketIds: Set<socketId> }
    this.users = new Map();
    // Map of socketId -> userId string
    this.socketToUser = new Map();
  }

  addUserSocket(userId, socketId, userData) {
    const uId = userId.toString();
    this.socketToUser.set(socketId, uId);

    if (!this.users.has(uId)) {
      this.users.set(uId, {
        userData: {
          id: uId,
          _id: uId,
          name: userData.name,
          email: userData.email
        },
        socketIds: new Set([socketId])
      });
      return { isNewUser: true, user: this.users.get(uId).userData };
    }

    const entry = this.users.get(uId);
    entry.socketIds.add(socketId);
    return { isNewUser: false, user: entry.userData };
  }

  removeSocket(socketId) {
    const uId = this.socketToUser.get(socketId);
    if (!uId) return null;

    this.socketToUser.delete(socketId);
    const entry = this.users.get(uId);
    if (!entry) return null;

    entry.socketIds.delete(socketId);

    if (entry.socketIds.size === 0) {
      this.users.delete(uId);
      return { userId: uId, isOfflineNow: true, user: entry.userData };
    }

    return { userId: uId, isOfflineNow: false, user: entry.userData };
  }

  getOnlineUsers() {
    const list = [];
    for (const [, val] of this.users.entries()) {
      list.push(val.userData);
    }
    return list;
  }
}

const presence = new PresenceManager();

module.exports = presence;
