// src/modules/users/users.validations.js
import { body, param } from 'express-validator';

export const createUserRules = [
  body('username').trim().notEmpty().isLength({ min: 3 }).withMessage('Username min 3 chars'),
  body('password').isLength({ min: 8 }).withMessage('Password min 8 characters'),
  body('email').optional({ nullable: true }).custom(v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)).withMessage('Invalid email'),
  body('assigned_display_id').optional({ nullable: true }).custom(v => v === null || v === undefined || Number.isInteger(Number(v))).withMessage('Invalid display ID'),
  body('production_line_id').optional({ nullable: true }).custom(v => v === null || v === undefined || Number.isInteger(Number(v))).withMessage('Invalid line ID'),
  body('has_delete_permission').optional().isBoolean(),
];

export const updateUserRules = [
  param('id').isInt().withMessage('Invalid user ID'),
  body('assigned_display_id').optional({ nullable: true }).custom(v => v === null || Number.isInteger(Number(v))).withMessage('Invalid display ID'),
  body('production_line_id').optional({ nullable: true }).custom(v => v === null || Number.isInteger(Number(v))).withMessage('Invalid line ID'),
  body('email').optional({ nullable: true }).isEmail().withMessage('Invalid email').bail().optional({ checkFalsy: true }),
  body('has_delete_permission').optional().isBoolean(),
  body('is_active').optional().isBoolean(),
];
