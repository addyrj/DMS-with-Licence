// src/modules/clients/clients.validations.js
import { body, param } from 'express-validator';

export const createClientRules = [
  body('company_name').trim().notEmpty().withMessage('Company name is required'),
  body('admin_username').trim().notEmpty().isLength({ min: 3 }).withMessage('Username min 3 chars'),
  body('admin_password').isLength({ min: 8 }).withMessage('Password min 8 characters'),
  body('devices_required').isInt({ min: 1 }).withMessage('Devices must be >= 1'),
  body('total_storage_gb').isInt({ min: 1 }).withMessage('Storage must be >= 1 GB'),
  body('pricing').isFloat({ min: 0 }).withMessage('Pricing must be >= 0'),
  body('subscription_days').isIn([30, 90, 180, 365]).withMessage('Invalid subscription plan'),
];

export const updateClientRules = [
  param('id').isInt().withMessage('Invalid client ID'),
];

export const storageUpgradeRules = [
  param('id').isInt(),
body('additional_gb').isInt({ min: 1, max: 1000 }).withMessage('Storage must be 1-1000 GB')
];

export const subscriptionRules = [
  param('id').isInt(),
  body('days').isIn([30, 90, 180, 365]).withMessage('Invalid plan'),
];
