const AppError = require('../helpers/AppError');

const allowRoles = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new AppError(401, 'Please sign in to continue'));
  if (!roles.includes(req.user.role)) {
    return next(new AppError(403, 'You do not have permission to do this'));
  }
  return next();
};

module.exports = allowRoles;
