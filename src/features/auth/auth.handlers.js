const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const settings = require('../../boot/settings');
const { User, Role } = require('../../data');
const AppError = require('../../helpers/AppError');
const { reply } = require('../../helpers/http');
const { recordAudit } = require('../../helpers/audit');

async function openSession(user, roleName) {
  const sessionId = crypto.randomUUID();
  await User.updateOne({ _id: user._id }, { sessionId, lastLoginAt: new Date() });

  const token = jwt.sign({ sub: user._id.toString(), sid: sessionId, role: roleName }, settings.jwtSecret, {
    expiresIn: settings.jwtTtl,
  });

  return {
    token,
    user: { id: user._id, fullName: user.fullName, email: user.email, role: roleName },
  };
}

async function register(req, res) {
  const { fullName, email, password } = req.body;

  if (await User.exists({ email })) {
    throw new AppError(409, 'An account with this email already exists');
  }

  const user = await User.create({
    fullName,
    email,
    passwordHash: await User.hashPassword(password),
    role: await Role.idOf('student'),
  });

  const session = await openSession(user, 'student');
  await recordAudit(req, 'auth.register', {
    entity: 'User',
    entityId: user._id,
    actor: { id: user._id, role: 'student' },
  });
  return reply(res, session, { status: 201 });
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash +sessionId').populate('role', 'name');

  if (!user || !(await user.passwordMatches(password))) {
    await recordAudit(req, 'auth.login_failed', { details: { email } });
    throw new AppError(401, 'Email or password is incorrect');
  }
  if (!user.isActive) {
    throw new AppError(403, 'This account has been deactivated. Please contact the administrator.');
  }

  const hadOtherSession = Boolean(user.sessionId);
  const session = await openSession(user, user.role.name);
  await recordAudit(req, 'auth.login', {
    entity: 'User',
    entityId: user._id,
    actor: { id: user._id, role: user.role.name },
    details: { endedPreviousSession: hadOtherSession },
  });
  return reply(res, session);
}

async function logout(req, res) {
  await User.updateOne({ _id: req.user.id }, { sessionId: null });
  await recordAudit(req, 'auth.logout', { entity: 'User', entityId: req.user.id });
  return reply(res, { message: 'Signed out' });
}

async function whoAmI(req, res) {
  return reply(res, req.user);
}

module.exports = { register, login, logout, whoAmI };
