const { body, param, query } = require('express-validator');

exports.checkout = [
  body('items').isArray({ min: 1 }).withMessage('Cart must contain at least one item'),
  body('items.*.productId').isInt({ min: 1 }).withMessage('Each item needs a valid productId'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.discount').optional().isFloat({ min: 0 }).withMessage('Line discount cannot be negative'),
  body('paymentMethod').optional().isIn(['cash', 'card', 'qr'])
    .withMessage('Payment must be cash, card or qr'),
  body('amountPaid').optional().isFloat({ min: 0 }),
  body('discountAmount').optional().isFloat({ min: 0 }),
  body('note').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
];

exports.listFilters = [
  query('from').optional().isISO8601().withMessage('from must be YYYY-MM-DD'),
  query('to').optional().isISO8601().withMessage('to must be YYYY-MM-DD'),
  query('status').optional().isIn(['completed', 'voided', 'refunded']),
];

exports.voidSale = [
  param('id').isInt({ min: 1 }),
  body('reason').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
];

exports.idParam = [param('id').isInt({ min: 1 }).withMessage('Invalid id')];
