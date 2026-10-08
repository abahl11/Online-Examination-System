const jwt = require('jsonwebtoken');
const settings = require('../boot/settings');
const { User } = require('../data');
const AppError = require('../helpers/AppError');

async function requireAuth(req, _res, next) {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new AppError(401, 'Please sign in to continue', { code: 'NO_TOKEN' });
    }

    let claims;
    try {
      claims = jwt.verify(token, settings.jwtSecret);
    } catch {
      throw new AppError(401, 'Your session is invalid or has expired', { code: 'TOKEN_INVALID' });
    }

    const account = await User.findById(claims.sub).select('+sessionId').populate('role', 'name');
    if (!account || !account.isActive) {
      throw new AppError(401, 'This account is not available', { code: 'ACCOUNT_UNAVAILABLE' });
    }
    if (!account.sessionId) {
      throw new AppError(401, 'You have been signed out', { code: 'SIGNED_OUT' });
    }
    if (account.sessionId !== claims.sid) {
      throw new AppError(401, 'You were signed out because this account signed in from another device', {
        code: 'SESSION_REPLACED',
      });
    }

    req.user = {
      id: account._id.toString(),
      fullName: account.fullName,
      email: account.email,
      role: account.role.name,
    };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireAuth;
