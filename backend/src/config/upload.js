const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const ApiError = require('../utils/ApiError');

// Files live on disk next to the backend, not in the database. Storing images
// as BLOBs bloats every query that touches the products table.
const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');
const PRODUCT_DIR = path.join(UPLOAD_ROOT, 'products');

fs.mkdirSync(PRODUCT_DIR, { recursive: true });

const ALLOWED = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — plenty for a product photo

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PRODUCT_DIR),
  filename: (req, file, cb) => {
    // Random name, extension derived from the MIME type we already checked.
    // Never trust the client's filename: "../../server.js" is a valid one.
    const name = crypto.randomBytes(16).toString('hex');
    cb(null, `${Date.now()}-${name}${ALLOWED[file.mimetype]}`);
  },
});

const uploadProductImage = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) {
      return cb(ApiError.badRequest('Only JPG, PNG, WEBP or GIF images are allowed'));
    }
    return cb(null, true);
  },
}).single('image');

/** Public path stored in the database, e.g. /uploads/products/172...-ab12.jpg */
function publicPath(filename) {
  return `/uploads/products/${filename}`;
}

/**
 * Delete an image we host. Ignores external URLs and missing files — a failed
 * cleanup should never break the request the user actually asked for.
 */
function removeLocalImage(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/products/')) return;
  const filename = path.basename(imageUrl);
  fs.promises.unlink(path.join(PRODUCT_DIR, filename)).catch(() => {});
}

module.exports = { uploadProductImage, publicPath, removeLocalImage, UPLOAD_ROOT, MAX_BYTES };
