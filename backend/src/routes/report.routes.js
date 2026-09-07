const router = require('express').Router();
const ctrl = require('../controllers/report.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin'));

router.get('/summary', ctrl.summary);
router.get('/revenue', ctrl.revenue);
router.get('/top-products', ctrl.topProducts);
router.get('/sales-by-category', ctrl.byCategory);
router.get('/payment-methods', ctrl.paymentMethods);
router.get('/by-cashier', ctrl.byCashier);
router.get('/stock-levels', ctrl.stockLevels);
router.get('/export', ctrl.exportReport);

module.exports = router;
