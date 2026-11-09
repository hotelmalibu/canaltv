import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'cambia-esto-en-produccion';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(check, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
