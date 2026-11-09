import { Router } from 'express';
import { db } from '../db.js';
import { verifyPassword, signToken } from '../auth.js';
import { requireAuth } from '../middleware.js';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  res.json({ token: signToken(user), user: { id: user.id, username: user.username } });
});

router.get('/me', requireAuth, (req, res) => {
  if (req.user.servicio) return res.json({ id: 0, username: req.user.username, servicio: true });
  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

export default router;
