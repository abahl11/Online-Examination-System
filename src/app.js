const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const swaggerUi = require('swagger-ui-express');

const settings = require('./boot/settings');
const logger = require('./boot/logger');
const apiRoutes = require('./routes');
const openApiSpec = require('./docs/openapi');
const { errorTrap, apiNotFound } = require('./middleware/errorTrap');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: settings.corsOrigin === '*' ? '*' : settings.corsOrigin.split(',').map((o) => o.trim()),
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(mongoSanitize());

  if (!settings.isTest) {
    app.use(morgan(':method :url :status :res[content-length]b - :response-time ms', { stream: logger.httpStream }));
  }

  app.get('/api-docs.json', (_req, res) => res.json(openApiSpec));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, { customSiteTitle: 'TestDesk API Docs' }));

  app.use('/api', apiRoutes);
  app.use('/api', apiNotFound);

  app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

  app.use(errorTrap);
  return app;
}

module.exports = createApp;
