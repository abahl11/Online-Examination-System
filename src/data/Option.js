const { Schema, model } = require('mongoose');

const optionSchema = new Schema(
  {
    question: { type: Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
    text: { type: String, required: true, trim: true },
    isCorrect: { type: Boolean, default: false },
    position: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'options' }
);

module.exports = model('Option', optionSchema);
