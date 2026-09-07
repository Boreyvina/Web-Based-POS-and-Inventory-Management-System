const { nodeEnv } = require('../config/env');

function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Internal server error';

  // Translate common MySQL errors into something a user can act on.
  switch (err.code) {
    case 'ER_DUP_ENTRY':
      status = 409;
      message = 'A record with that unique value already exists (SKU, barcode, username or email).';
      break;
    case 'ER_NO_REFERENCED_ROW_2':
      status = 400;
      message = 'Referenced record does not exist (check category_id / product_id).';
      break;
    case 'ER_ROW_IS_REFERENCED_2':
      status = 409;
      message = 'This record is used elsewhere and cannot be deleted. Deactivate it instead.';
      break;
    case 'ECONNREFUSED':
      status = 503;
      message = 'Cannot reach the database. Is MySQL running?';
      break;
    default:
      break;
  }

  if (status >= 500) console.error('[error]', err);

  res.status(status).json({
    success: false,
    message,
    ...(err.details ? { details: err.details } : {}),
    ...(nodeEnv === 'development' && status >= 500 ? { stack: err.stack } : {}),
  });
}

module.exports = { notFound, errorHandler };
