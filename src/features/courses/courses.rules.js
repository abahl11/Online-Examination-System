const { z, objectId } = require('../../helpers/rules');

const courseFields = {
  title: z.string().trim().min(3, 'Title is too short').max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,20}$/, 'Use 2-20 letters, digits or dashes'),
  description: z.string().trim().max(1000).default(''),
};

const createCourseRules = z.object(courseFields);

const updateCourseRules = z
  .object({
    title: courseFields.title.optional(),
    code: courseFields.code.optional(),
    description: z.string().trim().max(1000).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' });

const assignInstructorsRules = z.object({
  instructorIds: z.array(objectId).max(20),
});

module.exports = { createCourseRules, updateCourseRules, assignInstructorsRules };
