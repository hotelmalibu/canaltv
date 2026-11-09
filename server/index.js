import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initSchema, seedIfEmpty } from './db.js';
import authRoutes from './routes/auth.routes.js';
import sectionRoutes from './routes/sections.routes.js';
import itemRoutes from './routes/items.routes.js';
import uploadRoutes from './routes/uploads.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

initSchema();
seedIfEmpty();

const app = express();
app.use(express.json({ limit: '2mb' }));

// API REST
app.use('/api/auth', authRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/uploads', uploadRoutes);

// Archivos multimedia (soporta Range para poder adelantar/retroceder videos)
app.use('/uploads', express.static(path.join(publicDir, 'uploads')));

// Imágenes del hotel (fotos y logo)
app.use('/img', express.static(path.join(publicDir, 'img')));

// Interfaces
app.use('/tv', express.static(path.join(publicDir, 'tv')));
app.use('/admin', express.static(path.join(publicDir, 'admin')));
app.get('/', (req, res) => res.redirect('/tv/'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Hotel TV corriendo en http://localhost:${PORT}`);
  console.log(`  TV:    http://localhost:${PORT}/tv/`);
  console.log(`  Admin: http://localhost:${PORT}/admin/`);
});
