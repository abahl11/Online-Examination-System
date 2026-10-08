const { Schema, model } = require('mongoose');

const ATTEMPT_STATES = ['in_progress', 'submitted', 'auto_submitted'];

const paperItemSchema = new Schema(
  {
    question: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    optionOrder: [{ type: Schema.Types.ObjectId, ref: 'Option' }],
  },
  { _id: false }
);

const answerSchema = new Schema(
  {
    question: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    selectedOption: { type: Schema.Types.ObjectId, ref: 'Option', default: null },
    codeAnswer: { type: String, default: '' },
    savedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const attemptSchema = new Schema(
  {
    exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    attemptNumber: { type: Number, required: true },
    paper: [paperItemSchema],
    answers: [answerSchema],
    startedAt: { type: Date, default: Date.now },
    deadline: { type: Date, required: true },
    submittedAt: { type: Date, default: null },
    status: { type: String, enum: ATTEMPT_STATES, default: 'in_progress' },
  },
  { timestamps: true, collection: 'student_attempts' }
);

attemptSchema.index({ student: 1, exam: 1 });
attemptSchema.index({ status: 1, deadline: 1 });
attemptSchema.index(
  { exam: 1, student: 1 },
  { unique: true, partialFilterExpression: { status: 'in_progress' }, name: 'one_live_attempt' }
);

module.exports = model('Attempt', attemptSchema);
module.exports.ATTEMPT_STATES = ATTEMPT_STATES;
