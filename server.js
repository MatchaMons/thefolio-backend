const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth.routes');
const postRoutes = require('./routes/post.routes');
const commentRoutes = require('./routes/comment.routes');
const fs = require('fs');
require('dotenv').config();


const app = express();

// 🟢 ALLOW CROSS-ORIGIN REQUESTS
app.use(cors({
origin: [
'http://localhost:3000',
'https://thefolio-frontend.vercel.app',
],
credentials: true
}));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
    console.log("📁 Uploads directory created.");
}

app.use(express.json());

// Static folder for uploaded avatars
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 MISSION CONTROL ACTIVE ON PORT ${PORT}`);
});