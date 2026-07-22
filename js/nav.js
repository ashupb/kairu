// =====================================================
// NAV.JS — Menú lateral por rol (multinivel)
// =====================================================

// ── ROLES ────────────────────────────────────────────
// Roles institucionales con alcance de NIVEL que comparten los permisos de
// directivo_nivel. Hasta la v38 `secretario` y `vicedirector` no existían de
// verdad: auth.js los reescribía a directivo_nivel al iniciar sesión. Ahora el
// rol real viaja en USUARIO_ACTUAL.rol y estos tres se tratan igual por defecto
// (editable por institución desde Roles y Permisos).
const ROLES_DIRECTIVOS_NIVEL = ['directivo_nivel', 'secretario', 'vicedirector'];

// ¿El rol es un directivo con alcance acotado a su nivel?
function esDirectivoNivel(rol) {
  return ROLES_DIRECTIVOS_NIVEL.includes(rol);
}

// Administrador de plataforma (Kairú), no es un actor institucional:
// cruza instituciones y nunca pasa por la tabla roles_permisos.
function esSuperAdmin(rol) {
  return (rol || USUARIO_ACTUAL?.rol) === 'super_admin';
}

const NAV_CONFIG = {
  super_admin: [
    { sec: 'General' },
    { id:'dash',       icon:'⌂',  label:'Mi Día' },
    { id:'agenda',     icon:'▦',  label:'Agenda' },
    { sec: 'Portal familiar' },
    { id:'novedades',  icon:'📢', label:'Novedades' },
    { id:'comunicados',icon:'✉️', label:'Comunicados' },
    { id:'msgfam',     icon:'✉',  label:'Mensajes', badge: true },
    { sec: 'Gestión institucional' },
    { id:'prob',    icon:'△',  label:'Problemáticas' },
    { id:'obj',     icon:'◎',  label:'Objetivos' },
    { id:'eoe',     icon:'✦',  label:'EOE' },
    { sec: 'Académico' },
    { id:'asist',    icon:'✓',  label:'Asistencia' },
    { id:'notas',    icon:'≡',  label:'Calificaciones' },
    { id:'intensif', icon:'◈',  label:'Intensificación' },
    { sec: 'Sistema' },
    { id:'leg',     icon:'▤',  label:'Resumen del estudiante' },
    { id:'admin',   icon:'⊙',  label:'Configuración', expandable: true },
  ],
  director_general: [
    { sec: 'General' },
    { id:'dash',       icon:'⌂',  label:'Mi Día' },
    { id:'agenda',     icon:'▦',  label:'Agenda' },
    { sec: 'Portal familiar' },
    { id:'novedades',  icon:'📢', label:'Novedades' },
    { id:'comunicados',icon:'✉️', label:'Comunicados' },
    { id:'msgfam',     icon:'✉',  label:'Mensajes', badge: true },
    { sec: 'Gestión institucional' },
    { id:'prob',    icon:'△',  label:'Problemáticas' },
    { id:'obj',     icon:'◎',  label:'Objetivos' },
    { id:'eoe',     icon:'✦',  label:'EOE' },
    { sec: 'Académico' },
    { id:'asist',    icon:'✓',  label:'Asistencia' },
    { id:'notas',    icon:'≡',  label:'Calificaciones' },
    { id:'intensif', icon:'◈',  label:'Intensificación' },
    { sec: 'Institución' },
    { id:'leg',     icon:'▤',  label:'Resumen del estudiante' },
    { id:'admin',   icon:'⊙',  label:'Configuración', expandable: true },
  ],
  directivo_nivel: [
    { sec: 'General' },
    { id:'dash',       icon:'⌂',  label:'Mi Día' },
    { id:'agenda',     icon:'▦',  label:'Agenda' },
    { sec: 'Portal familiar' },
    { id:'novedades',  icon:'📢', label:'Novedades' },
    { id:'comunicados',icon:'✉️', label:'Comunicados' },
    { id:'msgfam',     icon:'✉',  label:'Mensajes', badge: true },
    { sec: 'Gestión' },
    { id:'prob',    icon:'△',  label:'Problemáticas' },
    { id:'obj',     icon:'◎',  label:'Objetivos' },
    { id:'eoe',     icon:'✦',  label:'EOE' },
    { sec: 'Académico' },
    { id:'asist',    icon:'✓',  label:'Asistencia' },
    { id:'notas',    icon:'≡',  label:'Calificaciones' },
    { id:'intensif', icon:'◈',  label:'Intensificación' },
    { sec: 'Institución' },
    { id:'leg',     icon:'▤',  label:'Resumen del estudiante' },
    { id:'admin',   icon:'⊙',  label:'Configuración', expandable: true },
  ],
  eoe: [
    { sec: 'General' },
    { id:'dash',     icon:'⌂',  label:'Mi Día' },
    { id:'asist',    icon:'✓',  label:'Asistencia' },
    { id:'notas',    icon:'≡',  label:'Calificaciones' },
    { id:'intensif', icon:'◈',  label:'Intensificación' },
    { sec: 'Orientación' },
    { id:'eoe',     icon:'▦',  label:'Actividades' },
    { id:'prob',    icon:'△',  label:'Problemáticas' },
    { id:'leg',     icon:'▤',  label:'Resumen del estudiante' },
    { id:'obj',     icon:'◎',  label:'Objetivos' },
    { sec: 'Portal familiar' },
    { id:'msgfam',  icon:'✉',  label:'Mensajes', badge: true },
  ],
  docente: [
    { sec: 'General' },
    { id:'dash',    icon:'⌂',  label:'Mi Día' },
    { id:'agenda',  icon:'▦',  label:'Agenda' },
    { sec: 'Portal familiar' },
    { id:'msgfam',  icon:'✉',  label:'Mensajes', badge: true },
    { sec: 'Mis clases' },
    { id:'asist',    icon:'✓',  label:'Asistencia' },
    { id:'notas',    icon:'≡',  label:'Calificaciones' },
    { id:'intensif', icon:'◈',  label:'Intensificación' },
    { sec: 'Institucional' },
    { id:'prob',    icon:'△',  label:'Problemáticas' },
    { id:'obj',     icon:'◎',  label:'Objetivos' },
  ],
  preceptor: [
    { sec: 'General' },
    { id:'dash',  icon:'⌂',   label:'Mi Día' },
    { id:'agenda',icon:'▦',   label:'Agenda' },
    { sec: 'Portal familiar' },
    { id:'novedades',  icon:'📢', label:'Novedades' },
    { id:'comunicados',icon:'✉️', label:'Comunicados' },
    { id:'msgfam',     icon:'✉',  label:'Mensajes', badge: true },
    { sec: 'Mis cursos' },
    { id:'asist',    icon:'✓',  label:'Tomar lista' },
    { id:'notas',    icon:'≡',  label:'Calificaciones' },
    { id:'intensif', icon:'◈',  label:'Intensificación' },
    { sec: 'Institucional' },
    { id:'prob',  icon:'△',   label:'Problemáticas' },
    { id:'obj',   icon:'◎',   label:'Objetivos' },
    { id:'leg',   icon:'▤',   label:'Resumen del estudiante' },
    { id:'admin', icon:'⊙',   label:'Configuración', expandable: true },
  ],
};

// secretario y vicedirector arrancan con el mismo menú que directivo_nivel
// (§4: editable por institución desde Roles y Permisos, que filtra por `ver`).
// Comparten la referencia a propósito para que no se desincronicen.
NAV_CONFIG.secretario   = NAV_CONFIG.directivo_nivel;
NAV_CONFIG.vicedirector = NAV_CONFIG.directivo_nivel;

// Detecta si el usuario opera en el contexto de nivel inicial.
// Usado para adaptar el nav y los módulos de calificaciones/informes.
function esNivelInicial() {
  const u = USUARIO_ACTUAL;
  if (!u) return false;
  if (u.nivel === 'inicial') return true;
  // director_general en institución exclusivamente inicial
  if (u.rol === 'director_general') {
    const inst = INSTITUCION_ACTUAL;
    if (inst?.nivel_inicial && !inst?.nivel_primario && !inst?.nivel_secundario) return true;
  }
  return false;
}

// Descarta encabezados de sección que quedaron sin ítems debajo tras filtrar
// por permisos (si no, quedan títulos sueltos como "Académico" sin nada).
function _navQuitarSeccionesVacias(items) {
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.sec) { out.push(it); continue; }
    let hayItems = false;
    for (let j = i + 1; j < items.length && !items[j].sec; j++) { hayItems = true; break; }
    if (hayItems) out.push(it);
  }
  return out;
}

function renderNav() {
  const nav   = document.getElementById('sb-nav');
  const rol   = USUARIO_ACTUAL?.rol;
  const inicial = esNivelInicial();
  let items = (NAV_CONFIG[rol] || NAV_CONFIG.docente).slice();

  if (inicial) {
    // Usuario de nivel inicial puro: renombrar notas, agregar informes, quitar intensif
    const itemsAdaptados = [];
    for (const item of items) {
      if (item.id === 'notas') {
        itemsAdaptados.push({ ...item, label: 'Áreas de desarrollo' });
        itemsAdaptados.push({ id: 'informes', icon: '◻', label: 'Informes' });
      } else if (item.id === 'intensif') {
        // Intensificación no aplica a nivel inicial — se omite
      } else {
        itemsAdaptados.push(item);
      }
    }
    items = itemsAdaptados;
  } else if (USUARIO_ACTUAL?.rol === 'director_general' && INSTITUCION_ACTUAL?.nivel_inicial) {
    // Director general en institución multinivel con inicial: agregar Informes después de notas
    const itemsAdaptados = [];
    for (const item of items) {
      itemsAdaptados.push(item);
      if (item.id === 'notas') {
        itemsAdaptados.push({ id: 'informes', icon: '◻', label: 'Informes' });
      }
    }
    items = itemsAdaptados;
  }

  // Filtro por la plantilla de permisos de la institución (tabla roles_permisos).
  // super_admin no pasa por la tabla y, si no hay fila para rol+módulo, puedeVer()
  // cae al default hardcodeado — o sea, sin plantillas el menú es el de siempre.
  if (typeof puedeVer === 'function') {
    items = _navQuitarSeccionesVacias(items.filter(it => it.sec || puedeVer(it.id)));
  }

  nav.innerHTML = '';
  items.forEach(item => {
    if (item.sec) {
      const s = document.createElement('div');
      s.className = 'sb-section';
      s.textContent = item.sec;
      nav.appendChild(s);
      return;
    }
    if (item.expandable) {
      _renderNavExpandable(nav, item);
      return;
    }
    const el = document.createElement('div');
    el.className = 'nav-it' + (item.id === CUR_PAGE ? ' on' : '');
    el.onclick   = () => goPage(item.id);
    const badge = item.badge && MSG_FAM_UNREAD > 0
      ? `<span class="ni-badge">${MSG_FAM_UNREAD > 9 ? '9+' : MSG_FAM_UNREAD}</span>`
      : '';
    el.innerHTML = `<span class="ni-icon">${item.icon}</span><span class="ni-label">${item.label}</span>${badge}`;
    nav.appendChild(el);
  });
}

// Ítem de nav con subsecciones anidadas dentro del mismo sidebar (hoy solo
// "Configuración" — grupos/items definidos en CONFIG_GRUPOS, configuracion.js).
// Dos niveles de despliegue: la entrada raíz (_navAdminOpen) y, dentro de
// ella, cada grupo (Institución, Parámetros académicos, etc. — _navAdminGruposAbiertos).
let _navAdminOpen = false;
let _navAdminGruposAbiertos = new Set();

function _renderNavExpandable(nav, item) {
  const activo = item.id === CUR_PAGE;
  // _navAdminOpen se fuerza a true solo en el momento de navegar hacia acá
  // (ver rAdmin()/_irAItemAdmin en configuracion.js) — nunca acá en el render,
  // porque si no el toggle de plegar/desplegar deja de funcionar.

  const head = document.createElement('div');
  head.className = 'nav-it' + (activo ? ' on' : '');
  head.innerHTML = `<span class="ni-icon">${item.icon}</span><span class="ni-label">${item.label}</span><span class="ni-chev">${_navAdminOpen ? '▾' : '▸'}</span>`;
  head.onclick = () => {
    if (activo) {
      _navAdminOpen = !_navAdminOpen;
      renderNav();
    } else {
      _navAdminOpen = true;
      goPage(item.id);
    }
  };
  nav.appendChild(head);

  if (!_navAdminOpen || typeof _configGruposVisibles !== 'function' || !SB_OPEN) return;

  const wrap = document.createElement('div');
  wrap.className = 'nav-subtree';

  _configGruposVisibles().forEach(g => {
    const grupoActivo = activo && _admGrupo === g.id;
    // (mismo motivo que arriba: no forzar el estado abierto acá, solo leerlo)
    const abiertoG = _navAdminGruposAbiertos.has(g.id);

    const gEl = document.createElement('div');
    gEl.className = 'nav-subsec' + (abiertoG ? ' open' : '');
    gEl.innerHTML = `<span class="ns-label">${g.label}</span><span class="ns-chev">${abiertoG ? '▾' : '▸'}</span>`;
    gEl.onclick = ev => {
      ev.stopPropagation();
      if (_navAdminGruposAbiertos.has(g.id)) _navAdminGruposAbiertos.delete(g.id); else _navAdminGruposAbiertos.add(g.id);
      renderNav();
    };
    wrap.appendChild(gEl);

    if (!abiertoG) return;

    const gItems = document.createElement('div');
    gItems.className = 'nav-subit-wrap';
    g.items.forEach(it => {
      const on = grupoActivo && _admItem === it.id;
      const subEl = document.createElement('div');
      subEl.className = 'nav-it nav-subit' + (on ? ' on' : '');
      subEl.textContent = it.label;
      subEl.onclick = ev => { ev.stopPropagation(); _irAItemAdmin(g.id, it.id); };
      gItems.appendChild(subEl);
    });
    wrap.appendChild(gItems);
  });

  nav.appendChild(wrap);
}
