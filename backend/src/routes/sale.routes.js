const router = require('express').Router();
const ctrl = require('../controllers/sale.controller');
const v = require('../validators/sale.validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Only a cashier rings up a sale. An owner who serves customers needs their
// own cashier account, so every transaction is attributable to a real person
// rather than to a shared administrator login.
router.post('/', authorize('cashier'), v.checkout, validate, ctrl.checkout);
router.get('/', authorize('admin', 'cashier'), v.listFilters, validate, ctrl.list);
router.get('/:id', authorize('admin', 'cashier'), v.idParam, validate, ctrl.getById);
router.patch('/:id/void', authorize('admin'), v.voidSale, validate, ctrl.voidSale);

module.exports = router;
