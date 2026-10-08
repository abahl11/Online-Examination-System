const jwt = require('jsonwebtoken');

jest.mock('../src/data', () => ({ User: { findById: jest.fn() } }));

const { User } = require('../src/data');
const settings = require('../src/boot/settings');
const requireAuth = require('../src/middleware/requireAuth');
const allowRoles = require('../src/middleware/allowRoles');

function userLookupReturns(account) {
  User.findById.mockReturnValue({ select: () => ({ populate: () => Promise.resolve(account) }) });
}

function run(middleware, req) {
  return new Promise((resolve) => middleware(req, {}, (err) => resolve(err)));
}

const signed = (claims) => jwt.sign(claims, settings.jwtSecret, { expiresIn: '1h' });

const account = {
  _id: { toString: () => 'user-1' },
  fullName: 'Test Student',
  email: 'test@example.com',
  isActive: true,
  sessionId: 'session-A',
  role: { name: 'student' },
};

describe('requireAuth', () => {
  afterEach(() => jest.resetAllMocks());

  test('rejects a request with no token', async () => {
    const err = await run(requireAuth, { headers: {} });
    expect(err.status).toBe(401);
    expect(err.code).toBe('NO_TOKEN');
  });

  test('rejects a tampered token', async () => {
    const err = await run(requireAuth, { headers: { authorization: 'Bearer not.a.real.token' } });
    expect(err.code).toBe('TOKEN_INVALID');
  });

  test('accepts a token whose session is still current', async () => {
    userLookupReturns(account);
    const req = { headers: { authorization: `Bearer ${signed({ sub: 'user-1', sid: 'session-A' })}` } };
    const err = await run(requireAuth, req);
    expect(err).toBeUndefined();
    expect(req.user).toEqual({ id: 'user-1', fullName: 'Test Student', email: 'test@example.com', role: 'student' });
  });

  test('rejects a token from an older session (signed in elsewhere)', async () => {
    userLookupReturns({ ...account, sessionId: 'session-B' });
    const req = { headers: { authorization: `Bearer ${signed({ sub: 'user-1', sid: 'session-A' })}` } };
    const err = await run(requireAuth, req);
    expect(err.status).toBe(401);
    expect(err.code).toBe('SESSION_REPLACED');
  });

  test('rejects a deactivated account', async () => {
    userLookupReturns({ ...account, isActive: false });
    const req = { headers: { authorization: `Bearer ${signed({ sub: 'user-1', sid: 'session-A' })}` } };
    const err = await run(requireAuth, req);
    expect(err.code).toBe('ACCOUNT_UNAVAILABLE');
  });
});

describe('allowRoles', () => {
  test('lets matching roles through and blocks others with 403', async () => {
    expect(await run(allowRoles('admin', 'instructor'), { user: { role: 'instructor' } })).toBeUndefined();
    const blocked = await run(allowRoles('admin'), { user: { role: 'student' } });
    expect(blocked.status).toBe(403);
  });
});
