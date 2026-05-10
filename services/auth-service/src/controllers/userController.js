const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { publishEvent } = require('../utils/rabbitmq');

exports.getMe = async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT u.id, u.username, u.email, u.display_name, u.avatar_url, u.bio, 
                    r.name as role, u.is_email_verified, u.created_at
             FROM users u 
             JOIN roles r ON u.role_id = r.id 
             WHERE u.id = ?`,
            [req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "User not found", data: null, error: { code: "NOT_FOUND" } });
        }

        const user = rows[0];
        // Convert integer to boolean
        user.is_email_verified = Boolean(user.is_email_verified);

        res.status(200).json({
            message: "User profile retrieved successfully",
            data: { user },
            error: null
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};

exports.updateMe = async (req, res) => {
    const { display_name, bio, avatar_url } = req.body || {};

    if (display_name === undefined && bio === undefined && avatar_url === undefined) {
        return res.status(400).json({
            message: "Validation failed",
            data: null,
            error: { code: "VALIDATION_ERROR", details: "At least one field to update must be provided" }
        });
    }

    if (bio && bio.length > 500) {
        return res.status(400).json({
            message: "Validation failed",
            data: null,
            error: { code: "VALIDATION_ERROR", details: { bio: "Bio must not exceed 500 characters" } }
        });
    }

    try {
        const updates = [];
        const params = [];

        if (display_name !== undefined) {
            updates.push('display_name = ?');
            params.push(display_name);
        }
        if (bio !== undefined) {
            updates.push('bio = ?');
            params.push(bio);
        }
        if (avatar_url !== undefined) {
            updates.push('avatar_url = ?');
            params.push(avatar_url);
        }

        if (updates.length > 0) {
            params.push(req.user.id);
            await db.execute(
                `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                params
            );
        }

        // Fetch updated user to return
        const [rows] = await db.execute(
            `SELECT id, username, display_name, bio, avatar_url, updated_at
             FROM users WHERE id = ?`,
            [req.user.id]
        );

        res.status(200).json({
            message: "Profile updated successfully",
            data: { user: rows[0] },
            error: null
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};

exports.updateRole = async (req, res) => {
    const { userId } = req.params;
    const { role } = req.body || {};
    const allowedRoles = ['user', 'moderator', 'admin'];

    if (!allowedRoles.includes(role)) {
        return res.status(400).json({
            message: "Invalid role value",
            data: null,
            error: { code: "INVALID_ROLE" }
        });
    }

    if (userId === req.user.id) {
        return res.status(400).json({
            message: "An admin cannot change their own role",
            data: null,
            error: { code: "SELF_ROLE_CHANGE_NOT_ALLOWED" }
        });
    }

    try {
        const [users] = await db.execute(
            `SELECT u.id, r.name as role
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.id = ? AND u.deleted_at IS NULL`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                message: "User not found",
                data: null,
                error: { code: "NOT_FOUND" }
            });
        }

        const oldRole = users[0].role;

        await db.execute(
            `UPDATE users SET role_id = (SELECT id FROM roles WHERE name = ?) WHERE id = ?`,
            [role, userId]
        );

        await publishEvent('user_events', {
            event_id: uuidv4(),
            event_type: 'user.role_changed',
            source_service: 'auth-service',
            payload: {
                user_id: userId,
                old_role: oldRole,
                new_role: role,
                changed_by: req.user.id
            }
        });

        res.status(200).json({
            message: "User role updated successfully",
            data: {
                user_id: userId,
                old_role: oldRole,
                new_role: role
            },
            error: null
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: "Internal server error",
            data: null,
            error: { code: "INTERNAL_ERROR" }
        });
    }
};

exports.deleteUser = async (req, res) => {
    const { userId } = req.params;

    if (userId === req.user.id) {
        return res.status(400).json({
            message: "An admin cannot delete their own account",
            data: null,
            error: { code: "SELF_DELETE_NOT_ALLOWED" }
        });
    }

    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        const [users] = await conn.execute(
            `SELECT id FROM users WHERE id = ? AND deleted_at IS NULL`,
            [userId]
        );

        if (users.length === 0) {
            await conn.rollback();
            return res.status(404).json({
                message: "User not found",
                data: null,
                error: { code: "NOT_FOUND" }
            });
        }

        await conn.execute(
            `UPDATE users
             SET is_active = 0, deleted_at = NOW()
             WHERE id = ?`,
            [userId]
        );

        await conn.execute(
            `UPDATE refresh_tokens
             SET revoked_at = NOW()
             WHERE user_id = ? AND revoked_at IS NULL`,
            [userId]
        );

        await conn.commit();

        res.status(200).json({
            message: "User deactivated successfully",
            data: { user_id: userId },
            error: null
        });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({
            message: "Internal server error",
            data: null,
            error: { code: "INTERNAL_ERROR" }
        });
    } finally {
        conn.release();
    }
};
