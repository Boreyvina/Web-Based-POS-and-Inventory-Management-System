const router = require('express').Router();
const ctrl = require('../controllers/sale.controller');
const v = require('../validators/sale.validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.post('/', authorize('admin', 'cashier'), v.checkout, validate, ctrl.checkout);
router.get('/', authorize('admin', 'cashier'), v.listFilters, validate, ctrl.list);
router.get('/:id', authorize('admin', 'cashier'), v.idParam, validate, ctrl.getById);
router.patch('/:id/void', authorize('admin'), v.voidSale, validate, ctrl.voidSale);

module.exports = router;
