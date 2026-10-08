const { Schema, model } = require('mongoose');

const leaderboardSchema = new Schema(
  {
    exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    bestResult: { type: Schema.Types.ObjectId, ref: 'Result' },
    bestScore: { type: Number, default: 0 },
    bestPercentage: { type: Number, default: 0 },
    timeTakenSeconds: { type: Number, default: 0 },
    attemptsUsed: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'leaderboard' }
);

leaderboardSchema.index({ exam: 1, student: 1 }, { unique: true });
leaderboardSchema.index({ exam: 1, bestScore: -1, timeTakenSeconds: 1 });

module.exports = model('LeaderboardEntry', leaderboardSchema);
