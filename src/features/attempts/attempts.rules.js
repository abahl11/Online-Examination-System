const { z, objectId } = require('../../helpers/rules');

const startRules = z.object({ examId: objectId });

const answerRules = z.object({
  question: objectId,
  selectedOption: objectId.nullable().optional(),
  codeAnswer: z.string().max(20000, 'Code answer is too long').optional(),
});

const submitRules = z.object({
  answers: z.array(answerRules).max(500).default([]),
  auto: z.boolean().default(false),
});

module.exports = { startRules, answerRules, submitRules };
