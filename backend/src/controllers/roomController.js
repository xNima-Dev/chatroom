const Room = require('../models/Room');

// @desc    Get all rooms
// @route   GET /api/rooms
const getRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find()
      .populate('createdBy', 'name email')
      .populate('members', 'name email')
      .sort({ createdAt: -1 });

    const formattedRooms = rooms.map((room) => {
      const isMember = room.members.some(
        (member) => member._id.toString() === req.user._id.toString()
      );
      return {
        id: room._id,
        _id: room._id,
        name: room.name,
        createdBy: room.createdBy,
        membersCount: room.members.length,
        members: room.members,
        isMember,
        createdAt: room.createdAt
      };
    });

    return res.status(200).json({
      success: true,
      rooms: formattedRooms
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new room
// @route   POST /api/rooms
const createRoom = async (req, res, next) => {
  try {
    // Whitelist allowed fields only
    const { name } = req.body;

    const existingRoom = await Room.findOne({ name: name.trim() });
    if (existingRoom) {
      return res.status(409).json({
        success: false,
        error: 'A room with this name already exists'
      });
    }

    const room = await Room.create({
      name: name.trim(),
      createdBy: req.user._id,
      members: [req.user._id]
    });

    await room.populate('createdBy', 'name email');
    await room.populate('members', 'name email');

    return res.status(201).json({
      success: true,
      room: {
        id: room._id,
        _id: room._id,
        name: room.name,
        createdBy: room.createdBy,
        membersCount: room.members.length,
        members: room.members,
        isMember: true,
        createdAt: room.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Join an existing room
// @route   POST /api/rooms/:id/join
const joinRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }

    const isMember = room.members.some(
      (m) => m.toString() === req.user._id.toString()
    );

    if (!isMember) {
      room.members.push(req.user._id);
      await room.save();
    }

    await room.populate('createdBy', 'name email');
    await room.populate('members', 'name email');

    return res.status(200).json({
      success: true,
      room: {
        id: room._id,
        _id: room._id,
        name: room.name,
        createdBy: room.createdBy,
        membersCount: room.members.length,
        members: room.members,
        isMember: true,
        createdAt: room.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getRooms, createRoom, joinRoom };
