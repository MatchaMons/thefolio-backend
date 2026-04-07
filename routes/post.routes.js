const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { protect } = require('../middleware/auth.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- MULTER CONFIG ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); 
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// @route   GET /api/posts
// @desc    Get all posts + Author Names + Reaction Counts
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        posts.*, 
        users.name AS author_name,
        (SELECT COUNT(*) FROM post_reactions WHERE post_id = posts.id) AS reaction_count
      FROM posts 
      LEFT JOIN users ON posts.author_id = users.id 
      ORDER BY posts.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("FETCH ERROR:", err);
    // This message helps you see if it's a DB issue in the browser console
    res.status(500).json({ message: 'Database Error: Check if post_reactions table exists' });
  }
});

// @route   GET /api/posts/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        posts.*, 
        users.name AS author_name,
        (SELECT COUNT(*) FROM post_reactions WHERE post_id = posts.id) AS reaction_count
      FROM posts 
      -- CHANGE 'INNER' TO 'LEFT' HERE --
      LEFT JOIN users ON posts.author_id = users.id 
      WHERE posts.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) return res.status(404).json({ message: 'Post not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("SINGLE FETCH ERROR:", err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   POST /api/posts
router.post('/', protect, upload.single('image'), async (req, res) => {
  const { title, content } = req.body; // 'content' comes from your React form
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    if (!title || !content) {
      if (req.file) fs.unlinkSync(req.file.path); 
      return res.status(400).json({ message: 'Title and content are required.' });
    }

    const result = await pool.query(
      // We map 'content' to 'body' here to match your SQL table
      'INSERT INTO posts (title, body, image, author_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, content, imagePath, req.user.id]
    );

    const newPost = result.rows[0];
    // We add the author_name manually so the frontend can display it immediately 
    // without needing a refresh
    newPost.author_name = req.user.name || 'Unknown User'; 
    
    res.status(201).json(newPost);
  } catch (err) {
    if (req.file) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
    console.error("DATABASE INSERT ERROR:", err);
    res.status(500).json({ message: 'Server Error: Check if table schema matches' });
  }
});

// 🟢 NEW: @route DELETE /api/posts/:id
// @desc    Delete post (Author or Admin only)
router.delete('/:id', protect, async (req, res) => {
    try {
        // 1. Check if post exists and get author
        const postCheck = await pool.query('SELECT author_id FROM posts WHERE id = $1', [req.params.id]);
        
        if (postCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Mission Intel not found' });
        }

        const post = postCheck.rows[0];

        // 2. Permission Check: Author ID matches OR User is Admin
        const isAuthor = post.author_id === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isAuthor && !isAdmin) {
            return res.status(403).json({ message: 'Not authorized to scrub this intel' });
        }

        // 3. Delete the post
        await pool.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
        
        res.json({ message: 'Mission successfully scrubbed from the board' });
    } catch (err) {
        console.error("DELETE ERROR:", err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/posts/:id/react
router.post('/:id/react', protect, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const { type } = req.body;

  try {
    const existing = await pool.query(
      'SELECT * FROM post_reactions WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );

    if (existing.rows.length > 0) {
      if (existing.rows[0].reaction_type === type) {
        await pool.query('DELETE FROM post_reactions WHERE id = $1', [existing.rows[0].id]);
        return res.json({ message: 'Reaction removed', type: null });
      } else {
        await pool.query(
          'UPDATE post_reactions SET reaction_type = $1 WHERE id = $2',
          [type, existing.rows[0].id]
        );
        return res.json({ message: 'Reaction updated', type });
      }
    }

    await pool.query(
      'INSERT INTO post_reactions (post_id, user_id, reaction_type) VALUES ($1, $2, $3)',
      [postId, userId, type]
    );
    res.status(201).json({ message: 'Reaction added', type });
  } catch (err) {
    console.error("REACTION ERROR:", err);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;