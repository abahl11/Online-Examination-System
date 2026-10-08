const { Exam, Question, Attempt, Result, LeaderboardEntry } = require('../../data');
const { EXAM_STATES } = require('../../data/Exam');
const AppError = require('../../helpers/AppError');
const { reply } = require('../../helpers/http');
const { readListParams, fetchPage } = require('../../helpers/listing');
const { recordAudit } = require('../../helpers/audit');
const { ensureCourseAccess, taughtCourseIds } = require('../../helpers/courseAccess');
const { closeLiveAttemptsOfExam } = require('../attempts/attempts.service');

const paperSize = (exam) =>
  exam.questionsPerAttempt > 0 ? Math.min(exam.questionsPerAttempt, exam.questions.length) : exam.questions.length;

async function loadManagedExam(user, examId) {
  const exam = await Exam.findById(examId);
  if (!exam) throw new AppError(404, 'Exam not found');
  await ensureCourseAccess(user, exam.course);
  return exam;
}

async function checkPool(questionIds, courseId) {
  const unique = [...new Set(questionIds.map(String))];
  if (!unique.length) return unique;
  const found = await Question.countDocuments({ _id: { $in: unique }, course: courseId });
  if (found !== unique.length) {
    throw new AppError(422, "Every question must come from this course's question bank");
  }
  return unique;
}


async function decorateForStudent(exams, studentId) {
  const examIds = exams.map((exam) => exam._id);
  const attempts = await Attempt.find({ exam: { $in: examIds }, student: studentId })
    .select('exam status')
    .lean();

  return exams.map((exam) => {
    const mine = attempts.filter((a) => String(a.exam) === String(exam._id));
    const live = mine.find((a) => a.status === 'in_progress');
    const { questions, ...rest } = exam;
    return {
      ...rest,
      questionCount: paperSize(exam),
      attemptsUsed: mine.length,
      attemptsLeft: Math.max(0, exam.maxAttempts - mine.length),
      liveAttemptId: live ? live._id : null,
    };
  });
}

async function listExams(req, res) {
  const params = readListParams(req.query, {
    searchIn: ['title'],
    sortable: ['title', 'createdAt', 'durationMinutes'],
  });
  const filter = { ...params.filter };
  const { role, id: userId } = req.user;

  if (role === 'student') {
    filter.status = 'published';
  } else if (EXAM_STATES.includes(req.query.status)) {
    filter.status = req.query.status;
  }

  if (req.query.course) {
    if (role !== 'student') await ensureCourseAccess(req.user, req.query.course);
    filter.course = req.query.course;
  } else if (role === 'instructor') {
    filter.course = { $in: await taughtCourseIds(userId) };
  }

  const { items, meta } = await fetchPage(Exam, filter, params, (q) =>
    q.populate('course', 'title code').populate('createdBy', 'fullName').lean()
  );

  const data =
    role === 'student'
      ? await decorateForStudent(items, userId)
      : items.map((exam) => ({ ...exam, questionCount: paperSize(exam), poolSize: exam.questions.length }));

  return reply(res, data, { meta });
}

async function getExam(req, res) {
  if (req.user.role === 'student') {
    const exam = await Exam.findById(req.params.id).populate('course', 'title code').lean();
    if (!exam || exam.status === 'draft') throw new AppError(404, 'Exam not found');
    const [decorated] = await decorateForStudent([exam], req.user.id);
    return reply(res, decorated);
  }

  const exam = await loadManagedExam(req.user, req.params.id);
  await exam.populate([
    { path: 'course', select: 'title code' },
    { path: 'questions', populate: { path: 'options' } },
  ]);
  return reply(res, exam);
}


async function createExam(req, res) {
  await ensureCourseAccess(req.user, req.body.course);
  const questions = await checkPool(req.body.questions, req.body.course);

  const exam = await Exam.create({ ...req.body, questions, createdBy: req.user.id });
  await recordAudit(req, 'exam.create', { entity: 'Exam', entityId: exam._id, details: { title: exam.title } });
  return reply(res, exam, { status: 201 });
}

async function updateExam(req, res) {
  const exam = await loadManagedExam(req.user, req.params.id);
  if (exam.status !== 'draft') {
    throw new AppError(409, 'Move the exam back to draft before editing it');
  }

  const changes = { ...req.body };
  if (changes.questions) changes.questions = await checkPool(changes.questions, exam.course);

  Object.assign(exam, changes);
  await exam.save();

  await recordAudit(req, 'exam.update', { entity: 'Exam', entityId: exam._id });
  return reply(res, exam);
}

async function deleteExam(req, res) {
  const exam = await loadManagedExam(req.user, req.params.id);
  if (await Attempt.exists({ exam: exam._id })) {
    throw new AppError(409, 'Students have already attempted this exam, so it cannot be deleted. Close it instead.');
  }

  await LeaderboardEntry.deleteMany({ exam: exam._id });
  await exam.deleteOne();
  await recordAudit(req, 'exam.delete', { entity: 'Exam', entityId: exam._id, details: { title: exam.title } });
  return reply(res, { message: 'Exam deleted' });
}


async function changeStatus(req, res) {
  const exam = await loadManagedExam(req.user, req.params.id);
  const next = req.body.status;
  if (exam.status === next) return reply(res, exam);

  if (next === 'published') {
    if (!exam.questions.length) throw new AppError(409, 'Add at least one question before publishing');
    if (exam.questionsPerAttempt > exam.questions.length) {
      throw new AppError(409, `The pool has only ${exam.questions.length} questions but each attempt needs ${exam.questionsPerAttempt}`);
    }
  }
  if (next === 'draft' && (await Attempt.exists({ exam: exam._id }))) {
    throw new AppError(409, 'Students have already attempted this exam, so it cannot go back to draft');
  }

  exam.status = next;
  await exam.save();

  let autoSubmitted = 0;
  if (next === 'closed') autoSubmitted = await closeLiveAttemptsOfExam(exam._id);

  await recordAudit(req, `exam.status_${next}`, { entity: 'Exam', entityId: exam._id, details: { autoSubmitted } });
  return reply(res, exam);
}

async function publishResults(req, res) {
  const exam = await loadManagedExam(req.user, req.params.id);
  if (exam.status !== 'closed') throw new AppError(409, 'Close the exam before publishing results');

  const pending = await Result.countDocuments({ exam: exam._id, reviewStatus: 'pending' });
  if (pending) throw new AppError(409, `${pending} result(s) still have coding answers waiting for review`);

  exam.resultsPublished = true;
  exam.resultsPublishedAt = new Date();
  await exam.save();

  await recordAudit(req, 'exam.publish_results', { entity: 'Exam', entityId: exam._id });
  return reply(res, exam);
}


async function examResults(req, res) {
  const exam = await loadManagedExam(req.user, req.params.id);
  const params = readListParams(req.query, {
    sortable: ['totalScore', 'percentage', 'createdAt', 'timeTakenSeconds'],
    defaultSort: '-createdAt',
  });
  const filter = { exam: exam._id };
  if (['auto', 'pending', 'reviewed'].includes(req.query.reviewStatus)) filter.reviewStatus = req.query.reviewStatus;

  const { items, meta } = await fetchPage(Result, filter, params, (q) =>
    q.select('-lines').populate('student', 'fullName email').populate('attempt', 'attemptNumber status')
  );
  return reply(res, items, { meta });
}

async function leaderboard(req, res) {
  let exam;
  if (req.user.role === 'student') {
    exam = await Exam.findById(req.params.id);
    if (!exam || !exam.resultsPublished) throw new AppError(403, 'The leaderboard opens once results are published');
  } else {
    exam = await loadManagedExam(req.user, req.params.id);
  }

  const params = readListParams(req.query, { defaultSort: '-bestScore timeTakenSeconds updatedAt' });
  const { items, meta } = await fetchPage(LeaderboardEntry, { exam: exam._id }, params, (q) =>
    q.populate('student', 'fullName').lean()
  );

  const ranked = items.map((row, index) => ({
    rank: params.skip + index + 1,
    student: row.student ? { _id: row.student._id, fullName: row.student.fullName } : null,
    bestScore: row.bestScore,
    bestPercentage: row.bestPercentage,
    timeTakenSeconds: row.timeTakenSeconds,
    attemptsUsed: row.attemptsUsed,
    isMe: row.student && String(row.student._id) === req.user.id,
  }));
  return reply(res, { exam: { _id: exam._id, title: exam.title }, rows: ranked }, { meta });
}

module.exports = {
  listExams,
  getExam,
  createExam,
  updateExam,
  deleteExam,
  changeStatus,
  publishResults,
  examResults,
  leaderboard,
};
