const { Router } = require('express');
const requireAuth = require('../../middleware/requireAuth');
const allowRoles = require('../../middleware/allowRoles');
const checkInput = require('../../middleware/checkInput');
const { runAsync } = require('../../helpers/http');
const { startRules, answerRules, submitRules } = require('./attempts.rules');
const attempts = require('./attempts.handlers');

const router = Router();
router.use(requireAuth, allowRoles('student'));

router.post('/', checkInput(startRules), runAsync(attempts.start));
router.get('/mine', runAsync(attempts.history));
router.get('/:id', runAsync(attempts.show));
router.put('/:id/answers', checkInput(answerRules), runAsync(attempts.answer));
router.post('/:id/submit', checkInput(submitRules), runAsync(attempts.submit));

module.exports = router;
