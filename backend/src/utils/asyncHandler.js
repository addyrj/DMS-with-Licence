// src/utils/asyncHandler.js
// Wraps async route handlers — eliminates try/catch boilerplate in every controller
// Usage: router.get('/', asyncHandler(async (req, res) => { ... }))

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;
