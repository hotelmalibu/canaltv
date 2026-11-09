import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware.js';

const router = Router();

const JOIN = `
  SELECT i.*, s.name AS section_name, s.slug AS section_slug, s.icon AS section_icon
  FROM items i JOIN sections s ON s.id = i.section_id
`;

router.get('/', (req, res) => {
  let sql = `${JOIN} WHERE 1 = 1`;
  const params = [];
  if (req.query.section) {
    sql += ' AND s.slug = ?';
    params.push(req.query.section);
  }
  if (req.query.type) {
    sql += ' AND i.type = ?';
    params.push(req.query.type);
  }
  sql += ' ORDER BY s.sort_order, i.sort_order, i.id';
  res.json(db.prepare(sql).all(...params));
});

router.post('/', requireAuth, (req, res) => {
  const b = req.body || {};
  if (!b.section_id || !b.title) {
    return res.status(400).json({ error: 'section_id y title son obligatorios' });
  }
  const info = db
    .prepare(
      `INSERT INTO items (section_id, title, description, type, media_url, thumbnail_url, price, date, link_url, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      b.section_id,
      b.title,
      b.description || '',
      b.type || 'video',
      b.media_url || '',
      b.thumbnail_url || '',
      b.price || '',
      b.date || '',
      b.link_url || '',
      b.sort_order || 0
    );
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

router.put('/:id', requireAuth, (req, res) => {
  const cur = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Ítem no encontrado' });
  const b = req.body || {};
  const fields = [
    'section_id', 'title', 'description', 'type', 'media_url',
    'thumbnail_url', 'price', 'date', 'link_url', 'sort_order', 'active'
  ];
  const sets = fields.map((f) => `${f} = ?`).join(', ');
  const vals = fields.map((f) => (b[f] !== undefined ? b[f] : cur[f]));
  db.prepare(`UPDATE items SET ${sets} WHERE id = ?`).run(...vals, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
