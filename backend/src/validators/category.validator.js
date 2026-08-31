const { body, param } = require('express-validator');

exports.create = [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Category name is required (2-80 chars)'),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
];

exports.update = [
  param('id').isInt({ min: 1 }),
  body('name').optional().trim().isLength({ min: 2, max: 80 }),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  body('isActive').optional().isBoolean(),
];

exports.idParam = [param('id').isInt({ min: 1 }).withMessage('Invalid id')];
