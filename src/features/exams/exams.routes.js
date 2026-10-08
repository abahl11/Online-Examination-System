const { Router } = require('express');
const requireAuth = require('../../middleware/requireAuth');
const allowRoles = require('../../middleware/allowRoles');
const checkInput = require('../../middleware/checkInput');
const { runAsync } = require('../../helpers/http');
const { createExamRules, updateExamRules, statusRules } = require('./exams.rules');
const exams = require('./exams.handlers');

const router = Router();
router.use(requireAuth);

const staffOnly = allowRoles('instructor', 'admin');

router.get('/', runAsync(exams.listExams));
router.get('/:id', runAsync(exams.getExam));
router.get('/:id/leaderboard', runAsync(exams.leaderboard));

router.post('/', staffOnly, checkInput(createExamRules), runAsync(exams.createExam));
router.patch('/:id', staffOnly, checkInput(updateExamRules), runAsync(exams.updateExam));
router.delete('/:id', staffOnly, runAsync(exams.deleteExam));
router.patch('/:id/status', staffOnly, checkInput(statusRules), runAsync(exams.changeStatus));
router.post('/:id/publish-results', staffOnly, runAsync(exams.publishResults));
router.get('/:id/results', staffOnly, runAsync(exams.examResults));

module.exports = router;
