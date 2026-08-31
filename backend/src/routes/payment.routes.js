const router = require('express').Router();
const ctrl = require('../controllers/payment.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin', 'cashier'));
router.get('/qr', ctrl.paymentQr);

module.exports = router;
