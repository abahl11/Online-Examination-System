const { Router } = require('express');

const authRoutes = require('./features/auth/auth.routes');
const { usersRouter, rolesRouter } = require('./features/users/users.routes');
const courseRoutes = require('./features/courses/courses.routes');
const questionRoutes = require('./features/questions/questions.routes');
const examRoutes = require('./features/exams/exams.routes');
const attemptRoutes = require('./features/attempts/attempts.routes');
const resultRoutes = require('./features/results/results.routes');
const reportRoutes = require('./features/reports/reports.routes');
const auditRoutes = require('./features/audit/audit.routes');

const api = Router();

api.use('/auth', authRoutes);
api.use('/users', usersRouter);
api.use('/roles', rolesRouter);
api.use('/courses', courseRoutes);
api.use('/questions', questionRoutes);
api.use('/exams', examRoutes);
api.use('/attempts', attemptRoutes);
api.use('/results', resultRoutes);
api.use('/reports', reportRoutes);
api.use('/audit-logs', auditRoutes);

module.exports = api;
