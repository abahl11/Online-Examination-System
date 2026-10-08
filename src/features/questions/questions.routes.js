const { Router } = require('express');
const requireAuth = require('../../middleware/requireAuth');
const allowRoles = require('../../middleware/allowRoles');
const checkInput = require('../../middleware/checkInput');
const { runAsync } = require('../../helpers/http');
const { createQuestionRules, updateQuestionRules } = require('./questions.rules');
const questions = require('./questions.handlers');

const router = Router();
router.use(requireAuth, allowRoles('instructor', 'admin'));

router.get('/', runAsync(questions.listQuestions));
router.post('/', checkInput(createQuestionRules), runAsync(questions.createQuestion));
router.get('/:id', runAsync(questions.getQuestion));
router.patch('/:id', checkInput(updateQuestionRules), runAsync(questions.updateQuestion));
router.delete('/:id', runAsync(questions.deleteQuestion));

module.exports = router;
