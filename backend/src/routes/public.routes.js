const router = require('express').Router();
const ctrl = require('../controllers/public.controller');

// No authenticate middleware here on purpose — this is the guest shop view.
router.get('/products', ctrl.products);
router.get('/categories', ctrl.categories);

module.exports = router;
