const AppError = require('../helpers/AppError');

const checkInput = (schema, source = 'body') => (req, _res, next) => {
  const outcome = schema.safeParse(req[source] ?? {});
  if (!outcome.success) {
    const details = outcome.error.issues.map((issue) => ({
      field: issue.path.join('.') || source,
      message: issue.message,
    }));
    return next(new AppError(422, 'Please correct the highlighted fields', { details }));
  }
  req[source] = outcome.data;
  return next();
};

module.exports = checkInput;
