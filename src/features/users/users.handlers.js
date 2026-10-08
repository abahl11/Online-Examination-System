const { User, Role, Course, Attempt, Question } = require('../../data');
const { ROLE_NAMES } = require('../../data/Role');
const AppError = require('../../helpers/AppError');
const { reply } = require('../../helpers/http');
const { readListParams, fetchPage } = require('../../helpers/listing');
const { recordAudit } = require('../../helpers/audit');

async function listUsers(req, res) {
  const params = readListParams(req.query, {
    searchIn: ['fullName', 'email'],
    sortable: ['fullName', 'email', 'createdAt', 'lastLoginAt'],
  });
  const filter = { ...params.filter };

  if (ROLE_NAMES.includes(req.query.role)) filter.role = await Role.idOf(req.query.role);
  if (req.query.isActive === 'true' || req.query.isActive === 'false') {
    filter.isActive = req.query.isActive === 'true';
  }

  const { items, meta } = await fetchPage(User, filter, params, (q) => q.populate('role', 'name label'));
  return reply(res, items, { meta });
}

async function getUser(req, res) {
  const user = await User.findById(req.params.id).populate('role', 'name label');
  if (!user) throw new AppError(404, 'User not found');
  return reply(res, user);
}

async function createUser(req, res) {
  const { fullName, email, password, role, isActive } = req.body;
  if (await User.exists({ email })) throw new AppError(409, 'An account with this email already exists');

  const user = await User.create({
    fullName,
    email,
    isActive,
    passwordHash: await User.hashPassword(password),
    role: await Role.idOf(role),
  });

  await recordAudit(req, 'user.create', { entity: 'User', entityId: user._id, details: { email, role } });
  await user.populate('role', 'name label');
  return reply(res, user, { status: 201 });
}

async function updateUser(req, res) {
  const user = await User.findById(req.params.id).populate('role', 'name');
  if (!user) throw new AppError(404, 'User not found');

  const changes = req.body;
  const editingSelf = user._id.toString() === req.user.id;
  if (editingSelf && (changes.isActive === false || (changes.role && changes.role !== 'admin'))) {
    throw new AppError(400, 'You cannot deactivate or demote your own account');
  }

  if (changes.fullName) user.fullName = changes.fullName;
  if (changes.role) user.role = await Role.idOf(changes.role);
  if (typeof changes.isActive === 'boolean') user.isActive = changes.isActive;
  if (changes.password) user.passwordHash = await User.hashPassword(changes.password);

  if (changes.isActive === false || changes.role || changes.password) user.sessionId = null;

  await user.save();
  await recordAudit(req, 'user.update', {
    entity: 'User',
    entityId: user._id,
    details: { ...changes, password: changes.password ? '[reset]' : undefined },
  });
  await user.populate('role', 'name label');
  return reply(res, user);
}

async function deleteUser(req, res) {
  if (req.params.id === req.user.id) throw new AppError(400, 'You cannot delete your own account');

  const user = await User.findById(req.params.id);
  if (!user) throw new AppError(404, 'User not found');

  const [hasAttempts, hasQuestions] = await Promise.all([
    Attempt.exists({ student: user._id }),
    Question.exists({ author: user._id }),
  ]);
  if (hasAttempts || hasQuestions) {
    throw new AppError(409, 'This user has exam history. Deactivate the account instead of deleting it.');
  }

  await Course.updateMany({ instructors: user._id }, { $pull: { instructors: user._id } });
  await user.deleteOne();
  await recordAudit(req, 'user.delete', { entity: 'User', entityId: user._id, details: { email: user.email } });
  return reply(res, { message: 'User deleted' });
}

async function listRoles(_req, res) {
  const roles = await Role.find().sort('name');
  return reply(res, roles);
}

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser, listRoles };
