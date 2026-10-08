const { Attempt, Result } = require('../../data');
const AppError = require('../../helpers/AppError');
const { reply } = require('../../helpers/http');
const { readListParams, fetchPage } = require('../../helpers/listing');
const { recordAudit } = require('../../helpers/audit');
const { isPastDeadline, secondsLeft } = require('../../engine/timing');
const service = require('./attempts.service');

async function loadOwnAttempt(req) {
  const attempt = await Attempt.findById(req.params.id);
  if (!attempt || String(attempt.student) !== req.user.id) throw new AppError(404, 'Attempt not found');
  return attempt;
}

async function start(req, res) {
  const attempt = await service.startAttempt(req.body.examId, req.user.id);
  await recordAudit(req, 'attempt.start', {
    entity: 'Attempt',
    entityId: attempt._id,
    details: { exam: req.body.examId, attemptNumber: attempt.attemptNumber },
  });
  return reply(res, await service.describeAttempt(attempt), { status: 201 });
}

async function show(req, res) {
  let attempt = await loadOwnAttempt(req);
  if (attempt.status === 'in_progress' && isPastDeadline(attempt.deadline, new Date(), true)) {
    await service.finalizeAttempt(attempt, 'auto');
    attempt = await Attempt.findById(attempt._id);
  }
  return reply(res, await service.describeAttempt(attempt));
}

async function answer(req, res) {
  const attempt = await loadOwnAttempt(req);
  if (attempt.status !== 'in_progress') throw new AppError(409, 'This attempt has already been submitted');

  if (isPastDeadline(attempt.deadline, new Date(), true)) {
    await service.finalizeAttempt(attempt, 'auto');
    throw new AppError(409, 'Time is up. Your attempt was submitted automatically.', { code: 'TIME_UP' });
  }

  const saved = await service.saveAnswer(attempt, req.body);
  return reply(res, { savedAt: saved.savedAt, secondsLeft: secondsLeft(attempt.deadline) });
}

async function submit(req, res) {
  const attempt = await loadOwnAttempt(req);

  if (attempt.status === 'in_progress') {
    if (!isPastDeadline(attempt.deadline, new Date(), true)) {
      for (const item of req.body.answers) await service.saveAnswer(attempt, item);
    }
    const auto = req.body.auto || isPastDeadline(attempt.deadline);
    await service.finalizeAttempt(attempt, auto ? 'auto' : 'manual');
    await recordAudit(req, auto ? 'attempt.auto_submit' : 'attempt.submit', {
      entity: 'Attempt',
      entityId: attempt._id,
    });
  }

  const [fresh, result] = await Promise.all([
    Attempt.findById(attempt._id).populate('exam', 'title resultsPublished'),
    Result.findOne({ attempt: attempt._id }).select('-lines'),
  ]);

  const published = Boolean(fresh.exam?.resultsPublished);
  return reply(res, {
    attemptId: fresh._id,
    status: fresh.status,
    submittedAt: fresh.submittedAt,
    resultId: result ? result._id : null,
    resultsPublished: published,
    score: published && result ? { total: result.totalScore, max: result.maxScore, percentage: result.percentage } : null,
  });
}

async function history(req, res) {
  const params = readListParams(req.query, {
    sortable: ['startedAt', 'submittedAt'],
    defaultSort: '-startedAt',
  });
  const filter = { student: req.user.id };
  if (req.query.exam) filter.exam = req.query.exam;

  const { items, meta } = await fetchPage(Attempt, filter, params, (q) =>
    q
      .select('-paper -answers')
      .populate({ path: 'exam', select: 'title resultsPublished course', populate: { path: 'course', select: 'code' } })
      .lean()
  );

  const results = await Result.find({ attempt: { $in: items.map((a) => a._id) } })
    .select('attempt totalScore maxScore percentage reviewStatus')
    .lean();
  const resultOf = new Map(results.map((r) => [String(r.attempt), r]));

  const rows = items.map((attempt) => {
    const result = resultOf.get(String(attempt._id));
    const visible = Boolean(attempt.exam?.resultsPublished && result);
    return {
      ...attempt,
      resultId: result ? result._id : null,
      resultsPublished: Boolean(attempt.exam?.resultsPublished),
      score: visible
        ? { total: result.totalScore, max: result.maxScore, percentage: result.percentage }
        : null,
    };
  });

  return reply(res, rows, { meta });
}

module.exports = { start, show, answer, submit, history };
