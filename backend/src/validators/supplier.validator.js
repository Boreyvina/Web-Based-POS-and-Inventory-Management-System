const { body, param } = require('express-validator');

exports.create = [
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Supplier name is required'),
  body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('Enter a valid email'),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 30 }),
  body('contactPerson').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  body('address').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
];

exports.update = [
  param('id').isInt({ min: 1 }),
  body('name').optional().trim().isLength({ min: 2, max: 120 }),
  body('email').optional({ values: 'falsy' }).trim().isEmail(),
  body('isActive').optional().isBoolean(),
];

exports.idParam = [param('id').isInt({ min: 1 }).withMessage('Invalid id')];
