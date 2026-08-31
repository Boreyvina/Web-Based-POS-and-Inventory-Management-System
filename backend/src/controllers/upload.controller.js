const { publicPath, removeLocalImage } = require('../config/upload');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * POST /api/uploads/product-image   (multipart/form-data, field name "image")
 * Returns the path to store in products.image_url.
 *
 * Upload is separate from product create/update so the product endpoints stay
 * plain JSON. The frontend uploads first, then sends the returned path.
 */
exports.productImage = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No image was uploaded (use the "image" field)');

  res.status(201).json({
    success: true,
    message: 'Image uploaded',
    data: {
      url: publicPath(req.file.filename),
      filename: req.file.filename,
      size: req.file.size,
      mimeType: req.file.mimetype,
    },
  });
});

/** DELETE /api/uploads/product-image?url=/uploads/products/xyz.jpg */
exports.removeProductImage = asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!url) throw ApiError.badRequest('Pass the image url to delete');
  removeLocalImage(url);
  res.json({ success: true, message: 'Image deleted' });
});
