const request = require('supertest');
const app = require('../src/app');
const Room = require('../src/models/Room');
const Message = require('../src/models/Message');

require('./setup');

describe('Room & Message REST API Integration Tests', () => {
  let user1Token;
  let user1Id;
  let user2Token;
  let user2Id;

  beforeEach(async () => {
    // Register User 1
    const res1 = await request(app).post('/api/auth/register').send({
      name: 'User One',
      email: 'user1@example.com',
      password: 'password123'
    });
    user1Token = res1.body.token;
    user1Id = res1.body.user.id;

    // Register User 2
    const res2 = await request(app).post('/api/auth/register').send({
      name: 'User Two',
      email: 'user2@example.com',
      password: 'password123'
    });
    user2Token = res2.body.token;
    user2Id = res2.body.user.id;
  });

  describe('POST /api/rooms & GET /api/rooms', () => {
    it('should allow an authenticated user to create a room and automatically become a member', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'General Chat' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.room.name).toBe('General Chat');
      expect(res.body.room.isMember).toBe(true);
      expect(res.body.room.membersCount).toBe(1);

      // Verify in DB
      const room = await Room.findOne({ name: 'General Chat' });
      expect(room).not.toBeNull();
      expect(room.members.map((m) => m.toString())).toContain(user1Id);
    });

    it('should reject creating duplicate room names (409 Conflict)', async () => {
      await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Tech Talk' });

      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ name: 'Tech Talk' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('already exists');
    });

    it('should list all rooms and indicate member status accurately', async () => {
      await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'User 1 Room' });

      const res = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.rooms.length).toBe(1);
      expect(res.body.rooms[0].name).toBe('User 1 Room');
      expect(res.body.rooms[0].isMember).toBe(false); // user 2 is not a member yet
    });
  });

  describe('POST /api/rooms/:id/join', () => {
    it('should allow a user to join an existing room', async () => {
      const createRes = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Node.js Hub' });

      const roomId = createRes.body.room._id;

      const joinRes = await request(app)
        .post(`/api/rooms/${roomId}/join`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(joinRes.status).toBe(200);
      expect(joinRes.body.success).toBe(true);
      expect(joinRes.body.room.isMember).toBe(true);
      expect(joinRes.body.room.membersCount).toBe(2);
    });
  });

  describe('GET /api/rooms/:id/messages (Authorization & Cursor Pagination)', () => {
    let roomId;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Private Room' });

      roomId = createRes.body.room._id;
    });

    it('should FORBID a non-member from reading room messages (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/rooms/${roomId}/messages`)
        .set('Authorization', `Bearer ${user2Token}`); // user2 is NOT a member

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Forbidden');
    });

    it('should allow room members to read messages', async () => {
      // Create test message directly
      await Message.create({
        room: roomId,
        sender: user1Id,
        text: 'Welcome to the private room!'
      });

      const res = await request(app)
        .get(`/api/rooms/${roomId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.messages.length).toBe(1);
      expect(res.body.messages[0].text).toBe('Welcome to the private room!');
      expect(res.body.messages[0].sender.name).toBe('User One');
    });

    it('should paginate messages using cursor pagination (limit and before)', async () => {
      // Insert 5 messages with explicit timestamps
      const msgIds = [];
      for (let i = 1; i <= 5; i++) {
        const msg = await Message.create({
          room: roomId,
          sender: user1Id,
          text: `Message ${i}`,
          createdAt: new Date(Date.now() + i * 1000)
        });
        msgIds.push(msg._id);
      }

      // Query limit=2 (should get newest messages 5 and 4)
      const page1 = await request(app)
        .get(`/api/rooms/${roomId}/messages?limit=2`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(page1.status).toBe(200);
      expect(page1.body.messages.length).toBe(2);
      expect(page1.body.messages[0].text).toBe('Message 5');
      expect(page1.body.messages[1].text).toBe('Message 4');
      expect(page1.body.hasMore).toBe(true);
      expect(page1.body.nextCursor).toBeDefined();

      // Query page2 using nextCursor
      const page2 = await request(app)
        .get(`/api/rooms/${roomId}/messages?limit=2&before=${page1.body.nextCursor}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(page2.status).toBe(200);
      expect(page2.body.messages.length).toBe(2);
      expect(page2.body.messages[0].text).toBe('Message 3');
      expect(page2.body.messages[1].text).toBe('Message 2');
    });
  });
});
