const express = require('express');
const router = express.Router();
const pool = require('../config/db'); 
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { protect } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload');

// 🟢 REGISTER NEW OPERATOR
router.post('/register', async (req, res) => {
    const { name, email, password, gamer_tag, dob, interest_level } = req.body;

    try {
        // Check if operator already exists
        const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ message: 'OPERATOR ALREADY IN DATABASE' });
        }

        // Hash the password for security
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert into Supabase - Column names must match your DB exactly
        const result = await pool.query(
            `INSERT INTO users (name, email, password, gamer_tag, dob, interest_level) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING id, name, email`,
            [name, email.toLowerCase().trim(), hashedPassword, gamer_tag, dob, interest_level]
        );

        const newUser = result.rows[0];
        const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.status(201).json({
            token,
            id: newUser.id,
            name: newUser.name,
            message: 'REGISTRATION COMPLETE. WELCOME TO THE GUILD.'
        });
    } catch (err) {
        console.error("REGISTRATION ERROR:", err.message);
        res.status(500).json({ message: 'SYSTEM ERROR: QUEST FAILED' });
    }
});

// 🟢 LOGIN
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
        const user = result.rows[0];
        if (!user) return res.status(401).json({ message: 'INVALID CREDENTIALS' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'INVALID CREDENTIALS' });

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({
            token,
            id: user.id,
            name: user.name,
            email: user.email,
            bio: user.bio,
            profilePic: user.profile_pic,
            role: user.role // 🟢 ADD THIS
        });
    } catch (err) {
        res.status(500).json({ message: 'SYSTEM ERROR' });
    }
});

// 🟢 UPDATE PROFILE (Text & Avatar)
router.put('/profile', protect, upload.single('profilePic'), async (req, res) => {
    const { name, bio } = req.body;
    const userId = req.user.id;
    const newPic = req.file ? req.file.filename : null;

    try {
        let result;
        if (newPic) {
            result = await pool.query(
                'UPDATE users SET name = $1, bio = $2, profile_pic = $3 WHERE id = $4 RETURNING id, name, email, bio, profile_pic',
                [name, bio, newPic, userId]
            );
        } else {
            result = await pool.query(
                'UPDATE users SET name = $1, bio = $2 WHERE id = $3 RETURNING id, name, email, bio, profile_pic',
                [name, bio, userId]
            );
        }
        const updatedUser = result.rows[0];
        res.json({
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            bio: updatedUser.bio,
            profilePic: updatedUser.profile_pic
        });
    } catch (err) {
        res.status(500).json({ message: 'UPDATE FAILED' });
    }
});

// 🟢 CHANGE PASSWORD (The Missing Piece)
router.put('/change-password', protect, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    try {
        const result = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
        const user = result.rows[0];

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: 'INCORRECT CURRENT PASSWORD' });

        const salt = await bcrypt.genSalt(10);
        const hashedPw = await bcrypt.hash(newPassword, salt);

        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPw, userId]);
        res.json({ message: 'SECURITY UPGRADED: PASSWORD CHANGED!' });
    } catch (err) {
        res.status(500).json({ message: 'PASSWORD UPDATE FAILED' });
    }
});

// GET /api/auth/me
router.get('/me', protect, (req, res) => {
    res.json(req.user); // req.user is populated by your 'protect' middleware
});

module.exports = router;