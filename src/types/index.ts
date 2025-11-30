// src/types/index.ts
import { Request } from 'express';
import { PoolClient } from 'pg';

export interface User {
  id: number;
  nationalId: string;
  email: string;
  phone?: string;
  passwordHash: string;
  county: string;
  division: string;
  pollingStation: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  emailVerificationToken?: string;
  phoneVerificationCode?: string;
  phoneVerificationExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Poll {
  id: number;
  officeName: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdBy: number;
  createdAt: Date;
}

export interface Candidate {
  id: number;
  pollId: number;
  name: string;
  party: string;
  photoUrl?: string;
  description?: string;
  createdAt: Date;
}

export interface Vote {
  id: number;
  userId: number;
  pollId: number;
  candidateId: number;
  pollingStation: string;
  county: string;
  division: string;
  createdAt: Date;
}

export interface AdminUser {
  id: number;
  email: string;
  passwordHash: string;
  role: string;
  createdAt: Date;
}

export interface RegisterRequest {
  nationalId: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  county: string;
  division: string;
  pollingStation: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
  admin?: {
    adminId: number;
    email: string;
    role: string;
  };
}

export interface ApiResponse<T = any> {
  message?: string;
  data?: T;
  error?: string;
}

export interface LocationData {
  county: string;
  division: string;
  pollingStation: string;
}

export interface VoteRequest {
  pollId: number;
  candidateId: number;
}

// Database types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}