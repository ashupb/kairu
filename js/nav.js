// =====================================================
// NAV.JS — Menú lateral por rol (multinivel)
// =====================================================

const NAV_CONFIG = {
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
    { id:'admin', icon:'⊙',   label:'Configuración' },
  ],
  admin: [
    { sec: 'General' },
    { id:'dash',    icon:'⌂',  label:'Mi Día' },
    { id:'agenda',  icon:'▦',  label:'Agenda' },
    { sec: 'Sistema' },
    { id:'admin',   icon:'⊙',  label:'Configuración', expandable: true },
  ],
};

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
let _navAdminOpen = false;

function _renderNavExpandable(nav, item) {
  const activo = item.id === CUR_PAGE;
  if (activo) _navAdminOpen = true; // la sección activa siempre se ve expandida

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

  _configGruposVisibles().forEach(g => {
    const gEl = document.createElement('div');
    gEl.className = 'nav-subsec';
    gEl.textContent = g.label;
    nav.appendChild(gEl);

    g.items.forEach(it => {
      const on = activo && _admGrupo === g.id && _admItem === it.id;
      const subEl = document.createElement('div');
      subEl.className = 'nav-it nav-subit' + (on ? ' on' : '');
      subEl.textContent = it.label;
      subEl.onclick = ev => { ev.stopPropagation(); _irAItemAdmin(g.id, it.id); };
      nav.appendChild(subEl);
    });
  });
}
