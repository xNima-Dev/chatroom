const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');
const healthRoutes = require('./routes/healthRoute');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Trust proxy for reverse proxy deployments
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS configuration reading allowed origin strictly from environment variable
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server) or matching CLIENT_URL
    if (!origin || origin === config.clientUrl) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health check route
app.use(healthRoutes);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// Catch-all route for unknown API endpoints
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;
