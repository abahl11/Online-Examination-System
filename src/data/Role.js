const { Schema, model } = require('mongoose');

const ROLE_NAMES = ['admin', 'instructor', 'student'];

const roleSchema = new Schema(
  {
    name: { type: String, enum: ROLE_NAMES, required: true, unique: true },
    label: { type: String, required: true },
    description: { type: String, default: '' },
  },
  { timestamps: true, collection: 'roles' }
);

const idCache = new Map();

roleSchema.statics.idOf = async function idOf(name) {
  if (idCache.has(name)) return idCache.get(name);
  const role = await this.findOne({ name }).select('_id').lean();
  if (!role) throw new Error(`Role "${name}" has not been seeded`);
  idCache.set(name, role._id);
  return role._id;
};

const Role = model('Role', roleSchema);

module.exports = Role;
module.exports.ROLE_NAMES = ROLE_NAMES;
