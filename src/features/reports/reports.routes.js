const { Router } = require('express');
const requireAuth = require('../../middleware/requireAuth');
const allowRoles = require('../../middleware/allowRoles');
const { runAsync } = require('../../helpers/http');
const reports = require('./reports.handlers');

const router = Router();
router.use(requireAuth, allowRoles('admin'));

router.get('/overview', runAsync(reports.overview));
router.get('/exams', runAsync(reports.examPerformance));

module.exports = router;
