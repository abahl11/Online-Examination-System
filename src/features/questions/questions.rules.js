const { z, objectId } = require('../../helpers/rules');

const optionRule = z.object({
  text: z.string().trim().min(1, 'Option text is required').max(500),
  isCorrect: z.boolean().default(false),
});
const optionList = z.array(optionRule).min(2, 'Add at least two options').max(8, 'Up to 8 options allowed');

const shared = {
  course: objectId,
  prompt: z.string().trim().min(5, 'Question text is too short').max(5000),
  marks: z.number().positive('Marks must be above 0').max(100).default(1),
};

const exactlyOneCorrect = (body, ctx) => {
  if (!body.options) return;
  const correct = body.options.filter((opt) => opt.isCorrect).length;
  if (correct !== 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'Mark exactly one option as correct' });
  }
};

const createQuestionRules = z
  .discriminatedUnion('kind', [
    z.object({ ...shared, kind: z.literal('mcq'), options: optionList }),
    z.object({ ...shared, kind: z.literal('coding'), language: z.string().trim().max(30).default('javascript') }),
  ])
  .superRefine(exactlyOneCorrect);

const updateQuestionRules = z
  .object({
    prompt: shared.prompt.optional(),
    marks: z.number().positive().max(100).optional(),
    options: optionList.optional(),
    language: z.string().trim().max(30).optional(),
  })
  .superRefine(exactlyOneCorrect)
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' });

module.exports = { createQuestionRules, updateQuestionRules };
