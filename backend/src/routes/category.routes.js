const router = require('express').Router();
const ctrl = require('../controllers/category.controller');
const v = require('../validators/category.validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', authorize('admin'), v.create, validate, ctrl.create);
router.put('/:id', authorize('admin'), v.update, validate, ctrl.update);
router.delete('/:id', authorize('admin'), v.idParam, validate, ctrl.remove);

module.exports = router;
