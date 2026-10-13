const express = require('express');
const { body, param } = require('express-validator');
const { getRooms, createRoom, joinRoom } = require('../controllers/roomController');
const { getMessages } = require('../controllers/messageController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// All room routes require authentication
router.use(protect);

const createRoomValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Room name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Room name must be between 2 and 50 characters'),
  validate
];

const roomIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid room ID format'),
  validate
];

router.get('/', getRooms);
router.post('/', createRoomValidation, createRoom);
router.post('/:id/join', roomIdValidation, joinRoom);

// Nested messages route: GET /api/rooms/:id/messages
router.get('/:id/messages', roomIdValidation, getMessages);

module.exports = router;
