const jwt = require('jsonwebtoken');
require('dotenv').config();

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Unauthorized", data: null, error: { code: "UNAUTHORIZED" } });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { id: decoded.sub, role: decoded.role, email: decoded.email };
        next();
    } catch (err) {
        return res.status(401).json({ message: "Unauthorized", data: null, error: { code: "UNAUTHORIZED" } });
    }
};

const requireRole = (roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ message: "Forbidden", data: null, error: { code: "FORBIDDEN" } });
    }
    next();
};

module.exports = { authenticate, requireRole };
