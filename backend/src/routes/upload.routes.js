const router = require('express').Router();
const ctrl = require('../controllers/upload.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadProductImage } = require('../config/upload');
const ApiError = require('../utils/ApiError');

// Multer reports its own errors (file too large, wrong type). Translate them
// into our envelope instead of letting a raw MulterError reach the client.
function handleUpload(req, res, next) {
  uploadProductImage(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(ApiError.badRequest('Image must be smaller than 2 MB'));
    if (err.code === 'LIMIT_UNEXPECTED_FILE') return next(ApiError.badRequest('Send one file in the "image" field'));
    return next(err);
  });
}

router.use(authenticate, authorize('admin'));

router.post('/product-image', handleUpload, ctrl.productImage);
router.delete('/product-image', ctrl.removeProductImage);

module.exports = router;
