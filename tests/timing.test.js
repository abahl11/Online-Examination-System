const { computeDeadline, secondsLeft, isPastDeadline, GRACE_MS } = require('../src/engine/timing');

const start = new Date('2026-03-01T10:00:00Z');

describe('computeDeadline', () => {
  test('adds the exam duration to the start time', () => {
    expect(computeDeadline(start, 30).toISOString()).toBe('2026-03-01T10:30:00.000Z');
  });
});

describe('secondsLeft / isPastDeadline', () => {
  const deadline = new Date('2026-03-01T10:30:00Z');

  test('counts down and never goes below zero', () => {
    expect(secondsLeft(deadline, new Date('2026-03-01T10:29:00Z'))).toBe(60);
    expect(secondsLeft(deadline, new Date('2026-03-01T11:00:00Z'))).toBe(0);
  });

  test('is not past the deadline before time is up', () => {
    expect(isPastDeadline(deadline, new Date('2026-03-01T10:29:59Z'))).toBe(false);
  });

  test('grace period lets a late auto-submit through', () => {
    const justAfter = new Date(deadline.getTime() + GRACE_MS - 1000);
    expect(isPastDeadline(deadline, justAfter)).toBe(true);
    expect(isPastDeadline(deadline, justAfter, true)).toBe(false);
  });
});
