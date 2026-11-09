// Pantalla del televisor — Hotel TV
// Carga las secciones y el contenido desde la API y permite navegar con el control remoto.

const HOTEL_NAME = 'Hotel TV'; // <-- cambia aquí el nombre del hotel

const API = '/api';
let sections = [];
let items = [];
let currentSection = null;

// Reloj
function tickClock() {
  const now = new Date();
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  document.getElementById('clockTime').textContent =
    now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('clockDate').textContent =
    `${days[now.getDay()]} ${now.getDate()} de ${months[now.getMonth()]}`;
}

async function load() {
  document.getElementById('hotelName').textContent = HOTEL_NAME;
  sections = await fetch(`${API}/sections`).then((r) => r.json());
  items = await fetch(`${API}/items`).then((r) => r.json());
  renderSections();
  if (sections.length) selectSection(sections[0].slug);
  tickClock();
  setInterval(tickClock, 30000);
  setInterval(refresh, 60000); // refresca el contenido cada minuto
}

async function refresh() {
  const s = await fetch(`${API}/sections`).then((r) => r.json());
  const i = await fetch(`${API}/items`).then((r) => r.json());
  if (s.length) { sections = s; items = i; renderSections(); selectSection(currentSection); }
}

function renderSections() {
  const nav = document.getElementById('sections');
  nav.innerHTML = '';
  sections.filter((s) => s.active).forEach((s) => {
    const btn = document.createElement('button');
    btn.className = 'focusable';
    btn.dataset.slug = s.slug;
    btn.textContent = `${s.icon || ''} ${s.name}`.trim();
    btn.addEventListener('click', () => selectSection(s.slug));
    nav.appendChild(btn);
  });
}

function selectSection(slug) {
  currentSection = slug;
  document.querySelectorAll('#sections button').forEach((b) => {
    b.classList.toggle('active', b.dataset.slug === slug);
  });
  renderCards();
  // devolver foco a la sección activa
  const active = document.querySelector('#sections button.active');
  if (active) active.focus();
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d.replace(' ', 'T'));
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleString('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit'
  });
}

function cardHTML(item) {
  const type = item.type || 'video';
  const icon = { video: '▶️', image: '🖼️', menu: '🍽️', text: '📅' }[type] || '📄';

  let thumb = '';
  if (item.thumbnail_url) {
    thumb = `<div class="thumb"><img src="${item.thumbnail_url}" alt=""></div>`;
  } else if (type !== 'menu') {
    thumb = `<div class="thumb">${icon}</div>`;
  }

  const metaParts = [];
  if (type === 'menu' && item.price) metaParts.push(`<span class="price">$${item.price}</span>`);
  if (type === 'text' && item.date) metaParts.push(`<span class="badge">📅 ${formatDate(item.date)}</span>`);
  if (type === 'video') metaParts.push('<span class="badge">▶ Reproducir</span>');

  return `
    <button class="card focusable" data-id="${item.id}">
      ${thumb}
      <h3>${escapeHTML(item.title)}</h3>
      ${item.description ? `<p>${escapeHTML(item.description)}</p>` : ''}
      ${metaParts.length ? `<div class="meta">${metaParts.join('')}</div>` : ''}
    </button>`;
}

function renderCards() {
  const content = document.getElementById('content');
  const list = items.filter((i) => i.section_slug === currentSection && i.active);
  content.innerHTML = list.length
    ? list.map(cardHTML).join('')
    : '<p style="color:var(--muted);font-size:24px;padding:40px">No hay contenido en esta sección todavía.</p>';
  content.querySelectorAll('.card').forEach((el) => {
    el.addEventListener('click', () => openItem(Number(el.dataset.id)));
  });
}

function openItem(id) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  const media = document.getElementById('playerMedia');
  document.getElementById('playerTitle').textContent = item.title;
  const type = item.type || 'video';

  if (type === 'video' && item.media_url) {
    if (isYouTube(item.media_url)) {
      media.innerHTML = `<iframe src="https://www.youtube.com/embed/${youtubeId(item.media_url)}?autoplay=1" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
    } else {
      media.innerHTML = `<video src="${item.media_url}" controls autoplay></video>`;
    }
  } else if (type === 'image' && item.media_url) {
    media.innerHTML = `<img src="${item.media_url}" alt="${escapeHTML(item.title)}">`;
  } else if (item.link_url) {
    media.innerHTML = `<iframe src="${item.link_url}" allow="fullscreen"></iframe>`;
  } else {
    // Sin medio: mostramos solo el título y descripción
    media.innerHTML = `<div style="color:#fff;font-size:30px;text-align:center">${escapeHTML(item.description || item.title)}</div>`;
  }
  document.getElementById('player').classList.add('open');
}

function closePlayer() {
  const media = document.getElementById('playerMedia');
  media.innerHTML = '';
  document.getElementById('player').classList.remove('open');
  const active = document.querySelector('#sections button.active');
  if (active) active.focus();
}

// Expone el cierre del reproductor para que el botón Atrás del control remoto (Android TV) lo invoque.
window.__closePlayer = closePlayer;

function isYouTube(url) { return /(youtube\.com|youtu\.be)/i.test(url); }
function youtubeId(url) {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  return m ? m[1] : '';
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

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
    if (dir === 'left') { if (dx >= 0) continue; score = -dx + Math.abs(dy) * 3; }
    else if (dir === 'right') { if (dx <= 0) continue; score = dx + Math.abs(dy) * 3; }
    else if (dir === 'up') { if (dy >= 0) continue; score = -dy + Math.abs(dx) * 3; }
    else { if (dy <= 0) continue; score = dy + Math.abs(dx) * 3; }
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) best.focus();
}

// Modo "atractivo": si nadie interactúa, rota las secciones solo.
let idleTimer = null;
let rotateTimer = null;
function resetIdle() {
  clearInterval(rotateTimer);
  idleTimer = setTimeout(() => {
    rotateTimer = setInterval(() => {
      const idx = sections.findIndex((s) => s.slug === currentSection);
      const next = sections[(idx + 1) % sections.length];
      if (next) selectSection(next.slug);
    }, 15000);
  }, 60000);
}

document.addEventListener('keydown', (e) => {
  const playerOpen = document.getElementById('player').classList.contains('open');
  if (playerOpen) {
    if (['Escape', 'Backspace'].includes(e.key)) { closePlayer(); e.preventDefault(); }
    return;
  }
  if (e.key === 'ArrowLeft') { moveFocus('left'); e.preventDefault(); resetIdle(); }
  else if (e.key === 'ArrowRight') { moveFocus('right'); e.preventDefault(); resetIdle(); }
  else if (e.key === 'ArrowUp') { moveFocus('up'); e.preventDefault(); resetIdle(); }
  else if (e.key === 'ArrowDown') { moveFocus('down'); e.preventDefault(); resetIdle(); }
  else if (e.key === 'Enter') { resetIdle(); }
});

document.getElementById('playerClose').addEventListener('click', closePlayer);
document.addEventListener('mousemove', resetIdle);

load();
