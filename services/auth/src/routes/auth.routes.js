const express = require('express');
const { body } = require('express-validator');
const AuthController = require('../controllers/auth.controller');
const validate = require('../middleware/validate.middleware');
const requireAuth = require('../middleware/requireAuth.middleware');

const router = express.Router();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post(
  '/register',
  validate([
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3–50 chars'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 chars'),
  ]),
  wrap(AuthController.register)
);

router.post(
  '/login',
  validate([
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ]),
  wrap(AuthController.login)
);

router.post('/refresh', wrap(AuthController.refresh));
router.post('/logout', requireAuth, wrap(AuthController.logout));
router.get('/me', requireAuth, wrap(AuthController.me));

router.patch(
  '/me',
  requireAuth,
  validate([
    body('email').optional().isEmail().normalizeEmail().withMessage('Valid email required'),
    body('username').optional().trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3–50 chars'),
  ]),
  wrap(AuthController.updateAccount)
);

router.put(
  '/me/password',
  requireAuth,
  validate([
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 chars'),
  ]),
  wrap(AuthController.changePassword)
);

router.get('/validate', wrap(AuthController.validate));

module.exports = router;
