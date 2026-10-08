const logger = require('../boot/logger');
const settings = require('../boot/settings');

function apiNotFound(req, res) {
  res.status(404).json({ success: false, message: `No API route for ${req.method} ${req.originalUrl}` });
}

function errorTrap(err, req, res, _next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details || null;
  const code = err.code && typeof err.code === 'string' ? err.code : undefined;

  if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err.name === 'ValidationError' && err.errors) {
    status = 422;
    message = 'Please correct the highlighted fields';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    message = `That ${field} is already in use`;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body is not valid JSON';
  }

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${err.stack || err.message}`);
    if (settings.isProduction) message = 'Something went wrong on our side';
  } else {
    logger.debug(`${req.method} ${req.originalUrl} -> ${status} ${message}`);
  }

  const body = { success: false, message };
  if (code) body.code = code;
  if (details) body.details = details;
  res.status(status).json(body);
}

module.exports = { errorTrap, apiNotFound };
