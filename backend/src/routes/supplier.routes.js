const router = require('express').Router();
const ctrl = require('../controllers/supplier.controller');
const v = require('../validators/supplier.validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin'));

router.get('/', ctrl.list);
router.post('/', v.create, validate, ctrl.create);
router.put('/:id', v.update, validate, ctrl.update);
router.delete('/:id', v.idParam, validate, ctrl.remove);

module.exports = router;
