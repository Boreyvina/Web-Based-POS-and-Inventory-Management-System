const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const v = require('../validators/auth.validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/login', v.login, validate, ctrl.login);
router.get('/me', authenticate, ctrl.me);
router.patch('/password', authenticate, v.changePassword, validate, ctrl.changePassword);

// Staff accounts are created by an admin, never self-registered.
router.post('/register', authenticate, authorize('admin'), v.register, validate, ctrl.register);
router.get('/users', authenticate, authorize('admin'), ctrl.listUsers);
router.patch('/users/:id/status', authenticate, authorize('admin'), v.userStatus, validate, ctrl.setUserStatus);

module.exports = router;
