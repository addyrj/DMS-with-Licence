// src/config/env.js
// Validates all required env variables on startup — fails fast if any missing
// src/config/env.js
const required = [
  'JWT_SECRET',
  'DB_HOST', 'DB_USER', 'DB_NAME',
  'SUPERADMIN_USERNAME', 'SUPERADMIN_PASSWORD',
];

const missing = required.filter(
  (key) => process.env[key] === undefined || process.env[key] === null
);
if (missing.length > 0) {
  console.error(`❌ Missing required env variables: ${missing.join(', ')}`);
  process.exit(1);
}

const env = {
  port:      process.env.PORT,
  nodeEnv:   process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiry: process.env.JWT_EXPIRY || process.env.JWT_EXPIRES_IN || '7d',
  superadmin: {
    username: process.env.SUPERADMIN_USERNAME,
    password: process.env.SUPERADMIN_PASSWORD,
  },
  db: {
    host:     process.env.DB_HOST,
    port:     Number(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
    name:     process.env.DB_NAME,
  },
  mqtt: {
    broker:   process.env.MQTT_BROKER   || '',
    port:     Number(process.env.MQTT_PORT) || 1883,
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || '',
  },
  baseUrl:    process.env.BASE_URL    || 'http://localhost:5004',
  uploadDir:  process.env.UPLOAD_DIR  || './uploads',
  tvfileDir:  process.env.TVFILE_DIR  || './tvfiles',
  corsOrigin: process.env.CORS_ORIGIN || '*',
};

export default env;