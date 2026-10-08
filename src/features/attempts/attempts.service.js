const { Exam, Question, Attempt, Result } = require('../../data');
const AppError = require('../../helpers/AppError');
const logger = require('../../boot/logger');
const { buildPaper } = require('../../engine/paperBuilder');
const { markPaper, summarise } = require('../../engine/grading');
const { computeDeadline, secondsLeft, isPastDeadline, GRACE_MS } = require('../../engine/timing');
const { refreshStanding } = require('../results/standings');

async function loadQuestionMap(questionIds) {
  const questions = await Question.find({ _id: { $in: questionIds } })
    .populate('options')
    .lean();
  return new Map(questions.map((q) => [String(q._id), q]));
}


async function finalizeAttempt(attempt, mode = 'manual') {
  const endedAt = new Date(Math.min(Date.now(), attempt.deadline.getTime()));

  const locked = await Attempt.findOneAndUpdate(
    { _id: attempt._id, status: 'in_progress' },
    { status: mode === 'auto' ? 'auto_submitted' : 'submitted', submittedAt: endedAt },
    { new: true }
  );
  if (!locked) return Result.findOne({ attempt: attempt._id });

  const exam = await Exam.findById(locked.exam);
  const questionMap = await loadQuestionMap(locked.paper.map((item) => item.question));
  const paper = locked.paper.map((item) => questionMap.get(String(item.question))).filter(Boolean);

  const lines = markPaper(paper, locked.answers, exam.negativeMark);
  const summary = summarise(lines);

  const result = await Result.create({
    attempt: locked._id,
    exam: locked.exam,
    student: locked.student,
    ...summary,
    lines,
    timeTakenSeconds: Math.round((endedAt - locked.startedAt) / 1000),
  });

  await refreshStanding(locked.exam, locked.student);
  logger.info(`Attempt ${locked._id} ${locked.status} -> ${summary.totalScore}/${summary.maxScore}`);
  return result;
}

async function sweepExpiredAttempts() {
  const overdue = await Attempt.find({
    status: 'in_progress',
    deadline: { $lt: new Date(Date.now() - GRACE_MS) },
  }).limit(200);

  for (const attempt of overdue) {
    try {
      await finalizeAttempt(attempt, 'auto');
    } catch (err) {
      logger.error(`Auto-submit failed for attempt ${attempt._id}: ${err.message}`);
    }
  }
  return overdue.length;
}

async function closeLiveAttemptsOfExam(examId) {
  const live = await Attempt.find({ exam: examId, status: 'in_progress' });
  for (const attempt of live) await finalizeAttempt(attempt, 'auto');
  return live.length;
}


async function startAttempt(examId, studentId) {
  const exam = await Exam.findById(examId);
  if (!exam || exam.status !== 'published') throw new AppError(404, 'This exam is not available');

  const live = await Attempt.findOne({ exam: exam._id, student: studentId, status: 'in_progress' });
  if (live) {
    if (!isPastDeadline(live.deadline)) return live;
    await finalizeAttempt(live, 'auto');
  }

  const used = await Attempt.countDocuments({ exam: exam._id, student: studentId });
  if (used >= exam.maxAttempts) {
    throw new AppError(409, `You have used all ${exam.maxAttempts} attempt(s) for this exam`);
  }

  const pool = [...(await loadQuestionMap(exam.questions)).values()];
  if (!pool.length) throw new AppError(409, 'This exam has no questions yet');

  const startedAt = new Date();
  try {
    return await Attempt.create({
      exam: exam._id,
      student: studentId,
      attemptNumber: used + 1,
      paper: buildPaper(pool, exam),
      startedAt,
      deadline: computeDeadline(startedAt, exam.durationMinutes),
    });
  } catch (err) {
    if (err.code === 11000) return Attempt.findOne({ exam: exam._id, student: studentId, status: 'in_progress' });
    throw err;
  }
}

async function describeAttempt(attempt) {
  const [exam, questionMap] = await Promise.all([
    Exam.findById(attempt.exam).select('title durationMinutes negativeMark course').populate('course', 'title code'),
    loadQuestionMap(attempt.paper.map((item) => item.question)),
  ]);
  const answerFor = new Map(attempt.answers.map((a) => [String(a.question), a]));

  const questions = attempt.paper
    .map((item, index) => {
      const q = questionMap.get(String(item.question));
      if (!q) return null;
      const saved = answerFor.get(String(q._id));
      const optionText = new Map((q.options || []).map((opt) => [String(opt._id), opt.text]));

      return {
        _id: q._id,
        number: index + 1,
        kind: q.kind,
        prompt: q.prompt,
        marks: q.marks,
        language: q.kind === 'coding' ? q.language : undefined,
        options: item.optionOrder.map((id) => ({ _id: id, text: optionText.get(String(id)) || '' })),
        answer: saved ? { selectedOption: saved.selectedOption, codeAnswer: saved.codeAnswer } : null,
      };
    })
    .filter(Boolean);

  return {
    _id: attempt._id,
    exam,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    startedAt: attempt.startedAt,
    deadline: attempt.deadline,
    submittedAt: attempt.submittedAt,
    secondsLeft: attempt.status === 'in_progress' ? secondsLeft(attempt.deadline) : 0,
    questions,
  };
}

async function saveAnswer(attempt, { question, selectedOption, codeAnswer }) {
  const item = attempt.paper.find((p) => String(p.question) === String(question));
  if (!item) throw new AppError(422, 'That question is not part of this attempt');

  const isMcq = item.optionOrder.length > 0;
  const entry = { question: item.question, selectedOption: null, codeAnswer: '', savedAt: new Date() };

  if (isMcq) {
    if (selectedOption && !item.optionOrder.some((id) => String(id) === String(selectedOption))) {
      throw new AppError(422, 'That option does not belong to this question');
    }
    entry.selectedOption = selectedOption || null;
  } else {
    entry.codeAnswer = codeAnswer || '';
  }

  const updated = await Attempt.updateOne(
    { _id: attempt._id, status: 'in_progress', 'answers.question': item.question },
    { $set: { 'answers.$': entry } }
  );
  if (updated.matchedCount === 0) {
    const pushed = await Attempt.updateOne(
      { _id: attempt._id, status: 'in_progress', 'answers.question': { $ne: item.question } },
      { $push: { answers: entry } }
    );
    if (pushed.matchedCount === 0) throw new AppError(409, 'This attempt has already been submitted');
  }
  return entry;
}

module.exports = {
  startAttempt,
  describeAttempt,
  saveAnswer,
  finalizeAttempt,
  sweepExpiredAttempts,
  closeLiveAttemptsOfExam,
};
