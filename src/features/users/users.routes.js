const { Router } = require('express');
const requireAuth = require('../../middleware/requireAuth');
const allowRoles = require('../../middleware/allowRoles');
const checkInput = require('../../middleware/checkInput');
const { runAsync } = require('../../helpers/http');
const { createUserRules, updateUserRules } = require('./users.rules');
const users = require('./users.handlers');

const usersRouter = Router();
usersRouter.use(requireAuth, allowRoles('admin'));

usersRouter.get('/', runAsync(users.listUsers));
usersRouter.post('/', checkInput(createUserRules), runAsync(users.createUser));
usersRouter.get('/:id', runAsync(users.getUser));
usersRouter.patch('/:id', checkInput(updateUserRules), runAsync(users.updateUser));
usersRouter.delete('/:id', runAsync(users.deleteUser));

const rolesRouter = Router();
rolesRouter.get('/', requireAuth, allowRoles('admin'), runAsync(users.listRoles));

module.exports = { usersRouter, rolesRouter };
