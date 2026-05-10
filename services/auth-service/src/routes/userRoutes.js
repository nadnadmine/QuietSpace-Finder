const express = require('express');
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/me', authenticate, userController.getMe);
router.patch('/me', authenticate, userController.updateMe);
router.patch('/:userId/role', authenticate, authorize('admin'), userController.updateRole);
router.delete('/:userId', authenticate, authorize('admin'), userController.deleteUser);

module.exports = router;
