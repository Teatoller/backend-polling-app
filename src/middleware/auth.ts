// src/middleware/auth.ts
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, ApiResponse } from '../types/index.js';

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    const response: ApiResponse = { error: 'Access token required' };
    res.status(401).json(response);
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err, user: any) => {
    if (err) {
      const response: ApiResponse = { error: 'Invalid or expired token' };
      res.status(403).json(response);
      return;
    }
    req.user = user;
    next();
  });
};

export const authenticateAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    const response: ApiResponse = { error: 'Access token required' };
    res.status(401).json(response);
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err, admin: any) => {
    if (err || !admin.role || admin.role !== 'admin') {
      const response: ApiResponse = { error: 'Admin access required' };
      res.status(403).json(response);
      return;
    }
    req.admin = admin;
    next();
  });
};