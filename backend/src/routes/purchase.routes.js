const router = require('express').Router();
const ctrl = require('../controllers/purchase.controller');
const v = require('../validators/purchase.validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

// Ordering stock is spending money, so it stays with the admin.
router.use(authenticate, authorize('admin'));

router.get('/suggestions', ctrl.suggestions);
router.get('/', v.listFilters, validate, ctrl.list);
router.post('/', v.createOrder, validate, ctrl.create);
router.get('/:id', v.idParam, validate, ctrl.getById);
router.patch('/:id/send', v.idParam, validate, ctrl.send);
router.post('/:id/receive', v.receive, validate, ctrl.receive);
router.patch('/:id/cancel', v.cancel, validate, ctrl.cancel);

module.exports = router;
