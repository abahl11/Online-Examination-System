const { z, email, password, fullName } = require('../../helpers/rules');

const registerRules = z.object({
  fullName,
  email,
  password,
});

const loginRules = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

module.exports = { registerRules, loginRules };
