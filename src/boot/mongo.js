const mongoose = require('mongoose');
const logger = require('./logger');

async function connectMongo(uri) {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  logger.info(`MongoDB connected (${mongoose.connection.name})`);
}

async function disconnectMongo() {
  await mongoose.connection.close();
}

module.exports = { connectMongo, disconnectMongo };
