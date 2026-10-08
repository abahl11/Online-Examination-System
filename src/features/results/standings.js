const { Result, Attempt, LeaderboardEntry } = require('../../data');

async function refreshStanding(examId, studentId) {
  const [best, attemptsUsed] = await Promise.all([
    Result.findOne({ exam: examId, student: studentId }).sort({ totalScore: -1, timeTakenSeconds: 1 }),
    Attempt.countDocuments({ exam: examId, student: studentId, status: { $ne: 'in_progress' } }),
  ]);
  if (!best) return null;

  return LeaderboardEntry.findOneAndUpdate(
    { exam: examId, student: studentId },
    {
      bestResult: best._id,
      bestScore: best.totalScore,
      bestPercentage: best.percentage,
      timeTakenSeconds: best.timeTakenSeconds,
      attemptsUsed,
    },
    { upsert: true, new: true }
  );
}

module.exports = { refreshStanding };
