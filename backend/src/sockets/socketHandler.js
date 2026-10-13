const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const config = require('../config/env');
const User = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');
const presence = require('./presence');
const { socketRateLimiter } = require('./rateLimiter');

const initSocketIO = (io) => {
  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      let token =
        socket.handshake.auth && socket.handshake.auth.token
          ? socket.handshake.auth.token
          : null;

      if (!token && socket.handshake.headers.authorization) {
        const parts = socket.handshake.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
          token = parts[1];
        }
      }

      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }

      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = {
        id: user._id.toString(),
        _id: user._id.toString(),
        name: user.name,
        email: user.email
      };

      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;

    // Presence management on connect
    const { isNewUser } = presence.addUserSocket(user.id, socket.id, user);
    if (isNewUser) {
      io.emit('user_online', {
        userId: user.id,
        user: { id: user.id, _id: user.id, name: user.name, email: user.email }
      });
    }

    // Send current list of online users to newly connected client
    socket.emit('online_users', presence.getOnlineUsers());

    // Join room event
    socket.on('join_room', async (data) => {
      const roomId = typeof data === 'object' && data !== null ? data.roomId : data;
      if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
        return socket.emit('error_message', { message: 'Invalid room ID' });
      }

      socket.join(`room:${roomId}`);
      socket.emit('joined_room', { roomId });
    });

    // Leave room event
    socket.on('leave_room', (data) => {
      const roomId = typeof data === 'object' && data !== null ? data.roomId : data;
      if (roomId) {
        socket.leave(`room:${roomId}`);
        socket.emit('left_room', { roomId });
      }
    });

    // Send message event
    socket.on('send_message', async (data, callback) => {
      try {
        const roomId = data.roomId || data.room;
        let text = data.text;

        // Rate limiting: max 5 messages per 3s
        if (socketRateLimiter.isRateLimited(socket.id)) {
          const errPayload = {
            message: 'Rate limit exceeded: Maximum 5 messages per 3 seconds'
          };
          socket.emit('error_message', errPayload);
          if (typeof callback === 'function') {
            callback({ success: false, error: errPayload.message });
          }
          return;
        }

        if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
          const errPayload = { message: 'Valid room ID is required' };
          socket.emit('error_message', errPayload);
          if (typeof callback === 'function') {
            callback({ success: false, error: errPayload.message });
          }
          return;
        }

        if (!text || typeof text !== 'string') {
          const errPayload = { message: 'Message text is required' };
          socket.emit('error_message', errPayload);
          if (typeof callback === 'function') {
            callback({ success: false, error: errPayload.message });
          }
          return;
        }

        text = text.trim();
        if (text.length === 0) {
          const errPayload = { message: 'Message cannot be empty' };
          socket.emit('error_message', errPayload);
          if (typeof callback === 'function') {
            callback({ success: false, error: errPayload.message });
          }
          return;
        }

        if (text.length > 1000) {
          const errPayload = { message: 'Message cannot exceed 1000 characters' };
          socket.emit('error_message', errPayload);
          if (typeof callback === 'function') {
            callback({ success: false, error: errPayload.message });
          }
          return;
        }

        // Verify sender is a member of the room
        const room = await Room.findById(roomId);
        if (!room) {
          const errPayload = { message: 'Room not found' };
          socket.emit('error_message', errPayload);
          if (typeof callback === 'function') {
            callback({ success: false, error: errPayload.message });
          }
          return;
        }

        const isMember = room.members.some(
          (m) => m.toString() === user.id.toString()
        );

        if (!isMember) {
          const errPayload = {
            message: 'Forbidden: You must be a member of this room to send messages'
          };
          socket.emit('error_message', errPayload);
          if (typeof callback === 'function') {
            callback({ success: false, error: errPayload.message });
          }
          return;
        }

        // Save message to MongoDB
        const message = await Message.create({
          room: roomId,
          sender: user.id,
          text
        });

        const populatedMessage = await Message.findById(message._id).populate(
          'sender',
          'name email'
        );

        // Broadcast to everyone in that room
        io.to(`room:${roomId}`).emit('receive_message', populatedMessage);

        if (typeof callback === 'function') {
          callback({ success: true, message: populatedMessage });
        }
      } catch (err) {
        socket.emit('error_message', { message: 'Failed to process message' });
        if (typeof callback === 'function') {
          callback({ success: false, error: err.message });
        }
      }
    });

    // Typing indicators
    socket.on('typing', (data) => {
      const roomId = typeof data === 'object' && data !== null ? data.roomId : data;
      if (roomId) {
        socket.to(`room:${roomId}`).emit('user_typing', {
          roomId,
          user: { id: user.id, name: user.name }
        });
      }
    });

    socket.on('stop_typing', (data) => {
      const roomId = typeof data === 'object' && data !== null ? data.roomId : data;
      if (roomId) {
        socket.to(`room:${roomId}`).emit('user_stop_typing', {
          roomId,
          user: { id: user.id, name: user.name }
        });
      }
    });

    // Disconnect event
    socket.on('disconnect', () => {
      const result = presence.removeSocket(socket.id);
      socketRateLimiter.cleanSocket(socket.id);

      if (result && result.isOfflineNow) {
        io.emit('user_offline', {
          userId: result.userId,
          user: result.user
        });
      }
    });
  });
};

module.exports = { initSocketIO };
