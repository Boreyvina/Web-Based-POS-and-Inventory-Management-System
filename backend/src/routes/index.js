const router = require('express').Router();

router.get('/health', (req, res) => res.json({ success: true, message: 'API is running', time: new Date() }));

router.use('/auth', require('./auth.routes'));
router.use('/public', require('./public.routes'));
router.use('/categories', require('./category.routes'));
router.use('/products', require('./product.routes'));
router.use('/sales', require('./sale.routes'));
router.use('/inventory', require('./inventory.routes'));
router.use('/reports', require('./report.routes'));
router.use('/uploads', require('./upload.routes'));
router.use('/payments', require('./payment.routes'));
router.use('/suppliers', require('./supplier.routes'));
router.use('/purchase-orders', require('./purchase.routes'));

module.exports = router;
