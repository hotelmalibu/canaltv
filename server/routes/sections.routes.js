import { Router } from 'express';
import { query, uno, limpiarArchivosHuerfanos } from '../db.js';
import { ah } from '../async.js';
import { requireAuth } from '../middleware.js';
import { publico } from '../publico.js';

const router = Router();

router.get('/', ah(async (req, res) => {
  res.json(await query('SELECT * FROM sections ORDER BY sort_order, id'));
}));

router.get('/:id/items', ah(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.json([]);
  const rows = await query('SELECT * FROM items WHERE section_id = $1 AND active = 1 ORDER BY sort_order, id', [req.params.id]);
  res.json(rows.map(publico));
}));

router.post('/', requireAuth, ah(async (req, res) => {
  const { name, slug, icon, sort_order } = req.body || {};
  if (!name || !slug) {
    return res.status(400).json({ error: 'name y slug son obligatorios' });
  }
  try {
    const fila = await uno(
      'INSERT INTO sections (name, slug, icon, sort_order) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, slug, icon || '', sort_order || 0]
    );
    res.status(201).json({ id: fila.id });
  } catch {
    res.status(400).json({ error: 'El slug ya existe o los datos son inválidos' });
  }
}));

router.put('/:id', requireAuth, ah(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Sección no encontrada' });
  const cur = await uno('SELECT * FROM sections WHERE id = $1', [req.params.id]);
  if (!cur) return res.status(404).json({ error: 'Sección no encontrada' });
  const b = req.body || {};
  try {
    await query('UPDATE sections SET name = $1, slug = $2, icon = $3, sort_order = $4, active = $5 WHERE id = $6', [
      b.name ?? cur.name,
      b.slug ?? cur.slug,
      b.icon ?? cur.icon,
      b.sort_order ?? cur.sort_order,
      b.active ?? cur.active,
      req.params.id,
    ]);
  } catch {
    return res.status(400).json({ error: 'El slug ya existe o los datos son inválidos' });
  }
  res.json({ ok: true });
}));

router.delete('/:id', requireAuth, ah(async (req, res) => {
  if (/^\d+$/.test(req.params.id)) {
    await query('DELETE FROM sections WHERE id = $1', [req.params.id]);
    await limpiarArchivosHuerfanos();
  }
  res.json({ ok: true });
}));

export default router;
