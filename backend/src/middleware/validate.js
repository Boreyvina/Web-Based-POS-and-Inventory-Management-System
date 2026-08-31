const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/** Put this after a list of express-validator rules to turn failures into a 400. */
module.exports = function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const details = result.array().map((e) => ({ field: e.path, message: e.msg }));
  next(ApiError.badRequest('Validation failed', details));
};
