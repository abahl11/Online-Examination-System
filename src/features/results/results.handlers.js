const { Result, Exam } = require('../../data');
const AppError = require('../../helpers/AppError');
const { reply } = require('../../helpers/http');
const { readListParams, fetchPage } = require('../../helpers/listing');
const { recordAudit } = require('../../helpers/audit');
const { ensureCourseAccess } = require('../../helpers/courseAccess');
const { summarise } = require('../../engine/grading');
const { writeResultPdf } = require('../../engine/resultPdf');
const { refreshStanding } = require('./standings');

async function loadVisibleResult(user, resultId) {
  const result = await Result.findById(resultId)
    .populate('student', 'fullName email')
    .populate('attempt', 'attemptNumber status startedAt submittedAt');
  if (!result) throw new AppError(404, 'Result not found');

  const exam = await Exam.findById(result.exam).populate('course', 'title code');
  if (!exam) throw new AppError(404, 'Exam not found');

  if (user.role === 'student') {
    if (String(result.student._id) !== user.id) throw new AppError(404, 'Result not found');
    if (!exam.resultsPublished) throw new AppError(403, 'Results for this exam have not been published yet');
  } else {
    await ensureCourseAccess(user, exam.course._id);
  }
  return { result, exam };
}

async function myResults(req, res) {
  const params = readListParams(req.query, {
    sortable: ['createdAt', 'totalScore', 'percentage'],
  });
  const { items, meta } = await fetchPage(Result, { student: req.user.id }, params, (q) =>
    q
      .select('-lines')
      .populate({ path: 'exam', select: 'title resultsPublished course', populate: { path: 'course', select: 'code title' } })
      .populate('attempt', 'attemptNumber')
      .lean()
  );

  const rows = items.map((row) => {
    if (row.exam?.resultsPublished) return { ...row, published: true };
    return {
      _id: row._id,
      exam: row.exam,
      attempt: row.attempt,
      createdAt: row.createdAt,
      published: false,
    };
  });
  return reply(res, rows, { meta });
}

async function showResult(req, res) {
  const { result, exam } = await loadVisibleResult(req.user, req.params.id);
  const body = result.toObject();
  body.exam = {
    _id: exam._id,
    title: exam.title,
    course: exam.course,
    negativeMark: exam.negativeMark,
    resultsPublished: exam.resultsPublished,
  };
  return reply(res, body);
}

async function downloadResult(req, res) {
  const { result, exam } = await loadVisibleResult(req.user, req.params.id);
  const safeTitle = exam.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="result-${safeTitle}-attempt-${result.attempt.attemptNumber}.pdf"`);

  writeResultPdf(res, {
    result,
    exam,
    course: exam.course,
    student: result.student,
    attemptNumber: result.attempt.attemptNumber,
  });
  await recordAudit(req, 'result.download', { entity: 'Result', entityId: result._id });
}

async function reviewResult(req, res) {
  const { result, exam } = await loadVisibleResult(req.user, req.params.id);

  for (const grade of req.body.grades) {
    const line = result.lines.find((l) => String(l.question) === grade.question);
    if (!line || line.kind !== 'coding') {
      throw new AppError(422, 'Only coding answers on this result can be reviewed');
    }
    if (line.outcome === 'unanswered') throw new AppError(422, 'An unanswered question cannot be graded');
    if (grade.marks > line.maxMarks) {
      throw new AppError(422, `Marks for a question cannot exceed ${line.maxMarks}`);
    }
    line.marksAwarded = grade.marks;
    line.feedback = grade.feedback;
    line.outcome = 'reviewed';
  }

  Object.assign(result, summarise(result.lines));
  result.markModified('lines');
  await result.save();
  await refreshStanding(result.exam, result.student._id);

  await recordAudit(req, 'result.review', {
    entity: 'Result',
    entityId: result._id,
    details: { graded: req.body.grades.length, totalScore: result.totalScore },
  });
  return reply(res, result);
}

module.exports = { myResults, showResult, downloadResult, reviewResult };
