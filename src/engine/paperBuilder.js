function shuffled(list, random = Math.random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function drawFromPool(pool, howMany, random = Math.random) {
  const mixed = shuffled(pool, random);
  if (!howMany || howMany >= mixed.length) return mixed;
  return mixed.slice(0, howMany);
}

function buildPaper(questions, { questionsPerAttempt = 0 } = {}, random = Math.random) {
  return drawFromPool(questions, questionsPerAttempt, random).map((q) => ({
    question: q._id,
    optionOrder: (q.options || []).map((opt) => opt._id),
  }));
}

module.exports = { shuffled, drawFromPool, buildPaper };
