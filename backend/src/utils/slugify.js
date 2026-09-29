// src/utils/slugify.js
// Convert company name to a safe MySQL database name
// "ABC Manufacturing Co." → "abc_manufacturing_co_db"

export const slugify = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_db';
