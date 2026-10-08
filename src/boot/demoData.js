const { User, Role, Course, Question, Option, Exam, Attempt } = require('../data');
const logger = require('./logger');
const attempts = require('../features/attempts/attempts.service');

const DEMO_USERS = {
  instructor: { fullName: 'Meera Iyer', email: 'meera@testdesk.dev', password: 'Teach@12345', role: 'instructor' },
  aarav: { fullName: 'Aarav Mehta', email: 'aarav@testdesk.dev', password: 'Learn@12345', role: 'student' },
  sara: { fullName: 'Sara Khan', email: 'sara@testdesk.dev', password: 'Learn@12345', role: 'student' },
};

const MCQ_BANK = [
  ['Which keyword declares a block-scoped variable that can be reassigned?', ['var', 'let', 'const', 'static'], 1],
  ['What does `typeof null` return in JavaScript?', ['"null"', '"undefined"', '"object"', '"number"'], 2],
  ['Which HTTP method is normally used to replace a whole resource?', ['POST', 'PATCH', 'PUT', 'GET'], 2],
  ['Which array method returns a new array without changing the original?', ['push', 'splice', 'map', 'sort'], 2],
  ['What is the time complexity of binary search on a sorted array?', ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], 1],
  ['Which HTTP status code means "Unauthorized"?', ['401', '403', '404', '409'], 0],
  ['In MongoDB, which operator matches any value in a given list?', ['$all', '$in', '$or', '$exists'], 1],
  ['What does `Promise.all` do when one of the promises rejects?', ['Ignores it', 'Rejects immediately', 'Retries it', 'Resolves with null'], 1],
];

async function createUser({ fullName, email, password, role }) {
  return User.create({ fullName, email, passwordHash: await User.hashPassword(password), role: await Role.idOf(role) });
}

async function createMcq(courseId, authorId, [prompt, choices, correctIndex]) {
  const question = await Question.create({ course: courseId, author: authorId, kind: 'mcq', prompt, marks: 2 });
  const options = await Option.insertMany(
    choices.map((text, position) => ({ question: question._id, text, isCorrect: position === correctIndex, position }))
  );
  return { id: question._id, options, correct: options[correctIndex]._id };
}

async function playAttempt(examId, studentId, questionsById, pick, minutesAgo) {
  const started = await attempts.startAttempt(examId, studentId);

  const startedAt = new Date(Date.now() - minutesAgo * 60 * 1000);
  await Attempt.updateOne(
    { _id: started._id },
    { startedAt, deadline: new Date(startedAt.getTime() + 15 * 60 * 1000) }
  );
  const attempt = await Attempt.findById(started._id);

  for (const item of attempt.paper) {
    const optionId = pick(questionsById.get(String(item.question)));
    if (optionId) await attempts.saveAnswer(attempt, { question: item.question, selectedOption: optionId });
  }
  await attempts.finalizeAttempt(await Attempt.findById(attempt._id), 'manual');
}

async function loadDemoData(admin) {
  if (await Course.exists({})) return;

  const instructor = await createUser(DEMO_USERS.instructor);
  const aarav = await createUser(DEMO_USERS.aarav);
  const sara = await createUser(DEMO_USERS.sara);

  const course = await Course.create({
    title: 'JavaScript Fundamentals',
    code: 'JS101',
    description: 'Core JavaScript, HTTP basics and a little MongoDB.',
    instructors: [instructor._id],
    createdBy: admin._id,
  });
  await Course.create({
    title: 'Database Systems',
    code: 'DB201',
    description: 'No instructor assigned yet.',
    createdBy: admin._id,
  });

  const mcqs = [];
  for (const row of MCQ_BANK) mcqs.push(await createMcq(course._id, instructor._id, row));
  const coding = await Question.create({
    course: course._id,
    author: instructor._id,
    kind: 'coding',
    prompt: 'Write a function `isPalindrome(text)` that returns true when the text reads the same backwards (ignore case).',
    marks: 5,
    language: 'javascript',
  });
  const questionsById = new Map(mcqs.map((q) => [String(q.id), q]));

  const warmUp = await Exam.create({
    title: 'JavaScript Warm-up Test',
    description: 'A short MCQ test that has already been taken and graded.',
    course: course._id,
    createdBy: instructor._id,
    questions: mcqs.slice(0, 4).map((q) => q.id),
    durationMinutes: 10,
    negativeMark: 0.5,
    maxAttempts: 1,
    status: 'published',
  });
  await playAttempt(warmUp._id, aarav._id, questionsById, (q) => q.correct, 6);
  let seen = 0;
  await playAttempt(
    warmUp._id,
    sara._id,
    questionsById,
    (q) => {
      seen += 1;
      if (seen <= 2) return q.correct;
      if (seen === 3) return q.options.find((opt) => !opt._id.equals(q.correct))._id;
      return null;
    },
    9
  );
  warmUp.status = 'closed';
  warmUp.resultsPublished = true;
  warmUp.resultsPublishedAt = new Date();
  await warmUp.save();

  await Exam.create({
    title: 'JavaScript Basics — Quiz 1',
    description: 'Six random questions from a pool of nine (including one coding question). Each wrong MCQ costs 0.5 marks.',
    course: course._id,
    createdBy: instructor._id,
    questions: [...mcqs.map((q) => q.id), coding._id],
    questionsPerAttempt: 6,
    durationMinutes: 15,
    negativeMark: 0.5,
    maxAttempts: 2,
    status: 'published',
  });

  logger.info('Demo data loaded (see README → Demo data for the logins).');
}

module.exports = { loadDemoData, DEMO_USERS };
