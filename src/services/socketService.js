// src/services/socketService.js
import { Server, Socket } from 'socket.io';

export const initializeSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinPoll', (pollId) => {
      socket.join(`poll-${pollId}`);
      console.log(`User ${socket.id} joined poll ${pollId}`);
    });

    socket.on('leavePoll', (pollId) => {
      socket.leave(`poll-${pollId}`);
      console.log(`User ${socket.id} left poll ${pollId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log('User disconnected:', socket.id, 'Reason:', reason);
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  return io;
};

// Utility function to emit vote updates to specific poll room
export const emitVoteUpdate = (io, pollId, candidateId) => {
  io.to(`poll-${pollId}`).emit('voteUpdate', {
    pollId,
    candidateId,
    timestamp: new Date().toISOString()
  });
};

// Utility function to get connected clients in a poll room
export const getPollRoomClients = (io, pollId) => {
  const room = io.sockets.adapter.rooms.get(`poll-${pollId}`);
  return room ? room.size : 0;
};

// Middleware for socket authentication (optional)
export const socketAuthMiddleware = (socket, next) => {
  // You can add authentication logic here
  // For example, verify JWT token from socket.handshake.auth
  const token = socket.handshake.auth.token;
  
  if (!token) {
    next(new Error('Authentication error: No token provided'));
    return;
  }

  // Add your JWT verification logic here
  try {
    // const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    // socket.data.user = decoded;
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
};