const { Question, Option, Exam } = require('../../data');
const { QUESTION_KINDS } = require('../../data/Question');
const AppError = require('../../helpers/AppError');
const { reply } = require('../../helpers/http');
const { readListParams, fetchPage } = require('../../helpers/listing');
const { recordAudit } = require('../../helpers/audit');
const { ensureCourseAccess, taughtCourseIds } = require('../../helpers/courseAccess');

const withDetails = (query) => query.populate('options').populate('course', 'title code');

function saveOptions(questionId, options) {
  return Option.insertMany(
    options.map((opt, index) => ({ question: questionId, text: opt.text, isCorrect: opt.isCorrect, position: index }))
  );
}

async function loadOwnedQuestion(user, questionId) {
  const question = await Question.findById(questionId);
  if (!question) throw new AppError(404, 'Question not found');
  await ensureCourseAccess(user, question.course);
  return question;
}

async function ensureNotLocked(questionId) {
  const locked = await Exam.exists({ questions: questionId, status: { $ne: 'draft' } });
  if (locked) throw new AppError(409, 'This question is part of a published exam and can no longer be changed');
}

async function listQuestions(req, res) {
  const params = readListParams(req.query, {
    searchIn: ['prompt'],
    sortable: ['createdAt', 'marks', 'kind'],
  });
  const filter = { ...params.filter };

  if (req.query.course) {
    await ensureCourseAccess(req.user, req.query.course);
    filter.course = req.query.course;
  } else if (req.user.role === 'instructor') {
    filter.course = { $in: await taughtCourseIds(req.user.id) };
  }
  if (QUESTION_KINDS.includes(req.query.kind)) filter.kind = req.query.kind;

  const { items, meta } = await fetchPage(Question, filter, params, withDetails);
  return reply(res, items, { meta });
}

async function getQuestion(req, res) {
  await loadOwnedQuestion(req.user, req.params.id);
  return reply(res, await withDetails(Question.findById(req.params.id)));
}

async function createQuestion(req, res) {
  const { options, ...fields } = req.body;
  await ensureCourseAccess(req.user, fields.course);

  const question = await Question.create({ ...fields, author: req.user.id });
  if (question.kind === 'mcq') await saveOptions(question._id, options);

  await recordAudit(req, 'question.create', {
    entity: 'Question',
    entityId: question._id,
    details: { kind: question.kind, course: fields.course },
  });
  return reply(res, await withDetails(Question.findById(question._id)), { status: 201 });
}

async function updateQuestion(req, res) {
  const question = await loadOwnedQuestion(req.user, req.params.id);
  await ensureNotLocked(question._id);

  const { options, ...changes } = req.body;
  if (question.kind === 'mcq') delete changes.language;

  Object.assign(question, changes);
  await question.save();

  if (question.kind === 'mcq' && options) {
    await Option.deleteMany({ question: question._id });
    await saveOptions(question._id, options);
  }

  await recordAudit(req, 'question.update', { entity: 'Question', entityId: question._id });
  return reply(res, await withDetails(Question.findById(question._id)));
}

async function deleteQuestion(req, res) {
  const question = await loadOwnedQuestion(req.user, req.params.id);
  await ensureNotLocked(question._id);

  await Exam.updateMany({ questions: question._id }, { $pull: { questions: question._id } });
  await Option.deleteMany({ question: question._id });
  await question.deleteOne();

  await recordAudit(req, 'question.delete', { entity: 'Question', entityId: question._id });
  return reply(res, { message: 'Question deleted' });
}

module.exports = { listQuestions, getQuestion, createQuestion, updateQuestion, deleteQuestion };
