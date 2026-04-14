// =====================================================
// MAIN.JS — Arranque y navegación
// =====================================================

let PAGE_HIST = [];
let CUR_PAGE  = 'dash';
let DARK      = false;
let SB_OPEN   = true;
let EX        = null;

const PAGE_LABELS = {
  dash:      'Inicio',
  prob:      'Problemáticas',
  obj:       'Objetivos institucionales',
  asist:     'Asistencia',
  notas:     'Calificaciones',
  leg:       'Legajos',
  eoe:       'Equipo de orientación',
  admin:     'Datos institucionales',
  agenda:    'Agenda institucional',
};

// ── ARRANQUE ─────────────────────────────────────────
async function iniciarApp() {
  // Ocultar login, mostrar shell
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('shell').style.display        = 'flex';

  // Nombre e iniciales del usuario en sidebar
  const u       = USUARIO_ACTUAL;
  const iniciales = u.avatar_iniciales || generarIniciales(u.nombre_completo);
  document.getElementById('sb-av').textContent    = iniciales.toUpperCase();
  document.getElementById('sb-nombre').textContent = u.nombre_completo;
  document.getElementById('sb-rol').textContent    = labelRol(u.rol);

  // Nombre de la institución en sidebar — genérico, se carga de la BD
  const instNombre = INSTITUCION_ACTUAL?.nombre || 'EduGestión';
  const instLetra  = instNombre[0]?.toUpperCase() || 'E';
  document.getElementById('sb-inst-logo').textContent  = instLetra;
  document.getElementById('sb-inst-nombre').textContent = instNombre;

  // Título de la pestaña del navegador
  document.title = instNombre + ' · EduGestión';

  iniciarReloj();
  renderNav();
  cargarNotificaciones();
  renderBottomNav();
  await goPage('dash');
}

// ── NAVEGACIÓN ────────────────────────────────────────
async function goPage(id) {
  if (CUR_PAGE !== id) PAGE_HIST.push(CUR_PAGE);
  CUR_PAGE = id;
  EX = null;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  const pg = document.getElementById('page-' + id);
  if (pg) pg.classList.add('on');

  document.getElementById('tb-title').textContent = PAGE_LABELS[id] || id;

  const back = document.getElementById('tb-back');
  back.classList.toggle('show', PAGE_HIST.length > 0);

  renderNav();

  const renderers = {
    dash:      rDash,
    prob:      rProb,
    obj:       rObj,
    asist:     rAsist,
    leg:       rLeg,
    eoe:       rEOE,
    admin:     rAdmin,
    agenda:    rAgenda,
  };
  if (renderers[id]) await renderers[id]();

  renderBottomNav();
// Cerrar sidebar mobile si estaba abierto
document.getElementById('sidebar')?.classList.remove('mobile-open');
document.getElementById('sidebar-overlay')?.classList.remove('on');

// Cerrar sidebar mobile al navegar
const sb2 = document.getElementById('sidebar');
const ov2 = document.getElementById('sidebar-overlay');
if (sb2) sb2.classList.remove('mobile-open');
if (ov2) ov2.classList.remove('on');
renderBottomNav();

}

function goBack() {
  if (PAGE_HIST.length > 0) {
    const prev = PAGE_HIST.pop();
    CUR_PAGE = prev;
    EX = null;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
    const pg = document.getElementById('page-' + prev);
    if (pg) pg.classList.add('on');
    document.getElementById('tb-title').textContent = PAGE_LABELS[prev] || prev;
    document.getElementById('tb-back').classList.toggle('show', PAGE_HIST.length > 0);
    renderNav();
    const renderers = { dash:rDash,prob:rProb,obj:rObj,reuniones:rReuniones,asist:rAsist,leg:rLeg,eoe:rEOE,admin:rAdmin };
    if (renderers[prev]) renderers[prev]();
  }
}

// ── UI CONTROLS ───────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    toggleMobileSidebar();
  } else {
    SB_OPEN = !SB_OPEN;
    sidebar.classList.toggle('collapsed', !SB_OPEN);
  }
}
function toggleDark() {
  DARK = !DARK;
  document.body.classList.toggle('dark', DARK);
  const icon = DARK ? '☀️' : '🌙';
  document.getElementById('theme-icon').textContent    = icon;
  document.getElementById('tb-theme-icon').textContent = icon;
  document.getElementById('dark-label').textContent    = DARK ? 'Modo claro' : 'Modo oscuro';
}

function togEx(id, fn) {
  EX = EX === id ? null : id;
  if (fn) fn();
}

// ── RELOJ ─────────────────────────────────────────────
function iniciarReloj() {
  function tick() {
    const now = new Date();
    const h   = String(now.getHours()).padStart(2, '0');
    const m   = String(now.getMinutes()).padStart(2, '0');
    const el  = document.getElementById('tb-clock');
    if (el) el.textContent = h + ':' + m;
  }
  tick();
  setInterval(tick, 30000);
}

// ── UTILIDADES GLOBALES ───────────────────────────────
function labelRol(rol) {
  return {
    director_general: 'Dirección general',
    directivo_nivel:  'Directivo/a',
    eoe:              'Orientador/a EOE',
    docente:          'Docente',
    preceptor:        'Preceptor/a',
    admin:            'Administrador',
  }[rol] || rol;
}

function generarIniciales(nombre) {
  if (!nombre) return '?';
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 1) return partes[0][0];
  // Apellido, Nombre → toma primera letra de cada parte
  return (partes[0][0] + (partes[1]?.[0] || '')).toUpperCase();
}

function PC(p) { return p >= 7 ? 'var(--verde)' : p >= 6 ? 'var(--ambar)' : 'var(--rojo)'; }
function NC(p) { return p >= 7 ? 'nota-ok' : p >= 6 ? 'nota-warn' : 'nota-risk'; }
function promedio(arr) {
  const v = (arr || []).filter(x => x !== null && x !== undefined && x !== '');
  return v.length ? v.reduce((a, b) => a + Number(b), 0) / v.length : null;
}
function formatFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function formatFechaCorta(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day:'2-digit', month:'short' });
}
function tiempoDesde(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `hace ${hrs} hs`;
  return `hace ${Math.floor(hrs / 24)} días`;
}
function labelTipo(t) {
  return { convivencia:'Convivencia', emocional:'Emocional', familiar:'Familiar', aprendizaje:'Aprendizaje', salud:'Salud', conducta:'Conducta', otro:'Otro' }[t] || t;
}
function labelEstado(e) {
  return { abierta:'Sin atender', en_seguimiento:'En seguimiento', resuelta:'Resuelto', derivada:'Derivado' }[e] || e;
}
function labelEstadoCls(e) {
  return e === 'abierta' ? 'tr' : e === 'en_seguimiento' ? 'ta' : 'tg';
}
function showLoading(pageId) {
  const pg = document.getElementById('page-' + pageId);
  if (pg) pg.innerHTML = `<div class="loading-state"><div class="spinner"></div><div>Cargando...</div></div>`;
}
function showError(pageId, msg) {
  const pg = document.getElementById('page-' + pageId);
  if (pg) pg.innerHTML = `<div class="empty-state">⚠️<br>${msg}</div>`;
}

// ── ARRANQUE AL CARGAR LA PÁGINA ─────────────────────
window.addEventListener('load', () => {
  document.getElementById('login-screen').style.display = 'none';
  verificarSesion();
});

// Enter en el login
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const ls = document.getElementById('login-screen');
    if (ls && ls.style.display !== 'none') login();
  }
});

// ── MOBILE SIDEBAR ────────────────────────────────────
function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar || !overlay) return;
  const isOpen = sidebar.classList.contains('mobile-open');
  if (isOpen) {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('on');
  } else {
    sidebar.classList.add('mobile-open');
    overlay.classList.add('on');
  }
}

// ── BOTTOM NAV MOBILE ─────────────────────────────────
const BOTTOM_NAV_ITEMS = {
  director_general: [
    { id:'dash',    icon:'🏠', label:'Inicio' },
    { id:'agenda',  icon:'📅', label:'Agenda' },
    { id:'prob',    icon:'⚠️', label:'Situaciones' },
    { id:'leg',     icon:'🗂️', label:'Legajos' },
    { id:'obj',     icon:'🎯', label:'Objetivos' },
  ],
  directivo_nivel: [
    { id:'dash',    icon:'🏠', label:'Inicio' },
    { id:'agenda',  icon:'📅', label:'Agenda' },
    { id:'prob',    icon:'⚠️', label:'Situaciones' },
    { id:'leg',     icon:'🗂️', label:'Legajos' },
    { id:'obj',     icon:'🎯', label:'Objetivos' },
  ],
  eoe: [
    { id:'dash',    icon:'🏠', label:'Inicio' },
    { id:'agenda',  icon:'📅', label:'Agenda' },
    { id:'eoe',     icon:'🧠', label:'Casos' },
    { id:'leg',     icon:'🗂️', label:'Legajos' },
    { id:'prob',    icon:'⚠️', label:'Situaciones' },
  ],
  docente: [
    { id:'dash',    icon:'🏠', label:'Inicio' },
    { id:'agenda',  icon:'📅', label:'Agenda' },
    { id:'asist',   icon:'✅', label:'Asistencia' },
    { id:'notas',   icon:'📊', label:'Notas' },
    { id:'prob',    icon:'⚠️', label:'Reportar' },
  ],
  preceptor: [
    { id:'dash',    icon:'🏠', label:'Inicio' },
    { id:'agenda',  icon:'📅', label:'Agenda' },
    { id:'asist',   icon:'✅', label:'Lista' },
    { id:'leg',     icon:'🗂️', label:'Legajos' },
    { id:'prob',    icon:'⚠️', label:'Reportar' },
  ],
};

function renderBottomNav() {
  const contenedor = document.getElementById('bottom-nav-items');
  if (!contenedor) return;
  const rol   = USUARIO_ACTUAL?.rol;
  const items = BOTTOM_NAV_ITEMS[rol] || BOTTOM_NAV_ITEMS.docente;
  contenedor.innerHTML = items.map(item => `
    <button class="bn-item ${CUR_PAGE === item.id ? 'on' : ''}" onclick="goPage('${item.id}')">
      <span class="bn-icon">${item.icon}</span>
      <span class="bn-label">${item.label}</span>
    </button>`).join('');
}

function togglePass() {
  const inp = document.getElementById('inp-pass');
  const btn = document.getElementById('btn-ojo');
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.textContent = '🙈'; // cerrado = ocultar
  } else {
    inp.type = 'password';
    btn.textContent = '👁';  // abierto = mostrar
  }
}