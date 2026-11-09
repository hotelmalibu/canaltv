// Panel de administración — Hotel TV
const API = '/api';
let token = localStorage.getItem('hotel_tv_token') || null;
let sections = [];
let items = [];
let currentSectionId = null;

let modalType = 'item'; // 'section' | 'item'
let modalMode = 'create'; // 'create' | 'edit'
let modalId = null;

// ---------- Utilidades ----------
function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(API + path, { ...options, headers }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Error del servidor');
    return data;
  });
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function toast(msg, ok = true) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (ok ? '' : ' err');
  setTimeout(() => (t.className = 'toast'), 2500);
}

function showView(view) {
  document.getElementById('loginView').classList.toggle('hidden', view !== 'login');
  document.getElementById('appView').classList.toggle('hidden', view !== 'app');
}

// ---------- Login ----------
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  document.getElementById('loginError').textContent = '';
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: { username: fd.get('username'), password: fd.get('password') }
    });
    token = data.token;
    localStorage.setItem('hotel_tv_token', token);
    showView('app');
    await loadAll();
  } catch (err) {
    document.getElementById('loginError').textContent = err.message;
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  token = null;
  localStorage.removeItem('hotel_tv_token');
  showView('login');
});

// ---------- Carga de datos ----------
async function loadAll() {
  try {
    sections = await api('/sections');
    renderSections();
    if (sections.length) selectSection(sections[0].id);
  } catch (err) {
    if (err.message.includes('401') || err.message === 'No autorizado') {
      showView('login');
    } else {
      toast(err.message, false);
    }
  }
}

function renderSections() {
  const list = document.getElementById('sectionsList');
  list.innerHTML = '';
  sections.forEach((s) => {
    const el = document.createElement('div');
    el.className = 'section-chip' + (s.id === currentSectionId ? ' active' : '');
    el.innerHTML = `
      <span>${s.icon ? s.icon + ' ' : ''}${escapeHTML(s.name)}</span>
      <span class="chip-actions">
        <button class="icon-btn" data-edit-section="${s.id}" title="Editar">✏️</button>
        <button class="icon-btn danger" data-del-section="${s.id}" title="Eliminar">🗑️</button>
      </span>`;
    el.querySelector('span:first-child').style.cursor = 'pointer';
    el.querySelector('span:first-child').addEventListener('click', () => selectSection(s.id));
    el.querySelector('[data-edit-section]').addEventListener('click', () => openSectionModal(s));
    el.querySelector('[data-del-section]').addEventListener('click', () => deleteSection(s.id));
    list.appendChild(el);
  });
}

async function selectSection(id) {
  currentSectionId = id;
  renderSections();
  const s = sections.find((x) => x.id === id);
  document.getElementById('sectionTitle').textContent = s ? `${s.icon || ''} ${s.name}` : 'Sección';
  items = await api(`/sections/${id}/items`);
  renderItems();
}

/** Solo rutas del propio sitio o http(s): descarta `javascript:` y similares. */
function urlSegura(u) {
  const s = String(u || '').trim();
  return /^(\/(?!\/)|https?:\/\/)/i.test(s) ? s : '';
}

/** Miniatura: la imagen del ítem o, si es un video sin miniatura, su primer fotograma. */
function miniHTML(i) {
  const thumb = urlSegura(i.thumbnail_url);
  const media = urlSegura(i.media_url);
  if (thumb) return `<div class="mini"><img src="${escapeHTML(thumb)}" alt="" loading="lazy"></div>`;
  if (i.type === 'image' && media) return `<div class="mini"><img src="${escapeHTML(media)}" alt="" loading="lazy"></div>`;
  if (i.type === 'video' && media && !/youtu/i.test(media)) {
    return `<div class="mini"><video src="${escapeHTML(media)}#t=0.8" muted preload="metadata" playsinline></video></div>`;
  }
  const icono = { video: '🎬', image: '🖼️', menu: '🍽️', text: '📅' }[i.type] || '📄';
  return `<div class="mini" aria-hidden="true">${icono}</div>`;
}

function renderItems() {
  const list = document.getElementById('itemsList');
  if (!items.length) {
    list.innerHTML = '<p class="empty">No hay ítems en esta sección. Crea el primero con "+ Nuevo ítem".</p>';
    return;
  }
  const typeNames = { video: 'Video', image: 'Imagen', menu: 'Menú', text: 'Evento/Texto' };
  list.innerHTML = `
    <table>
      <thead><tr>
        <th>Contenido</th><th>Tipo</th><th>Precio</th><th>Fecha</th><th>Estado</th><th></th>
      </tr></thead>
      <tbody>
        ${items.map((i) => `
          <tr>
            <td>
              <div class="celda-titulo">
                ${miniHTML(i)}
                <div>
                  <b>${escapeHTML(i.title)}${i.origen === 'marketingpro' ? '<span class="tag mp" title="Publicado desde MarketingPro IA">MarketingPro IA</span>' : ''}</b>
                  ${i.description ? `<small>${escapeHTML(i.description)}</small>` : ''}
                </div>
              </div>
            </td>
            <td><span class="tag">${typeNames[i.type] || i.type}</span></td>
            <td>${i.price ? '$' + escapeHTML(i.price) : '—'}</td>
            <td>${i.date ? escapeHTML(i.date) : '—'}</td>
            <td><span class="tag ${i.active ? 'on' : 'off'}">${i.active ? 'Activo' : 'Oculto'}</span></td>
            <td>
              <div class="row-actions">
                <button class="ghost" data-edit-item="${i.id}">Editar</button>
                <button class="ghost" data-del-item="${i.id}">Eliminar</button>
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
  list.querySelectorAll('[data-edit-item]').forEach((b) =>
    b.addEventListener('click', () => openItemModal(items.find((i) => i.id === Number(b.dataset.editItem)))));
  list.querySelectorAll('[data-del-item]').forEach((b) =>
    b.addEventListener('click', () => deleteItem(Number(b.dataset.delItem))));
}

// ---------- Modales ----------
function openModal(title, formHTML) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalForm').innerHTML = formHTML;
  document.getElementById('modal').classList.remove('hidden');
  wireUploads();
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  document.getElementById('modalForm').innerHTML = '';
}

function openSectionModal(section) {
  modalType = 'section';
  modalMode = section ? 'edit' : 'create';
  modalId = section ? section.id : null;
  openModal(
    section ? 'Editar sección' : 'Nueva sección',
    `<label>Nombre <input name="name" required value="${section ? escapeHTML(section.name) : ''}"></label>
     <label>Slug (identificador en la URL) <input name="slug" required value="${section ? escapeHTML(section.slug) : ''}"></label>
     <label>Icono (emoji) <input name="icon" value="${section ? escapeHTML(section.icon) : ''}"></label>
     <label>Orden <input name="sort_order" type="number" value="${section ? section.sort_order : 0}"></label>
     <div class="form-actions">
       <button type="button" class="ghost" id="cancelModal">Cancelar</button>
       <button type="submit" class="primary">Guardar</button>
     </div>`
  );
}

function openItemModal(item) {
  modalType = 'item';
  modalMode = item ? 'edit' : 'create';
  modalId = item ? item.id : null;
  const it = item || {};
  const type = it.type || 'video';
  const dateValue = it.date ? it.date.replace(' ', 'T') : '';
  openModal(
    item ? 'Editar ítem' : 'Nuevo ítem',
    `<label>Título <input name="title" required value="${escapeHTML(it.title || '')}"></label>
     <label>Tipo
       <select name="type">
         <option value="video" ${type === 'video' ? 'selected' : ''}>Video</option>
         <option value="image" ${type === 'image' ? 'selected' : ''}>Imagen</option>
         <option value="menu" ${type === 'menu' ? 'selected' : ''}>Menú</option>
         <option value="text" ${type === 'text' ? 'selected' : ''}>Evento / Texto</option>
       </select>
     </label>
     <label>Descripción <textarea name="description">${escapeHTML(it.description || '')}</textarea></label>
     <label>Video o imagen (URL) <input name="media_url" value="${escapeHTML(it.media_url || '')}" placeholder="https://... o sube un archivo"></label>
     <div class="field-upload">
       <button type="button" class="ghost upload-btn" data-field="media_url">⬆️ Subir archivo</button>
       <input type="file" class="file-input" hidden accept="video/*,image/*" data-field="media_url">
     </div>
     <label>Miniatura (URL) <input name="thumbnail_url" value="${escapeHTML(it.thumbnail_url || '')}"></label>
     <div class="field-upload">
       <button type="button" class="ghost upload-btn" data-field="thumbnail_url">⬆️ Subir imagen</button>
       <input type="file" class="file-input" hidden accept="image/*" data-field="thumbnail_url">
     </div>
     <label>Precio (para menú) <input name="price" value="${escapeHTML(it.price || '')}"></label>
     <label>Fecha (para eventos) <input name="date" type="datetime-local" value="${dateValue}"></label>
     <label>Enlace externo <input name="link_url" value="${escapeHTML(it.link_url || '')}"></label>
     <label>Orden <input name="sort_order" type="number" value="${it.sort_order ?? 0}"></label>
     <label class="checkbox"><input name="active" type="checkbox" ${it.active !== 0 ? 'checked' : ''}> Activo</label>
     <div class="form-actions">
       <button type="button" class="ghost" id="cancelModal">Cancelar</button>
       <button type="submit" class="primary">Guardar</button>
     </div>`
  );
}

function wireUploads() {
  document.getElementById('cancelModal').addEventListener('click', closeModal);
  document.querySelectorAll('.upload-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('.file-input');
      input.click();
    });
  });
  document.querySelectorAll('.file-input').forEach((input) => {
    input.addEventListener('change', () => uploadFile(input));
  });
}

async function uploadFile(input) {
  const file = input.files[0];
  if (!file) return;
  const field = input.dataset.field;
  const fd = new FormData();
  fd.append('file', file);
  toast('Subiendo archivo…');
  try {
    const data = await api('/uploads', { method: 'POST', body: fd });
    document.querySelector(`input[name="${field}"]`).value = data.url;
    toast('Archivo subido ✓');
  } catch (err) {
    toast(err.message, false);
  }
}

document.getElementById('modalForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = Object.fromEntries(fd.entries());
  body.active = fd.has('active') ? 1 : 0;
  body.sort_order = Number(body.sort_order || 0);
  if (body.date !== undefined) body.date = body.date.replace('T', ' ');
  try {
    if (modalType === 'section') {
      if (modalMode === 'create') await api('/sections', { method: 'POST', body });
      else await api(`/sections/${modalId}`, { method: 'PUT', body });
    } else {
      if (modalMode === 'create') {
        body.section_id = currentSectionId;
        await api('/items', { method: 'POST', body });
      } else {
        await api(`/items/${modalId}`, { method: 'PUT', body });
      }
    }
    closeModal();
    toast('Guardado ✓');
    await loadAll();
  } catch (err) {
    toast(err.message, false);
  }
});

// ---------- Eliminar ----------
async function deleteSection(id) {
  if (!confirm('¿Eliminar esta sección y todos sus ítems?')) return;
  try {
    await api(`/sections/${id}`, { method: 'DELETE' });
    toast('Sección eliminada');
    await loadAll();
  } catch (err) {
    toast(err.message, false);
  }
}

async function deleteItem(id) {
  if (!confirm('¿Eliminar este ítem?')) return;
  try {
    await api(`/items/${id}`, { method: 'DELETE' });
    toast('Ítem eliminado');
    await selectSection(currentSectionId);
  } catch (err) {
    toast(err.message, false);
  }
}

// ---------- Botones globales ----------
document.getElementById('newSectionBtn').addEventListener('click', () => openSectionModal());
document.getElementById('newItemBtn').addEventListener('click', () => openItemModal());
document.getElementById('modalClose').addEventListener('click', closeModal);

// Inicio
if (token) {
  showView('app');
  loadAll();
} else {
  showView('login');
}
