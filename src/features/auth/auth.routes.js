const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const requireAuth = require('../../middleware/requireAuth');
const checkInput = require('../../middleware/checkInput');
const { runAsync } = require('../../helpers/http');
const { registerRules, loginRules } = require('./auth.rules');
const auth = require('./auth.handlers');

const router = Router();

const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please wait a few minutes and try again.' },
});

router.post('/register', credentialLimiter, checkInput(registerRules), runAsync(auth.register));
router.post('/login', credentialLimiter, checkInput(loginRules), runAsync(auth.login));
router.post('/logout', requireAuth, runAsync(auth.logout));
router.get('/me', requireAuth, runAsync(auth.whoAmI));

module.exports = router;
