import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { requireAuth } from '../middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_IMAGE = /\.(jpe?g|png|gif|webp|svg)$/i;
const ALLOWED_VIDEO = /\.(mp4|webm|mov|m4v|mkv)$/i;

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE.test(file.originalname) || ALLOWED_VIDEO.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido (solo imágenes y videos)'));
    }
  }
});

const router = Router();

router.post('/', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
  res.status(201).json({ url: `/uploads/${req.file.filename}`, name: req.file.originalname });
});

export default router;
