// =====================================================
// PERMISOS.JS — Resolución de permisos por rol (roles_permisos)
// =====================================================
//
// Plantillas de permisos editables por institución (Configuración → Usuarios →
// Roles y Permisos). Modelo: el ROL define todo, no hay override por usuario.
//
// Resolución (§4.3 del spec de roles):
//   1. super_admin  → siempre true, no pasa por la tabla.
//   2. Fila en roles_permisos para (institución, rol, módulo) → se usa.
//   3. Sin fila → fallback al default hardcodeado (PERMISOS_DEFAULT), que
//      replica el comportamiento previo a la tabla. Así, si la migración no
//      corrió o falta un registro, la app se comporta como siempre.
//
// IMPORTANTE — alcance actual: `ver` es lo único cableado en la app (filtra el
// menú en renderNav() y protege goPage()). `editar`/`eliminar` se persisten y se
// editan desde la matriz, pero los módulos siguen usando sus arrays de rol
// históricos; adoptarlos es incremental y NO debe hacerse en bloque (ver
// CLAUDE.md). Esto es deliberado: el objetivo de la etapa fue que el
// comportamiento visible no cambiara.

// Módulos gobernados por la tabla (ids del nav).
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
  { id: 'admin',       label: 'Configuración' },
];

// Roles institucionales que aparecen en la matriz. super_admin queda fuera a
// propósito: no es editable ni configurable (§4.4).
const PERMISOS_ROLES = [
  'director_general', 'directivo_nivel', 'vicedirector',
  'secretario', 'eoe', 'preceptor', 'docente',
];

// ── DEFAULTS ─────────────────────────────────────────
// `ver` se deriva de NAV_CONFIG (si el módulo está en el menú del rol, lo ve).
// `editar`/`eliminar` replican los arrays de permisos históricos de cada módulo.
const _PERM_EDITAR_DEFAULT = {
  director_general: ['agenda','novedades','comunicados','msgfam','prob','obj','eoe','asist','notas','intensif','informes','leg','admin'],
  directivo_nivel:  ['agenda','novedades','comunicados','msgfam','prob','obj','eoe','asist','notas','intensif','informes','leg','admin'],
  eoe:              ['msgfam','prob','obj','eoe','leg'],
  preceptor:        ['agenda','novedades','comunicados','msgfam','prob','asist','notas','intensif','leg','admin'],
  docente:          ['msgfam','prob','asist','notas','intensif','informes'],
};
const _PERM_ELIMINAR_DEFAULT = {
  director_general: ['agenda','novedades','comunicados','prob','obj','eoe','asist','notas','intensif','leg','admin'],
  directivo_nivel:  ['agenda','novedades','comunicados','prob','obj','eoe','asist','notas','intensif','admin'],
  eoe:              ['eoe'],
  preceptor:        ['agenda'],
  docente:          [],
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

// ── CACHE ────────────────────────────────────────────
// Mapa "rol|modulo" → {ver,editar,eliminar} de la institución activa.
let PERMISOS_CACHE = null;

async function cargarPermisos() {
  PERMISOS_CACHE = null;
  const instId = USUARIO_ACTUAL?.institucion_id || INSTITUCION_ACTUAL?.id;
  if (!instId) return;
  try {
    const { data, error } = await sb.from('roles_permisos')
      .select('rol, modulo_id, ver, editar, eliminar')
      .eq('institucion_id', instId);
    // Si la tabla no existe todavía (migración sin correr) queda en null →
    // todo cae al default hardcodeado.
    if (error || !data) return;
    const mapa = {};
    data.forEach(r => { mapa[`${r.rol}|${r.modulo_id}`] = r; });
    PERMISOS_CACHE = mapa;
  } catch (_) { /* sin plantillas → defaults */ }
}

function _permResolver(moduloId, campo, rol) {
  const r = rol || USUARIO_ACTUAL?.rol;
  if (!r) return false;
  if (r === 'super_admin') return true;              // acceso total, sin tabla
  const fila = PERMISOS_CACHE?.[`${r}|${moduloId}`];
  if (fila && typeof fila[campo] === 'boolean') return fila[campo];
  return permisosDefault(r, moduloId)[campo];        // fallback
}

function puedeVer(moduloId, rol)      { return _permResolver(moduloId, 'ver', rol); }
function puedeEditar(moduloId, rol)   { return _permResolver(moduloId, 'editar', rol); }
function puedeEliminar(moduloId, rol) { return _permResolver(moduloId, 'eliminar', rol); }
