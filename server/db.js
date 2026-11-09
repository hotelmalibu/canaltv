import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashPassword } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'hotel.db'));
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      icon TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'video',
      media_url TEXT NOT NULL DEFAULT '',
      thumbnail_url TEXT NOT NULL DEFAULT '',
      price TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL DEFAULT '',
      link_url TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function seedIfEmpty() {
  const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (users === 0) {
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
      .run('admin', hashPassword(process.env.ADMIN_PASSWORD || 'hotel123'));
  }

  const sections = db.prepare('SELECT COUNT(*) AS c FROM sections').get().c;
  if (sections > 0) return;

  const insertSection = db.prepare(
    'INSERT INTO sections (name, slug, icon, sort_order) VALUES (?, ?, ?, ?)'
  );
  const s1 = insertSection.run('Programas', 'programas', '🎬', 1).lastInsertRowid;
  const s2 = insertSection.run('Eventos', 'eventos', '📅', 2).lastInsertRowid;
  const s3 = insertSection.run('Restaurante', 'restaurante', '🍽️', 3).lastInsertRowid;
  const s4 = insertSection.run('Noticias', 'noticias', '📰', 4).lastInsertRowid;
  const s5 = insertSection.run('Videos de la Región', 'region', '🏞️', 5).lastInsertRowid;

  const insertItem = db.prepare(`
    INSERT INTO items (section_id, title, description, type, media_url, thumbnail_url, price, date, link_url, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const SAMPLE = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/';

  // Programas
  insertItem.run(Number(s1), 'Bienvenida al hotel', 'Descubre todo lo que Hotel Malibu tiene para ti.', 'video', `${SAMPLE}BigBuckBunny.mp4`, '/img/hero-fachada.jpg', '', '', '', 1);
  insertItem.run(Number(s1), 'Tour por las instalaciones', 'Habitaciones, piscina, spa y zonas comunes.', 'video', `${SAMPLE}ForBiggerBlazes.mp4`, '/img/piscina.jpg', '', '', '', 2);

  // Eventos
  insertItem.run(Number(s2), 'Noche de música en vivo', 'Viernes 20:00 en el lobby.', 'text', '', '/img/restaurante.jpg', '', '2026-11-13 20:00', '', 1);
  insertItem.run(Number(s2), 'Cata de café regional', 'Sábado 10:00, cupo limitado.', 'text', '', '/img/serv1.jpg', '', '2026-11-14 10:00', '', 2);

  // Restaurante
  insertItem.run(Number(s3), 'Ceviche de camarón', 'Con limón y ají de la casa.', 'menu', '', '/img/restaurante.jpg', '12.000', '', '', 1);
  insertItem.run(Number(s3), 'Bandeja paisa', 'Plato tradicional de la región.', 'menu', '', '/img/serv2.jpg', '18.000', '', '', 2);
  insertItem.run(Number(s3), 'Jugo de frutas naturales', 'Mango, maracuyá o guanábana.', 'menu', '', '/img/serv3.jpg', '6.000', '', '', 3);

  // Noticias
  insertItem.run(Number(s4), 'Nueva torre con coworking', 'Espacios modernos para trabajar y reunirse.', 'text', '', '/img/coworking.jpg', '', '2026-11-12 00:00', '', 1);
  insertItem.run(Number(s4), 'Piscina y zonas renovadas', 'Nuevas áreas para disfrutar en familia.', 'text', '', '/img/piscina.jpg', '', '2026-11-10 00:00', '', 2);
  insertItem.run(Number(s4), 'Suite de lujo disponible', 'Confort y elegancia en cada detalle.', 'text', '', '/img/suitedelujo.jpg', '', '2026-11-08 00:00', '', 3);

  // Región
  insertItem.run(Number(s5), 'Descubre nuestra ciudad', 'Video promocional de Sincelejo y sus alrededores.', 'video', `${SAMPLE}ForBiggerJoyrides.mp4`, '/img/hero-fachada.jpg', '', '', '', 1);
}
