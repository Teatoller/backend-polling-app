// src/middleware/validation.js
import Joi from 'joi';

export const validateRegistration = (req, res, next) => {
  const schema = Joi.object({
    nationalId: Joi.string().pattern(/^\d{8}$/).required()
      .messages({ 'string.pattern.base': 'National ID must be 8 digits' }),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^\+?[\d\s-()]+$/).optional(),
    password: Joi.string().min(6).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
    countyId: Joi.number().integer().allow(null).optional(),
    // allow empty names when ID is not provided; backend stores empty string if absent
    countyName: Joi.string().allow('', null).optional(),
    subCountyId: Joi.number().integer().allow(null).optional(),
    subCountyName: Joi.string().allow('', null).optional(),
    wardId: Joi.number().integer().allow(null).optional(),
    wardName: Joi.string().allow('', null).optional(),
    // pollingStation is required for storing where the user will vote; allow empty when ID-based flows don't provide it
    pollingStation: Joi.string().allow('', null).optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    const response = { error: error.details[0].message };
    res.status(400).json(response);
    return;
  }
  next();
};

export const validateLogin = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    const response = { error: error.details[0].message };
    res.status(400).json(response);
    return;
  }
  next();
};

export const validatePollCreation = (req, res, next) => {
  const schema = Joi.object({
    officeName: Joi.string().required(),
    description: Joi.string().optional(),
    startDate: Joi.date().required(),
    endDate: Joi.date().required(),
    candidates: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        party: Joi.string().required(),
        photoUrl: Joi.string().optional(),
        description: Joi.string().optional(),
        countyId: Joi.number().integer().allow(null).optional(),
        countyName: Joi.string().allow(null, '').optional(),
        subCountyId: Joi.number().integer().allow(null).optional(),
        subCountyName: Joi.string().allow(null, '').optional(),
        wardId: Joi.number().integer().allow(null).optional(),
        wardName: Joi.string().allow(null, '').optional(),
        pollingStation: Joi.string().allow(null, '').optional()
      })
    ).min(1).required()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    const response = { error: error.details[0].message };
    res.status(400).json(response);
    return;
  }
  next();
};

export const validateVoteSubmission = (req, res, next) => {
  const schema = Joi.object({
    pollId: Joi.number().integer().positive().required(),
    candidateId: Joi.number().integer().positive().required()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    const response = { error: error.details[0].message };
    res.status(400).json(response);
    return;
  }
  next();
};

export const validateEmail = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    const response = { error: error.details[0].message };
    res.status(400).json(response);
    return;
  }
  next();
};

export const validateSurveyVote = (req, res, next) => {
  const schema = Joi.object({
    surveyId: Joi.number().integer().positive().required(),
    optionId: Joi.number().integer().positive().required()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    const response = { error: error.details[0].message };
    res.status(400).json(response);
    return;
  }
  next();
};