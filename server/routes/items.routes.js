import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware.js';
import { publico } from '../publico.js';

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
  res.json(db.prepare(sql).all(...params).map(publico));
});

router.post('/', requireAuth, (req, res) => {
  const b = req.body || {};
  if (!b.section_id || !b.title) {
    return res.status(400).json({ error: 'section_id y title son obligatorios' });
  }
  const ref = typeof b.external_ref === 'string' && b.external_ref.trim() ? b.external_ref.trim().slice(0, 200) : null;
  if (ref) {
    // Idempotente: reintentar con la misma referencia devuelve el ítem ya creado.
    const previo = db.prepare('SELECT id FROM items WHERE external_ref = ?').get(ref);
    if (previo) return res.status(200).json({ id: previo.id, existente: true });
  }
  if (!db.prepare('SELECT 1 FROM sections WHERE id = ?').get(b.section_id)) {
    return res.status(400).json({ error: 'La sección no existe' });
  }
  const info = db
    .prepare(
      `INSERT INTO items (section_id, title, description, type, media_url, thumbnail_url, price, date, link_url, sort_order, external_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      b.sort_order || 0,
      ref
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
