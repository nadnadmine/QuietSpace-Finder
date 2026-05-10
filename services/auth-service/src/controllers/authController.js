const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { publishEvent } = require('../utils/rabbitmq');

const generateTokens = (user) => {
    const payload = {
        sub: user.id,
        role: user.role_name,
        email: user.email
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' });
    
    // Refresh token is a random string, we hash it for storage
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    return { accessToken, refreshToken, refreshTokenHash };
};

exports.register = async (req, res) => {
    const { username, email, password, display_name, role = 'user' } = req.body || {};
    
    if (!username || !email || !password) {
        return res.status(400).json({
            message: "Validation failed",
            data: null,
            error: { code: "VALIDATION_ERROR", details: "username, email, and password are required" }
        });
    }

    const allowedRoles = ['user', 'moderator', 'admin'];
    if (!allowedRoles.includes(role)) {
        return res.status(400).json({
            message: "Validation failed",
            data: null,
            error: { code: "VALIDATION_ERROR", details: "role must be one of: user, moderator, admin" }
        });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 12);
        const userId = uuidv4();

        await db.execute(
            `INSERT INTO users (id, role_id, username, email, password_hash, display_name) 
             VALUES (?, (SELECT id FROM roles WHERE name = ?), ?, ?, ?, ?)`,
            [userId, role, username, email, passwordHash, display_name || null]
        );

        // Fetch created user role info
        const [rows] = await db.execute(
            `SELECT u.id, u.username, u.email, u.display_name, r.name as role_name, u.is_email_verified, u.created_at
             FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
            [userId]
        );
        const user = rows[0];

        // Generate email verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
        const verificationTokenId = uuidv4();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await db.execute(
            `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
            [verificationTokenId, userId, tokenHash, expiresAt]
        );

        // For local testing convenience, we include the verification_token in the response data 
        // even though it's normally sent via email.


        // Publish event to RabbitMQ
        await publishEvent('user_events', {
            event_id: uuidv4(),
            event_type: 'user.registered',
            source_service: 'auth-service',
            payload: { user_id: user.id, email: user.email, display_name: user.display_name }
        });

        res.status(201).json({
            message: "Registration successful. Please verify your email.",
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    display_name: user.display_name,
                    role: user.role_name,
                    is_email_verified: Boolean(user.is_email_verified),
                    created_at: user.created_at
                },
                verification_token: verificationToken
            },
            error: null
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: "Email or username already in use",
                data: null,
                error: { code: "DUPLICATE_ENTRY", field: err.sqlMessage.includes('email') ? 'email' : 'username' }
            });
        }
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({
            message: "Validation failed",
            data: null,
            error: { code: "VALIDATION_ERROR", details: "email and password are required" }
        });
    }

    try {
        const [rows] = await db.execute(
            `SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ?`,
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({ message: "Invalid email or password", data: null, error: { code: "INVALID_CREDENTIALS" } });
        }

        const user = rows[0];

        if (!user.is_active) {
            return res.status(403).json({ message: "Account is deactivated", data: null, error: { code: "ACCOUNT_INACTIVE" } });
        }

        if (!user.password_hash) {
             return res.status(401).json({ message: "Invalid email or password. Did you login with OAuth?", data: null, error: { code: "INVALID_CREDENTIALS" } });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password", data: null, error: { code: "INVALID_CREDENTIALS" } });
        }

        const { accessToken, refreshToken, refreshTokenHash } = generateTokens(user);

        // Store refresh token
        const tokenId = uuidv4();
        // Calculate expiry for 7 days
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        
        await db.execute(
            `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
            [tokenId, user.id, refreshTokenHash, expiresAt]
        );

        await db.execute(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [user.id]);

        res.status(200).json({
            message: "Login successful",
            data: {
                access_token: accessToken,
                refresh_token: refreshToken,
                token_type: "Bearer",
                expires_in: 900,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    display_name: user.display_name,
                    role: user.role_name,
                    avatar_url: user.avatar_url,
                    is_email_verified: Boolean(user.is_email_verified)
                }
            },
            error: null
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};

exports.refresh = async (req, res) => {
    const { refresh_token } = req.body || {};
    if (!refresh_token) {
        return res.status(400).json({ message: "refresh_token is required", data: null, error: { code: "VALIDATION_ERROR" } });
    }

    try {
        const hash = crypto.createHash('sha256').update(refresh_token).digest('hex');
        const [tokens] = await db.execute(`SELECT * FROM refresh_tokens WHERE token_hash = ?`, [hash]);
        
        if (tokens.length === 0) {
            return res.status(401).json({ message: "Invalid or expired refresh token", data: null, error: { code: "INVALID_REFRESH_TOKEN" } });
        }

        const storedToken = tokens[0];

        if (storedToken.revoked_at || new Date(storedToken.expires_at) < new Date()) {
            // Token reuse detection logic could go here
            return res.status(401).json({ message: "Invalid or expired refresh token", data: null, error: { code: "INVALID_REFRESH_TOKEN" } });
        }

        const [users] = await db.execute(
            `SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
            [storedToken.user_id]
        );
        const user = users[0];

        const { accessToken, refreshToken: newRefreshToken, refreshTokenHash } = generateTokens(user);

        // Revoke old token and insert new one in a transaction
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await conn.execute(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?`, [storedToken.id]);
            
            const tokenId = uuidv4();
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            await conn.execute(
                `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
                [tokenId, user.id, refreshTokenHash, expiresAt]
            );
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

        res.status(200).json({
            message: "Token refreshed",
            data: {
                access_token: accessToken,
                refresh_token: newRefreshToken,
                token_type: "Bearer",
                expires_in: 900
            },
            error: null
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};

exports.logout = async (req, res) => {
    const { refresh_token } = req.body || {};
    if (!refresh_token) {
        return res.status(400).json({ message: "refresh_token is required", data: null, error: { code: "VALIDATION_ERROR" } });
    }
    
    try {
        const hash = crypto.createHash('sha256').update(refresh_token).digest('hex');
        await db.execute(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND user_id = ?`, [hash, req.user.id]);
        
        res.status(200).json({ message: "Logged out successfully", data: null, error: null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};

exports.logoutAll = async (req, res) => {
    try {
        const [result] = await db.execute(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL`, [req.user.id]);
        
        res.status(200).json({
            message: "All sessions revoked successfully",
            data: { revoked_count: result.affectedRows },
            error: null
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};

exports.verifyEmail = async (req, res) => {
    const { token } = req.body || {};

    if (!token) {
        return res.status(400).json({
            message: "Validation failed",
            data: null,
            error: { code: "VALIDATION_ERROR", details: "token is required" }
        });
    }

    try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        
        const [rows] = await db.execute(
            `SELECT * FROM email_verification_tokens WHERE token_hash = ?`,
            [tokenHash]
        );

        if (rows.length === 0) {
            return res.status(400).json({
                message: "Invalid or expired verification token",
                data: null,
                error: { code: "INVALID_TOKEN" }
            });
        }

        const verificationToken = rows[0];

        if (verificationToken.used_at || new Date(verificationToken.expires_at) < new Date()) {
            return res.status(400).json({
                message: "Invalid or expired verification token",
                data: null,
                error: { code: "INVALID_TOKEN" }
            });
        }

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            await conn.execute(
                `UPDATE users SET is_email_verified = 1, email_verified_at = NOW() WHERE id = ?`,
                [verificationToken.user_id]
            );

            await conn.execute(
                `UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ?`,
                [verificationToken.id]
            );

            await conn.commit();

            res.status(200).json({
                message: "Email verified successfully",
                data: null,
                error: null
            });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};
