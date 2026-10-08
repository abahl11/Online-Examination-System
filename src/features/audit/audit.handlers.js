const { AuditLog } = require('../../data');
const { reply } = require('../../helpers/http');
const { readListParams, fetchPage, escapeRegex } = require('../../helpers/listing');

async function listAuditLogs(req, res) {
  const params = readListParams(req.query, {
    searchIn: ['action', 'entity', 'actorRole', 'ip'],
    sortable: ['createdAt', 'action'],
  });
  const filter = { ...params.filter };

  if (typeof req.query.action === 'string' && req.query.action.trim()) {
    filter.action = new RegExp(`^${escapeRegex(req.query.action.trim())}`);
  }
  if (typeof req.query.entity === 'string' && req.query.entity) filter.entity = req.query.entity;
  if (typeof req.query.actor === 'string' && req.query.actor) filter.actor = req.query.actor;

  const { items, meta } = await fetchPage(AuditLog, filter, params, (q) => q.populate('actor', 'fullName email'));
  return reply(res, items, { meta });
}

module.exports = { listAuditLogs };
