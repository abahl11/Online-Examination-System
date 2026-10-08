const { Course } = require('../data');
const AppError = require('./AppError');

async function ensureCourseAccess(user, courseId) {
  const course = await Course.findById(courseId);
  if (!course) throw new AppError(404, 'Course not found');

  if (user.role === 'admin') return course;

  const assigned = course.instructors.some((id) => id.toString() === user.id);
  if (user.role === 'instructor' && assigned) return course;

  throw new AppError(403, 'You are not assigned to this course');
}

async function taughtCourseIds(userId) {
  const rows = await Course.find({ instructors: userId }).select('_id').lean();
  return rows.map((row) => row._id);
}

module.exports = { ensureCourseAccess, taughtCourseIds };
