// =====================================================
// NAV.JS — Menú lateral por rol (multinivel)
// =====================================================

const NAV_CONFIG = {
  director_general: [
    { sec: 'General' },
    { id:'dash',    icon:'⌂',  label:'Inicio' },
    { id:'agenda',  icon:'▦',  label:'Agenda' },
    { id:'avisos',  icon:'📢', label:'Comunicados' },
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
    { id:'admin',   icon:'⊙',  label:'Configuración' },
  ],
  directivo_nivel: [
    { sec: 'General' },
    { id:'dash',    icon:'⌂',  label:'Inicio' },
    { id:'agenda',  icon:'▦',  label:'Agenda' },
    { id:'avisos',  icon:'📢', label:'Comunicados' },
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
    { id:'admin',   icon:'⊙',  label:'Configuración' },
  ],
  eoe: [
    { sec: 'General' },
    { id:'dash',     icon:'⌂',  label:'Inicio' },
    { id:'asist',    icon:'✓',  label:'Asistencia' },
    { id:'notas',    icon:'≡',  label:'Calificaciones' },
    { id:'intensif', icon:'◈',  label:'Intensificación' },
    { sec: 'Orientación' },
    { id:'eoe',     icon:'▦',  label:'Actividades' },
    { id:'prob',    icon:'△',  label:'Problemáticas' },
    { id:'leg',     icon:'▤',  label:'Resumen del estudiante' },
    { id:'obj',     icon:'◎',  label:'Objetivos' },
  ],
  docente: [
    { sec: 'General' },
    { id:'dash',    icon:'⌂',  label:'Inicio' },
    { id:'agenda',  icon:'▦',  label:'Agenda' },
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
    { id:'dash',  icon:'⌂',   label:'Inicio' },
    { id:'agenda',icon:'▦',   label:'Agenda' },
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
    { id:'dash',    icon:'⌂',  label:'Inicio' },
    { id:'agenda',  icon:'▦',  label:'Agenda' },
    { sec: 'Sistema' },
    { id:'admin',   icon:'⊙',  label:'Configuración' },
  ],
};

function renderNav() {
  const nav   = document.getElementById('sb-nav');
  const rol   = USUARIO_ACTUAL?.rol;
  const items = NAV_CONFIG[rol] || NAV_CONFIG.docente;
  nav.innerHTML = '';
  items.forEach(item => {
    if (item.sec) {
      const s = document.createElement('div');
      s.className = 'sb-section';
      s.textContent = item.sec;
      nav.appendChild(s);
      return;
    }
    const el = document.createElement('div');
    el.className = 'nav-it' + (item.id === CUR_PAGE ? ' on' : '');
    el.onclick   = () => goPage(item.id);
    el.innerHTML = `<span class="ni-icon">${item.icon}</span><span class="ni-label">${item.label}</span>`;
    nav.appendChild(el);
  });
}
