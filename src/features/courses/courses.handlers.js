const { Course, User, Role, Exam, Question } = require('../../data');
const AppError = require('../../helpers/AppError');
const { reply } = require('../../helpers/http');
const { readListParams, fetchPage } = require('../../helpers/listing');
const { recordAudit } = require('../../helpers/audit');

const withInstructors = (query) => query.populate('instructors', 'fullName email');

async function listCourses(req, res) {
  const params = readListParams(req.query, {
    searchIn: ['title', 'code'],
    sortable: ['title', 'code', 'createdAt'],
    defaultSort: 'title',
  });
  const filter = { ...params.filter };
  if (req.user.role === 'instructor') filter.instructors = req.user.id;

  const { items, meta } = await fetchPage(Course, filter, params, withInstructors);
  return reply(res, items, { meta });
}

async function getCourse(req, res) {
  const course = await withInstructors(Course.findById(req.params.id));
  if (!course) throw new AppError(404, 'Course not found');
  return reply(res, course);
}

async function createCourse(req, res) {
  const course = await Course.create({ ...req.body, createdBy: req.user.id });
  await recordAudit(req, 'course.create', { entity: 'Course', entityId: course._id, details: { code: course.code } });
  return reply(res, course, { status: 201 });
}

async function updateCourse(req, res) {
  const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!course) throw new AppError(404, 'Course not found');
  await recordAudit(req, 'course.update', { entity: 'Course', entityId: course._id, details: req.body });
  return reply(res, await withInstructors(Course.findById(course._id)));
}

async function deleteCourse(req, res) {
  const course = await Course.findById(req.params.id);
  if (!course) throw new AppError(404, 'Course not found');

  const [hasExams, hasQuestions] = await Promise.all([
    Exam.exists({ course: course._id }),
    Question.exists({ course: course._id }),
  ]);
  if (hasExams || hasQuestions) {
    throw new AppError(409, 'Remove the exams and questions of this course before deleting it');
  }

  await course.deleteOne();
  await recordAudit(req, 'course.delete', { entity: 'Course', entityId: course._id, details: { code: course.code } });
  return reply(res, { message: 'Course deleted' });
}

async function assignInstructors(req, res) {
  const course = await Course.findById(req.params.id);
  if (!course) throw new AppError(404, 'Course not found');

  const uniqueIds = [...new Set(req.body.instructorIds)];
  const instructorRole = await Role.idOf('instructor');
  const validCount = await User.countDocuments({ _id: { $in: uniqueIds }, role: instructorRole, isActive: true });
  if (validCount !== uniqueIds.length) {
    throw new AppError(422, 'Every selected user must be an active instructor');
  }

  course.instructors = uniqueIds;
  await course.save();
  await recordAudit(req, 'course.assign_instructors', {
    entity: 'Course',
    entityId: course._id,
    details: { instructorIds: uniqueIds },
  });
  return reply(res, await withInstructors(Course.findById(course._id)));
}

module.exports = { listCourses, getCourse, createCourse, updateCourse, deleteCourse, assignInstructors };
