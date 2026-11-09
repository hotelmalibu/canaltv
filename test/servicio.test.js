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

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'canaltv-'));
  proc = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: String(PORT), DB_PATH: path.join(dir, 'h.db'), UPLOADS_DIR: path.join(dir, 'uploads'), SERVICE_API_KEY: KEY, JWT_SECRET: 'x'.repeat(40) },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${BASE}/api/sections`)).ok) return; } catch { /* aún arrancando */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('el servidor no arrancó');
});

after(async () => {
  if (proc) {
    const salio = new Promise((r) => proc.once('exit', r));
    proc.kill();
    await salio;
  }
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

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
  const deSeccion = await (await fetch(`${BASE}/api/sections/1/items`)).json();
  assert.equal(deSeccion.some((i) => 'external_ref' in i), false);
});

test('una sección inexistente da 400', async () => {
  const r = await fetch(`${BASE}/api/items`, { method: 'POST', headers: { ...auth, ...json }, body: JSON.stringify({ section_id: 9999, title: 'x' }) });
  assert.equal(r.status, 400);
});

test('subir un archivo no permitido se rechaza', async () => {
  const fd = new FormData();
  fd.append('file', new Blob(['hola']), 'virus.exe');
  const r = await fetch(`${BASE}/api/uploads`, { method: 'POST', headers: auth, body: fd });
  assert.notEqual(r.status, 201);
});

test('subir un mp4 devuelve su URL', async () => {
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(64)], { type: 'video/mp4' }), 'v.mp4');
  const r = await fetch(`${BASE}/api/uploads`, { method: 'POST', headers: auth, body: fd });
  assert.equal(r.status, 201);
  assert.match((await r.json()).url, /^\/uploads\/.+\.mp4$/);
});
