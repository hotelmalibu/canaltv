import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initSchema, seedIfEmpty, motorDb } from './db.js';
import authRoutes from './routes/auth.routes.js';
import sectionRoutes from './routes/sections.routes.js';
import itemRoutes from './routes/items.routes.js';
import { uploadsRouter, filesRouter } from './routes/uploads.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

await initSchema();
await seedIfEmpty();

const app = express();
app.use(express.json({ limit: '2mb' }));

// API REST
app.use('/api/auth', authRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/uploads', uploadsRouter);

// Videos e imágenes subidos (guardados en la base de datos; soportan Range)
app.use('/uploads', filesRouter);

// Imágenes del hotel (fotos y logo)
app.use('/img', express.static(path.join(publicDir, 'img')));

// Interfaces
app.use('/tv', express.static(path.join(publicDir, 'tv')));
app.use('/admin', express.static(path.join(publicDir, 'admin')));
app.get('/', (req, res) => res.redirect('/tv/'));

// Errores: siempre JSON en español, sin detalles internos.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    const mb = Number(process.env.MAX_FILE_MB || 100);
    return res.status(413).json({ error: `El archivo supera el máximo de ${mb} MB.` });
  }
  if (err?.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  console.error('[error]', err?.message || err);
  res.status(500).json({ error: 'Error del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Hotel TV corriendo en http://localhost:${PORT} (base de datos: ${motorDb})`);
  console.log(`  TV:    http://localhost:${PORT}/tv/`);
  console.log(`  Admin: http://localhost:${PORT}/admin/`);
});
