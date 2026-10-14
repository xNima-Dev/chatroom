require('./setup');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');

describe('Auth REST API Integration Tests', () => {
  const sampleUser = {
    name: 'Kasun Silva',
    email: 'kasun@example.com',
    password: 'password123'
  };

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully and return JWT token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(sampleUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.name).toBe(sampleUser.name);
      expect(res.body.user.email).toBe(sampleUser.email);
      expect(res.body.user.password).toBeUndefined();

      // Check DB persistence
      const savedUser = await User.findOne({ email: sampleUser.email });
      expect(savedUser).not.toBeNull();
      expect(savedUser.password).not.toBe(sampleUser.password); // must be hashed
    });

    it('should reject registration if email is already registered (409 Conflict)', async () => {
      await request(app).post('/api/auth/register').send(sampleUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send(sampleUser);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('already exists');
    });

    it('should reject registration with invalid email or short password (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: '',
          email: 'not-an-email',
          password: '123'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(sampleUser);
    });

    it('should login successfully with correct credentials and return token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: sampleUser.email,
          password: sampleUser.password
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(sampleUser.email);
    });

    it('should reject login with wrong password (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: sampleUser.email,
          password: 'wrongpassword'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should reject login for non-existent email (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unknown@example.com',
          password: 'password123'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid credentials');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile when authenticated with valid token', async () => {
      const regRes = await request(app).post('/api/auth/register').send(sampleUser);
      const token = regRes.body.token;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe(sampleUser.email);
    });

    it('should return 401 when token is missing', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
