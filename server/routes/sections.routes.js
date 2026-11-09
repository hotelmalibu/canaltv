import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware.js';

const router = Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM sections ORDER BY sort_order, id').all();
  res.json(rows);
});

router.get('/:id/items', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM items WHERE section_id = ? AND active = 1 ORDER BY sort_order, id')
    .all(req.params.id);
  res.json(rows);
});

router.post('/', requireAuth, (req, res) => {
  const { name, slug, icon, sort_order } = req.body || {};
  if (!name || !slug) {
    return res.status(400).json({ error: 'name y slug son obligatorios' });
  }
  try {
    const info = db
      .prepare('INSERT INTO sections (name, slug, icon, sort_order) VALUES (?, ?, ?, ?)')
      .run(name, slug, icon || '', sort_order || 0);
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  } catch {
    res.status(400).json({ error: 'El slug ya existe o los datos son inválidos' });
  }
});

router.put('/:id', requireAuth, (req, res) => {
  const cur = db.prepare('SELECT * FROM sections WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Sección no encontrada' });
  const b = req.body || {};
  db.prepare(
    'UPDATE sections SET name = ?, slug = ?, icon = ?, sort_order = ?, active = ? WHERE id = ?'
  ).run(
    b.name ?? cur.name,
    b.slug ?? cur.slug,
    b.icon ?? cur.icon,
    b.sort_order ?? cur.sort_order,
    b.active ?? cur.active,
    req.params.id
  );
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sections WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
