const router = require('express').Router();
const ctrl = require('../controllers/product.controller');
const v = require('../validators/product.validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Read: admin + cashier
router.get('/', ctrl.list);
router.get('/alerts/low-stock', ctrl.lowStock);
router.get('/alerts/expiring', ctrl.expiring);
router.get('/barcode/:code', ctrl.getByBarcode);
router.get('/:id', v.idParam, validate, ctrl.getById);
router.get('/:id/batches', v.idParam, validate, ctrl.batches);

// Stock count: cashiers may correct counts, but nothing else
router.patch('/:id/stock', authorize('admin', 'cashier'), v.adjustStock, validate, ctrl.adjustStock);

// Writing off expired stock is a loss, so it stays with the admin
router.post('/:id/write-off', authorize('admin'), v.writeOff, validate, ctrl.writeOffExpired);

// Write: admin only
router.post('/', authorize('admin'), v.create, validate, ctrl.create);
router.put('/:id', authorize('admin'), v.update, validate, ctrl.update);
router.delete('/:id', authorize('admin'), v.idParam, validate, ctrl.remove);

module.exports = router;
