// src/middleware/auth.js
import jwt from 'jsonwebtoken';
import { VALID_ROLES } from './authorization.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    const response = { error: 'Access token required' };
    res.status(401).json(response);
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      const response = { error: 'Invalid or expired token' };
      res.status(403).json(response);
      return;
    }
    req.user = user;
    next();
  });
};

export const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    const response = { error: 'Access token required' };
    res.status(401).json(response);
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, admin) => {
    if (
      err ||
      !admin.role ||
      !VALID_ROLES.includes(admin.role)
    ) {
      const response = { error: 'Admin access required' };
      res.status(403).json(response);
      return;
    }
    req.admin = admin;
    next();
  });
};