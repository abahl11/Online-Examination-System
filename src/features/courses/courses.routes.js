const { Router } = require('express');
const requireAuth = require('../../middleware/requireAuth');
const allowRoles = require('../../middleware/allowRoles');
const checkInput = require('../../middleware/checkInput');
const { runAsync } = require('../../helpers/http');
const rules = require('./courses.rules');
const courses = require('./courses.handlers');

const router = Router();
router.use(requireAuth);

const adminOnly = allowRoles('admin');

router.get('/', runAsync(courses.listCourses));
router.get('/:id', runAsync(courses.getCourse));
router.post('/', adminOnly, checkInput(rules.createCourseRules), runAsync(courses.createCourse));
router.patch('/:id', adminOnly, checkInput(rules.updateCourseRules), runAsync(courses.updateCourse));
router.delete('/:id', adminOnly, runAsync(courses.deleteCourse));
router.put(
  '/:id/instructors',
  adminOnly,
  checkInput(rules.assignInstructorsRules),
  runAsync(courses.assignInstructors)
);

module.exports = router;
