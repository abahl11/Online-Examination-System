require('dotenv').config();

const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (isProduction) {
    throw new Error('JWT_SECRET must be set in production');
  }
  jwtSecret = 'testdesk-local-dev-secret';
}

const settings = {
  env,
  isProduction,
  isTest: env === 'test',
  port: Number(process.env.PORT) || 5001,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/testdesk',

  jwtSecret,
  jwtTtl: process.env.JWT_EXPIRES_IN || '8h',

  corsOrigin: process.env.CORS_ORIGIN || '*',
  logLevel: process.env.LOG_LEVEL || (isProduction ? 'http' : 'debug'),
  autoSubmitEverySec: Number(process.env.AUTO_SUBMIT_INTERVAL) || 30,

  firstAdmin: {
    fullName: process.env.ADMIN_NAME || 'Platform Admin',
    email: process.env.ADMIN_EMAIL || 'admin@testdesk.dev',
    password: process.env.ADMIN_PASSWORD || 'Admin@12345',
  },
};

module.exports = settings;
