const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { protect } = require('../middleware/auth.middleware');

// @route   GET /api/comments/:postId
router.get('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const result = await pool.query(`
      SELECT comments.*, users.name AS author_name 
      FROM comments 
      JOIN users ON comments.author_id = users.id 
      WHERE post_id = $1 
      ORDER BY created_at ASC`, 
      [postId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET COMMENTS ERROR:", err);
    res.status(500).json({ message: 'Error fetching comments' });
  }
});

// @route   POST /api/comments/:postId
// Matches your React call: API.post('/comments/${id}', { content: newComment })
router.post('/:postId', protect, async (req, res) => {
  const { postId } = req.params;
  const { content } = req.body; 

  try {
    const result = await pool.query(
      'INSERT INTO comments (post_id, author_id, content) VALUES ($1, $2, $3) RETURNING *',
      [postId, req.user.id, content] 
    );

    const newComment = result.rows[0];
    newComment.author_name = req.user.name; // For immediate UI update
    res.status(201).json(newComment);
  } catch (err) {
    console.error("COMMENT INSERT ERROR:", err.message);
    res.status(500).json({ message: 'Mission Critical Error: Check table columns' });
  }
});

module.exports = router;