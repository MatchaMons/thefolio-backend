const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- 1. ENSURE UPLOADS DIRECTORY EXISTS ---
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log("📁 Uploads directory created.");
}

// --- 2. UPDATED STORAGE LOGIC ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 🟢 Sanitizes filenames by replacing spaces with underscores
    const safeName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB Limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Images only!'));
  }
});

// 🟢 EXPORTING DIRECTLY SO .single() WORKS
module.exports = upload;