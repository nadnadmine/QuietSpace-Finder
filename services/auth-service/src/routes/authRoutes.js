const express = require('express');
const passport = require('passport');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/register', authController.register);
router.post('/verify-email', authController.verifyEmail);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.post('/logout-all', authenticate, authController.logoutAll);

// OAuth Routes
router.get('/oauth/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get('/oauth/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/login' }), (req, res) => {
    // Return tokens
    res.json({
        message: "OAuth login successful",
        data: {
            access_token: req.user.accessToken,
            refresh_token: req.user.refreshToken,
            token_type: "Bearer",
            expires_in: 900,
            is_new_user: req.user.isNew,
            user: req.user.profile
        },
        error: null
    });
});

router.get('/oauth/github', passport.authenticate('github', { scope: ['user:email'], session: false }));
router.get('/oauth/github/callback', passport.authenticate('github', { session: false, failureRedirect: '/login' }), (req, res) => {
    // Return tokens
    res.json({
        message: "OAuth login successful",
        data: {
            access_token: req.user.accessToken,
            refresh_token: req.user.refreshToken,
            token_type: "Bearer",
            expires_in: 900,
            is_new_user: req.user.isNew,
            user: req.user.profile
        },
        error: null
    });
});

module.exports = router;
