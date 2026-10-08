const { createQuestionRules } = require('../src/features/questions/questions.rules');
const { createExamRules } = require('../src/features/exams/exams.rules');
const { registerRules } = require('../src/features/auth/auth.rules');

const courseId = '64b7f0c2a1b2c3d4e5f60718';

describe('question validation', () => {
  const mcq = {
    course: courseId,
    kind: 'mcq',
    prompt: 'Pick the even number',
    options: [
      { text: '3', isCorrect: false },
      { text: '4', isCorrect: true },
    ],
  };

  test('accepts a valid MCQ and fills defaults', () => {
    const parsed = createQuestionRules.parse(mcq);
    expect(parsed.marks).toBe(1);
  });

  test('rejects an MCQ without exactly one correct option', () => {
    const none = { ...mcq, options: mcq.options.map((o) => ({ ...o, isCorrect: false })) };
    const two = { ...mcq, options: mcq.options.map((o) => ({ ...o, isCorrect: true })) };
    expect(createQuestionRules.safeParse(none).success).toBe(false);
    expect(createQuestionRules.safeParse(two).success).toBe(false);
  });

  test('accepts a coding question without options', () => {
    const parsed = createQuestionRules.parse({ course: courseId, kind: 'coding', prompt: 'Write FizzBuzz' });
    expect(parsed.language).toBe('javascript');
  });

  test('rejects an unknown question kind', () => {
    expect(createQuestionRules.safeParse({ ...mcq, kind: 'essay' }).success).toBe(false);
  });
});

describe('exam validation', () => {
  const base = { title: 'Quiz 1', course: courseId, durationMinutes: 20 };

  test('applies defaults', () => {
    const parsed = createExamRules.parse(base);
    expect(parsed).toMatchObject({ maxAttempts: 1, negativeMark: 0, questionsPerAttempt: 0, questions: [] });
  });

  test('rejects a negative mark below zero', () => {
    const result = createExamRules.safeParse({ ...base, negativeMark: -1 });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['negativeMark']);
  });

  test('rejects a zero-minute exam', () => {
    expect(createExamRules.safeParse({ ...base, durationMinutes: 0 }).success).toBe(false);
  });
});

describe('registration validation', () => {
  test('normalises the email and requires a strong-enough password', () => {
    const ok = registerRules.parse({ fullName: 'Asha', email: '  Asha@Example.COM ', password: 'secret123' });
    expect(ok.email).toBe('asha@example.com');
    expect(registerRules.safeParse({ fullName: 'Asha', email: 'a@b.co', password: 'short' }).success).toBe(false);
    expect(registerRules.safeParse({ fullName: 'Asha', email: 'a@b.co', password: 'onlyletters' }).success).toBe(false);
  });
});
