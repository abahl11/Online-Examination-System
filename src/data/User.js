const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    isActive: { type: Boolean, default: true },
    sessionId: { type: String, default: null, select: false },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'users',
    toJSON: {
      transform(_doc, out) {
        delete out.passwordHash;
        delete out.sessionId;
        delete out.__v;
        return out;
      },
    },
  }
);

userSchema.index({ role: 1 });

userSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, 10);

userSchema.methods.passwordMatches = function passwordMatches(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

module.exports = model('User', userSchema);
