const { markPaper, summarise } = require('../src/engine/grading');

const paper = [
  {
    _id: 'q1',
    kind: 'mcq',
    prompt: '2 + 2 = ?',
    marks: 2,
    options: [
      { _id: 'a', text: '3', isCorrect: false },
      { _id: 'b', text: '4', isCorrect: true },
    ],
  },
  {
    _id: 'q2',
    kind: 'mcq',
    prompt: 'Capital of France?',
    marks: 2,
    options: [
      { _id: 'c', text: 'Paris', isCorrect: true },
      { _id: 'd', text: 'Rome', isCorrect: false },
    ],
  },
  { _id: 'q3', kind: 'coding', prompt: 'Reverse a string', marks: 5, options: [] },
];

describe('markPaper', () => {
  test('awards marks for a correct MCQ and records the chosen text', () => {
    const [line] = markPaper(paper, [{ question: 'q1', selectedOption: 'b' }]);
    expect(line.outcome).toBe('correct');
    expect(line.marksAwarded).toBe(2);
    expect(line.selectedText).toBe('4');
    expect(line.correctText).toBe('4');
  });

  test('applies negative marking to a wrong MCQ', () => {
    const lines = markPaper(paper, [{ question: 'q2', selectedOption: 'd' }], 0.5);
    expect(lines[1].outcome).toBe('wrong');
    expect(lines[1].marksAwarded).toBe(-0.5);
  });

  test('blank answers score zero and never get a penalty', () => {
    const lines = markPaper(paper, [], 1);
    expect(lines.map((l) => l.outcome)).toEqual(['unanswered', 'unanswered', 'unanswered']);
    expect(lines.every((l) => l.marksAwarded === 0)).toBe(true);
  });

  test('a written coding answer waits for review', () => {
    const lines = markPaper(paper, [{ question: 'q3', codeAnswer: 'const r = (s) => [...s].reverse().join("")' }]);
    expect(lines[2].outcome).toBe('pending');
    expect(lines[2].marksAwarded).toBe(0);
  });

  test('a whitespace-only coding answer counts as unanswered', () => {
    const lines = markPaper(paper, [{ question: 'q3', codeAnswer: '   \n ' }]);
    expect(lines[2].outcome).toBe('unanswered');
  });
});

describe('summarise', () => {
  test('adds up scores, counts and percentage', () => {
    const lines = markPaper(
      paper,
      [
        { question: 'q1', selectedOption: 'b' },
        { question: 'q2', selectedOption: 'd' },
      ],
      0.5
    );
    const summary = summarise(lines);

    expect(summary.maxScore).toBe(9);
    expect(summary.mcqScore).toBe(1.5);
    expect(summary.totalScore).toBe(1.5);
    expect(summary.percentage).toBe(16.67);
    expect(summary).toMatchObject({ correctCount: 1, wrongCount: 1, unansweredCount: 1, reviewStatus: 'auto' });
  });

  test('total score is never negative', () => {
    const lines = markPaper(paper, [{ question: 'q1', selectedOption: 'a' }, { question: 'q2', selectedOption: 'd' }], 3);
    expect(summarise(lines).totalScore).toBe(0);
  });

  test('pending coding answers mark the result for review, reviewed ones count', () => {
    const lines = markPaper(paper, [{ question: 'q3', codeAnswer: 'code' }]);
    expect(summarise(lines).reviewStatus).toBe('pending');

    lines[2].outcome = 'reviewed';
    lines[2].marksAwarded = 4;
    const after = summarise(lines);
    expect(after.reviewStatus).toBe('reviewed');
    expect(after.codingScore).toBe(4);
    expect(after.totalScore).toBe(4);
    expect(after.percentage).toBe(44.44);
  });
});
