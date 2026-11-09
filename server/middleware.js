import crypto from 'node:crypto';
import { verifyToken } from './auth.js';

// Clave de servicio para integraciones (p. ej. MarketingPro IA). Se define en SERVICE_API_KEY
// (mínimo 24 caracteres). Si no está definida, solo funcionan los tokens del panel.
const SERVICE_KEY = process.env.SERVICE_API_KEY || '';

function esClaveServicio(token) {
  if (SERVICE_KEY.length < 24) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(SERVICE_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  if (esClaveServicio(token)) {
    req.user = { id: 0, username: 'servicio', servicio: true };
    return next();
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}
