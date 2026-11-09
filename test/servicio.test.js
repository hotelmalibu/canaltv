import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const KEY = 'clave-de-servicio-de-prueba-123456';
const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
let proc;
let dir;

const auth = { Authorization: `Bearer ${KEY}` };
const json = { 'Content-Type': 'application/json' };

// Sin DATABASE_URL el servidor usa PGlite (PostgreSQL embebido) en DB_DIR: el mismo SQL que Neon.
let n = 0;
async function arrancar(extraEnv = {}) {
  proc = spawn(process.execPath, ['server/index.js'], {
    env: {
      ...process.env,
      DATABASE_URL: '',
      PORT: String(PORT),
      DB_DIR: path.join(dir, `pgdata${extraEnv.nueva ? ++n : ''}`),
      SERVICE_API_KEY: KEY,
      JWT_SECRET: 'x'.repeat(40),
      ...Object.fromEntries(Object.entries(extraEnv).filter(([k]) => k !== 'nueva')),
    },
    stdio: 'ignore',
  });
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch(`${BASE}/api/sections`)).ok) return; } catch { /* aún arrancando */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('el servidor no arrancó');
}

async function detener() {
  if (!proc) return;
  const salio = new Promise((r) => proc.once('exit', r));
  proc.kill();
  await salio;
  proc = undefined;
}

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'canaltv-'));
  await arrancar();
});

after(async () => {
  await detener();
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

const subir = async (bytes, nombre, tipo = 'video/mp4') => {
  const fd = new FormData();
  fd.append('file', new Blob([bytes], { type: tipo }), nombre);
  return fetch(`${BASE}/api/uploads`, { method: 'POST', headers: auth, body: fd });
};

test('sin clave no se puede crear contenido', async () => {
  const r = await fetch(`${BASE}/api/items`, { method: 'POST', headers: json, body: JSON.stringify({ section_id: 1, title: 'x' }) });
  assert.equal(r.status, 401);
});

test('una clave incorrecta se rechaza', async () => {
  const r = await fetch(`${BASE}/api/auth/me`, { headers: { Authorization: 'Bearer otra-clave-distinta-1234567890' } });
  assert.equal(r.status, 401);
});

test('la clave de servicio se identifica en /api/auth/me', async () => {
  const r = await fetch(`${BASE}/api/auth/me`, { headers: auth });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).servicio, true);
});

test('el login del panel funciona con la contraseña inicial', async () => {
  const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: json, body: JSON.stringify({ username: 'admin', password: 'hotel123' }) });
  assert.equal(r.status, 200);
  assert.ok((await r.json()).token);
  const mala = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: json, body: JSON.stringify({ username: 'admin', password: 'nope' }) });
  assert.equal(mala.status, 401);
});

test('crear un ítem con la misma external_ref no duplica', async () => {
  const cuerpo = { section_id: 1, title: 'Video del hotel', type: 'video', media_url: '/uploads/a.mp4', external_ref: 'marketingpro:pub-1' };
  const a = await fetch(`${BASE}/api/items`, { method: 'POST', headers: { ...auth, ...json }, body: JSON.stringify(cuerpo) });
  assert.equal(a.status, 201);
  const ida = (await a.json()).id;
  const b = await fetch(`${BASE}/api/items`, { method: 'POST', headers: { ...auth, ...json }, body: JSON.stringify(cuerpo) });
  assert.equal(b.status, 200);
  const jb = await b.json();
  assert.equal(jb.id, ida);
  assert.equal(jb.existente, true);
});

test('la lectura pública no expone external_ref, solo el origen', async () => {
  const lista = await (await fetch(`${BASE}/api/items`)).json();
  const mio = lista.find((i) => i.title === 'Video del hotel');
  assert.ok(mio);
  assert.equal(mio.origen, 'marketingpro');
  assert.equal('external_ref' in mio, false);
  assert.equal(typeof mio.id, 'number');
  assert.match(mio.created_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  const deSeccion = await (await fetch(`${BASE}/api/sections/1/items`)).json();
  assert.equal(deSeccion.some((i) => 'external_ref' in i), false);
});

test('una sección inexistente da 400', async () => {
  const r = await fetch(`${BASE}/api/items`, { method: 'POST', headers: { ...auth, ...json }, body: JSON.stringify({ section_id: 9999, title: 'x' }) });
  assert.equal(r.status, 400);
});

test('subir un archivo no permitido se rechaza con 400', async () => {
  const r = await subir('hola', 'virus.exe', 'application/octet-stream');
  assert.equal(r.status, 400);
});

test('subir un mp4 y descargarlo completo', async () => {
  const bytes = Uint8Array.from({ length: 1000 }, (_, i) => i % 251);
  const r = await subir(bytes, 'v.mp4');
  assert.equal(r.status, 201);
  const { url } = await r.json();
  assert.match(url, /^\/uploads\/.+\.mp4$/);
  const g = await fetch(`${BASE}${url}`);
  assert.equal(g.status, 200);
  assert.equal(g.headers.get('content-type'), 'video/mp4');
  assert.equal(g.headers.get('accept-ranges'), 'bytes');
  assert.deepEqual(new Uint8Array(await g.arrayBuffer()), bytes);
});

test('Range: trozo, final abierto, sufijo e inválido', async () => {
  const bytes = Uint8Array.from({ length: 1000 }, (_, i) => i % 251);
  const { url } = await (await subir(bytes, 'r.mp4')).json();

  const a = await fetch(`${BASE}${url}`, { headers: { Range: 'bytes=10-19' } });
  assert.equal(a.status, 206);
  assert.equal(a.headers.get('content-range'), 'bytes 10-19/1000');
  assert.deepEqual(new Uint8Array(await a.arrayBuffer()), bytes.slice(10, 20));

  const b = await fetch(`${BASE}${url}`, { headers: { Range: 'bytes=990-' } });
  assert.equal(b.status, 206);
  assert.equal(b.headers.get('content-range'), 'bytes 990-999/1000');
  assert.deepEqual(new Uint8Array(await b.arrayBuffer()), bytes.slice(990));

  const c = await fetch(`${BASE}${url}`, { headers: { Range: 'bytes=-5' } });
  assert.equal(c.status, 206);
  assert.deepEqual(new Uint8Array(await c.arrayBuffer()), bytes.slice(995));

  const d = await fetch(`${BASE}${url}`, { headers: { Range: 'bytes=5000-6000' } });
  assert.equal(d.status, 416);
  assert.equal(d.headers.get('content-range'), 'bytes */1000');
});

test('un archivo inexistente da 404 en JSON', async () => {
  const r = await fetch(`${BASE}/uploads/no-existe.mp4`);
  assert.equal(r.status, 404);
  assert.equal((await r.json()).error, 'Archivo no encontrado');
});

test('los datos y los videos sobreviven a un reinicio del servidor', async () => {
  const bytes = Uint8Array.from({ length: 300 }, (_, i) => (i * 7) % 256);
  const { url } = await (await subir(bytes, 'persistente.mp4')).json();
  await detener();
  await arrancar();
  const g = await fetch(`${BASE}${url}`);
  assert.equal(g.status, 200);
  assert.deepEqual(new Uint8Array(await g.arrayBuffer()), bytes);
  const lista = await (await fetch(`${BASE}/api/items`)).json();
  assert.ok(lista.some((i) => i.title === 'Video del hotel'));
});

test('al superar el espacio total se rechaza con 413 y un mensaje claro', async () => {
  await detener();
  await arrancar({ nueva: true, MAX_STORAGE_MB: '0.0001' });
  const r = await subir(new Uint8Array(5000), 'grande.mp4');
  assert.equal(r.status, 413);
  assert.match((await r.json()).error, /No hay espacio/);
});

test('al superar el tamaño máximo por archivo se rechaza con 413', async () => {
  await detener();
  await arrancar({ nueva: true, MAX_FILE_MB: '0.001' });
  const r = await subir(new Uint8Array(5000), 'enorme.mp4');
  assert.equal(r.status, 413);
  assert.match((await r.json()).error, /supera el máximo/);
});

test('borrar un ítem conserva el archivo recién subido durante la hora de gracia', async () => {
  await detener();
  await arrancar({ nueva: true });
  const { url } = await (await subir(new Uint8Array(100), 'huerfano.mp4')).json();
  const alta = await fetch(`${BASE}/api/items`, {
    method: 'POST', headers: { ...auth, ...json },
    body: JSON.stringify({ section_id: 1, title: 'Con archivo', media_url: url, external_ref: 'marketingpro:pub-2' }),
  });
  const { id } = await alta.json();
  await fetch(`${BASE}/api/items/${id}`, { method: 'DELETE', headers: auth });
  // Recién subido: el archivo se conserva durante la hora de gracia aunque ya no tenga ítem.
  assert.equal((await fetch(`${BASE}${url}`)).status, 200);
});
