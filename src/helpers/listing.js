const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function readListParams(query = {}, { searchIn = [], sortable = [], defaultSort = '-createdAt' } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT));

  let sort = defaultSort;
  if (typeof query.sort === 'string' && query.sort.trim()) {
    const wanted = query.sort.trim();
    if (sortable.includes(wanted.replace(/^-/, ''))) sort = wanted;
  }

  const filter = {};
  const term = typeof query.search === 'string' ? query.search.trim() : '';
  if (term && searchIn.length) {
    const pattern = new RegExp(escapeRegex(term.slice(0, 100)), 'i');
    filter.$or = searchIn.map((field) => ({ [field]: pattern }));
  }

  return { page, limit, skip: (page - 1) * limit, sort, filter };
}

async function fetchPage(Model, filter, params, shape = (q) => q) {
  const [items, total] = await Promise.all([
    shape(Model.find(filter).sort(params.sort).skip(params.skip).limit(params.limit)),
    Model.countDocuments(filter),
  ]);

  return {
    items,
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      pages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

module.exports = { readListParams, fetchPage, escapeRegex };
