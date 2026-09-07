/** An error we intentionally throw, with an HTTP status attached. */
class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
    this.isOperational = true;
  }
  static badRequest(msg, details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'Not authenticated') { return new ApiError(401, msg); }
  static forbidden(msg = 'You do not have permission to do this') { return new ApiError(403, msg); }
  static notFound(msg = 'Not found') { return new ApiError(404, msg); }
  static conflict(msg) { return new ApiError(409, msg); }
}

module.exports = ApiError;
