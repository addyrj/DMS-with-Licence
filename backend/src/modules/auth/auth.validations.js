// src/modules/auth/auth.validations.js
import { body } from 'express-validator';

export const loginRules = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
];
