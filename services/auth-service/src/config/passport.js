const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const https = require('https');
const db = require('../db');

// Fetch GitHub emails via API (needed when user hides email on GitHub profile)
const fetchGitHubEmails = (accessToken) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: '/user/emails',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'QuietSpace-Finder',
                'Accept': 'application/vnd.github+json'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.end();
    });
};

// Helper to generate tokens inside passport strategy
const generateAndStoreTokens = async (user) => {
    const payload = { sub: user.id, role: user.role_name, email: user.email };
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' });
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const tokenId = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    await db.execute(
        `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
        [tokenId, user.id, refreshTokenHash, expiresAt]
    );

    return { accessToken, refreshToken };
};

const handleOAuth = async (providerName, profile, accessToken, refreshToken, done) => {
    try {
        const providerIdMap = { 'google': 1, 'github': 2 }; // Ensure these match oauth_providers table
        const providerId = providerIdMap[providerName];
        const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;

        if (!email) {
            return done(new Error('Email not found in OAuth profile'), null);
        }

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            // 1. Check if OAuth account exists
            const [oauthRows] = await conn.execute(
                `SELECT o.user_id FROM oauth_accounts o WHERE o.provider_id = ? AND o.provider_user_id = ?`,
                [providerId, profile.id]
            );

            let userId;
            let isNewUser = false;

            if (oauthRows.length > 0) {
                userId = oauthRows[0].user_id;
            } else {
                // 2. Check if user with this email exists
                const [userRows] = await conn.execute(`SELECT id FROM users WHERE email = ?`, [email]);
                
                if (userRows.length > 0) {
                    userId = userRows[0].id;
                } else {
                    // 3. Create new user
                    userId = uuidv4();
                    const username = `user_${crypto.randomBytes(4).toString('hex')}`;
                    const displayName = profile.displayName || profile.username || username;
                    
                    await conn.execute(
                        `INSERT INTO users (id, role_id, username, email, display_name, is_email_verified) 
                         VALUES (?, (SELECT id FROM roles WHERE name = 'user'), ?, ?, ?, 1)`,
                        [userId, username, email, displayName]
                    );
                    isNewUser = true;
                }

                // Link OAuth account
                await conn.execute(
                    `INSERT INTO oauth_accounts (id, user_id, provider_id, provider_user_id, provider_email, raw_profile) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [uuidv4(), userId, providerId, profile.id, email, JSON.stringify(profile)]
                );
            }

            // Fetch complete user profile for token payload
            const [users] = await conn.execute(
                `SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
                [userId]
            );
            const user = users[0];

            await conn.execute(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [user.id]);
            
            await conn.commit();

            const tokens = await generateAndStoreTokens(user);

            const result = {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                isNew: isNewUser,
                profile: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    display_name: user.display_name,
                    role: user.role_name,
                    avatar_url: user.avatar_url,
                    is_email_verified: Boolean(user.is_email_verified)
                }
            };

            return done(null, result);

        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (err) {
        return done(err, null);
    }
};

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'placeholder',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/oauth/google/callback'
  },
  (accessToken, refreshToken, profile, done) => {
    handleOAuth('google', profile, accessToken, refreshToken, done);
  }
));

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID || 'placeholder',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || 'placeholder',
    callbackURL: process.env.GITHUB_CALLBACK_URL || '/api/auth/oauth/github/callback',
    scope: ['user:email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
        // GitHub may not include email in profile if user set it to private.
        // Fetch from /user/emails API as fallback.
        if (!profile.emails || profile.emails.length === 0) {
            const githubEmails = await fetchGitHubEmails(accessToken);
            // Prefer primary + verified email, fallback to any verified, then any
            const primary = githubEmails.find(e => e.primary && e.verified)
                         || githubEmails.find(e => e.verified)
                         || githubEmails[0];
            if (primary && primary.email) {
                profile.emails = [{ value: primary.email }];
            }
        }
        handleOAuth('github', profile, accessToken, refreshToken, done);
    } catch (err) {
        done(err, null);
    }
  }
));

module.exports = passport;
