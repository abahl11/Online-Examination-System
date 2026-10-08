const { Schema, model } = require('mongoose');

const courseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 20 },
    description: { type: String, default: '', maxlength: 1000 },
    instructors: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'courses' }
);

courseSchema.index({ instructors: 1 });

module.exports = model('Course', courseSchema);
