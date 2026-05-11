const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Upstream URLs
const AUTH_SERVICE = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const PLACE_SERVICE = process.env.PLACE_SERVICE_URL || 'http://localhost:3002';
const NOTIFICATION_SERVICE = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8080';

// Global Middlewares
app.use(helmet());
app.use(cors());

// Generate Request ID
app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
});

// Logging setup matching the spec
morgan.token('req-id', (req) => req.id);
app.use(morgan(':req-id :date[iso] :method :url :status :response-time ms - :remote-addr'));

// Rate Limiting Config
const globalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            message: "Too many requests. Please slow down.",
            data: null,
            error: { code: "RATE_LIMITED", retry_after_seconds: 60 }
        });
    }
});

const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            message: "Too many requests. Please slow down.",
            data: null,
            error: { code: "RATE_LIMITED", retry_after_seconds: 60 }
        });
    }
});

const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            message: "Too many requests. Please slow down.",
            data: null,
            error: { code: "RATE_LIMITED", retry_after_seconds: 60 }
        });
    }
});

app.use(globalLimiter);

// Specific Rate Limits
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return writeLimiter(req, res, next);
    }
    next();
});

// Health Check Endpoint
app.get('/health', async (req, res) => {
    // Basic ping check for upstream services with timeout
    const checkService = async (url) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        try {
            const start = Date.now();
            const response = await fetch(`${url}/health`, { 
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return {
                status: response.ok ? "healthy" : "degraded",
                response_time_ms: Date.now() - start,
                url
            };
        } catch (err) {
            clearTimeout(timeoutId);
            return { 
                status: "unhealthy", 
                error: err.name === 'AbortError' ? 'Timeout' : err.message, 
                url 
            };
        }
    };

    res.status(200).json({
        message: "All services status",
        data: {
            gateway: { 
                status: "healthy", 
                timestamp: new Date().toISOString(),
                uptime_seconds: Math.floor(process.uptime())
            },
            services: {
                "auth-service": await checkService(AUTH_SERVICE),
                "place-service": await checkService(PLACE_SERVICE),
                "notification-service": await checkService(NOTIFICATION_SERVICE)
            }
        },
        error: null
    });
});

// API Info Endpoint
app.get('/api', (req, res) => {
    res.status(200).json({
        message: "QuietSpace Finder API",
        data: {
            version: "1.0.0",
            description: "Backend API for QuietSpace Finder — find and report quiet places",
            routes: {
                "/api/auth": "Auth Service",
                "/api/users": "Auth Service",
                "/api/places": "Place Service",
                "/api/bookmarks": "Place Service",
                "/api/tags": "Place Service",
                "/api/reports": "Place Service",
                "/api/notifications": "Notification Service"
            }
        },
        error: null
    });
});

// Proxy Setup
const proxyOptions = (target, prefix) => ({
    target,
    changeOrigin: true,
    // Restore the exact original path to prevent trailing slash issues
    pathRewrite: (path, req) => req.originalUrl,
    onError: (err, req, res) => {
        res.status(503).json({
            message: "Service temporarily unavailable",
            data: null,
            error: { code: "UPSTREAM_UNAVAILABLE", details: err.message }
        });
    }
});

// Auth Service Routes
app.use('/api/auth', createProxyMiddleware(proxyOptions(AUTH_SERVICE, '/api/auth')));
app.use('/api/users', createProxyMiddleware(proxyOptions(AUTH_SERVICE, '/api/users')));

// Place Service Routes
app.use('/api/places', createProxyMiddleware(proxyOptions(PLACE_SERVICE, '/api/places')));
app.use('/api/bookmarks', createProxyMiddleware(proxyOptions(PLACE_SERVICE, '/api/bookmarks')));
app.use('/api/tags', createProxyMiddleware(proxyOptions(PLACE_SERVICE, '/api/tags')));
app.use('/api/reports', createProxyMiddleware(proxyOptions(PLACE_SERVICE, '/api/reports')));

// Notification Service Routes
app.use('/api/notifications', createProxyMiddleware(proxyOptions(NOTIFICATION_SERVICE, '/api/notifications')));

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Gateway is running on port ${PORT}`);
});
