// Pantalla del televisor — Hotel TV
// Carga las secciones y el contenido desde la API y permite navegar con el control remoto.

const HOTEL_NAME = 'HOTEL Y CENTRO DE EVENTOS MALIBU'; // <-- cambia aquí el nombre del hotel

const API = '/api';
const DIAS_NUEVO = 7;          // un ítem es «Nuevo» durante estos días
const HERO_MS = 10000;         // cada cuánto cambia el destacado
const HERO_MAX = 4;            // cuántos ítems rota el destacado
const REFRESCO_MS = 60000;     // cada cuánto se vuelve a leer el contenido

let sections = [];
let items = [];
let currentSection = null;
let ultimaFirma = '';
let heroLista = [];
let heroIdx = 0;
let heroTimer = null;

const $ = (id) => document.getElementById(id);

// ---------- Seguridad: lo que viene de la base de datos nunca se inserta sin escapar ----------
function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
/** Solo rutas del propio sitio o http(s): descarta `javascript:` y similares. */
function urlSegura(u) {
  const s = String(u ?? '').trim();
  return /^(\/(?!\/)|https?:\/\/)/i.test(s) ? s : '';
}
function isYouTube(url) { return /(youtube\.com|youtu\.be)/i.test(url); }
function youtubeId(url) {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  return m ? m[1] : '';
}

// ---------- Reloj ----------
function tickClock() {
  const now = new Date();
  $('clockTime').textContent = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const fecha = now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  $('clockDate').textContent = fecha.charAt(0).toUpperCase() + fecha.slice(1);
}

// ---------- Datos ----------
async function pedir(ruta) {
  const r = await fetch(`${API}${ruta}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(ruta);
  return r.json();
}

async function load() {
  $('hotelName').textContent = HOTEL_NAME;
  tickClock();
  setInterval(tickClock, 15000);
  try {
    [sections, items] = await Promise.all([pedir('/sections'), pedir('/items')]);
  } catch {
    sections = []; items = [];
  }
  ultimaFirma = JSON.stringify([sections, items]);
  renderSections();
  const primera = sections.find((s) => s.active);
  if (primera) selectSection(primera.slug);
  else renderCards();
  setInterval(refresh, REFRESCO_MS);
}

// Vuelve a leer el contenido sin molestar: solo redibuja si cambió algo y nunca con el reproductor abierto.
async function refresh() {
  if ($('player').classList.contains('open')) return;
  try {
    const [s, i] = await Promise.all([pedir('/sections'), pedir('/items')]);
    const firma = JSON.stringify([s, i]);
    if (firma === ultimaFirma || !s.length) return;
    ultimaFirma = firma;
    sections = s; items = i;
    const foco = document.activeElement?.dataset?.id;
    renderSections();
    if (!sections.some((x) => x.slug === currentSection && x.active)) currentSection = sections.find((x) => x.active)?.slug ?? null;
    selectSection(currentSection, { conservarFoco: foco });
  } catch { /* sin red: se conserva lo que ya está en pantalla */ }
}

// ---------- Secciones ----------
function renderSections() {
  const nav = $('sections');
  nav.innerHTML = '';
  sections.filter((s) => s.active).forEach((s) => {
    const btn = document.createElement('button');
    btn.className = 'focusable';
    btn.dataset.slug = s.slug;
    btn.innerHTML = `${s.icon ? `<span aria-hidden="true">${escapeHTML(s.icon)}</span>` : ''}<span>${escapeHTML(s.name)}</span>`;
    btn.addEventListener('click', () => selectSection(s.slug));
    nav.appendChild(btn);
  });
}

function selectSection(slug, opciones = {}) {
  currentSection = slug;
  document.querySelectorAll('#sections button').forEach((b) => {
    b.classList.toggle('active', b.dataset.slug === slug);
  });
  renderHero();
  renderCards();
  if (opciones.conservarFoco !== undefined) {
    const el = opciones.conservarFoco ? document.querySelector(`.card[data-id="${CSS.escape(opciones.conservarFoco)}"]`) : null;
    if (el) { el.focus({ preventScroll: true }); return; }
  }
  const active = document.querySelector('#sections button.active');
  if (active && !opciones.sinFoco) active.focus({ preventScroll: true });
}

const itemsDe = (slug) => items.filter((i) => i.section_slug === slug && i.active);

// ---------- Miniaturas ----------
function miniaturaUrl(item) {
  const thumb = urlSegura(item.thumbnail_url);
  if (thumb) return { tipo: 'img', url: thumb };
  const media = urlSegura(item.media_url);
  if (item.type === 'image' && media) return { tipo: 'img', url: media };
  if (item.type === 'video' && media) {
    if (isYouTube(media)) return { tipo: 'img', url: `https://i.ytimg.com/vi/${youtubeId(media)}/hqdefault.jpg` };
    // Un video sin miniatura (p. ej. los que llegan desde MarketingPro IA) muestra su propio fotograma.
    return { tipo: 'video', url: `${media}#t=0.8` };
  }
  return null;
}

function esNuevo(item) {
  const t = new Date(String(item.created_at || '').replace(' ', 'T') + 'Z').getTime();
  return Number.isFinite(t) && Date.now() - t < DIAS_NUEVO * 86400000;
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(String(d).replace(' ', 'T'));
  if (isNaN(dt.getTime())) return d;
  const hasTime = dt.getHours() !== 0 || dt.getMinutes() !== 0;
  return dt.toLocaleString('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short',
    ...(hasTime ? { hour: '2-digit', minute: '2-digit' } : {})
  });
}

function mmss(s) {
  if (!Number.isFinite(s) || s <= 0) return '';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// ---------- Destacado ----------
function renderHero() {
  const hero = $('hero');
  const content = $('content');
  clearInterval(heroTimer);
  heroLista = itemsDe(currentSection).filter((i) => miniaturaUrl(i)).slice(0, HERO_MAX);
  heroIdx = 0;
  if (!heroLista.length) {
    hero.hidden = true;
    content.className = 'content sin-hero';
    return;
  }
  hero.hidden = false;
  content.className = 'content con-hero';
  hero.innerHTML = `
    <div class="hero-layers"></div>
    <div class="hero-body">
      <span class="hero-eyebrow"></span>
      <h2 class="hero-title"></h2>
      <p class="hero-desc"></p>
      <button type="button" class="hero-btn focusable"><span aria-hidden="true">▶</span> <span class="hero-btn-txt">Ver ahora</span></button>
    </div>
    <div class="hero-dots" aria-hidden="true">${heroLista.map(() => '<i></i>').join('')}</div>`;
  hero.querySelector('.hero-btn').addEventListener('click', () => openItem(heroLista[heroIdx].id));
  pintarHero(true);
  if (heroLista.length > 1) heroTimer = setInterval(() => { heroIdx = (heroIdx + 1) % heroLista.length; pintarHero(false); }, HERO_MS);
}

function pintarHero(primera) {
  const item = heroLista[heroIdx];
  if (!item) return;
  const hero = $('hero');
  const capas = hero.querySelector('.hero-layers');
  const m = miniaturaUrl(item);
  const bg = document.createElement(m.tipo === 'video' ? 'video' : 'img');
  bg.className = 'hero-bg';
  bg.src = m.url;
  if (m.tipo === 'video') { bg.muted = true; bg.preload = 'metadata'; bg.setAttribute('playsinline', ''); } else { bg.alt = ''; }
  capas.appendChild(bg);
  requestAnimationFrame(() => requestAnimationFrame(() => bg.classList.add('on')));
  capas.querySelectorAll('.hero-bg').forEach((el) => { if (el !== bg) { el.classList.remove('on'); setTimeout(() => el.remove(), 1000); } });

  const etiqueta = esNuevo(item) ? 'Nuevo · ' : '';
  const tipo = { video: 'Video', image: 'Imagen', menu: 'Restaurante', text: 'Para ti' }[item.type] || 'Destacado';
  hero.querySelector('.hero-eyebrow').textContent = `${etiqueta}${tipo}`;
  hero.querySelector('.hero-title').textContent = item.title;
  hero.querySelector('.hero-desc').textContent = item.description || '';
  hero.querySelector('.hero-btn-txt').textContent = item.type === 'video' ? 'Ver ahora' : 'Abrir';
  hero.querySelectorAll('.hero-dots i').forEach((d, n) => d.classList.toggle('on', n === heroIdx));
  void primera;
}

// ---------- Tarjetas ----------
function thumbHTML(item) {
  const type = item.type || 'video';
  const m = miniaturaUrl(item);
  const icon = { video: '🎬', image: '🖼️', menu: '🍽️', text: '📅' }[type] || '📄';
  let medio = `<span aria-hidden="true">${icon}</span>`;
  if (m && m.tipo === 'img') medio = `<img src="${escapeHTML(m.url)}" alt="" loading="lazy">`;
  if (m && m.tipo === 'video') medio = `<video src="${escapeHTML(m.url)}" muted preload="metadata" playsinline tabindex="-1"></video>`;
  return `<div class="thumb">
    ${medio}
    ${type === 'video' ? '<span class="play" aria-hidden="true"></span>' : ''}
    ${esNuevo(item) ? '<span class="chip">Nuevo</span>' : ''}
    ${type === 'video' ? '<span class="dur" hidden></span>' : ''}
  </div>`;
}

function cardHTML(item, n) {
  const type = item.type || 'video';
  const conThumb = type !== 'menu' || item.thumbnail_url;
  const meta = [];
  if (type === 'menu' && item.price) meta.push(`<span class="price">$${escapeHTML(item.price)}</span>`);
  if (type === 'text' && item.date) meta.push(`<span class="badge">📅 ${escapeHTML(formatDate(item.date))}</span>`);

  return `
    <button class="card focusable ${type}" data-id="${item.id}" style="--i:${Math.min(n, 12)}">
      ${conThumb ? thumbHTML(item) : ''}
      <div class="card-body">
        <h3>${escapeHTML(item.title)}</h3>
        ${item.description ? `<p>${escapeHTML(item.description)}</p>` : ''}
        ${meta.length ? `<div class="meta">${meta.join('')}</div>` : ''}
      </div>
    </button>`;
}

function renderCards() {
  const content = $('content');
  const list = itemsDe(currentSection);
  content.scrollTop = 0;
  content.innerHTML = list.length
    ? list.map(cardHTML).join('')
    : '<div class="vacio"><b>Muy pronto</b><span>Estamos preparando contenido nuevo para esta sección.</span></div>';
  content.querySelectorAll('.card').forEach((el) => {
    el.addEventListener('click', () => openItem(Number(el.dataset.id)));
    // La duración se muestra cuando el navegador conoce los metadatos del video.
    const v = el.querySelector('.thumb video');
    const dur = el.querySelector('.dur');
    if (v && dur) v.addEventListener('loadedmetadata', () => { const t = mmss(v.duration); if (t) { dur.textContent = t; dur.hidden = false; } }, { once: true });
  });
}

// ---------- Reproductor ----------
let quietoTimer = null;
function despertarReproductor() {
  const p = $('player');
  p.classList.remove('quieto');
  clearTimeout(quietoTimer);
  quietoTimer = setTimeout(() => p.classList.add('quieto'), 3500);
}

function openItem(id) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  const media = $('playerMedia');
  $('playerTitle').textContent = item.title;
  const type = item.type || 'video';
  const url = urlSegura(item.media_url);
  const link = urlSegura(item.link_url);

  if (type === 'video' && url) {
    if (isYouTube(url)) {
      media.innerHTML = `<iframe src="https://www.youtube.com/embed/${escapeHTML(youtubeId(url))}?autoplay=1" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
    } else {
      media.innerHTML = `<video src="${escapeHTML(url)}" controls autoplay playsinline></video>`;
      const v = media.querySelector('video');
      // Si el navegador bloquea el autoplay con sonido, se reproduce sin sonido en vez de quedarse detenido.
      v.play?.().catch(() => { v.muted = true; v.play?.().catch(() => {}); });
      v.addEventListener('ended', closePlayer);
    }
  } else if (type === 'image' && url) {
    media.innerHTML = `<img src="${escapeHTML(url)}" alt="${escapeHTML(item.title)}">`;
  } else if (link) {
    media.innerHTML = `<iframe src="${escapeHTML(link)}" allow="fullscreen"></iframe>`;
  } else {
    // Sin medio: solo título y descripción
    media.innerHTML = `<div class="player-texto">${escapeHTML(item.description || item.title)}</div>`;
  }
  clearInterval(heroTimer);
  $('player').classList.add('open');
  despertarReproductor();
  $('playerClose').focus({ preventScroll: true });
}

function closePlayer() {
  const media = $('playerMedia');
  media.innerHTML = '';
  clearTimeout(quietoTimer);
  $('player').classList.remove('open', 'quieto');
  if (heroLista.length > 1 && !$('hero').hidden) heroTimer = setInterval(() => { heroIdx = (heroIdx + 1) % heroLista.length; pintarHero(false); }, HERO_MS);
  const active = document.querySelector('#sections button.active');
  if (active) active.focus({ preventScroll: true });
}

// Expone el cierre del reproductor para que el botón Atrás del control remoto (Android TV) lo invoque.
window.__closePlayer = closePlayer;

// ---------- Navegación espacial (control remoto) ----------
function focusables() {
  return Array.from(document.querySelectorAll('.focusable'))
    .filter((el) => el.offsetWidth > 0 && el.offsetHeight > 0);
}

function moveFocus(dir) {
  const all = focusables();
  const current = document.activeElement;
  if (!all.length) return;
  if (!current || !all.includes(current)) { all[0].focus(); return; }
  const r = current.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best = null, bestScore = Infinity;
  for (const el of all) {
    if (el === current) continue;
    const er = el.getBoundingClientRect();
    const ex = er.left + er.width / 2, ey = er.top + er.height / 2;
    const dx = ex - cx, dy = ey - cy;
    let score;
    if (dir === 'left') { if (dx >= -1) continue; score = -dx + Math.abs(dy) * 3; }
    else if (dir === 'right') { if (dx <= 1) continue; score = dx + Math.abs(dy) * 3; }
    else if (dir === 'up') { if (dy >= -1) continue; score = -dy + Math.abs(dx) * 3; }
    else { if (dy <= 1) continue; score = dy + Math.abs(dx) * 3; }
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) best.focus({ preventScroll: true });
  if (best && best.classList.contains('card')) best.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// Modo "atractivo": si nadie interactúa, rota las secciones solo.
let idleTimer = null;
let rotateTimer = null;
function resetIdle() {
  clearTimeout(idleTimer);
  clearInterval(rotateTimer);
  idleTimer = setTimeout(() => {
    rotateTimer = setInterval(() => {
      if ($('player').classList.contains('open')) return;
      const visibles = sections.filter((s) => s.active);
      const idx = visibles.findIndex((s) => s.slug === currentSection);
      const next = visibles[(idx + 1) % visibles.length];
      if (next) selectSection(next.slug, { sinFoco: true });
    }, 15000);
  }, 60000);
}

document.addEventListener('keydown', (e) => {
  const playerOpen = $('player').classList.contains('open');
  if (playerOpen) {
    despertarReproductor();
    if (['Escape', 'Backspace', 'GoBack', 'BrowserBack'].includes(e.key)) { closePlayer(); e.preventDefault(); }
    return;
  }
  const dir = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key];
  if (dir) { moveFocus(dir); e.preventDefault(); }
  resetIdle();
});

$('playerClose').addEventListener('click', closePlayer);
$('player').addEventListener('mousemove', despertarReproductor);
document.addEventListener('mousemove', resetIdle);
document.addEventListener('click', resetIdle);

load().then(resetIdle);
