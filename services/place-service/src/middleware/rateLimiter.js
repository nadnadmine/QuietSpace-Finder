const rateLimit = require('express-rate-limit');

// ─────────────────────────────────────────────────────────────
// 1. GLOBAL API RATE LIMITER
//    Berlaku untuk semua endpoint /api/*
//    Maksimal 5 request per menit per IP 
// ─────────────────────────────────────────────────────────────
const globalApiLimiter = rateLimit({
    windowMs: 60 * 1000,        // Jendela waktu: 1 menit (60.000 ms)
    max: 5,                      // Maksimal 5 request per IP per jendela waktu
    standardHeaders: true,       // Kirim header RateLimit-* (standar RFC 6585)
    legacyHeaders: false,        // Nonaktifkan header X-RateLimit-* (sudah deprecated)

    // Pesan error yang dikembalikan saat limit terlampaui (HTTP 429)
    message: {
        success: false,
        status: 429,
        error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Terlalu banyak permintaan dari IP ini. Maksimal 5 request per menit. Coba lagi setelah 1 menit.',
            retryAfter: '60 detik'
        }
    },

    // Custom handler saat rate limit terlampaui (opsional, untuk logging)
    handler: (req, res, next, options) => {
        const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        console.warn(`[RATE LIMIT] ⛔ IP ${clientIp} telah melebihi batas request pada endpoint: ${req.path}`);
        res.status(options.statusCode).json(options.message);
    },

    // Fungsi untuk generate key unik per client (default: IP address)
    keyGenerator: (req) => {
        return req.ip || req.headers['x-forwarded-for'] || 'unknown';
    },

    // Lewati rate limiting untuk health check endpoint
    skip: (req) => req.path === '/health'
});

// ─────────────────────────────────────────────────────────────
// 2. STRICT LIMITER untuk endpoint sensitif
//    Contoh: Create Place, Submit Report
//    Lebih ketat: maksimal 3 request per menit
// ─────────────────────────────────────────────────────────────
const strictLimiter = rateLimit({
    windowMs: 60 * 1000,        // 1 menit
    max: 3,                      // Lebih ketat: 3 request per menit
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        status: 429,
        error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Terlalu banyak percobaan untuk endpoint ini. Maksimal 3 request per menit.',
            retryAfter: '60 detik'
        }
    },
    handler: (req, res, next, options) => {
        const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        console.warn(`[RATE LIMIT STRICT] ⛔ IP ${clientIp} blocked di endpoint sensitif: ${req.path}`);
        res.status(options.statusCode).json(options.message);
    }
});

// ─────────────────────────────────────────────────────────────
// 3. READ-ONLY LIMITER untuk endpoint GET (lebih longgar)
//    Cocok untuk endpoint publik seperti daftar tempat
//    Maksimal 20 request per menit
// ─────────────────────────────────────────────────────────────
const readOnlyLimiter = rateLimit({
    windowMs: 60 * 1000,        // 1 menit
    max: 20,                     // Lebih longgar untuk GET request
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        status: 429,
        error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Terlalu banyak request baca. Maksimal 20 request per menit.',
            retryAfter: '60 detik'
        }
    }
});

module.exports = {
    globalApiLimiter,
    strictLimiter,
    readOnlyLimiter
};