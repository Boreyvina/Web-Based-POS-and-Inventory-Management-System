const router = require('express').Router();
const ctrl = require('../controllers/inventory.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin'));
router.get('/logs', ctrl.logs);

module.exports = router;
