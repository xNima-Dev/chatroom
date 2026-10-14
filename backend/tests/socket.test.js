require('./setup');
const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const app = require('../src/app');
const { initSocketIO } = require('../src/sockets/socketHandler');
const User = require('../src/models/User');
const Room = require('../src/models/Room');
const Message = require('../src/models/Message');
const { generateToken } = require('../src/controllers/authController');

describe('Socket.io Real-Time Integration Tests', () => {
  let httpServer;
  let io;
  let port;
  let user1;
  let user2;
  let user1Token;
  let user2Token;
  let testRoom;

  beforeAll((done) => {
    httpServer = http.createServer(app);
    io = new Server(httpServer, {
      cors: { origin: '*' }
    });
    initSocketIO(io);

    httpServer.listen(() => {
      port = httpServer.address().port;
      done();
    });
  });

  afterAll((done) => {
    io.close(() => {
      httpServer.close(done);
    });
  });

  beforeEach(async () => {
    // Create two test users
    user1 = await User.create({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123'
    });
    user1Token = generateToken(user1);

    user2 = await User.create({
      name: 'Bob',
      email: 'bob@example.com',
      password: 'password123'
    });
    user2Token = generateToken(user2);

    // Create room with both users as members
    testRoom = await Room.create({
      name: 'General Discussion',
      createdBy: user1._id,
      members: [user1._id, user2._id]
    });
  });

  it('should REJECT connection without a valid JWT token', (done) => {
    const socket = Client(`http://localhost:${port}`, {
      auth: { token: 'invalid_or_missing_token' },
      transports: ['websocket']
    });

    socket.on('connect', () => {
      socket.disconnect();
      done(new Error('Connection should not have succeeded'));
    });

    socket.on('connect_error', (err) => {
      expect(err.message).toMatch(/Authentication error/);
      socket.disconnect();
      done();
    });
  });

  it('should ACCEPT connection with a valid JWT token and receive online users', (done) => {
    const socket = Client(`http://localhost:${port}`, {
      auth: { token: user1Token },
      transports: ['websocket']
    });

    socket.on('online_users', (users) => {
      expect(Array.isArray(users)).toBe(true);
      expect(users.some((u) => u.id === user1._id.toString())).toBe(true);
      socket.disconnect();
      done();
    });
  });

  it('should persist sent message and broadcast it to another client in the same room', (done) => {
    const clientA = Client(`http://localhost:${port}`, {
      auth: { token: user1Token },
      transports: ['websocket']
    });

    const clientB = Client(`http://localhost:${port}`, {
      auth: { token: user2Token },
      transports: ['websocket']
    });

    let connectedCount = 0;
    const onConnect = () => {
      connectedCount++;
      if (connectedCount === 2) {
        // Both join the room
        clientA.emit('join_room', { roomId: testRoom._id.toString() });
        clientB.emit('join_room', { roomId: testRoom._id.toString() });

        setTimeout(() => {
          // Client A sends message
          clientA.emit(
            'send_message',
            {
              roomId: testRoom._id.toString(),
              text: 'Hello from Alice!'
            },
            (response) => {
              expect(response.success).toBe(true);
              expect(response.message.text).toBe('Hello from Alice!');
            }
          );
        }, 50);
      }
    };

    clientA.on('connect', onConnect);
    clientB.on('connect', onConnect);

    // Client B listens for receive_message
    clientB.on('receive_message', async (message) => {
      try {
        expect(message.text).toBe('Hello from Alice!');
        expect(message.sender._id.toString()).toBe(user1._id.toString());
        expect(message.room.toString()).toBe(testRoom._id.toString());

        // Verify message was persisted to MongoDB
        const savedMessage = await Message.findById(message._id);
        expect(savedMessage).not.toBeNull();
        expect(savedMessage.text).toBe('Hello from Alice!');

        clientA.disconnect();
        clientB.disconnect();
        done();
      } catch (err) {
        clientA.disconnect();
        clientB.disconnect();
        done(err);
      }
    });
  });

  it('should enforce rate limit when more than 5 messages sent within 3 seconds', (done) => {
    const client = Client(`http://localhost:${port}`, {
      auth: { token: user1Token },
      transports: ['websocket']
    });

    client.on('connect', () => {
      client.emit('join_room', { roomId: testRoom._id.toString() });

      let errorsReceived = 0;
      client.on('error_message', (err) => {
        if (err.message.includes('Rate limit exceeded')) {
          errorsReceived++;
        }
      });

      // Send 7 messages rapidly
      for (let i = 0; i < 7; i++) {
        client.emit('send_message', {
          roomId: testRoom._id.toString(),
          text: `Spam message ${i}`
        });
      }

      setTimeout(() => {
        expect(errorsReceived).toBeGreaterThan(0);
        client.disconnect();
        done();
      }, 200);
    });
  });
});
