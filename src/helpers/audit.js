const { AuditLog } = require('../data');
const logger = require('../boot/logger');

async function recordAudit(req, action, { entity = null, entityId = null, details = {}, actor = null } = {}) {
  try {
    const who = actor || req.user || null;
    await AuditLog.create({
      actor: who ? who.id || who._id : null,
      actorRole: who ? who.role?.name || who.role || 'guest' : 'guest',
      action,
      entity,
      entityId,
      details,
      ip: req.ip || '',
      userAgent: (req.get && req.get('user-agent')) || '',
    });
  } catch (err) {
    logger.error(`Audit write failed for "${action}": ${err.message}`);
  }
}

module.exports = { recordAudit };
