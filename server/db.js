// Base de datos del Channel Manager.
//   · Con DATABASE_URL (Neon u otro PostgreSQL) usa un pool de `pg`: los datos y los videos sobreviven a los despliegues.
//   · Sin DATABASE_URL usa PGlite (PostgreSQL embebido) en DB_DIR: sirve para desarrollar y para las pruebas.
// Los videos e imágenes subidos se guardan en la tabla `files` (bytea), no en el disco.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { hashPassword } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let motor;
if (process.env.DATABASE_URL) {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 20000, // Neon puede tardar unos segundos en despertar
    idleTimeoutMillis: 30000,
  });
  pool.on('error', (e) => console.error('[db] conexión inactiva con error:', e.message));
  motor = {
    nombre: 'postgres',
    query: async (sql, params = []) => (await pool.query(sql, params)).rows,
    exec: async (sql) => { await pool.query(sql); },
  };
} else {
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = process.env.DB_DIR || path.join(__dirname, '..', 'data', 'pgdata');
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const local = new PGlite(dir);
  motor = {
    nombre: 'pglite',
    query: async (sql, params = []) => (await local.query(sql, params)).rows,
    exec: async (sql) => { await local.exec(sql); },
  };
}

export const motorDb = motor.nombre;
/** Ejecuta una consulta con parámetros $1, $2… y devuelve las filas. */
export const query = (sql, params) => motor.query(sql, params);
/** Primera fila o undefined. */
export const uno = async (sql, params) => (await motor.query(sql, params))[0];

const AHORA_TEXTO = "to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')";

export async function initSchema() {
  await motor.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT ${AHORA_TEXTO}
    );

    CREATE TABLE IF NOT EXISTS sections (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      icon TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
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
      external_ref TEXT,
      created_at TEXT NOT NULL DEFAULT ${AHORA_TEXTO}
    );
    CREATE UNIQUE INDEX IF NOT EXISTS items_external_ref_uq ON items(external_ref) WHERE external_ref IS NOT NULL;

    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      data BYTEA NOT NULL,
      created_at TEXT NOT NULL DEFAULT ${AHORA_TEXTO}
    );
  `);
}

/** Borra los archivos subidos que ningún ítem usa (con 1 hora de gracia para el que acaba de subirse). */
export async function limpiarArchivosHuerfanos() {
  await motor.query(
    `DELETE FROM files
      WHERE created_at < to_char((now() - interval '1 hour') AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
        AND '/uploads/' || name NOT IN (
          SELECT media_url FROM items UNION SELECT thumbnail_url FROM items UNION SELECT link_url FROM items
        )`
  );
}

export async function seedIfEmpty() {
  const { c: users } = await uno('SELECT COUNT(*)::int AS c FROM users');
  if (users === 0) {
    await query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [
      'admin',
      hashPassword(process.env.ADMIN_PASSWORD || 'hotel123'),
    ]);
  }

  const { c: sections } = await uno('SELECT COUNT(*)::int AS c FROM sections');
  if (sections > 0) return;

  const seccion = async (name, slug, icon, orden) =>
    (await uno('INSERT INTO sections (name, slug, icon, sort_order) VALUES ($1, $2, $3, $4) RETURNING id', [name, slug, icon, orden])).id;
  const s1 = await seccion('Programas', 'programas', '🎬', 1);
  const s2 = await seccion('Eventos', 'eventos', '📅', 2);
  const s3 = await seccion('Restaurante', 'restaurante', '🍽️', 3);
  const s4 = await seccion('Noticias', 'noticias', '📰', 4);
  const s5 = await seccion('Videos de la Región', 'region', '🏞️', 5);

  const item = (sec, title, description, type, media, thumb, price, date, orden) =>
    query(
      `INSERT INTO items (section_id, title, description, type, media_url, thumbnail_url, price, date, link_url, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '', $9)`,
      [sec, title, description, type, media, thumb, price, date, orden]
    );

  const SAMPLE = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/';

  // Programas
  await item(s1, 'Bienvenida al hotel', 'Descubre todo lo que Hotel Malibu tiene para ti.', 'video', `${SAMPLE}BigBuckBunny.mp4`, '/img/hero-fachada.jpg', '', '', 1);
  await item(s1, 'Tour por las instalaciones', 'Habitaciones, piscina, spa y zonas comunes.', 'video', `${SAMPLE}ForBiggerBlazes.mp4`, '/img/piscina.jpg', '', '', 2);

  // Eventos
  await item(s2, 'Noche de música en vivo', 'Viernes 20:00 en el lobby.', 'text', '', '/img/restaurante.jpg', '', '2026-11-13 20:00', 1);
  await item(s2, 'Cata de café regional', 'Sábado 10:00, cupo limitado.', 'text', '', '/img/serv1.jpg', '', '2026-11-14 10:00', 2);

  // Restaurante
  await item(s3, 'Ceviche de camarón', 'Con limón y ají de la casa.', 'menu', '', '/img/restaurante.jpg', '12.000', '', 1);
  await item(s3, 'Bandeja paisa', 'Plato tradicional de la región.', 'menu', '', '/img/serv2.jpg', '18.000', '', 2);
  await item(s3, 'Jugo de frutas naturales', 'Mango, maracuyá o guanábana.', 'menu', '', '/img/serv3.jpg', '6.000', '', 3);

  // Noticias
  await item(s4, 'Nueva torre con coworking', 'Espacios modernos para trabajar y reunirse.', 'text', '', '/img/coworking.jpg', '', '2026-11-12 00:00', 1);
  await item(s4, 'Piscina y zonas renovadas', 'Nuevas áreas para disfrutar en familia.', 'text', '', '/img/piscina.jpg', '', '2026-11-10 00:00', 2);
  await item(s4, 'Suite de lujo disponible', 'Confort y elegancia en cada detalle.', 'text', '', '/img/suitedelujo.jpg', '', '2026-11-08 00:00', 3);

  // Región
  await item(s5, 'Descubre nuestra ciudad', 'Video promocional de Sincelejo y sus alrededores.', 'video', `${SAMPLE}ForBiggerJoyrides.mp4`, '/img/hero-fachada.jpg', '', '', 1);
}
