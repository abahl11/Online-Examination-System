const { Schema, model } = require('mongoose');

const QUESTION_KINDS = ['mcq', 'coding'];

const questionSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: QUESTION_KINDS, required: true },
    prompt: { type: String, required: true, trim: true },
    marks: { type: Number, default: 1, min: 0 },
    language: { type: String, default: 'javascript' },
  },
  {
    timestamps: true,
    collection: 'questions',
    id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

questionSchema.index({ course: 1, kind: 1 });

questionSchema.virtual('options', {
  ref: 'Option',
  localField: '_id',
  foreignField: 'question',
  options: { sort: { position: 1 } },
});

module.exports = model('Question', questionSchema);
module.exports.QUESTION_KINDS = QUESTION_KINDS;
