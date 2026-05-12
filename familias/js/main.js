// ── Estado de navegación ──────────────────────────────────────────
let CUR_PAGE = 'login';

// ── Mapa de renderers ─────────────────────────────────────────────
const PAGE_RENDERERS = {
  inicio:       () => rInicio(),
  comunicados:  () => rComunicados(),
  seguimiento:  () => rSeguimiento(),
  asistencia:   () => rAsistencia(),
  agenda:       () => rAgenda(),
  mensajes:     () => rMensajes(),
  contactos:    () => rContactos(),
};

// ── Ítems del bottom nav ──────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'inicio',      label: 'Inicio',      svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>` },
  { id: 'comunicados', label: 'Avisos',      svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>` },
  { id: 'seguimiento', label: 'Seguimiento', svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>` },
  { id: 'agenda',      label: 'Agenda',      svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>` },
  { id: 'mensajes',    label: 'Mensajes',    svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>` },
];

// ── Navegación ────────────────────────────────────────────────────
function goPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');
  CUR_PAGE = id;

  const isLogin = id === 'login';
  document.getElementById('topbar').style.display     = isLogin ? 'none' : 'flex';
  document.getElementById('bottom-nav').style.display = isLogin ? 'none' : 'flex';

  if (!isLogin) {
    renderBottomNav();
    if (PAGE_RENDERERS[id]) PAGE_RENDERERS[id]();
  }
}

// ── Top bar ───────────────────────────────────────────────────────
function renderTopBar() {
  const alumnoEl = document.getElementById('topbar-alumno');
  if (!alumnoEl || !USUARIO_FAMILIAR) return;

  const alumnos = USUARIO_FAMILIAR.alumnos || [];
  if (alumnos.length <= 1) {
    alumnoEl.innerHTML = ALUMNO_ACTUAL
      ? `<span class="topbar-nombre">${ALUMNO_ACTUAL.nombre_completo}</span>`
      : '';
  } else {
    alumnoEl.innerHTML = `
      <select class="topbar-selector" onchange="setAlumno(this.value)">
        ${alumnos.map(a => `
          <option value="${a.id}" ${a.id === ALUMNO_ACTUAL?.id ? 'selected' : ''}>
            ${a.nombre_completo}
          </option>
        `).join('')}
      </select>`;
  }
}

// ── Bottom nav ────────────────────────────────────────────────────
function renderBottomNav() {
  const nav = document.getElementById('bottom-nav');
  nav.innerHTML = NAV_ITEMS.map(item => `
    <button class="bottom-nav-item ${CUR_PAGE === item.id ? 'active' : ''}"
            onclick="goPage('${item.id}')">
      ${item.svg}
      <span>${item.label}</span>
    </button>
  `).join('');
}

// ── App init ──────────────────────────────────────────────────────
function iniciarApp() {
  renderTopBar();
  goPage('inicio');
}

// ── Helpers globales ──────────────────────────────────────────────
function showLoading(pageId) {
  const el = document.getElementById('page-' + pageId);
  if (el) el.innerHTML = `<div class="loading-wrap"><div class="spinner"></div></div>`;
}

function fmtFecha(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
}

function fmtMes(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

function nombreCurso(cursoObj) {
  if (!cursoObj) return '';
  return `${cursoObj.nombre}${cursoObj.division ? ' ' + cursoObj.division : ''}`;
}

function nivelLabel(nivel) {
  const map = { inicial: 'Inicial', primario: 'Primario', secundario: 'Secundario' };
  return map[nivel] || nivel || '';
}
