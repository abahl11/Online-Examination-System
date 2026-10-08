const { Schema, model } = require('mongoose');

const markLineSchema = new Schema(
  {
    question: { type: Schema.Types.ObjectId, ref: 'Question' },
    kind: { type: String, enum: ['mcq', 'coding'] },
    prompt: String,
    maxMarks: Number,
    marksAwarded: { type: Number, default: 0 },
    outcome: { type: String, enum: ['correct', 'wrong', 'unanswered', 'pending', 'reviewed'] },
    selectedOption: { type: Schema.Types.ObjectId, default: null },
    selectedText: { type: String, default: '' },
    correctText: { type: String, default: '' },
    codeAnswer: { type: String, default: '' },
    feedback: { type: String, default: '' },
  },
  { _id: false }
);

const resultSchema = new Schema(
  {
    attempt: { type: Schema.Types.ObjectId, ref: 'Attempt', required: true, unique: true },
    exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    maxScore: { type: Number, default: 0 },
    mcqScore: { type: Number, default: 0 },
    codingScore: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },

    correctCount: { type: Number, default: 0 },
    wrongCount: { type: Number, default: 0 },
    unansweredCount: { type: Number, default: 0 },
    timeTakenSeconds: { type: Number, default: 0 },

    reviewStatus: { type: String, enum: ['auto', 'pending', 'reviewed'], default: 'auto' },
    lines: [markLineSchema],
  },
  { timestamps: true, collection: 'results' }
);

resultSchema.index({ exam: 1, totalScore: -1 });
resultSchema.index({ student: 1, createdAt: -1 });

module.exports = model('Result', resultSchema);
