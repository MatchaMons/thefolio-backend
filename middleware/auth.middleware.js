const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// The ultimate gatekeeper: verifies the token and loads the user
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        console.log("❌ ACCESS DENIED: NO TOKEN");
        return res.status(401).json({ message: 'NOT AUTHORIZED: PLEASE LOGIN' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Standardized to profile_pic (lowercase, no quotes needed for Postgres)
        // 🟢 This is the fix that allows profile updates to proceed.
        const result = await pool.query(
            'SELECT id, name, email, bio, profile_pic, role, status FROM users WHERE id = $1', 
            [decoded.id]
        );

        const user = result.rows[0];

        if (!user || user.status === 'inactive') {
            return res.status(401).json({ message: 'ACCOUNT INACTIVE OR MISSING' });
        }

        req.user = user; 
        next();
    } catch (err) {
        console.error("❌ SESSION EXPIRED:", err.message);
        return res.status(401).json({ message: 'SESSION EXPIRED: LOGIN AGAIN' });
    }

    const adminOnly = (req, res, next) => {
    // We already have req.user from the 'protect' middleware
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'ACCESS DENIED: ADMIN PRIVILEGES REQUIRED' });
    }
};

module.exports = { protect, adminOnly };
};

module.exports = { protect };