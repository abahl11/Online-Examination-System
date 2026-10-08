const GRACE_MS = 15 * 1000;

function computeDeadline(startedAt, durationMinutes) {
  return new Date(startedAt.getTime() + durationMinutes * 60 * 1000);
}

function secondsLeft(deadline, now = new Date()) {
  return Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));
}

function isPastDeadline(deadline, now = new Date(), allowGrace = false) {
  const limit = deadline.getTime() + (allowGrace ? GRACE_MS : 0);
  return now.getTime() > limit;
}

module.exports = { GRACE_MS, computeDeadline, secondsLeft, isPastDeadline };
