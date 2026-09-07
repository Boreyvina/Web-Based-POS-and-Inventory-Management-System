const { body, param, query } = require('express-validator');

exports.createOrder = [
  body('supplierId').optional({ values: 'null' }).isInt({ min: 1 }),
  body('items').isArray({ min: 1 }).withMessage('An order needs at least one line'),
  body('items.*.productId').isInt({ min: 1 }).withMessage('Each line needs a valid product'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.unitCost').optional().isFloat({ min: 0 }),
  body('items.*.expiryDate').optional({ values: 'null' }).isISO8601().withMessage('Expiry must be YYYY-MM-DD'),
  body('expectedDate').optional({ values: 'null' }).isISO8601().withMessage('Expected date must be YYYY-MM-DD'),
  body('status').optional().isIn(['draft', 'ordered']),
  body('note').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
];

exports.receive = [
  param('id').isInt({ min: 1 }),
  body('lines').isArray({ min: 1 }).withMessage('Say which lines arrived'),
  body('lines.*.itemId').isInt({ min: 1 }),
  body('lines.*.quantity').isInt({ min: 0 }).withMessage('Quantity cannot be negative'),
  body('lines.*.expiryDate').optional({ values: 'null' }).isISO8601(),
  body('lines.*.unitCost').optional().isFloat({ min: 0 }),
  body('lines.*.batchNo').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
];

exports.cancel = [
  param('id').isInt({ min: 1 }),
  body('reason').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
];

exports.listFilters = [
  query('status').optional().isIn(['draft', 'ordered', 'partial', 'received', 'cancelled']),
];

exports.idParam = [param('id').isInt({ min: 1 }).withMessage('Invalid id')];
