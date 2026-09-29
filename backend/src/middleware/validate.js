// src/middleware/validate.js
// Collect express-validator errors and return 422 if any

import { validationResult } from 'express-validator';
import { error }            from '../utils/response.js';

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, errors.array().map((e) => e.msg).join(', '), 422);
  }
  next();
};

export default validate;
