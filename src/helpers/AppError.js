class AppError extends Error {
  constructor(status, message, { details = null, code = null } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

module.exports = AppError;
