import { Router } from 'express';
import { query, uno, limpiarArchivosHuerfanos } from '../db.js';
import { ah } from '../async.js';
import { requireAuth } from '../middleware.js';
import { publico } from '../publico.js';

const router = Router();

const JOIN = `
  SELECT i.*, s.name AS section_name, s.slug AS section_slug, s.icon AS section_icon
  FROM items i JOIN sections s ON s.id = i.section_id
`;

const esId = (v) => /^\d{1,9}$/.test(String(v));

router.get('/', ah(async (req, res) => {
  let sql = `${JOIN} WHERE 1 = 1`;
  const params = [];
  if (req.query.section) {
    params.push(req.query.section);
    sql += ` AND s.slug = $${params.length}`;
  }
  if (req.query.type) {
    params.push(req.query.type);
    sql += ` AND i.type = $${params.length}`;
  }
  sql += ' ORDER BY s.sort_order, i.sort_order, i.id';
  res.json((await query(sql, params)).map(publico));
}));

router.post('/', requireAuth, ah(async (req, res) => {
  const b = req.body || {};
  if (!b.section_id || !b.title) {
    return res.status(400).json({ error: 'section_id y title son obligatorios' });
  }
  const ref = typeof b.external_ref === 'string' && b.external_ref.trim() ? b.external_ref.trim().slice(0, 200) : null;
  if (ref) {
    // Idempotente: reintentar con la misma referencia devuelve el ítem ya creado.
    const previo = await uno('SELECT id FROM items WHERE external_ref = $1', [ref]);
    if (previo) return res.status(200).json({ id: previo.id, existente: true });
  }
  if (!esId(b.section_id) || !(await uno('SELECT 1 AS x FROM sections WHERE id = $1', [b.section_id]))) {
    return res.status(400).json({ error: 'La sección no existe' });
  }
  const fila = await uno(
    `INSERT INTO items (section_id, title, description, type, media_url, thumbnail_url, price, date, link_url, sort_order, external_ref)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [
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
      ref,
    ]
  );
  res.status(201).json({ id: fila.id });
}));

router.put('/:id', requireAuth, ah(async (req, res) => {
  const cur = esId(req.params.id) ? await uno('SELECT * FROM items WHERE id = $1', [req.params.id]) : null;
  if (!cur) return res.status(404).json({ error: 'Ítem no encontrado' });
  const b = req.body || {};
  const fields = [
    'section_id', 'title', 'description', 'type', 'media_url',
    'thumbnail_url', 'price', 'date', 'link_url', 'sort_order', 'active'
  ];
  const sets = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const vals = fields.map((f) => (b[f] !== undefined ? b[f] : cur[f]));
  await query(`UPDATE items SET ${sets} WHERE id = $${fields.length + 1}`, [...vals, req.params.id]);
  await limpiarArchivosHuerfanos();
  res.json({ ok: true });
}));

router.delete('/:id', requireAuth, ah(async (req, res) => {
  if (esId(req.params.id)) {
    await query('DELETE FROM items WHERE id = $1', [req.params.id]);
    await limpiarArchivosHuerfanos();
  }
  res.json({ ok: true });
}));

export default router;
