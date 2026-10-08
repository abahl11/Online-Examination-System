const { User, Course, Exam, Attempt, Result } = require('../../data');
const { reply } = require('../../helpers/http');
const { readListParams, fetchPage } = require('../../helpers/listing');
const { round2 } = require('../../engine/grading');

async function overview(_req, res) {
  const [usersByRole, courses, examsByStatus, attempts, liveAttempts, scoreStats] = await Promise.all([
    User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $lookup: { from: 'roles', localField: '_id', foreignField: '_id', as: 'role' } },
      { $unwind: '$role' },
      { $project: { _id: 0, role: '$role.name', count: 1 } },
    ]),
    Course.countDocuments(),
    Exam.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Attempt.countDocuments({ status: { $ne: 'in_progress' } }),
    Attempt.countDocuments({ status: 'in_progress' }),
    Result.aggregate([
      {
        $group: {
          _id: null,
          avgPercentage: { $avg: '$percentage' },
          total: { $sum: 1 },
          pendingReviews: { $sum: { $cond: [{ $eq: ['$reviewStatus', 'pending'] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const toCounts = (rows, key) => Object.fromEntries(rows.map((row) => [row[key], row.count]));
  const stats = scoreStats[0] || { avgPercentage: 0, total: 0, pendingReviews: 0 };

  return reply(res, {
    users: toCounts(usersByRole, 'role'),
    courses,
    exams: toCounts(examsByStatus, '_id'),
    attempts: { finished: attempts, running: liveAttempts },
    results: {
      graded: stats.total,
      averagePercentage: round2(stats.avgPercentage || 0),
      pendingReviews: stats.pendingReviews,
    },
  });
}

async function examPerformance(req, res) {
  const params = readListParams(req.query, {
    searchIn: ['title'],
    sortable: ['title', 'createdAt'],
  });
  const { items, meta } = await fetchPage(Exam, params.filter, params, (q) =>
    q.select('title status course resultsPublished').populate('course', 'code').lean()
  );

  const stats = await Result.aggregate([
    { $match: { exam: { $in: items.map((exam) => exam._id) } } },
    {
      $group: {
        _id: '$exam',
        attempts: { $sum: 1 },
        avgPercentage: { $avg: '$percentage' },
        highest: { $max: '$totalScore' },
        lowest: { $min: '$totalScore' },
      },
    },
  ]);
  const statsOf = new Map(stats.map((row) => [String(row._id), row]));

  const rows = items.map((exam) => {
    const s = statsOf.get(String(exam._id));
    return {
      ...exam,
      attempts: s ? s.attempts : 0,
      averagePercentage: s ? round2(s.avgPercentage) : 0,
      highestScore: s ? s.highest : 0,
      lowestScore: s ? s.lowest : 0,
    };
  });
  return reply(res, rows, { meta });
}

module.exports = { overview, examPerformance };
