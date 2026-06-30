// =====================================================
// MAIN.JS — Arranque y navegación
// =====================================================

let CUR_PAGE      = 'dash';
let DARK          = false;
let SB_OPEN       = true;
let EX            = null;
let MSG_FAM_UNREAD = 0;

const PAGE_LABELS = {
  dash:      'Mi Día',
  prob:      'Problemáticas',
  obj:       'Objetivos institucionales',
  asist:     'Asistencia',
  notas:     'Calificaciones',
  intensif:  'Intensificación',
  leg:       'Resumen del estudiante',
  eoe:       'Equipo de orientación',
  admin:     'Datos institucionales',
  agenda:    'Agenda institucional',
  novedades:    'Novedades',
  comunicados:  'Comunicados a familias',
  informes:  'Informes',
  tareas:    'Mis tareas',
  msgfam:    'Mensajes con familias',
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
  document.getElementById('sb-rol').textContent    = labelRol(u.rol_display || u.rol);

  // Nombre de la institución en sidebar — genérico, se carga de la BD
  const instNombre = INSTITUCION_ACTUAL?.nombre || 'Kairú';
  const instLetra  = instNombre[0]?.toUpperCase() || 'K';
  const sbLogoEl   = document.getElementById('sb-inst-logo');
  if (sbLogoEl) sbLogoEl.textContent = instLetra;
  document.getElementById('sb-inst-nombre').textContent = instNombre;

  // Título de la pestaña del navegador
  document.title = instNombre + ' · Kairú';

  iniciarReloj();
  renderNav();
  cargarNotificaciones();
  fetchMsgFamUnread();
  renderBottomNav();
  await goPage('dash');
}

// ── NAVEGACIÓN ────────────────────────────────────────
async function goPage(id) {
  CUR_PAGE = id;
  EX = null;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  const pg = document.getElementById('page-' + id);
  if (pg) pg.classList.add('on');

  document.getElementById('tb-title').textContent = PAGE_LABELS[id] || id;

  renderNav();

  // Adaptar títulos para nivel inicial
  if (typeof esNivelInicial === 'function' && esNivelInicial()) {
    PAGE_LABELS.notas    = 'Áreas de desarrollo';
    PAGE_LABELS.informes = 'Informes';
  }

  const renderers = {
    dash:      rDash,
    prob:      rProb,
    obj:       rObj,
    asist:     rAsist,
    notas:     rNotas,
    intensif:  rIntensif,
    leg:       rLeg,
    eoe:       rEOE,
    admin:     rAdmin,
    agenda:    rAgenda,
    novedades:   rNovedades,
    comunicados: rComunicados,
    informes:  rInformes,
    tareas:    rTareas,
    msgfam:    rMsgFam,
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


// ── UI CONTROLS ───────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    toggleMobileSidebar();
  } else {
    SB_OPEN = !SB_OPEN;
    sidebar.classList.toggle('collapsed', !SB_OPEN);
    const icon = document.getElementById('sb-toggle-icon');
    if (icon) icon.textContent = SB_OPEN ? '‹' : '›';
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
    secretario:       'Secretario/a',
    vicedirector:     'Vicedirector/a',
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
function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getFeriadosAR(anio) {
  const _iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const map = new Map();
  const a=anio%19, b=Math.floor(anio/100), c=anio%100, d=Math.floor(b/4), e=b%4;
  const f=Math.floor((b+8)/25), g=Math.floor((b-f+1)/3);
  const h=(19*a+b-d-g+15)%30, ii=Math.floor(c/4), k=c%4;
  const l=(32+2*e+2*ii-h-k)%7, m=Math.floor((a+11*h+22*l)/451);
  const pm=Math.floor((h+l-7*m+114)/31), pd=((h+l-7*m+114)%31)+1;
  const pascua = new Date(anio, pm-1, pd);
  const dp = (off, nom) => { const x=new Date(pascua); x.setDate(x.getDate()+off); map.set(_iso(x), nom); };
  dp(-48,'Carnaval'); dp(-47,'Carnaval'); dp(-2,'Viernes Santo');
  const af = (mes, dia, nom) => map.set(_iso(new Date(anio, mes-1, dia)), nom);
  af(1,1,'Año Nuevo'); af(3,24,'Día de la Memoria por la Verdad y la Justicia');
  af(4,2,'Día del Veterano y de los Caídos en Malvinas'); af(5,1,'Día del Trabajador');
  af(5,25,'Revolución de Mayo'); af(6,20,'Paso a la Inmortalidad del Gral. Belgrano');
  af(7,9,'Día de la Independencia'); af(12,8,'Inmaculada Concepción'); af(12,25,'Navidad');
  const tsl = (mes, dia, nom) => {
    const dt = new Date(anio, mes-1, dia);
    dt.setDate(dt.getDate() + [1,0,-1,-2,4,3,2][dt.getDay()]);
    map.set(_iso(dt), nom);
  };
  tsl(8,17,'Paso a la Inmortalidad del Gral. San Martín');
  tsl(10,12,'Día del Respeto a la Diversidad Cultural');
  tsl(11,20,'Día de la Soberanía Nacional');
  return map;
}
function diaHabilMasReciente(iso) {
  const d = new Date(iso + 'T12:00:00');
  for (let i = 0; i < 20; i++) {
    const check = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (esFechaHabil(check)) return check;
    d.setDate(d.getDate() - 1);
  }
  return iso;
}
function esFechaHabil(iso) {
  const d = new Date(iso + 'T12:00:00');
  const dia = d.getDay();
  if (dia === 0 || dia === 6) return false;
  const anio = d.getFullYear();
  if (!window._feriadosARCache) window._feriadosARCache = {};
  if (!window._feriadosARCache[anio]) window._feriadosARCache[anio] = getFeriadosAR(anio);
  if (window._feriadosARCache[anio].has(iso)) return false;
  if (window._diasNoLectivos?.has(iso)) return false;
  return true;
}
function formatFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'2-digit' });
}
function formatFechaLatam(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}
function formatFechaLarga(iso) {
  if (!iso) return '—';
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const [y, m, d] = iso.split('-');
  return `${parseInt(d)} de ${meses[parseInt(m)-1]} de ${y}`;
}
function formatFechaCorta(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return new Date(+y, +m - 1, +d).toLocaleDateString('es-AR', { day:'2-digit', month:'short' });
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
  return {
    convivencia:'Convivencia', emocional:'Emocional', familiar:'Familiar',
    aprendizaje:'Aprendizaje', salud:'Salud', conducta:'Conducta', otro:'Otro',
    académica:'Académica', conductual:'Conductual', socioemocional:'Socioemocional',
    ausentismo:'Ausentismo', otros:'Otros',
  }[t] || (t || '—');
}
function labelEstado(e) {
  return {
    abierta:'Sin atender', en_seguimiento:'En seguimiento',
    resuelta:'Cerrada', derivada:'Derivada', cerrada:'Cerrada',
  }[e] || e;
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
function mostrarToast(msg, tipo) {
  const t = document.createElement('div');
  const ok = tipo === 'ok' || tipo === 'success';
  Object.assign(t.style, {
    position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%) translateY(20px)',
    background: ok ? 'var(--verde,#27ae60)' : 'var(--rojo,#e74c3c)',
    color:'#fff', padding:'10px 20px', borderRadius:'8px', fontSize:'13px', fontWeight:'600',
    boxShadow:'0 4px 16px rgba(0,0,0,.18)', zIndex:'9999', opacity:'0',
    transition:'opacity .2s, transform .2s', whiteSpace:'nowrap', maxWidth:'90vw',
  });
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
  setTimeout(() => {
    t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(10px)';
    setTimeout(() => t.remove(), 250);
  }, 2800);
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
    { id:'dash',     icon:'⌂',  label:'Inicio' },
    { id:'agenda',   icon:'▦',  label:'Agenda' },
    { id:'prob',     icon:'△',  label:'Situaciones' },
    { id:'intensif', icon:'◈',  label:'Intensif.' },
    { id:'leg',      icon:'▤',  label:'Resumen' },
  ],
  directivo_nivel: [
    { id:'dash',     icon:'⌂',  label:'Inicio' },
    { id:'agenda',   icon:'▦',  label:'Agenda' },
    { id:'prob',     icon:'△',  label:'Situaciones' },
    { id:'intensif', icon:'◈',  label:'Intensif.' },
    { id:'leg',      icon:'▤',  label:'Resumen' },
  ],
  eoe: [
    { id:'dash',     icon:'⌂',  label:'Inicio' },
    { id:'prob',     icon:'△',  label:'Situaciones' },
    { id:'eoe',      icon:'▦',  label:'Actividades' },
    { id:'intensif', icon:'◈',  label:'Intensif.' },
    { id:'leg',      icon:'▤',  label:'Resumen' },
  ],
  docente: [
    { id:'dash',     icon:'⌂',  label:'Inicio' },
    { id:'asist',    icon:'✓',  label:'Asistencia' },
    { id:'notas',    icon:'≡',  label:'Notas' },
    { id:'intensif', icon:'◈',  label:'Intensif.' },
    { id:'prob',     icon:'△',  label:'Reportar' },
  ],
  preceptor: [
    { id:'dash',     icon:'⌂',  label:'Inicio' },
    { id:'asist',    icon:'✓',  label:'Lista' },
    { id:'notas',    icon:'≡',  label:'Notas' },
    { id:'intensif', icon:'◈',  label:'Intensif.' },
    { id:'leg',      icon:'▤',  label:'Resumen' },
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

// ── FECHA INPUT PERSONALIZADO ────────────────────────
const _MESES_ESP = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function renderFechaInput(id, iso, opts) {
  opts = opts || {};
  const parts = (iso || '').split('-');
  const y = parts[0] || '', m = parts[1] || '', d = parts[2] || '';
  const mOpts = _MESES_ESP.map((mn, i) => {
    const val = String(i + 1).padStart(2, '0');
    return `<option value="${val}"${m === val ? ' selected' : ''}>${mn}</option>`;
  }).join('');
  const sty = 'padding:8px;border:1px solid var(--brd);border-radius:var(--rad);background:var(--surf);color:var(--txt);font-size:13px;font-family:inherit;box-sizing:border-box';
  const oc  = opts.onchange ? ` onchange="${opts.onchange}"` : '';
  const ws  = opts.wrapStyle ? opts.wrapStyle + ';' : '';
  return `<div id="${id}-wrap" style="${ws}display:flex;gap:4px;align-items:center">` +
    `<input type="text" inputmode="numeric" id="${id}-d" placeholder="DD" value="${d}" maxlength="2" style="${sty};width:46px;text-align:center"${oc}>` +
    `<span style="color:var(--txt2);padding:0 2px">/</span>` +
    `<select id="${id}-m" style="${sty};flex:1"${oc}><option value="">Mes</option>${mOpts}</select>` +
    `<span style="color:var(--txt2);padding:0 2px">/</span>` +
    `<input type="text" inputmode="numeric" id="${id}-y" placeholder="AAAA" value="${y}" maxlength="4" style="${sty};width:60px;text-align:center"${oc}>` +
    `</div>`;
}

function getFechaInput(id) {
  const d = String(document.getElementById(id + '-d')?.value || '').padStart(2, '0');
  const m = document.getElementById(id + '-m')?.value || '';
  const y = document.getElementById(id + '-y')?.value || '';
  if (!m || !y || d === '00') return '';
  return `${y}-${m}-${d}`;
}

function _resetFechaInput(id, iso) {
  const [y, m, d] = (iso || '').split('-');
  const dEl = document.getElementById(id + '-d');
  const mEl = document.getElementById(id + '-m');
  const yEl = document.getElementById(id + '-y');
  if (dEl) dEl.value = parseInt(d, 10);
  if (mEl) mEl.value = m;
  if (yEl) yEl.value = y;
}

function validarFechaHabilCustom(id) {
  const iso = getFechaInput(id);
  if (!iso) return;
  const hoy = hoyISO();
  if (iso > hoy) {
    alert('No podés seleccionar una fecha futura.');
    _resetFechaInput(id, diaHabilMasReciente(hoy));
    return;
  }
  if (!esFechaHabil(iso)) {
    alert('Por favor seleccioná un día hábil (sin fines de semana, feriados ni días sin clases).');
    _resetFechaInput(id, diaHabilMasReciente(iso));
  }
}

function togglePass() {
  const inp = document.getElementById('inp-pass');
  const eyeOpen   = document.getElementById('ojo-abierto');
  const eyeClosed = document.getElementById('ojo-cerrado');
  if (inp.type === 'password') {
    inp.type = 'text';
    eyeOpen.style.display   = '';
    eyeClosed.style.display = 'none';
  } else {
    inp.type = 'password';
    eyeOpen.style.display   = 'none';
    eyeClosed.style.display = '';
  }
}

// ============ IA ASSISTANT ============
async function llamarIA(action, payload) {
  try {
    const { data: { session } } = await sb.auth.getSession();
    const response = await fetch(
      `https://vxsgzutluqfonhakiltz.supabase.co/functions/v1/ai-assistant`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action, payload })
      }
    );
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data.result;
  } catch (err) {
    console.error("Error IA:", err);
    return null;
  }
}