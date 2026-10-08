const { z, email, password, fullName } = require('../../helpers/rules');
const { ROLE_NAMES } = require('../../data/Role');

const createUserRules = z.object({
  fullName,
  email,
  password,
  role: z.enum(ROLE_NAMES),
  isActive: z.boolean().default(true),
});

const updateUserRules = z
  .object({
    fullName: fullName.optional(),
    role: z.enum(ROLE_NAMES).optional(),
    isActive: z.boolean().optional(),
    password: password.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' });

module.exports = { createUserRules, updateUserRules };
