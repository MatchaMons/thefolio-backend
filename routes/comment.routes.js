const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { protect } = require('../middleware/auth.middleware');

// @route   GET /api/comments/:postId
// @desc    Get all intel feedback (comments) for a specific mission
router.get('/:postId', async (req, res) => {
  try {
    const { postId } = req.params; // Make sure you're pulling postId here
    const result = await pool.query(`
      SELECT comments.*, users.name AS author_name 
      FROM comments 
      JOIN users ON comments.user_id = users.id 
      WHERE post_id = $1 
      ORDER BY created_at ASC`, 
      [postId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching comments' });
  }
});

// @route   POST /api/comments
// @desc    Post new intel feedback
router.post('/', protect, async (req, res) => {
  const { postId, body } = req.body; 

  try {
    const result = await pool.query(
      'INSERT INTO comments (post_id, user_id, body) VALUES ($1, $2, $3) RETURNING *',
      [postId, req.user.id, body] 
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("MISSION CRITICAL ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;