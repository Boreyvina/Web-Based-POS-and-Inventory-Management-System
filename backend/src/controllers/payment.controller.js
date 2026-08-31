const { buildPayload } = require('../utils/emvqr');
const { qr, store } = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/payments/qr?amount=12.50&ref=INV-001
 *
 * Returns what the checkout screen needs to draw a QR code. The QR itself is
 * rendered in the browser — sending a picture over the wire would be slower and
 * harder to resize.
 */
exports.paymentQr = asyncHandler(async (req, res) => {
  const amount = req.query.amount === undefined ? null : Number(req.query.amount);
  if (amount !== null && (Number.isNaN(amount) || amount < 0)) {
    throw ApiError.badRequest('amount must be a positive number');
  }

  // A saved QR picture always wins: if the shop owner uploaded the code from
  // their banking app, showing that is more trustworthy than one we generated.
  if (qr.staticImageUrl) {
    return res.json({
      success: true,
      data: {
        mode: 'image',
        imageUrl: qr.staticImageUrl,
        amount,
        currency: store.currency,
        merchantName: qr.merchantName,
        note: 'Saved bank QR — the customer types the amount in their app',
      },
    });
  }

  if (!qr.accountId) {
    throw ApiError.badRequest(
      'QR payments are not configured. Set QR_ACCOUNT_ID (and the other QR_ values) ' +
      'in the backend .env, or set QR_STATIC_IMAGE_URL to a picture of your bank QR.'
    );
  }

  const payload = buildPayload(
    {
      acquirerId: qr.acquirerId,
      accountId: qr.accountId,
      merchantTag: qr.merchantTag,
      merchantName: qr.merchantName || store.name,
      merchantCity: qr.merchantCity,
      merchantCategoryCode: qr.merchantCategoryCode,
      countryCode: qr.countryCode,
      currency: store.currency,
    },
    amount,
    req.query.ref
  );

  res.json({
    success: true,
    data: {
      mode: 'payload',
      payload,
      amount,
      currency: store.currency,
      merchantName: qr.merchantName || store.name,
    },
  });
});
