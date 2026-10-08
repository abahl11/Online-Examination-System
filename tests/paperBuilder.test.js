const { shuffled, drawFromPool, buildPaper } = require('../src/engine/paperBuilder');

function seededRandom(seed = 42) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe('shuffled', () => {
  test('keeps every item and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const output = shuffled(input, seededRandom());
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...output].sort()).toEqual(input);
  });
});

describe('drawFromPool', () => {
  const pool = ['a', 'b', 'c', 'd', 'e'];

  test('draws the requested number of distinct items', () => {
    const picked = drawFromPool(pool, 3, seededRandom(7));
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
    picked.forEach((item) => expect(pool).toContain(item));
  });

  test('0 or more than the pool size returns the whole pool', () => {
    expect(drawFromPool(pool, 0)).toHaveLength(5);
    expect(drawFromPool(pool, 50)).toHaveLength(5);
  });

  test('different seeds give different papers', () => {
    const first = drawFromPool(pool, 5, seededRandom(1)).join('');
    const second = drawFromPool(pool, 5, seededRandom(99)).join('');
    expect(first).not.toBe(second);
  });
});

describe('buildPaper', () => {
  const questions = [
    { _id: 'm1', kind: 'mcq', options: [{ _id: 'o1' }, { _id: 'o2' }, { _id: 'o3' }] },
    { _id: 'm2', kind: 'mcq', options: [{ _id: 'o4' }, { _id: 'o5' }] },
    { _id: 'c1', kind: 'coding', options: [] },
  ];

  test('creates one paper item per drawn question', () => {
    const paper = buildPaper(questions, { questionsPerAttempt: 2 }, seededRandom(3));
    expect(paper).toHaveLength(2);
    paper.forEach((item) => expect(['m1', 'm2', 'c1']).toContain(item.question));
  });

  test('lists each MCQ option id in its original order', () => {
    const paper = buildPaper(questions, {}, seededRandom(5));
    const m1 = paper.find((p) => p.question === 'm1');
    expect(m1.optionOrder).toEqual(['o1', 'o2', 'o3']);
  });

  test('coding questions have no options', () => {
    const paper = buildPaper(questions, {}, seededRandom(5));
    expect(paper.find((p) => p.question === 'c1').optionOrder).toEqual([]);
  });
});
