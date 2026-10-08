const { readListParams } = require('../src/helpers/listing');

describe('readListParams', () => {
  test('falls back to sensible defaults', () => {
    const params = readListParams({});
    expect(params).toMatchObject({ page: 1, limit: 10, skip: 0, sort: '-createdAt', filter: {} });
  });

  test('computes skip from page and caps the limit', () => {
    const params = readListParams({ page: '3', limit: '500' });
    expect(params.limit).toBe(100);
    expect(params.skip).toBe(200);
  });

  test('only accepts whitelisted sort fields', () => {
    expect(readListParams({ sort: '-title' }, { sortable: ['title'] }).sort).toBe('-title');
    expect(readListParams({ sort: 'passwordHash' }, { sortable: ['title'] }).sort).toBe('-createdAt');
  });

  test('builds a case-insensitive OR search with regex characters escaped', () => {
    const { filter } = readListParams({ search: 'c++ (basics)' }, { searchIn: ['title', 'code'] });
    expect(filter.$or).toHaveLength(2);
    const pattern = filter.$or[0].title;
    expect(pattern.flags).toContain('i');
    expect(pattern.test('Intro to C++ (basics)')).toBe(true);
  });

  test('ignores non-string search input such as objects', () => {
    const { filter } = readListParams({ search: { $ne: null } }, { searchIn: ['title'] });
    expect(filter).toEqual({});
  });
});
