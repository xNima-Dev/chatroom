const mongoose = require('mongoose');
const Room = require('../models/Room');
const Message = require('../models/Message');

// @desc    Get messages for a room with cursor pagination
// @route   GET /api/rooms/:id/messages?limit=30&before=<messageId>
const getMessages = async (req, res, next) => {
  try {
    const { id: roomId } = req.params;
    const { before } = req.query;
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1) limit = 30;
    if (limit > 100) limit = 100;

    // Verify room existence
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }

    // Authorization check: Only room members allowed
    const isMember = room.members.some(
      (memberId) => memberId.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You must be a member of this room to read messages'
      });
    }

    // Build cursor query
    const query = { room: roomId };

    if (before) {
      if (!mongoose.Types.ObjectId.isValid(before)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid "before" cursor ObjectId'
        });
      }
      query._id = { $lt: new mongoose.Types.ObjectId(before) };
    }

    // Query messages newest first, fetching 1 extra item to detect hasMore
    const messages = await Message.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate('sender', 'name email');

    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor =
      hasMore && resultMessages.length > 0
        ? resultMessages[resultMessages.length - 1]._id
        : null;

    return res.status(200).json({
      success: true,
      count: resultMessages.length,
      hasMore,
      nextCursor,
      messages: resultMessages
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMessages };
