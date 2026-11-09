import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { query, uno } from '../db.js';
import { ah } from '../async.js';
import { requireAuth } from '../middleware.js';

const ALLOWED_IMAGE = /\.(jpe?g|png|gif|webp|svg)$/i;
const ALLOWED_VIDEO = /\.(mp4|webm|mov|m4v|mkv)$/i;

const MIME = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

const MB = 1024 * 1024;
// Los archivos viven en la base de datos: el plan gratis de Neon tiene 0,5 GB, así que se limita cada archivo
// y el total para no llenarla (una base llena deja de aceptar también el contenido de texto).
const mb = (valor, porDefecto) => {
  const n = Number(valor);
  return Math.floor((Number.isFinite(n) && n > 0 ? n : porDefecto) * MB);
};
const MAX_ARCHIVO = mb(process.env.MAX_FILE_MB, 100);
const MAX_TOTAL = mb(process.env.MAX_STORAGE_MB, 350);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ARCHIVO },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE.test(file.originalname) || ALLOWED_VIDEO.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Tipo de archivo no permitido (solo imágenes y videos)'), { status: 400 }));
    }
  },
});

export const uploadsRouter = Router();

uploadsRouter.post('/', requireAuth, upload.single('file'), ah(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
  const { total } = await uno('SELECT COALESCE(SUM(size), 0)::bigint::float8 AS total FROM files');
  if (total + req.file.size > MAX_TOTAL) {
    return res.status(413).json({
      error: `No hay espacio: los archivos ocupan ${Math.round(total / MB)} MB de ${Math.round(MAX_TOTAL / MB)} MB. Elimina contenido que ya no uses.`,
    });
  }
  const ext = path.extname(req.file.originalname).toLowerCase();
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  await query('INSERT INTO files (name, mime, size, data) VALUES ($1, $2, $3, $4)', [
    name,
    MIME[ext] || 'application/octet-stream',
    req.file.size,
    req.file.buffer,
  ]);
  res.status(201).json({ url: `/uploads/${name}`, name: req.file.originalname });
}));

// ---------- Descarga: soporta Range para poder adelantar y retroceder los videos ----------
const TROZO_ABIERTO = 8 * MB; // una petición "bytes=0-" recibe como máximo este trozo; el navegador pide el resto

function parseRange(cabecera, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(cabecera || '');
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start;
  let end;
  if (m[1] === '') {
    start = Math.max(size - Number(m[2]), 0);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? Math.min(start + TROZO_ABIERTO - 1, size - 1) : Math.min(Number(m[2]), size - 1);
  }
  if (!Number.isFinite(start) || start >= size || start > end) return 'invalido';
  return { start, end };
}

export const filesRouter = Router();

filesRouter.get('/:name', ah(async (req, res) => {
  const meta = await uno('SELECT mime, size FROM files WHERE name = $1', [req.params.name]);
  if (!meta) return res.status(404).json({ error: 'Archivo no encontrado' });

  res.set({
    'Content-Type': meta.mime,
    'Accept-Ranges': 'bytes',
    // El nombre es único (marca de tiempo + aleatorio): el contenido nunca cambia.
    'Cache-Control': 'public, max-age=31536000, immutable',
  });

  const rango = parseRange(req.headers.range, meta.size);
  if (rango === 'invalido') {
    res.set('Content-Range', `bytes */${meta.size}`);
    return res.status(416).end();
  }
  if (rango) {
    // substring de bytea es base 1: solo se lee de la base el trozo pedido.
    const fila = await uno('SELECT substring(data FROM $2::int FOR $3::int) AS trozo FROM files WHERE name = $1', [
      req.params.name,
      rango.start + 1,
      rango.end - rango.start + 1,
    ]);
    const trozo = Buffer.from(fila.trozo);
    res.status(206).set({ 'Content-Range': `bytes ${rango.start}-${rango.end}/${meta.size}`, 'Content-Length': trozo.length });
    return res.end(trozo);
  }
  const fila = await uno('SELECT data FROM files WHERE name = $1', [req.params.name]);
  const todo = Buffer.from(fila.data);
  res.set('Content-Length', todo.length);
  res.end(todo);
}));
