# ChatRoom - Full-Stack Real-Time Chat Application

A high-performance, production-ready real-time collaborative chat application built with the **MERN** stack (MongoDB, Express, React, Node.js) and **Socket.io**.

---

## 🏛 Architecture Diagram

```text
+-----------------------------------------------------------------------------------+
|                                 REACT CLIENT (Vite)                              |
|                                                                                   |
|  [RoomList Sidebar]          [ChatArea Feed + Input]         [OnlineUsers Sidebar]|
|  - Channel list              - Message feed (Optimistic)     - Real-time presence |
|  - Create Room modal         - Cursor pagination ('before')  - Green dot indicator|
|  - Room search & Join        - Debounced typing indicator    - Mobile drawer      |
|                              - Retry failed messages                              |
+-----------------------------------------------------------------------------------+
             |                                             |
   REST API (Axios + JWT)                        WebSocket (Socket.io-client)
   Bearer token in headers                       Handshake auth { token }
             |                                             |
             v                                             v
+-----------------------------------------------------------------------------------+
|                               EXPRESS + NODE.JS BACKEND                           |
|                                                                                   |
|  +---------------------------+             +----------------------------------+   |
|  |     REST API Controllers  |             |      Socket.io Real-Time Layer   |   |
|  | - /api/auth (Login/Reg)   |             | - Handshake JWT verification     |   |
|  | - /api/rooms (CRUD/Join)  |             | - Per-socket rate limiter        |   |
|  | - /api/rooms/:id/messages |             | - In-memory multi-tab presence   |   |
|  | - /health (Health check)  |             | - Room member validation & save  |   |
|  +---------------------------+             +----------------------------------+   |
|                |                                             |                    |
|                +----------------------+----------------------+                    |
|                                       v                                           |
|                            [ Centralized Error Handler ]                          |
|                            [ Mongoose ODM (Data Models)]                          |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
                            +-----------------------+
                            |     MONGODB DATABASE  |
                            | - Users collection    |
                            | - Rooms collection    |
                            | - Messages collection |
                            |   (Compound Index on  |
                            |   room + createdAt)   |
                            +-----------------------+
```

---

## ⚡ Socket.io Event Reference

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `connection` | Client $\leftrightarrow$ Server | Handshake `auth: { token }` | Authenticates JWT; rejects connection if token is missing or invalid. |
| `online_users` | Server $\rightarrow$ Client | `Array<{ id, name, email }>` | Emitted to newly connected client with current list of active users. |
| `user_online` | Server $\rightarrow$ All Clients | `{ userId, user: { id, name, email } }` | Broadcast when a user transitions from 0 to 1 active socket connection. |
| `user_offline` | Server $\rightarrow$ All Clients | `{ userId, user }` | Broadcast when a user's final socket connection disconnects. |
| `join_room` | Client $\rightarrow$ Server | `{ roomId: string }` | Joins Socket.io room channel `room:<roomId>`. |
| `leave_room` | Client $\rightarrow$ Server | `{ roomId: string }` | Leaves Socket.io room channel `room:<roomId>`. |
| `send_message` | Client $\rightarrow$ Server | `{ roomId: string, text: string }` | Rate-limited (max 5/3s), checks room membership, saves to Mongo, broadcasts. Supports ack callback. |
| `receive_message`| Server $\rightarrow$ Room Clients | `Message object` | Broadcasts newly persisted message with populated sender details to room members. |
| `typing` | Client $\rightarrow$ Server | `{ roomId: string }` | Client indicates active keystrokes in room input. |
| `stop_typing` | Client $\rightarrow$ Server | `{ roomId: string }` | Client indicates typing ceased (debounced after 1.5s). |
| `user_typing` | Server $\rightarrow$ Room Clients | `{ roomId, user: { id, name } }` | Notifies other room members that someone is typing. |
| `user_stop_typing`| Server $\rightarrow$ Room Clients | `{ roomId, user: { id, name } }` | Clears typing indicator for user in specified room. |
| `error_message` | Server $\rightarrow$ Client | `{ message: string }` | Informs client of validation failures, rate limits, or forbidden operations. |

---

## ⚙️ Environment Variables

### Backend (`chatroom/backend/.env`)
```env
PORT=5001
MONGODB_URI=mongodb://localhost:27017/chatroom
JWT_SECRET=super_secret_jwt_key_chat_room_2026_at_least_32_chars
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

### Frontend (`chatroom/frontend/.env`)
```env
VITE_API_URL=http://localhost:5001
```

---

## 🚀 Setup & Installation Steps

### 1. Prerequisites
- **Node.js** (v18+)
- **MongoDB** instance running locally or via MongoDB Atlas

### 2. Backend Setup
```bash
cd chatroom/backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env

# Start server in development mode
npm run dev

# Or start in production mode
npm start
```

### 3. Frontend Setup
```bash
cd chatroom/frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env

# Start Vite development server
npm run dev

# Build for production
npm run build
```

---

## 🌐 Production Deployment Guide

### Option 1: Render (1-Click Blueprint)
The repository includes `render.yaml` for automatic deployment of both backend and frontend:
1. Connect your GitHub repository to [Render](https://render.com).
2. Create a new **Blueprint** and select this repo.
3. Configure the environment variables:
   - `MONGODB_URI`: Your MongoDB Atlas cluster connection URI.
   - `CLIENT_URL`: The frontend production URL provided by Render.
   - `VITE_API_URL`: The backend production URL provided by Render.

### Option 2: Vercel (Frontend) + Render (Backend)
1. **Database**: Create a free M0 cluster on [MongoDB Atlas](https://www.mongodb.com/atlas), whitelist `0.0.0.0/0`, and copy the connection string.
2. **Backend (Render Web Service)**:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Add Environment Variables: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL` (your Vercel domain), `NODE_ENV=production`.
3. **Frontend (Vercel)**:
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Add Environment Variable: `VITE_API_URL` (your Render backend URL).

---

## 🧪 Running Automated Tests

The backend test suite is built with **Jest**, **Supertest**, and **mongodb-memory-server**:

```bash
cd chatroom/backend

# Run all test suites
npm test

# Run health check tests
npx jest tests/health.test.js --watchman=false

# Run auth tests
npx jest tests/auth.test.js --watchman=false

# Run room & message tests
npx jest tests/rooms.test.js --watchman=false

# Run socket integration tests
npx jest tests/socket.test.js --watchman=false
```

---

## 🔍 Key Architectural Design Decisions

1. **Separation of `app.js` and `server.js`**:
   `app.js` exports the configured Express application without listening on a TCP port. This allows Supertest to execute integration tests without port conflicts or unclosed handles.
2. **Centralized Error Middleware**:
   Maps database and JWT exceptions (`CastError` $\rightarrow$ 400, duplicate keys $\rightarrow$ 409, `ValidationError` $\rightarrow$ 400, `JsonWebTokenError` $\rightarrow$ 401) to proper HTTP status codes. Never returns 200 for errors.
3. **Cursor-Based Pagination**:
   Instead of offset-based pagination (`skip/limit`) which degrades as collections grow, `GET /api/rooms/:id/messages` queries `{ room, _id: { $lt: before } }` backed by a compound index `{ room: 1, createdAt: -1 }`.
4. **Optimistic Updates & Resilience**:
   The frontend UI renders messages immediately with a temporary ID and status `sending`. When the server confirms persistence, status changes to `delivered`. If acknowledgement fails or times out, the message displays an inline "Retry" action.
5. **Multi-Tab Presence Tracking**:
   The in-memory `PresenceManager` tracks users via `Map<userId, Set<socketId>>`. A user opening multiple browser tabs will not trigger duplicate online announcements, and will only be marked offline when their final tab disconnects.
6. **Per-Socket Sliding Window Rate Limiting**:
   Limits rapid spamming on real-time sockets (max 5 messages per 3 seconds) using timestamp windowing.

---

## ⚠️ Known Limitations & Future Work

1. **Horizontal Scaling with Multiple Node.js Instances**:
   Currently, presence state is stored in memory (`Map`) and Socket.io broadcasts are local to the running Node.js process. To scale horizontally across multiple container instances or load balancers, a **Redis adapter** (`@socket.io/redis-adapter`) and a Redis Pub/Sub instance are required so events and presence broadcast across all instances.
2. **File & Media Attachments**:
   Messages currently support text content (up to 1,000 characters). Supporting images and audio requires integrating an object store like AWS S3 or Google Cloud Storage.
3. **Message Reactions & Read Receipts**:
   Future work includes tracking per-user read pointers (`lastReadMessageId`) and emoji reaction arrays per message.
4. **End-to-End Encryption (E2EE)**:
   Messages are encrypted in transit via TLS and hashed at the database password level, but message text is stored plaintext on MongoDB. Sensitive channels could introduce client-side Web Crypto API keys.
