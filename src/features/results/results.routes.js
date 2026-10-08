const { Router } = require('express');
const requireAuth = require('../../middleware/requireAuth');
const allowRoles = require('../../middleware/allowRoles');
const checkInput = require('../../middleware/checkInput');
const { runAsync } = require('../../helpers/http');
const { reviewRules } = require('./results.rules');
const results = require('./results.handlers');

const router = Router();
router.use(requireAuth);

router.get('/mine', allowRoles('student'), runAsync(results.myResults));
router.get('/:id', runAsync(results.showResult));
router.get('/:id/pdf', runAsync(results.downloadResult));
router.patch('/:id/review', allowRoles('instructor', 'admin'), checkInput(reviewRules), runAsync(results.reviewResult));

module.exports = router;
