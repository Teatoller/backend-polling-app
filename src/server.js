// src/server.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import pollRoutes from './routes/polls.js';
import adminRoutes from './routes/admin.js';
import resultsRoutes from './routes/results.js';

import { authenticateToken } from './middleware/auth.js';
import { initializeSocket, socketAuthMiddleware } from './services/socketService.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Socket.io configuration with CORS
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});

// API Rate limiting (more restrictive)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Lower limit for auth endpoints
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet());
app.use(limiter);
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Make io accessible to routes
app.set('io', io);

// Apply stricter rate limiting to auth routes
app.use('/api/auth', apiLimiter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  const response = {
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  };
  res.status(500).json(response);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/polls', authenticateToken, pollRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/results', resultsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  const response = {
    message: 'Server is running',
    data: {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    }
  };
  res.json(response);
});

// Database health check
app.get('/api/health/db', async (req, res) => {
  try {
    const { db } = await import('./config/database.js');
    await db.query('SELECT 1');
    const response = {
      message: 'Database connection is healthy'
    };
    res.json(response);
  } catch (error) {
    console.error('Database health check failed:', error);
    const response = {
      error: 'Database connection failed'
    };
    res.status(503).json(response);
  }
});

// 404 handler
app.use((req, res) => {
  const response = {
    error: 'Route not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  };
  res.status(404).json(response);
});

// Socket.io middleware and initialization
io.use(socketAuthMiddleware);
initializeSocket(io);

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  
  httpServer.close((err) => {
    if (err) {
      console.error('Error during server shutdown:', err);
      process.exit(1);
    }
    
    console.log('HTTP server closed.');
    
    // Close database connections if needed
    // db.close().then(() => {
    //   console.log('Database connections closed.');
    //   process.exit(0);
    // });
    
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.log('Forcing shutdown after timeout...');
    process.exit(1);
  }, 10000);
};

// Handle different shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const PORT = parseInt(process.env.PORT || '5000');
const HOST = process.env.HOST || '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
  console.log(`
🚀 Server running on port ${PORT}
📍 Environment: ${process.env.NODE_ENV || 'development'}
🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}
📊 Database: ${process.env.DB_NAME || 'polling_app'}
  `);
  
  // Log important configuration
  if (process.env.NODE_ENV === 'development') {
    console.log(`
🔧 Development Mode
📧 Email Service: ${process.env.EMAIL_SERVICE ? 'Configured' : 'Not configured'}
📱 SMS Service: ${process.env.TWILIO_ACCOUNT_SID ? 'Configured' : 'Using mock'}
    `);
  }
});

export default app;