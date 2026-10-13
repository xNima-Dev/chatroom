# chatroom

Real-time chat application built with the MERN stack (MongoDB, Express, React, Node.js) and Socket.io.

## Milestone 1: Backend Architecture (Implemented)
- **Authentication**: JWT authentication with bcrypt password hashing
- **Rooms**: Dynamic room creation and membership tracking
- **Messages**: Real-time room messaging with cursor-based pagination
- **Socket.io**: Handshake JWT authentication, presence tracking (online/offline users), sliding-window rate limiting (max 5 messages / 3s), typing indicators
- **Security & Reliability**: Helmet, CORS whitelist from env, centralized error handling, fail-fast database connection
- **Automated Tests**: Integration tests with Jest, Supertest, and mongodb-memory-server
