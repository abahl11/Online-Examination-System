const settings = require('./boot/settings');
const logger = require('./boot/logger');
const { connectMongo, disconnectMongo } = require('./boot/mongo');
const { bootstrapData } = require('./boot/bootstrap');
const createApp = require('./app');
const { sweepExpiredAttempts } = require('./features/attempts/attempts.service');

async function launch() {
  await connectMongo(settings.mongoUri);
  await bootstrapData();

  const app = createApp();
  const server = app.listen(settings.port, () => {
    logger.info(`TestDesk running on port ${settings.port} (${settings.env})`);
  });

  const sweeper = setInterval(async () => {
    try {
      const closed = await sweepExpiredAttempts();
      if (closed) logger.info(`Auto-submitted ${closed} expired attempt(s)`);
    } catch (err) {
      logger.error(`Auto-submit sweep failed: ${err.message}`);
    }
  }, settings.autoSubmitEverySec * 1000);

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    clearInterval(sweeper);
    server.close(async () => {
      await disconnectMongo();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

launch().catch((err) => {
  logger.error(`Could not start the server: ${err.stack || err.message}`);
  process.exit(1);
});
