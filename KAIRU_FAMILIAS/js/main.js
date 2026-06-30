// ── Estado de navegación ──────────────────────────────────────────
let CUR_PAGE = 'login';
let UNREAD_COUNT = 0;
let CONV_NOTIF_COUNT = 0;
let MSG_UNREAD_COUNT = 0;
let _DEEP_LINK_ID = null; // ID del ítem a destacar tras la próxima navegación

// ── Ítems del nav ─────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    id: 'inicio', label: 'Inicio',
    svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`
  },
  { section: 'Portal Familiar' },
  {
    id: 'novedades', label: 'Novedades',
    svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`
  },
  {
    id: 'comunicados', label: 'Comunicados', badge: true,
    svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`
  },
  {
    id: 'mensajes', label: 'Mensajes', badge: 'msg',
    svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`
  },
  { section: 'Vida Escolar' },
  {
    id: 'seguimiento', label: 'Seguimiento',
    svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>`
  },
  {
    id: 'asistencia', label: 'Asistencias',
    svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`
  },
  {
    id: 'agenda', label: 'Agenda',
    svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
  },
  {
    id: 'convocatorias', label: 'Convocatorias', badge: 'conv',
    svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`
  },
];

// ── Mapa de renderers ─────────────────────────────────────────────
const PAGE_RENDERERS = {
  inicio:       () => rInicio(),
  novedades:    () => rNovedades(),
  comunicados:  () => rComunicados(),
  seguimiento:  () => rSeguimiento(),
  asistencia:   () => rAsistencia(),
  agenda:         () => rAgenda(),
  convocatorias:  () => rConvocatorias(),
  mensajes:       () => rMensajes(),
  contactos:    () => rContactos(),
};

// ── Navegación ────────────────────────────────────────────────────
function goPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');
  CUR_PAGE = id;

  if (id !== 'login') {
    updateSidebarActive(id);
    closeSidebarDrawer();
    if (PAGE_RENDERERS[id]) PAGE_RENDERERS[id]();
  }
}

// Navega a una página y abre/resalta el ítem con ese ID una vez cargado
function goPageDeep(pageId, itemId) {
  _DEEP_LINK_ID = itemId;
  goPage(pageId);
}

// ── Render sidebar completo ───────────────────────────────────────
function renderSidebar() {
  renderSidebarStudent();
  renderSidebarNav();
  applyDarkModeState();
}

// ── Sección estudiante ────────────────────────────────────────────
function renderSidebarStudent() {
  const el = document.getElementById('sidebar-student');
  if (!el || !ALUMNO_ACTUAL) return;

  const alumnos = USUARIO_FAMILIAR?.alumnos || [];
  const tieneMultiples = alumnos.length > 1;
  const iniciales = _iniciales(ALUMNO_ACTUAL.nombre_completo);
  const c = ALUMNO_ACTUAL.cursos;
  const cursoStr = c ? `${nombreCurso(c)} · ${nivelLabel(c.nivel)}` : '';

  const chevronSvg = tieneMultiples ? `
    <span class="sidebar-student-chevron" id="student-chevron">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </span>` : '';

  const dropdownHtml = tieneMultiples ? `
    <div class="student-dropdown" id="student-dropdown">
      ${alumnos.map(a => `
        <button class="student-dropdown-item ${a.id === ALUMNO_ACTUAL.id ? 'active' : ''}"
                onclick="selectAlumnoSidebar('${a.id}')">
          <span class="mini-avatar">${_iniciales(a.nombre_completo)}</span>
          <span>${a.nombre_completo}</span>
        </button>
      `).join('')}
    </div>` : '';

  el.innerHTML = `
    <button class="sidebar-student-btn" ${tieneMultiples ? 'onclick="toggleStudentDropdown()"' : ''}>
      <span class="sidebar-avatar">${iniciales}</span>
      <span class="sidebar-student-info">
        <span class="sidebar-student-name">${ALUMNO_ACTUAL.nombre_completo}</span>
        <span class="sidebar-student-curso">${cursoStr}</span>
      </span>
      ${chevronSvg}
    </button>
    ${dropdownHtml}
  `;
}

function toggleStudentDropdown() {
  const dropdown = document.getElementById('student-dropdown');
  const chevron  = document.getElementById('student-chevron');
  if (!dropdown) return;
  dropdown.classList.toggle('open');
  if (chevron) chevron.classList.toggle('open');
}

function selectAlumnoSidebar(alumnoId) {
  setAlumno(alumnoId);
  const dropdown = document.getElementById('student-dropdown');
  const chevron  = document.getElementById('student-chevron');
  if (dropdown) dropdown.classList.remove('open');
  if (chevron)  chevron.classList.remove('open');
}

// ── Nav items ─────────────────────────────────────────────────────
function renderSidebarNav() {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;
  nav.innerHTML = NAV_ITEMS.map(item => {
    if (item.section) {
      return `<div class="sidebar-nav-section">${item.section}</div>`;
    }
    const badgeCount = item.badge === 'conv' ? CONV_NOTIF_COUNT : item.badge === 'msg' ? MSG_UNREAD_COUNT : UNREAD_COUNT;
    const badge = item.badge && badgeCount > 0
      ? `<span class="nav-badge" data-page="${item.id}">${badgeCount > 9 ? '9+' : badgeCount}</span>`
      : '';
    return `
      <button class="sidebar-nav-item ${CUR_PAGE === item.id ? 'active' : ''}"
              data-tooltip="${item.label}"
              onclick="goPage('${item.id}')">
        ${item.svg}
        <span class="sidebar-nav-label">${item.label}</span>
        ${badge}
      </button>`;
  }).join('');
}

function updateSidebarActive(id) {
  document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
    const isActive = btn.getAttribute('onclick') === `goPage('${id}')`;
    btn.classList.toggle('active', isActive);
  });
}

// ── Badge Convocatorias: cuenta notificaciones de citas no leídas ─────────────
async function fetchConvNotifCount() {
  if (!USUARIO_FAMILIAR) return;
  try {
    const { data } = await sb
      .from('notificaciones')
      .select('id')
      .eq('usuario_id', USUARIO_FAMILIAR.id)
      .eq('leida', false)
      .eq('referencia_tabla', 'eventos_institucionales');
    CONV_NOTIF_COUNT = (data || []).length;
    renderSidebarNav();
    updateSidebarActive(CUR_PAGE);
  } catch (_) {}
}

// ── Campana: solo cuenta comunicados (tipo='comunicado') del curso del alumno ──
async function fetchUnreadCount() {
  if (!USUARIO_FAMILIAR || !ALUMNO_ACTUAL) return;
  const cursoId = ALUMNO_ACTUAL.cursos?.id;
  if (!cursoId) { updateBellBadge(0); return; }

  try {
    const { data: todos } = await sb
      .from('comunicados')
      .select('id')
      .eq('institucion_id', USUARIO_FAMILIAR.institucion_id)
      .eq('tipo', 'comunicado')
      .eq('curso_id', cursoId)
      .order('created_at', { ascending: false })
      .limit(50);

    const ids = (todos || []).map(c => c.id);
    if (!ids.length) { updateBellBadge(0); return; }

    const { data: lecturas } = await sb
      .from('comunicado_lecturas')
      .select('comunicado_id')
      .eq('usuario_id', USUARIO_FAMILIAR.id)
      .in('comunicado_id', ids);

    const leidos = new Set((lecturas || []).map(l => l.comunicado_id));
    updateBellBadge(ids.filter(id => !leidos.has(id)).length);
  } catch (_) {}
}

function updateBellBadge(count) {
  UNREAD_COUNT = count;

  // Re-render nav para mostrar/ocultar badge en "Avisos"
  renderSidebarNav();
  updateSidebarActive(CUR_PAGE);

  // Badge campana en content-topbar (desktop)
  const contentBadge = document.getElementById('content-bell-badge');
  if (contentBadge) {
    contentBadge.textContent = count > 9 ? '9+' : count;
    contentBadge.classList.toggle('visible', count > 0);
  }

  // Punto rojo en mob-topbar (mobile)
  const mobBadge = document.getElementById('mob-bell-badge');
  if (mobBadge) mobBadge.style.display = count > 0 ? 'block' : 'none';
}

// ── Sidebar collapse / expand ─────────────────────────────────────
function toggleSidebar() {
  const collapsed = document.body.classList.toggle('sidebar-collapsed');
  localStorage.setItem('kairu-fam-sidebar-collapsed', collapsed ? '1' : '0');
}

function applySidebarCollapsedState() {
  if (localStorage.getItem('kairu-fam-sidebar-collapsed') === '1') {
    document.body.classList.add('sidebar-collapsed');
  }
}

// ── Dark mode ─────────────────────────────────────────────────────
function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('kairu-fam-dark', isDark ? '1' : '0');
  applyDarkModeState();
}

function applyDarkModeState() {
  const isDark = document.body.classList.contains('dark');
  const sw = document.getElementById('dark-toggle-sw');
  if (sw) sw.classList.toggle('on', isDark);
}

function initDarkMode() {
  if (localStorage.getItem('kairu-fam-dark') === '1') {
    document.body.classList.add('dark');
  }
}

// ── Mobile drawer ─────────────────────────────────────────────────
function openSidebarDrawer() {
  document.getElementById('sidebar')?.classList.add('sidebar--open');
  document.getElementById('sidebar-overlay')?.classList.add('visible');
}

function closeSidebarDrawer() {
  document.getElementById('sidebar')?.classList.remove('sidebar--open');
  document.getElementById('sidebar-overlay')?.classList.remove('visible');
}

// ── Reloj en content-topbar (desktop) ────────────────────────────
function startClock() {
  function tick() {
    const el = document.getElementById('content-time');
    if (el) el.textContent = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
  tick();
  setInterval(tick, 30000);
}

// ── App init ──────────────────────────────────────────────────────
function iniciarApp() {
  initDarkMode();
  applySidebarCollapsedState();
  renderSidebar();
  startClock();
  fetchUnreadCount();
  fetchConvNotifCount();
  fetchMsgUnreadCount();
  goPage('inicio');
}

// ── Cambiar alumno activo ─────────────────────────────────────────
function setAlumno(alumnoId) {
  const alumno = USUARIO_FAMILIAR?.alumnos?.find(a => a.id === alumnoId);
  if (!alumno) return;
  ALUMNO_ACTUAL = alumno;
  renderSidebarStudent();
  if (PAGE_RENDERERS[CUR_PAGE]) PAGE_RENDERERS[CUR_PAGE]();
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

function _iniciales(n) {
  return n ? n.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase() : '?';
}
