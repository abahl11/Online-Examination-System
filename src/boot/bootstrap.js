const { Role, User } = require('../data');
const settings = require('./settings');
const logger = require('./logger');
const { loadDemoData } = require('./demoData');

const DEFAULT_ROLES = [
  { name: 'admin', label: 'Administrator', description: 'Manages users, courses, instructors and reports' },
  { name: 'instructor', label: 'Instructor', description: 'Builds question banks and exams, publishes results' },
  { name: 'student', label: 'Student', description: 'Takes exams and views their scores' },
];

async function ensureRoles() {
  await Promise.all(
    DEFAULT_ROLES.map((role) => Role.updateOne({ name: role.name }, { $setOnInsert: role }, { upsert: true }))
  );
}

async function ensureFirstAdmin() {
  const adminRoleId = await Role.idOf('admin');
  const existing = await User.findOne({ role: adminRoleId });
  if (existing) return existing;

  const { fullName, email, password } = settings.firstAdmin;
  const admin = await User.create({
    fullName,
    email,
    passwordHash: await User.hashPassword(password),
    role: adminRoleId,
  });

  logger.info(`Created first admin account: ${email}`);
  if (settings.isProduction && !process.env.ADMIN_PASSWORD) {
    logger.warn('The admin is using the default password. Set ADMIN_PASSWORD to choose your own.');
  }
  return admin;
}

async function bootstrapData() {
  await ensureRoles();
  const admin = await ensureFirstAdmin();
  await loadDemoData(admin);
}

module.exports = { bootstrapData, ensureRoles };
