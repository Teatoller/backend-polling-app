// src/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiResponse } from '../types/index.js';

export const validateRegistration = (req: Request, res: Response, next: NextFunction): void => {
  const schema = Joi.object({
    nationalId: Joi.string().pattern(/^\d{8}$/).required()
      .messages({ 'string.pattern.base': 'National ID must be 8 digits' }),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^\+?[\d\s-()]+$/).optional(),
    password: Joi.string().min(6).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
    county: Joi.string().required(),
    division: Joi.string().required(),
    pollingStation: Joi.string().required()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    const response: ApiResponse = { error: error.details[0].message };
    res.status(400).json(response);
    return;
  }
  next();
};

export const validateLogin = (req: Request, res: Response, next: NextFunction): void => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    const response: ApiResponse = { error: error.details[0].message };
    res.status(400).json(response);
    return;
  }
  next();
};