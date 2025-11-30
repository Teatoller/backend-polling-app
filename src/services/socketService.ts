// src/services/socketService.ts
import { Server, Socket } from 'socket.io';

export interface SocketEvents {
  'joinPoll': (pollId: number) => void;
  'leavePoll': (pollId: number) => void;
  'voteUpdate': (data: { pollId: number; candidateId: number }) => void;
}

export const initializeSocket = (io: Server): Server => {
  io.on('connection', (socket: Socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinPoll', (pollId: number) => {
      socket.join(`poll-${pollId}`);
      console.log(`User ${socket.id} joined poll ${pollId}`);
    });

    socket.on('leavePoll', (pollId: number) => {
      socket.leave(`poll-${pollId}`);
      console.log(`User ${socket.id} left poll ${pollId}`);
    });

    socket.on('disconnect', (reason: string) => {
      console.log('User disconnected:', socket.id, 'Reason:', reason);
    });

    socket.on('error', (error: Error) => {
      console.error('Socket error:', error);
    });
  });

  return io;
};

// Utility function to emit vote updates to specific poll room
export const emitVoteUpdate = (io: Server, pollId: number, candidateId: number): void => {
  io.to(`poll-${pollId}`).emit('voteUpdate', {
    pollId,
    candidateId,
    timestamp: new Date().toISOString()
  });
};

// Utility function to get connected clients in a poll room
export const getPollRoomClients = (io: Server, pollId: number): number => {
  const room = io.sockets.adapter.rooms.get(`poll-${pollId}`);
  return room ? room.size : 0;
};

// Middleware for socket authentication (optional)
export const socketAuthMiddleware = (socket: Socket, next: (err?: Error) => void): void => {
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