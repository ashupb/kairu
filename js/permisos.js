// =====================================================
// PERMISOS.JS — Módulos activos, permisos por rol y capacidades
// =====================================================
//
// Punto ÚNICO de resolución de acceso. Tres capas, en este orden:
//
//   1. Apps        (tabla modulos_institucion)  → ¿la institución usa el módulo?
//   2. Roles       (tabla roles_permisos)       → ¿el rol puede ver/editar/eliminar?
//   3. Capacidades (tabla roles_capacidades)    → permisos finos dentro de un módulo
//
//   Acceso efectivo = moduloActivo(id) AND (permiso del rol)
//
// Regla maestra: si un módulo está apagado en Apps NO lo ve nadie, sin importar
// lo que diga Roles y Permisos. La única excepción es super_admin (ver abajo).
//
// En las tres capas, si la tabla no existe o falta la fila se cae a un default
// que replica el comportamiento histórico: sin migraciones corridas, la app se
// comporta igual que siempre y nada desaparece por un registro faltante.

// ── CATÁLOGO DE MÓDULOS ──────────────────────────────
// Fuente única: no duplicar esta lista en otros archivos (Apps y Roles y
// Permisos leen de acá).
const PERMISOS_MODULOS = [
  { id: 'dash',        label: 'Mi Día' },
  { id: 'agenda',      label: 'Agenda' },
  { id: 'novedades',   label: 'Novedades' },
  { id: 'comunicados', label: 'Comunicados' },
  { id: 'msgfam',      label: 'Mensajes con familias' },
  { id: 'prob',        label: 'Problemáticas' },
  { id: 'obj',         label: 'Objetivos' },
  { id: 'eoe',         label: 'EOE' },
  { id: 'asist',       label: 'Asistencia' },
  { id: 'notas',       label: 'Calificaciones' },
  { id: 'intensif',    label: 'Intensificación' },
  { id: 'informes',    label: 'Informes (inicial)' },
  { id: 'leg',         label: 'Resumen del estudiante' },
  { id: 'tareas',      label: 'Tareas' },
  { id: 'admin',       label: 'Configuración' },
  // Subsecciones de Configuración → Portal Familiar (no son páginas del nav)
  { id: 'familias',       label: 'Portal: usuarios familia' },
  { id: 'portal_general', label: 'Portal: configuración' },
];

// Roles institucionales que aparecen en la matriz. super_admin queda fuera a
// propósito: no es editable ni configurable.
const PERMISOS_ROLES = [
  'director_general', 'directivo_nivel', 'vicedirector',
  'secretario', 'eoe', 'preceptor', 'docente',
];

// ── CLASIFICACIÓN PARA "APPS" ────────────────────────
// Núcleo: sin interruptor, la app no funciona sin ellos.
const APPS_NUCLEO = ['dash', 'admin'];
// Derivados del nivel: sin interruptor. NO se fuerzan desde acá — su
// visibilidad ya la resuelve renderNav() según los niveles de la institución
// (informes para inicial, intensif para el resto). En Apps se muestran sólo
// como informativos, para no cambiar el comportamiento actual.
const APPS_DERIVADOS = { intensif: 'secundario/primario', informes: 'inicial' };
// Bloque Portal Familiar: subordinados al maestro `portal`.
const APPS_PORTAL_HIJOS = ['novedades', 'comunicados', 'msgfam'];
// Activables sueltos, en el orden en que se muestran.
const APPS_ACTIVABLES = ['asist', 'notas', 'leg', 'agenda', 'prob', 'obj', 'eoe', 'tareas'];

// Secciones de la app de FAMILIAS (ids prefijados para no colisionar con los
// módulos internos: 'novedades', 'comunicados' y 'agenda' existen en ambos).
const PORTAL_SECCIONES = [
  { id: 'portal_novedades',     label: 'Novedades' },
  { id: 'portal_comunicados',   label: 'Comunicados' },
  { id: 'portal_mensajes',      label: 'Mensajes' },
  { id: 'portal_seguimiento',   label: 'Seguimiento académico' },
  { id: 'portal_asistencia',    label: 'Asistencias' },
  { id: 'portal_agenda',        label: 'Agenda' },
  { id: 'portal_convocatorias', label: 'Convocatorias' },
];

// ── DEFAULTS DE PERMISOS POR ROL ─────────────────────
// `ver` se deriva de NAV_CONFIG (si el módulo está en el menú del rol, lo ve).
// `editar`/`eliminar` replican los arrays de permisos históricos de cada módulo.
const _PERM_EDITAR_DEFAULT = {
  director_general: ['agenda','novedades','comunicados','msgfam','prob','obj','eoe','asist','notas','intensif','informes','leg','tareas','admin','familias','portal_general'],
  directivo_nivel:  ['agenda','novedades','comunicados','msgfam','prob','obj','eoe','asist','notas','intensif','informes','leg','tareas','admin','familias','portal_general'],
  eoe:              ['msgfam','prob','obj','eoe','leg','tareas'],
  preceptor:        ['agenda','novedades','comunicados','msgfam','prob','asist','notas','intensif','leg','tareas','admin','familias','portal_general'],
  docente:          ['msgfam','prob','asist','notas','intensif','informes','tareas'],
};
const _PERM_ELIMINAR_DEFAULT = {
  director_general: ['agenda','novedades','comunicados','prob','obj','eoe','asist','notas','intensif','leg','tareas','admin','familias'],
  directivo_nivel:  ['agenda','novedades','comunicados','prob','obj','eoe','asist','notas','intensif','tareas','admin','familias'],
  eoe:              ['eoe','tareas'],
  preceptor:        ['agenda','tareas','familias'],
  docente:          ['tareas'],
};
// secretario y vicedirector arrancan idénticos a directivo_nivel.
_PERM_EDITAR_DEFAULT.secretario    = _PERM_EDITAR_DEFAULT.directivo_nivel;
_PERM_EDITAR_DEFAULT.vicedirector  = _PERM_EDITAR_DEFAULT.directivo_nivel;
_PERM_ELIMINAR_DEFAULT.secretario   = _PERM_ELIMINAR_DEFAULT.directivo_nivel;
_PERM_ELIMINAR_DEFAULT.vicedirector = _PERM_ELIMINAR_DEFAULT.directivo_nivel;

// ¿El rol ve el módulo según NAV_CONFIG? (fuente del default de `ver`)
function _permVerDefault(rol, moduloId) {
  // 'informes' es condicional por nivel inicial y no está fijo en NAV_CONFIG.
  if (moduloId === 'informes') {
    return ['director_general','directivo_nivel','secretario','vicedirector','docente'].includes(rol);
  }
  // 'tareas' tampoco está en NAV_CONFIG: se entra desde el panel del dashboard,
  // no desde el menú. Sin este caso el default sería false para todos los roles
  // y el módulo desaparecería al sembrar la tabla.
  if (moduloId === 'tareas') return true;

  // 'familias' y 'portal_general' son subsecciones de Configuración, no páginas
  // del nav: sin caso explícito el default sería false y desaparecerían al
  // sembrar la tabla. El default replica los roles que hoy tienen acceso.
  if (moduloId === 'familias' || moduloId === 'portal_general') {
    return ['director_general','directivo_nivel','secretario','vicedirector','preceptor'].includes(rol);
  }

  const nav = (typeof NAV_CONFIG !== 'undefined' && NAV_CONFIG[rol]) || null;
  if (!nav) return false;
  return nav.some(it => it.id === moduloId);
}

function permisosDefault(rol, moduloId) {
  return {
    ver:      _permVerDefault(rol, moduloId),
    editar:   (_PERM_EDITAR_DEFAULT[rol]   || []).includes(moduloId),
    eliminar: (_PERM_ELIMINAR_DEFAULT[rol] || []).includes(moduloId),
  };
}

// ── CAPACIDADES SENSIBLES ────────────────────────────
// Permisos finos que la matriz de módulos no puede expresar. Set chico y
// entendible a propósito: NO agregar capacidades nuevas sin consultar.
const CAPACIDADES = [
  { id: 'ver_obs_privadas_eoe', label: 'Ver observaciones privadas del EOE',
    desc: 'Datos sensibles de salud y psicología del estudiante.' },
  { id: 'cargar_calificaciones', label: 'Cargar calificaciones',
    desc: 'Cargar y editar notas de los estudiantes.' },
  { id: 'cerrar_periodos', label: 'Cerrar períodos evaluativos',
    desc: 'Cerrar períodos y generar las alertas académicas.' },
  { id: 'gestionar_alumnos', label: 'Gestionar estudiantes',
    desc: 'Altas, bajas y matrícula.' },
  { id: 'gestionar_usuarios', label: 'Gestionar usuarios',
    desc: 'Crear y editar usuarios, y regenerar contraseñas.' },
  { id: 'editar_roles_permisos', label: 'Editar roles y permisos',
    desc: 'Cambiar las plantillas de permisos y capacidades.' },
];

// Defaults: replican EXACTAMENTE lo que hoy hace el código hardcodeado.
const _CAP_DEFAULT = {
  // legajosPermisos().verObsPrivadas
  ver_obs_privadas_eoe:  ['eoe','director_general','directivo_nivel','secretario','vicedirector'],
  // calificaciones.js — el EOE es sólo lectura
  cargar_calificaciones: ['director_general','directivo_nivel','secretario','vicedirector','preceptor','docente'],
  // cierre de período: sólo directivos
  cerrar_periodos:       ['director_general','directivo_nivel','secretario','vicedirector'],
  // CONFIG_GRUPOS → Alumnos
  gestionar_alumnos:     ['director_general','directivo_nivel','secretario','vicedirector','preceptor'],
  // _puedeGestionarUsuarios()
  gestionar_usuarios:    ['director_general','directivo_nivel','secretario','vicedirector'],
  // _puedeAdministrarInstitucion()
  editar_roles_permisos: ['director_general'],
};

function capacidadDefault(rol, capacidad) {
  return (_CAP_DEFAULT[capacidad] || []).includes(rol);
}

// ── CACHÉS ───────────────────────────────────────────
let PERMISOS_CACHE   = null;  // "rol|modulo" → {ver,editar,eliminar}
let MODULOS_CACHE    = null;  // "modulo"     → bool
let CAPACIDADES_CACHE = null; // "rol|capacidad" → bool

// Carga las tres tablas de la institución activa. Cada una falla por separado:
// si una tabla no existe todavía, su caché queda en null y esa capa cae al
// default sin afectar a las otras.
async function cargarPermisos() {
  PERMISOS_CACHE = MODULOS_CACHE = CAPACIDADES_CACHE = null;
  const instId = USUARIO_ACTUAL?.institucion_id || INSTITUCION_ACTUAL?.id;
  if (!instId) return;

  try {
    const { data, error } = await sb.from('roles_permisos')
      .select('rol, modulo_id, ver, editar, eliminar').eq('institucion_id', instId);
    if (!error && data) {
      const mapa = {};
      data.forEach(r => { mapa[`${r.rol}|${r.modulo_id}`] = r; });
      PERMISOS_CACHE = mapa;
    }
  } catch (_) { /* defaults */ }

  try {
    const { data, error } = await sb.from('modulos_institucion')
      .select('modulo_id, activo').eq('institucion_id', instId);
    if (!error && data) {
      const mapa = {};
      data.forEach(r => { mapa[r.modulo_id] = r.activo !== false; });
      MODULOS_CACHE = mapa;
    }
  } catch (_) { /* todo activo */ }

  try {
    const { data, error } = await sb.from('roles_capacidades')
      .select('rol, capacidad, habilitada').eq('institucion_id', instId);
    if (!error && data) {
      const mapa = {};
      data.forEach(r => { mapa[`${r.rol}|${r.capacidad}`] = r.habilitada === true; });
      CAPACIDADES_CACHE = mapa;
    }
  } catch (_) { /* defaults */ }
}

// ── APPS: ¿la institución usa este módulo? ───────────
// Fallback: sin fila (o sin tabla) el módulo se considera ACTIVO.
function moduloActivo(moduloId) {
  if (APPS_NUCLEO.includes(moduloId)) return true;   // dash y admin no se apagan

  // Los hijos del Portal Familiar dependen del maestro.
  if (APPS_PORTAL_HIJOS.includes(moduloId) && MODULOS_CACHE
      && MODULOS_CACHE.portal === false) return false;

  if (!MODULOS_CACHE) return true;
  const v = MODULOS_CACHE[moduloId];
  return v === undefined ? true : v;
}

// ── RESOLUCIÓN ───────────────────────────────────────
function _permResolver(moduloId, campo, rol) {
  const r = rol || USUARIO_ACTUAL?.rol;
  if (!r) return false;

  // El administrador de plataforma ve todo, INCLUSO los módulos apagados:
  // necesita la institución completa para dar soporte y poder reactivarlos.
  if (r === 'super_admin') return true;

  // Regla maestra: módulo apagado → nadie accede, sin mirar el rol.
  if (!moduloActivo(moduloId)) return false;

  const fila = PERMISOS_CACHE?.[`${r}|${moduloId}`];
  if (fila && typeof fila[campo] === 'boolean') return fila[campo];
  return permisosDefault(r, moduloId)[campo];
}

function puedeVer(moduloId, rol)      { return _permResolver(moduloId, 'ver', rol); }
function puedeEditar(moduloId, rol)   { return _permResolver(moduloId, 'editar', rol); }
function puedeEliminar(moduloId, rol) { return _permResolver(moduloId, 'eliminar', rol); }

// ── CAPACIDADES ──────────────────────────────────────
function tieneCapacidad(capacidad, rol) {
  const r = rol || USUARIO_ACTUAL?.rol;
  if (!r) return false;
  if (r === 'super_admin') return true;
  const v = CAPACIDADES_CACHE?.[`${r}|${capacidad}`];
  if (typeof v === 'boolean') return v;
  return capacidadDefault(r, capacidad);
}
