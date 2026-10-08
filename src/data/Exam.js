const { Schema, model } = require('mongoose');

const EXAM_STATES = ['draft', 'published', 'closed'];

const examSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, default: '', maxlength: 2000 },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    questions: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
    questionsPerAttempt: { type: Number, default: 0, min: 0 },

    durationMinutes: { type: Number, required: true, min: 1 },
    negativeMark: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 1, min: 1 },

    status: { type: String, enum: EXAM_STATES, default: 'draft' },
    resultsPublished: { type: Boolean, default: false },
    resultsPublishedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'exams' }
);

examSchema.index({ course: 1, status: 1 });

module.exports = model('Exam', examSchema);
module.exports.EXAM_STATES = EXAM_STATES;
