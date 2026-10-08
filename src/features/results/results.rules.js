const { z, objectId } = require('../../helpers/rules');

const reviewRules = z.object({
  grades: z
    .array(
      z.object({
        question: objectId,
        marks: z.number().min(0, 'Marks cannot be negative').max(100),
        feedback: z.string().trim().max(1000).default(''),
      })
    )
    .min(1, 'Grade at least one answer'),
});

module.exports = { reviewRules };
