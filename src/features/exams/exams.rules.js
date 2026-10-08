const { z, objectId } = require('../../helpers/rules');
const { EXAM_STATES } = require('../../data/Exam');

const examFields = {
  title: z.string().trim().min(3, 'Title is too short').max(150),
  description: z.string().trim().max(2000).default(''),
  questions: z.array(objectId).max(500).default([]),
  questionsPerAttempt: z.number().int().min(0).max(500).default(0),
  durationMinutes: z.number().int().min(1, 'Duration must be at least 1 minute').max(600),
  negativeMark: z.number().min(0).max(10).default(0),
  maxAttempts: z.number().int().min(1).max(10).default(1),
};

const createExamRules = z.object({ ...examFields, course: objectId });

const updateExamRules = z
  .object(examFields)
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' });

const statusRules = z.object({ status: z.enum(EXAM_STATES) });

module.exports = { createExamRules, updateExamRules, statusRules };
