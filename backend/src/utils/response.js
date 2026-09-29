// src/utils/response.js
// Standardised HTTP response helpers

export const success = (res, data = {}, statusCode = 200) =>
  res.status(statusCode).json({ success: true, ...data });

export const error = (res, message = 'Something went wrong', statusCode = 500) =>
  res.status(statusCode).json({ success: false, error: message });
