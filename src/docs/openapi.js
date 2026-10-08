const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const param = (name) => ({ $ref: `#/components/parameters/${name}` });
const LIST = [param('page'), param('limit'), param('search'), param('sort')];
const ID = [param('id')];

const query = (name, description, schema = { type: 'string' }) => ({ name, in: 'query', required: false, description, schema });

const jsonBody = (schemaName) => ({
  required: true,
  content: { 'application/json': { schema: ref(schemaName) } },
});

function op(tag, summary, { roles, params = [], body, ok = 200, isPublic = false, notes } = {}) {
  const description = [roles ? `**Roles:** ${roles}` : null, notes].filter(Boolean).join('\n\n');
  const operation = {
    tags: [tag],
    summary,
    parameters: params,
    responses: {
      [ok]: { description: 'Success', content: { 'application/json': { schema: ref('Envelope') } } },
      400: { $ref: '#/components/responses/BadRequest' },
      422: { $ref: '#/components/responses/Invalid' },
    },
  };
  if (description) operation.description = description;
  if (body) operation.requestBody = jsonBody(body);
  if (isPublic) {
    operation.security = [];
  } else {
    operation.responses[401] = { $ref: '#/components/responses/Unauthorized' };
    operation.responses[403] = { $ref: '#/components/responses/Forbidden' };
    operation.responses[404] = { $ref: '#/components/responses/NotFound' };
  }
  return operation;
}

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'TestDesk — Online Examination API',
    version: '1.0.0',
    description:
      'REST API for the TestDesk exam platform.\n\n' +
      '1. Call **POST /auth/login** (the first admin comes from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`).\n' +
      '2. Copy `data.token`, press **Authorize** and paste it.\n\n' +
      'List endpoints accept `page`, `limit`, `search` and `sort` (`field` or `-field`). ' +
      'Every reply is wrapped as `{ success, data, meta? }`; errors as `{ success: false, message, code?, details? }`.',
  },
  servers: [{ url: '/api' }],
  tags: [
    { name: 'Auth' },
    { name: 'Users', description: 'Admin: manage accounts' },
    { name: 'Courses', description: 'Admin: courses and instructor assignment' },
    { name: 'Questions', description: 'Instructor: question bank (MCQ + coding)' },
    { name: 'Exams', description: 'Instructor: exams, publishing, results, leaderboard' },
    { name: 'Attempts', description: 'Student: take an exam' },
    { name: 'Results', description: 'Scores, PDF download, coding review' },
    { name: 'Reports', description: 'Admin dashboards' },
    { name: 'Audit', description: 'Admin: audit trail' },
  ],
  security: [{ bearerAuth: [] }],

  paths: {
    '/auth/register': { post: op('Auth', 'Register as a student', { body: 'RegisterInput', ok: 201, isPublic: true }) },
    '/auth/login': {
      post: op('Auth', 'Sign in and receive a JWT', {
        body: 'LoginInput',
        isPublic: true,
        notes: 'Signing in ends any other active session of the same account.',
      }),
    },
    '/auth/logout': { post: op('Auth', 'End the current session') },
    '/auth/me': { get: op('Auth', 'Current user') },

    '/users': {
      get: op('Users', 'List users', {
        roles: 'admin',
        params: [...LIST, query('role', 'admin | instructor | student'), query('isActive', 'true | false')],
      }),
      post: op('Users', 'Create a user of any role', { roles: 'admin', body: 'UserCreateInput', ok: 201 }),
    },
    '/users/{id}': {
      get: op('Users', 'Get one user', { roles: 'admin', params: ID }),
      patch: op('Users', 'Update name / role / status / reset password', { roles: 'admin', params: ID, body: 'UserUpdateInput' }),
      delete: op('Users', 'Delete a user without exam history', { roles: 'admin', params: ID }),
    },
    '/roles': { get: op('Users', 'List roles', { roles: 'admin' }) },

    '/courses': {
      get: op('Courses', 'List courses (instructors see only theirs)', { roles: 'any', params: LIST }),
      post: op('Courses', 'Create a course', { roles: 'admin', body: 'CourseInput', ok: 201 }),
    },
    '/courses/{id}': {
      get: op('Courses', 'Get a course', { roles: 'any', params: ID }),
      patch: op('Courses', 'Update a course', { roles: 'admin', params: ID, body: 'CourseInput' }),
      delete: op('Courses', 'Delete an empty course', { roles: 'admin', params: ID }),
    },
    '/courses/{id}/instructors': {
      put: op('Courses', 'Assign instructors (replaces the list)', { roles: 'admin', params: ID, body: 'AssignInstructorsInput' }),
    },

    '/questions': {
      get: op('Questions', 'Browse the question bank', {
        roles: 'instructor, admin',
        params: [...LIST, query('course', 'Course id'), query('kind', 'mcq | coding')],
      }),
      post: op('Questions', 'Add an MCQ or coding question', { roles: 'instructor, admin', body: 'QuestionInput', ok: 201 }),
    },
    '/questions/{id}': {
      get: op('Questions', 'Get a question with options', { roles: 'instructor, admin', params: ID }),
      patch: op('Questions', 'Edit a question (not allowed once used in a published exam)', {
        roles: 'instructor, admin',
        params: ID,
        body: 'QuestionUpdateInput',
      }),
      delete: op('Questions', 'Delete a question', { roles: 'instructor, admin', params: ID }),
    },

    '/exams': {
      get: op('Exams', 'List exams', {
        roles: 'any (students only see published exams, with their attempt info)',
        params: [...LIST, query('course', 'Course id'), query('status', 'draft | published | closed')],
      }),
      post: op('Exams', 'Create an exam (starts as draft)', { roles: 'instructor, admin', body: 'ExamInput', ok: 201 }),
    },
    '/exams/{id}': {
      get: op('Exams', 'Get an exam', { roles: 'any', params: ID }),
      patch: op('Exams', 'Edit a draft exam (duration, pool, marking…)', { roles: 'instructor, admin', params: ID, body: 'ExamUpdateInput' }),
      delete: op('Exams', 'Delete an exam with no attempts', { roles: 'instructor, admin', params: ID }),
    },
    '/exams/{id}/status': {
      patch: op('Exams', 'Publish, close or move back to draft', {
        roles: 'instructor, admin',
        params: ID,
        body: 'StatusInput',
        notes: 'Closing auto-submits every running attempt.',
      }),
    },
    '/exams/{id}/publish-results': {
      post: op('Exams', 'Publish results of a closed exam', {
        roles: 'instructor, admin',
        params: ID,
        notes: 'Fails while any coding answer is still waiting for review.',
      }),
    },
    '/exams/{id}/results': {
      get: op('Exams', 'All results of an exam', {
        roles: 'instructor, admin',
        params: [...ID, ...LIST, query('reviewStatus', 'auto | pending | reviewed')],
      }),
    },
    '/exams/{id}/leaderboard': {
      get: op('Exams', 'Ranked best scores', {
        roles: 'any (students after results are published)',
        params: [...ID, param('page'), param('limit')],
      }),
    },

    '/attempts': {
      post: op('Attempts', 'Start (or resume) an attempt', {
        roles: 'student',
        body: 'StartAttemptInput',
        ok: 201,
        notes: 'Questions are drawn at random from the exam pool.',
      }),
    },
    '/attempts/mine': { get: op('Attempts', 'Exam history of the student', { roles: 'student', params: LIST }) },
    '/attempts/{id}': {
      get: op('Attempts', 'Attempt paper, saved answers and time left', {
        roles: 'student',
        params: ID,
        notes: 'Auto-submits if the timer has already expired.',
      }),
    },
    '/attempts/{id}/answers': {
      put: op('Attempts', 'Save one answer', { roles: 'student', params: ID, body: 'AnswerInput' }),
    },
    '/attempts/{id}/submit': {
      post: op('Attempts', 'Submit the attempt', { roles: 'student', params: ID, body: 'SubmitInput' }),
    },

    '/results/mine': { get: op('Results', "Student's results (scores hidden until published)", { roles: 'student', params: LIST }) },
    '/results/{id}': { get: op('Results', 'Result with per-question breakdown', { roles: 'any', params: ID }) },
    '/results/{id}/pdf': {
      get: {
        ...op('Results', 'Download result sheet as PDF', { roles: 'any', params: ID }),
        responses: {
          200: { description: 'PDF file', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/results/{id}/review': {
      patch: op('Results', 'Grade coding answers', { roles: 'instructor, admin', params: ID, body: 'ReviewInput' }),
    },

    '/reports/overview': { get: op('Reports', 'Platform totals: users, courses, exams, attempts, average score', { roles: 'admin' }) },
    '/reports/exams': { get: op('Reports', 'Per-exam performance', { roles: 'admin', params: LIST }) },
    '/audit-logs': {
      get: op('Audit', 'Audit trail', {
        roles: 'admin',
        params: [...LIST, query('action', 'Prefix, e.g. "exam."'), query('entity', 'e.g. Exam'), query('actor', 'User id')],
      }),
    },
  },

  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    parameters: {
      id: { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      page: { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
      limit: { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
      search: { name: 'search', in: 'query', schema: { type: 'string' } },
      sort: { name: 'sort', in: 'query', description: 'Field name, prefix with - for descending', schema: { type: 'string' } },
    },
    responses: {
      BadRequest: { description: 'Bad request', content: { 'application/json': { schema: ref('Error') } } },
      Invalid: { description: 'Validation failed', content: { 'application/json': { schema: ref('Error') } } },
      Unauthorized: { description: 'Missing, expired or replaced session', content: { 'application/json': { schema: ref('Error') } } },
      Forbidden: { description: 'Role not allowed', content: { 'application/json': { schema: ref('Error') } } },
      NotFound: { description: 'Not found', content: { 'application/json': { schema: ref('Error') } } },
    },
    schemas: {
      Envelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { description: 'Payload' },
          meta: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
              pages: { type: 'integer' },
            },
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          code: { type: 'string', example: 'SESSION_REPLACED' },
          details: {
            type: 'array',
            items: { type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' } } },
          },
        },
      },
      RegisterInput: {
        type: 'object',
        required: ['fullName', 'email', 'password'],
        properties: {
          fullName: { type: 'string', example: 'Riya Sharma' },
          email: { type: 'string', example: 'riya@example.com' },
          password: { type: 'string', example: 'Student@123' },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', example: 'admin@testdesk.dev' },
          password: { type: 'string', example: 'Admin@12345' },
        },
      },
      UserCreateInput: {
        type: 'object',
        required: ['fullName', 'email', 'password', 'role'],
        properties: {
          fullName: { type: 'string', example: 'Dev Instructor' },
          email: { type: 'string', example: 'dev@testdesk.dev' },
          password: { type: 'string', example: 'Teach@123' },
          role: { type: 'string', enum: ['admin', 'instructor', 'student'] },
          isActive: { type: 'boolean', default: true },
        },
      },
      UserUpdateInput: {
        type: 'object',
        properties: {
          fullName: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'instructor', 'student'] },
          isActive: { type: 'boolean' },
          password: { type: 'string', description: 'New password (admin reset)' },
        },
      },
      CourseInput: {
        type: 'object',
        required: ['title', 'code'],
        properties: {
          title: { type: 'string', example: 'Data Structures' },
          code: { type: 'string', example: 'CS201' },
          description: { type: 'string' },
        },
      },
      AssignInstructorsInput: {
        type: 'object',
        required: ['instructorIds'],
        properties: { instructorIds: { type: 'array', items: { type: 'string' } } },
      },
      QuestionInput: {
        type: 'object',
        required: ['course', 'kind', 'prompt'],
        properties: {
          course: { type: 'string' },
          kind: { type: 'string', enum: ['mcq', 'coding'] },
          prompt: { type: 'string', example: 'What is the time complexity of binary search?' },
          marks: { type: 'number', default: 1 },
          options: {
            type: 'array',
            description: 'MCQ only: 2-8 options, exactly one correct',
            items: { type: 'object', properties: { text: { type: 'string' }, isCorrect: { type: 'boolean' } } },
            example: [
              { text: 'O(n)', isCorrect: false },
              { text: 'O(log n)', isCorrect: true },
            ],
          },
          language: { type: 'string', description: 'Coding only', example: 'javascript' },
        },
      },
      QuestionUpdateInput: {
        type: 'object',
        description: 'Any QuestionInput field except course and kind',
        properties: {
          prompt: { type: 'string' },
          marks: { type: 'number' },
          options: { type: 'array', items: { type: 'object' } },
          language: { type: 'string' },
        },
      },
      ExamInput: {
        type: 'object',
        required: ['title', 'course', 'durationMinutes'],
        properties: {
          title: { type: 'string', example: 'Mid-term quiz' },
          description: { type: 'string' },
          course: { type: 'string' },
          questions: { type: 'array', items: { type: 'string' }, description: 'Question pool (ids)' },
          questionsPerAttempt: { type: 'integer', description: '0 = all questions in the pool', example: 5 },
          durationMinutes: { type: 'integer', example: 20 },
          negativeMark: { type: 'number', description: 'Deducted per wrong MCQ', example: 0.25 },
          maxAttempts: { type: 'integer', example: 2 },
        },
      },
      ExamUpdateInput: { type: 'object', description: 'Any ExamInput field except course' },
      StatusInput: {
        type: 'object',
        required: ['status'],
        properties: { status: { type: 'string', enum: ['draft', 'published', 'closed'] } },
      },
      StartAttemptInput: {
        type: 'object',
        required: ['examId'],
        properties: { examId: { type: 'string' } },
      },
      AnswerInput: {
        type: 'object',
        required: ['question'],
        properties: {
          question: { type: 'string' },
          selectedOption: { type: 'string', nullable: true, description: 'MCQ: option id (null clears)' },
          codeAnswer: { type: 'string', description: 'Coding: source code' },
        },
      },
      SubmitInput: {
        type: 'object',
        properties: {
          answers: { type: 'array', items: ref('AnswerInput') },
          auto: { type: 'boolean', description: 'true when the timer submitted on the student’s behalf' },
        },
      },
      ReviewInput: {
        type: 'object',
        required: ['grades'],
        properties: {
          grades: {
            type: 'array',
            items: {
              type: 'object',
              properties: { question: { type: 'string' }, marks: { type: 'number' }, feedback: { type: 'string' } },
            },
          },
        },
      },
    },
  },
};

module.exports = spec;
