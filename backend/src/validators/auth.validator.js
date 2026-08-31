const { body, param } = require('express-validator');

exports.login = [
  body('username').trim().notEmpty().withMessage('Username or email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

exports.register = [
  body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
    .matches(/^[a-zA-Z0-9._-]+$/).withMessage('Username may contain letters, numbers, . _ - only'),
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('fullName').trim().isLength({ min: 2, max: 120 }).withMessage('Full name is required'),
  body('role').isIn(['admin', 'cashier', 'customer']).withMessage('Role must be admin, cashier or customer'),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 30 }),
];

exports.changePassword = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
];

exports.userStatus = [
  param('id').isInt({ min: 1 }),
  body('isActive').isBoolean().withMessage('isActive must be true or false'),
];
