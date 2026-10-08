const { Router } = require('express');
const requireAuth = require('../../middleware/requireAuth');
const allowRoles = require('../../middleware/allowRoles');
const { runAsync } = require('../../helpers/http');
const { listAuditLogs } = require('./audit.handlers');

const router = Router();
router.get('/', requireAuth, allowRoles('admin'), runAsync(listAuditLogs));

module.exports = router;
