// =====================================================
// CALIFICACIONES.JS v2 — Módulo completo
// =====================================================

let TIPOS_EVAL   = [];
let PERIODOS     = [];
let CONFIG_NOTAS = {}; // keyed por nivel, poblado en rNotas()

// Genera siglas del tipo de instancia: "Evaluación escrita" → "EE", "Trabajo práctico" → "TP"
function _abrevTipo(nombre) {
  if (!nombre) return '—';
  const SKIP = new Set(['de','del','la','el','los','las','en','a','con','por','para','y','o','un','una']);
  const siglas = nombre.split(/\s+/)
    .filter(w => !SKIP.has(w.toLowerCase()))
    .map(w => w[0].toUpperCase())
    .join('');
  return siglas || nombre[0].toUpperCase();
}

// ─── HELPERS DE ESCALA POR NIVEL/CICLO ───────────────
// Detecta primer ciclo primario (1°, 2°, 3°) a partir del nombre del curso
function _esPrimerCiclo(nombreCurso) {
  const n = parseInt(nombreCurso);
  return !isNaN(n) && n >= 1 && n <= 3;
}

// Umbral de aprobación según nivel y curso (null = escala conceptual, sin umbral numérico)
function _umbralMin(nivel, nombreCurso) {
  if (nivel === 'inicial') return null;
  if (nivel === 'primario' && _esPrimerCiclo(nombreCurso)) return null;
  return (CONFIG_NOTAS[nivel]?.nota_minima) ?? 7;
}

// Umbral de recuperación (zona ambar): debajo de este → rojo
function _umbralRec(nivel, nombreCurso) {
  if (nivel === 'inicial') return null;
  if (nivel === 'primario' && _esPrimerCiclo(nombreCurso)) return null;
  return (CONFIG_NOTAS[nivel]?.nota_recuperacion) ?? 4;
}

function _escCal(s) {
  if (!s) return '';
  return String(s).replace(/'/g, "\\'").replace(/"/g, '\\"');
}

async function _guardarNotaIntensifCal(estadoId, campo, valor) {
  const v = parseFloat(valor);
  const upd = campo === 1
    ? { nota_intensif_1: isNaN(v) ? null : v }
    : { nota_intensif_2: isNaN(v) ? null : v };
  const { error } = await sb.from('materias_estado_alumno').update(upd).eq('id', estadoId);
  if (error) console.error('Error guardando nota intensif:', error.message);
}

// NOTA_COLOR / NOTA_BG / NOTA_CLS aceptan (nota) o (nota, nivel, nombreCurso)
// Retrocompatibles: sin nivel/nombreCurso usan umbrales por defecto
const NOTA_COLOR = (n, nivel, nombreCurso) => {
  if (n === null || n === undefined) return 'var(--txt3)';
  const min = nivel ? _umbralMin(nivel, nombreCurso) : 7;
  const rec = nivel ? _umbralRec(nivel, nombreCurso) : 4;
  if (min === null) return 'var(--txt2)'; // conceptual: sin color especial
  return n >= min ? 'var(--verde)' : n >= rec ? 'var(--ambar)' : 'var(--rojo)';
};
const NOTA_BG = (n, nivel, nombreCurso) => {
  if (n === null || n === undefined) return 'var(--surf2)';
  const min = nivel ? _umbralMin(nivel, nombreCurso) : 7;
  const rec = nivel ? _umbralRec(nivel, nombreCurso) : 4;
  if (min === null) return 'var(--surf2)';
  return n >= min ? 'var(--verde-l)' : n >= rec ? 'var(--amb-l)' : 'var(--rojo-l)';
};
const NOTA_CLS = (n, nivel, nombreCurso) => {
  if (n === null || n === undefined) return 'nota-nd';
  const min = nivel ? _umbralMin(nivel, nombreCurso) : 7;
  const rec = nivel ? _umbralRec(nivel, nombreCurso) : 4;
  if (min === null) return 'nota-nd';
  return n >= min ? 'nota-ok' : n >= rec ? 'nota-warn' : 'nota-risk';
};

// ─── HELPERS GLOBALES ─────────────────────────────────
function renderSituacionCard(alumnos, getPromedio, prefijo, titulo, notaMin = 7, notaRec = 4) {
  const _rp = al => _redondearProm(getPromedio(al));
  const criticos    = alumnos.filter(al => { const p = _rp(al); return p !== null && p < notaRec; });
  const observacion = alumnos.filter(al => { const p = _rp(al); return p !== null && p >= notaRec && p < notaMin; });
  const aprobados   = alumnos.filter(al => { const p = _rp(al); return p !== null && p >= notaMin; });
  const sinNotas    = alumnos.filter(al => getPromedio(al) === null);

  const listaHTML = (lista, color) => lista.map(al => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--brd)">
      <div>
        <div style="font-size:12px;font-weight:500">${al.apellido}, ${al.nombre}</div>
        ${al.cursoNombre ? `<div style="font-size:10px;color:var(--txt2)">${al.cursoNombre}</div>` : ''}
      </div>
      <span style="font-size:13px;font-weight:700;color:${color}">${_rp(al) ?? 0}</span>
    </div>`).join('');

  return `
    <div style="margin-bottom:16px">
      <div style="font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--txt2);text-transform:uppercase;margin-bottom:10px">
        ${titulo || 'Situación académica'}
      </div>
      <div class="metrics m3" style="margin-bottom:8px">
        <div class="mc" style="background:var(--rojo-l);cursor:pointer;border:1.5px solid transparent"
          onclick="toggleSit('${prefijo}crit')" title="Ver alumnos críticos">
          <div class="mc-v" style="color:var(--rojo);font-size:20px">${criticos.length}</div>
          <div class="mc-l">Críticos (&lt;${notaRec})</div>
        </div>
        <div class="mc" style="background:var(--amb-l);cursor:pointer;border:1.5px solid transparent"
          onclick="toggleSit('${prefijo}obs')" title="Ver alumnos en observación">
          <div class="mc-v" style="color:var(--ambar);font-size:20px">${observacion.length}</div>
          <div class="mc-l">Observación (${notaRec}–${notaMin - 1})</div>
        </div>
        <div class="mc" style="background:var(--verde-l);cursor:pointer;border:1.5px solid transparent"
          onclick="toggleSit('${prefijo}apr')" title="Ver aprobados">
          <div class="mc-v" style="color:var(--verde);font-size:20px">${aprobados.length}</div>
          <div class="mc-l">Aprobados (${notaMin}+)</div>
        </div>
      </div>
      ${criticos.length ? `
      <div id="${prefijo}crit" style="display:none;margin-bottom:8px">
        <div style="font-size:10px;font-weight:700;color:var(--rojo);margin-bottom:6px;display:flex;align-items:center;gap:6px">
          🔴 Situación crítica
          <span style="font-weight:400;color:var(--txt2)">(${criticos.length} alumnos)</span>
        </div>
        <div class="card" style="padding:8px 14px;border-left:3px solid var(--rojo)">${listaHTML(criticos, 'var(--rojo)')}</div>
      </div>` : ''}
      ${observacion.length ? `
      <div id="${prefijo}obs" style="display:none;margin-bottom:8px">
        <div style="font-size:10px;font-weight:700;color:var(--ambar);margin-bottom:6px;display:flex;align-items:center;gap:6px">
          🟡 En observación
          <span style="font-weight:400;color:var(--txt2)">(${observacion.length} alumnos)</span>
        </div>
        <div class="card" style="padding:8px 14px;border-left:3px solid var(--ambar)">${listaHTML(observacion, 'var(--ambar)')}</div>
      </div>` : ''}
      ${aprobados.length ? `
      <div id="${prefijo}apr" style="display:none;margin-bottom:8px">
        <div style="font-size:10px;font-weight:700;color:var(--verde);margin-bottom:6px;display:flex;align-items:center;gap:6px">
          🟢 Aprobados
          <span style="font-weight:400;color:var(--txt2)">(${aprobados.length} alumnos)</span>
        </div>
        <div class="card" style="padding:8px 14px;border-left:3px solid var(--verde)">${listaHTML(aprobados, 'var(--verde)')}</div>
      </div>` : ''}
      ${sinNotas.length ? `
      <div style="font-size:10px;color:var(--txt3);margin-top:4px">${sinNotas.length} alumno(s) sin notas registradas</div>` : ''}
    </div>`;
}

// Variante para escala conceptual (MB/B/R/I) — primaria primer ciclo
function renderSituacionCardConceptual(alumnos, getConcProm, prefijo, titulo) {
  const satisf    = alumnos.filter(al => { const c = getConcProm(al); return c === 'MB' || c === 'B'; });
  const enproceso = alumnos.filter(al => getConcProm(al) === 'R');
  const dificulta = alumnos.filter(al => getConcProm(al) === 'I');
  const sinNotas  = alumnos.filter(al => !getConcProm(al));

  const listaHTML = (lista, color) => lista.map(al => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--brd)">
      <div>
        <div style="font-size:12px;font-weight:500">${al.apellido}, ${al.nombre}</div>
        ${al.cursoNombre ? `<div style="font-size:10px;color:var(--txt2)">${al.cursoNombre}</div>` : ''}
      </div>
      <span style="font-size:13px;font-weight:700;color:${color}">${getConcProm(al) ?? '—'}</span>
    </div>`).join('');

  return `
    <div style="margin-bottom:16px">
      <div style="font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--txt2);text-transform:uppercase;margin-bottom:10px">
        ${titulo || 'Situación académica'}
      </div>
      <div class="metrics m3" style="margin-bottom:8px">
        <div class="mc" style="background:var(--rojo-l);cursor:pointer;border:1.5px solid transparent"
          onclick="toggleSit('${prefijo}dif')" title="Con dificultades">
          <div class="mc-v" style="color:var(--rojo);font-size:20px">${dificulta.length}</div>
          <div class="mc-l">Con dificultades (I)</div>
        </div>
        <div class="mc" style="background:var(--amb-l);cursor:pointer;border:1.5px solid transparent"
          onclick="toggleSit('${prefijo}proc')" title="En proceso">
          <div class="mc-v" style="color:var(--ambar);font-size:20px">${enproceso.length}</div>
          <div class="mc-l">En proceso (R)</div>
        </div>
        <div class="mc" style="background:var(--verde-l);cursor:pointer;border:1.5px solid transparent"
          onclick="toggleSit('${prefijo}sat')" title="Satisfactorio">
          <div class="mc-v" style="color:var(--verde);font-size:20px">${satisf.length}</div>
          <div class="mc-l">Satisfactorio (MB/B)</div>
        </div>
      </div>
      ${dificulta.length ? `
      <div id="${prefijo}dif" style="display:none;margin-bottom:8px">
        <div style="font-size:10px;font-weight:700;color:var(--rojo);margin-bottom:6px;display:flex;align-items:center;gap:6px">
          🔴 Con dificultades <span style="font-weight:400;color:var(--txt2)">(${dificulta.length})</span>
        </div>
        <div class="card" style="padding:8px 14px;border-left:3px solid var(--rojo)">${listaHTML(dificulta,'var(--rojo)')}</div>
      </div>` : ''}
      ${enproceso.length ? `
      <div id="${prefijo}proc" style="display:none;margin-bottom:8px">
        <div style="font-size:10px;font-weight:700;color:var(--ambar);margin-bottom:6px;display:flex;align-items:center;gap:6px">
          🟡 En proceso <span style="font-weight:400;color:var(--txt2)">(${enproceso.length})</span>
        </div>
        <div class="card" style="padding:8px 14px;border-left:3px solid var(--ambar)">${listaHTML(enproceso,'var(--ambar)')}</div>
      </div>` : ''}
      ${satisf.length ? `
      <div id="${prefijo}sat" style="display:none;margin-bottom:8px">
        <div style="font-size:10px;font-weight:700;color:var(--verde);margin-bottom:6px;display:flex;align-items:center;gap:6px">
          🟢 Satisfactorio <span style="font-weight:400;color:var(--txt2)">(${satisf.length})</span>
        </div>
        <div class="card" style="padding:8px 14px;border-left:3px solid var(--verde)">${listaHTML(satisf,'var(--verde)')}</div>
      </div>` : ''}
      ${sinNotas.length ? `
      <div style="font-size:10px;color:var(--txt3);margin-top:4px">${sinNotas.length} alumno(s) sin notas registradas</div>` : ''}
    </div>`;
}

// Variante que clasifica por cantidad de materias desaprobadas (directivo/preceptor/EOE)
function renderSituacionCardDesap(alumnos, getDesapCount, prefijo, titulo) {
  const riesgo  = alumnos.filter(al => { const n = getDesapCount(al); return n !== null && n >= 3; });
  const seguim  = alumnos.filter(al => { const n = getDesapCount(al); return n !== null && n === 2; });
  const aldia   = alumnos.filter(al => { const n = getDesapCount(al); return n !== null && n <= 1; });
  const sinNotas = alumnos.filter(al => getDesapCount(al) === null);

  const listaHTML = (lista, color) => lista.map(al => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--brd)">
      <div>
        <div style="font-size:12px;font-weight:500">${al.apellido}, ${al.nombre}</div>
        ${al.cursoNombre ? `<div style="font-size:10px;color:var(--txt2)">${al.cursoNombre}</div>` : ''}
      </div>
      <span style="font-size:11px;font-weight:600;color:${color}">${getDesapCount(al)} desap.</span>
    </div>`).join('');

  return `
    <div style="margin-bottom:16px">
      <div style="font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--txt2);text-transform:uppercase;margin-bottom:10px">
        ${titulo || 'Situación académica'}
      </div>
      <div class="metrics m3" style="margin-bottom:8px">
        <div class="mc" style="background:var(--rojo-l);cursor:pointer;border:1.5px solid transparent"
          onclick="toggleSit('${prefijo}riesgo')" title="Ver alumnos en riesgo">
          <div class="mc-v" style="color:var(--rojo);font-size:20px">${riesgo.length}</div>
          <div class="mc-l">En riesgo (3+ mat.)</div>
        </div>
        <div class="mc" style="background:var(--amb-l);cursor:pointer;border:1.5px solid transparent"
          onclick="toggleSit('${prefijo}seguim')" title="Ver alumnos en seguimiento">
          <div class="mc-v" style="color:var(--ambar);font-size:20px">${seguim.length}</div>
          <div class="mc-l">Seguimiento (2 mat.)</div>
        </div>
        <div class="mc" style="background:var(--verde-l);cursor:pointer;border:1.5px solid transparent"
          onclick="toggleSit('${prefijo}aldia')" title="Ver alumnos al día">
          <div class="mc-v" style="color:var(--verde);font-size:20px">${aldia.length}</div>
          <div class="mc-l">Al día (0–1 mat.)</div>
        </div>
      </div>
      ${riesgo.length ? `
      <div id="${prefijo}riesgo" style="display:none;margin-bottom:8px">
        <div style="font-size:10px;font-weight:700;color:var(--rojo);margin-bottom:6px;display:flex;align-items:center;gap:6px">
          En riesgo <span style="font-weight:400;color:var(--txt2)">(${riesgo.length} alumnos)</span>
        </div>
        <div class="card" style="padding:8px 14px;border-left:3px solid var(--rojo)">${listaHTML(riesgo, 'var(--rojo)')}</div>
      </div>` : ''}
      ${seguim.length ? `
      <div id="${prefijo}seguim" style="display:none;margin-bottom:8px">
        <div style="font-size:10px;font-weight:700;color:var(--ambar);margin-bottom:6px;display:flex;align-items:center;gap:6px">
          En seguimiento <span style="font-weight:400;color:var(--txt2)">(${seguim.length} alumnos)</span>
        </div>
        <div class="card" style="padding:8px 14px;border-left:3px solid var(--ambar)">${listaHTML(seguim, 'var(--ambar)')}</div>
      </div>` : ''}
      ${aldia.length ? `
      <div id="${prefijo}aldia" style="display:none;margin-bottom:8px">
        <div style="font-size:10px;font-weight:700;color:var(--verde);margin-bottom:6px;display:flex;align-items:center;gap:6px">
          Al día <span style="font-weight:400;color:var(--txt2)">(${aldia.length} alumnos)</span>
        </div>
        <div class="card" style="padding:8px 14px;border-left:3px solid var(--verde)">${listaHTML(aldia, 'var(--verde)')}</div>
      </div>` : ''}
      ${sinNotas.length ? `
      <div style="font-size:10px;color:var(--txt3);margin-top:4px">${sinNotas.length} alumno(s) sin notas registradas</div>` : ''}
    </div>`;
}

function toggleSit(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const visible = el.style.display !== 'none';
  el.style.display = visible ? 'none' : 'block';
}

function _mkMiniStat(apr, obs, crit, sin) {
  if (apr + obs + crit === 0) return `<div style="font-size:10px;color:var(--txt3);margin-top:5px">Sin notas registradas</div>`;
  return `<div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap">
    ${apr  ? `<span style="font-size:10px;font-weight:600;color:var(--verde)">🟢 ${apr}</span>`  : ''}
    ${obs  ? `<span style="font-size:10px;font-weight:600;color:var(--ambar)">🟡 ${obs}</span>` : ''}
    ${crit ? `<span style="font-size:10px;font-weight:600;color:var(--rojo)">🔴 ${crit}</span>` : ''}
    ${sin  ? `<span style="font-size:10px;color:var(--txt3)">⬜ ${sin}</span>`                   : ''}
  </div>`;
}

function _redondearProm(v) { return v === null || v === undefined ? null : Math.round(v); }

function _scrollGrilla(dir) {
  const el = document.getElementById('grilla-notas-wrap');
  if (el) el.scrollBy({ left: dir * 160, behavior: 'smooth' });
}

// ─── RENDER PRINCIPAL ─────────────────────────────────
async function rNotas() {
  showLoading('notas');
  const instId = USUARIO_ACTUAL.institucion_id;
  const rol    = USUARIO_ACTUAL.rol;
  const inst   = INSTITUCION_ACTUAL;

  // Usuario de nivel inicial puro (docente/directivo con nivel='inicial' o inst exclusivamente inicial)
  if (typeof esNivelInicial === 'function' && esNivelInicial()) {
    await rNotasInicial();
    return;
  }

  // Director general en institución que incluye nivel inicial → tabs de nivel
  if (rol === 'director_general' && inst?.nivel_inicial) {
    await _rNotasConTabs(instId);
    return;
  }

  const [tiposRes, periodosRes, cfgNotasRes] = await Promise.all([
    sb.from('tipos_instancia_evaluativa').select('*').eq('institucion_id', instId).eq('activo', true).order('nombre'),
    sb.from('periodos_evaluativos').select('*').eq('institucion_id', instId).eq('anio', 2026).order('nivel').order('numero'),
    sb.from('config_asistencia').select('*').eq('institucion_id', instId),
  ]);
  TIPOS_EVAL   = tiposRes.data  || [];
  PERIODOS     = periodosRes.data || [];
  CONFIG_NOTAS = {};
  (cfgNotasRes.data || []).forEach(c => CONFIG_NOTAS[c.nivel] = c);

  if (rol === 'docente') await rNotasDocente();
  else                   await rNotasDirectivo();

  inyectarEstilosNotas();
}

async function _rNotasConTabs(instId) {
  const inst   = INSTITUCION_ACTUAL;
  const pg     = document.getElementById('page-notas');
  const niveles = ['inicial','primario','secundario'].filter(n => inst?.['nivel_' + n]);
  const tab    = window._notasNivelTab && niveles.includes(window._notasNivelTab)
    ? window._notasNivelTab : niveles[0];
  window._notasNivelTab = tab;

  const labelTab = { inicial: 'Áreas de desarrollo', primario: 'Calificaciones', secundario: 'Calificaciones' };
  const colores  = { inicial: 'var(--accent)', primario: '#1a5276', secundario: '#6c3483' };

  pg.innerHTML = `
    <div class="pg-t">${labelTab[tab] || 'Calificaciones'}</div>
    <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">
      ${niveles.map(n => {
        const labels = { inicial:'Inicial', primario:'Primario', secundario:'Secundario' };
        return `<button onclick="window._notasNivelTab='${n}';rNotas()"
          style="padding:6px 16px;border-radius:20px;border:2px solid ${tab===n?colores[n]:'var(--brd)'};
            background:${tab===n?colores[n]:'transparent'};color:${tab===n?'#fff':'var(--txt2)'};
            font-size:12px;font-weight:600;cursor:pointer;transition:.15s">
          ${labels[n]}
        </button>`;
      }).join('')}
    </div>
    <div id="notas-tab-body"></div>
  `;

  if (tab === 'inicial') {
    await rNotasInicial();
  } else {
    const [tiposRes, periodosRes, cfgNotasRes] = await Promise.all([
      sb.from('tipos_instancia_evaluativa').select('*').eq('institucion_id', instId).eq('activo', true).order('nombre'),
      sb.from('periodos_evaluativos').select('*').eq('institucion_id', instId).eq('anio', 2026).order('nivel').order('numero'),
      sb.from('config_asistencia').select('*').eq('institucion_id', instId),
    ]);
    TIPOS_EVAL   = tiposRes.data  || [];
    PERIODOS     = periodosRes.data || [];
    CONFIG_NOTAS = {};
    (cfgNotasRes.data || []).forEach(c => CONFIG_NOTAS[c.nivel] = c);
    await rNotasDirectivo(tab);
    inyectarEstilosNotas();
  }
}

// ═══════════════════════════════════════════════════════
// NIVEL INICIAL — ÁREAS DE DESARROLLO
// ═══════════════════════════════════════════════════════

let _iniCache = {}; // { cursoId_semestre: { alumnos, observaciones } }

async function rNotasInicial() {
  // Si estamos en contexto de tabs (director_general multinivel), renderizar en el sub-contenedor
  const tabBody = document.getElementById('notas-tab-body');
  const pg      = tabBody || document.getElementById('page-notas');
  const enTabs  = !!tabBody;

  const instId = USUARIO_ACTUAL.institucion_id;
  const rol    = USUARIO_ACTUAL.rol;
  const miId   = USUARIO_ACTUAL.id;
  const anio   = INSTITUCION_ACTUAL?.anio_lectivo || new Date().getFullYear();
  const esDocente = rol === 'docente';

  // Cargar salas disponibles
  let cursosQuery = sb.from('cursos')
    .select('id, nombre, division, nivel')
    .eq('institucion_id', instId)
    .eq('nivel', 'inicial')
    .eq('activo', true)
    .order('nombre');

  if (esDocente) {
    const { data: asigs } = await sb.from('asignaciones')
      .select('curso_id')
      .eq('docente_id', miId)
      .eq('anio_lectivo', anio);
    const ids = (asigs || []).map(a => a.curso_id);
    if (!ids.length) {
      pg.innerHTML = `${enTabs?'':' <div class="pg-t">Áreas de desarrollo</div>'}<div class="empty-state">No tenés salas asignadas para este año.</div>`;
      return;
    }
    cursosQuery = cursosQuery.in('id', ids);
  }

  const { data: cursos } = await cursosQuery;

  if (!cursos?.length) {
    pg.innerHTML = `${enTabs?'':'<div class="pg-t">Áreas de desarrollo</div>'}<div class="empty-state">No hay salas de nivel inicial registradas.</div>`;
    return;
  }

  // Cargar dimensiones de la config
  const { data: cfgArr } = await sb.from('config_asistencia')
    .select('dimensiones_informe')
    .eq('institucion_id', instId)
    .eq('nivel', 'inicial')
    .maybeSingle();
  const dimensiones = cfgArr?.dimensiones_informe || [];

  // Estado inicial del selector
  const salaId   = window._iniSalaId  || cursos[0].id;
  const semestre = window._iniSemestre || 1;
  window._iniSalaId   = salaId;
  window._iniSemestre = semestre;

  const salaActual = cursos.find(c => c.id === salaId) || cursos[0];

  pg.innerHTML = `
    ${enTabs ? '' : '<div class="pg-t">Áreas de desarrollo</div>'}
    <div class="card" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:18px;padding:14px 16px">
      <div style="flex:1;min-width:140px">
        <div style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;margin-bottom:4px">Sala</div>
        <select id="ini-sala" class="inp" style="width:100%;margin:0"
          onchange="window._iniSalaId=this.value;window._iniSemestre=document.getElementById('ini-sem').value*1;rNotasInicial()">
          ${cursos.map(c => `<option value="${c.id}" ${c.id===salaId?'selected':''}>${c.nombre}${c.division?' '+c.division:''}</option>`).join('')}
        </select>
      </div>
      <div style="min-width:140px">
        <div style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;margin-bottom:4px">Semestre</div>
        <select id="ini-sem" class="inp" style="width:100%;margin:0"
          onchange="window._iniSemestre=this.value*1;window._iniSalaId=document.getElementById('ini-sala').value;rNotasInicial()">
          <option value="1" ${semestre===1?'selected':''}>1° semestre</option>
          <option value="2" ${semestre===2?'selected':''}>2° semestre</option>
        </select>
      </div>
    </div>

    <div id="ini-lista"><div class="loading-state small"><div class="spinner"></div></div></div>
  `;

  await _renderListaInicial(salaId, semestre, anio, instId, dimensiones, esDocente);
}

async function _renderListaInicial(salaId, semestre, anio, instId, dimensiones, esDocente) {
  const cont = document.getElementById('ini-lista');
  if (!cont) return;

  const { data: alumnos } = await sb.from('alumnos')
    .select('id, nombre, apellido')
    .eq('curso_id', salaId)
    .eq('activo', true)
    .order('apellido').order('nombre');

  if (!alumnos?.length) {
    cont.innerHTML = `<div class="empty-state">No hay alumnos registrados en esta sala.</div>`;
    return;
  }

  const alumnoIds = alumnos.map(a => a.id);
  const { data: obsData } = await sb.from('observaciones_iniciales')
    .select('alumno_id, dimension, observacion, borrador_ia')
    .eq('anio_lectivo', anio)
    .eq('semestre', semestre)
    .in('alumno_id', alumnoIds);

  // Indexar por alumno_id → dimension
  const obsIdx = {};
  (obsData || []).forEach(o => {
    if (!obsIdx[o.alumno_id]) obsIdx[o.alumno_id] = {};
    obsIdx[o.alumno_id][o.dimension] = o;
  });

  const totalDims = dimensiones.length;

  if (!totalDims) {
    cont.innerHTML = `
      <div class="card" style="padding:16px;color:var(--txt2);font-size:13px">
        No hay dimensiones de desarrollo configuradas. Configuralas en
        <strong>Configuración → Nivel inicial</strong>.
      </div>`;
    return;
  }

  cont.innerHTML = alumnos.map(al => {
    const obsAl   = obsIdx[al.id] || {};
    const cargadas = Object.keys(obsAl).filter(d => obsAl[d].observacion?.trim()).length;
    const isOpen   = EX === `ini-${al.id}`;

    return `
      <div class="card" style="margin-bottom:10px;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;cursor:pointer"
             onclick="togEx('ini-${al.id}', () => _renderListaInicial('${salaId}',${semestre},${anio},'${instId}',${JSON.stringify(dimensiones).replace(/"/g,"'")},${esDocente}))">
          <div>
            <div style="font-size:13px;font-weight:600">${al.apellido}, ${al.nombre}</div>
            <div id="ini-prog-${al.id}" style="font-size:11px;color:var(--txt2);margin-top:2px">${cargadas}/${totalDims} dimensiones con observación</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:60px;height:6px;background:var(--surf2);border-radius:3px;overflow:hidden">
              <div id="ini-bar-${al.id}" style="width:${totalDims?Math.round(cargadas/totalDims*100):0}%;height:100%;background:var(--verde);border-radius:3px;transition:width .3s"></div>
            </div>
            <span style="font-size:18px;color:var(--txt3);transform:rotate(${isOpen?'90':'0'}deg);transition:.2s">›</span>
          </div>
        </div>
        ${isOpen ? _renderDetalleAlumnoInicial(al, obsAl, dimensiones, salaId, semestre, anio, instId, esDocente) : ''}
      </div>`;
  }).join('');
}

function _renderDetalleAlumnoInicial(al, obsAl, dimensiones, salaId, semestre, anio, instId, esDocente) {
  const totalDims = dimensiones.length;
  const tieneObs  = Object.values(obsAl).some(o => o.observacion?.trim());
  const btnId     = `btn-save-ini-${al.id}`;

  const dimsHTML = dimensiones.map((dim, idx) => {
    const obs      = obsAl[dim] || {};
    const textoObs = obs.observacion || '';
    const dimId    = `dim-${al.id}-${idx}`;

    return `
      <div style="margin-bottom:20px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--txt2);margin-bottom:6px">${dim}</div>
        <textarea id="${dimId}" class="inp"
          style="width:100%;min-height:80px;resize:vertical;font-size:13px;line-height:1.5;box-sizing:border-box"
          placeholder="Observación narrativa para esta dimensión..."
          oninput="_iniMarkDirty('${al.id}',${totalDims})">${_esc(textoObs)}</textarea>
      </div>`;
  }).join('');

  const btnClass = tieneObs ? 'btn-s' : 'btn-p';
  const btnLabel = tieneObs ? 'Editar observaciones' : 'Guardar observaciones';
  const btnMode  = tieneObs ? 'view' : 'edit';

  return `
    <div style="padding:0 16px 16px">
      <div style="height:1px;background:var(--brd);margin-bottom:16px"></div>
      ${dimsHTML}
      <button id="${btnId}" class="${btnClass}" style="width:100%;margin-top:4px" data-mode="${btnMode}"
        onclick="_iniHandleSave('${al.id}','${instId}',${semestre},${anio},'${salaId}',${JSON.stringify(dimensiones).replace(/"/g,"'")},${esDocente})">
        ${btnLabel}
      </button>
    </div>`;
}

function _esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function _iniUpdateProgress(alumnoId, totalDims) {
  let count = 0;
  document.querySelectorAll(`textarea[id^="dim-${alumnoId}-"]`).forEach(ta => {
    if (ta.value?.trim()) count++;
  });
  const progText = document.getElementById(`ini-prog-${alumnoId}`);
  const progBar  = document.getElementById(`ini-bar-${alumnoId}`);
  if (progText) progText.textContent = `${count}/${totalDims} dimensiones con observación`;
  if (progBar)  progBar.style.width  = `${totalDims ? Math.round(count / totalDims * 100) : 0}%`;
}

function _iniMarkDirty(alumnoId, totalDims) {
  _iniUpdateProgress(alumnoId, totalDims);
  const btn = document.getElementById(`btn-save-ini-${alumnoId}`);
  if (btn && btn.dataset.mode === 'view') {
    btn.className    = 'btn-p';
    btn.style.width  = '100%';
    btn.textContent  = 'Guardar observaciones';
    btn.dataset.mode = 'edit';
  }
}

async function _iniHandleSave(alumnoId, instId, semestre, anio, salaId, dimensiones, esDocente) {
  const btn = document.getElementById(`btn-save-ini-${alumnoId}`);
  if (btn?.dataset.mode === 'view') {
    btn.className    = 'btn-p';
    btn.style.width  = '100%';
    btn.textContent  = 'Guardar observaciones';
    btn.dataset.mode = 'edit';
    const firstTa = document.querySelector(`textarea[id^="dim-${alumnoId}-"]`);
    if (firstTa) firstTa.focus();
    return;
  }
  await _guardarObservacionesInicial(alumnoId, instId, semestre, anio, salaId, dimensiones, esDocente);
}

async function _guardarObservacionesInicial(alumnoId, instId, semestre, anio, salaId, dimensiones, esDocente) {
  const rows = dimensiones.map((dim, idx) => {
    const dimId  = `dim-${alumnoId}-${idx}`;
    const texto  = document.getElementById(dimId)?.value?.trim() || null;
    return {
      alumno_id:      alumnoId,
      institucion_id: instId,
      anio_lectivo:   anio,
      semestre,
      dimension:      dim,
      observacion:    texto,
      creado_por:     USUARIO_ACTUAL.id,
      actualizado_en: new Date().toISOString(),
    };
  });

  const { error } = await sb.from('observaciones_iniciales')
    .upsert(rows, { onConflict: 'alumno_id,anio_lectivo,semestre,dimension' });

  if (error) {
    mostrarToast('Error al guardar. Intentá de nuevo.', 'error');
    return;
  }

  mostrarToast('Observaciones guardadas.', 'ok');
  const btn = document.getElementById(`btn-save-ini-${alumnoId}`);
  if (btn) {
    btn.className    = 'btn-s';
    btn.style.width  = '100%';
    btn.textContent  = 'Editar observaciones';
    btn.dataset.mode = 'view';
  }
  _iniUpdateProgress(alumnoId, dimensiones.length);
}

// ═══════════════════════════════════════════════════════
// DOCENTE
// ═══════════════════════════════════════════════════════
async function rNotasDocente() {
  const c      = document.getElementById('page-notas');
  const instId = USUARIO_ACTUAL.institucion_id;
  const miId   = USUARIO_ACTUAL.id;

  const { data: asigs } = await sb.from('asignaciones')
    .select('tipo_docente, cursos(id,nombre,division,nivel), materias(id,nombre)')
    .eq('docente_id', miId)
    .eq('anio_lectivo', new Date().getFullYear());

  if (!asigs?.length) {
    c.innerHTML = `<div class="pg-t">Calificaciones</div><div class="empty-state">Sin cursos asignados.</div>`;
    return;
  }

  // Grado: accede a todas las materias del nivel. Especial: solo su materia asignada.
  const gradoAsigs = asigs.filter(a => a.tipo_docente === 'grado');
  const especAsigs = asigs.filter(a => a.tipo_docente !== 'grado');

  // Para maestras de grado: obtener todas las materias del nivel
  let materiasPorNivel = {};
  if (gradoAsigs.length) {
    const nivelesGrado = [...new Set(gradoAsigs.map(a => a.cursos?.nivel).filter(Boolean))];
    const { data: allMats } = await sb.from('materias')
      .select('id,nombre,nivel').eq('institucion_id', instId).eq('activo', true)
      .in('nivel', nivelesGrado);
    (allMats || []).forEach(m => {
      if (!materiasPorNivel[m.nivel]) materiasPorNivel[m.nivel] = [];
      materiasPorNivel[m.nivel].push(m);
    });
  }

  const cursoMap = {};

  gradoAsigs.forEach(a => {
    const cu = a.cursos;
    cursoMap[cu.id] = { ...cu, esGrado: true, materias: materiasPorNivel[cu.nivel] || [] };
  });

  especAsigs.forEach(a => {
    const cu = a.cursos;
    if (!cursoMap[cu.id]) cursoMap[cu.id] = { ...cu, esGrado: false, materias: [] };
    if (!cursoMap[cu.id].esGrado) cursoMap[cu.id].materias.push(a.materias);
  });

  c.innerHTML = `
    <div class="pg-t">Calificaciones</div>
    <div class="pg-s">Seleccioná curso y materia</div>
    <div class="sec-lb">Mis clases</div>
    ${Object.values(cursoMap).map(cu => {
      if (cu.esGrado) {
        const labelNivel  = cu.nivel === 'inicial' ? 'sala' : 'grado';
        const esPrimaria  = cu.nivel === 'primario' || cu.nivel === 'inicial';

        // --- MODO: docente-grado-primaria ---
        // Primaria/inicial: una sola card que abre la tabla completa (todas las materias comunes)
        if (esPrimaria) {
          return `
            <div class="card" style="display:flex;align-items:flex-start;justify-content:space-between;
              padding:14px 16px;margin-bottom:8px;cursor:pointer;border-left:3px solid var(--verde)"
              onclick="verNotasPrimariaGrado('${cu.id}','${cu.nivel}','${cu.nombre}${cu.division}')">
              <div style="flex:1;min-width:0">
                <div style="font-size:15px;font-weight:700;font-family:'Lora',serif">${cu.nombre}${cu.division}</div>
                <div style="font-size:12px;color:var(--txt2)">Maestra/o de ${labelNivel} · todas las materias comunes</div>
                <div id="card-stat-${cu.id}"></div>
              </div>
              <span style="font-size:22px;color:var(--verde);flex-shrink:0;margin-left:8px">→</span>
            </div>`;
        }

        // --- MODO: secundario ---
        return `
          <div class="card" style="margin-bottom:8px;padding:14px 16px;border-left:3px solid var(--verde)">
            <div style="font-size:15px;font-weight:700;font-family:'Lora',serif;margin-bottom:8px">
              ${cu.nombre}${cu.division}
              <span style="font-size:11px;font-weight:400;color:var(--txt2)">— Maestra/o de ${labelNivel}</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px">
              ${cu.materias.map(m => `
                <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;
                  padding:7px 10px;background:var(--surf2);border-radius:var(--rad)"
                  onclick="verNotasCursoDocente('${cu.id}','${cu.nivel}','${m.id}','${cu.nombre}${cu.division}','${m.nombre.replace(/'/g,"\\'")}')">
                  <div style="flex:1;min-width:0">
                    <div style="font-size:12px;font-weight:500">${m.nombre}</div>
                    <div id="card-stat-${cu.id}_${m.id}"></div>
                  </div>
                  <span style="color:var(--verde);flex-shrink:0;margin-left:8px">→</span>
                </div>`).join('')}
            </div>
          </div>`;
      }
      return cu.materias.map(m => `
        <div class="card" style="display:flex;align-items:flex-start;justify-content:space-between;
          padding:14px 16px;margin-bottom:8px;cursor:pointer;border-left:3px solid var(--verde)"
          onclick="verNotasCursoDocente('${cu.id}','${cu.nivel}','${m.id}','${cu.nombre}${cu.division}','${m.nombre.replace(/'/g,"\\'")}')">
          <div style="flex:1;min-width:0">
            <div style="font-size:15px;font-weight:700;font-family:'Lora',serif">${cu.nombre}${cu.division}</div>
            <div style="font-size:12px;color:var(--txt2)">${m.nombre}</div>
            <div id="card-stat-${cu.id}_${m.id}"></div>
          </div>
          <span style="font-size:22px;color:var(--verde);flex-shrink:0;margin-left:8px">→</span>
        </div>`).join('');
    }).join('')}
    <div class="sec-lb" style="margin-top:14px">Situación de mis alumnos</div>
    <div id="sit-docente-global" style="text-align:center;padding:20px;color:var(--txt3);font-size:11px">
      <div class="spinner" style="margin:0 auto 8px"></div>Calculando situación...
    </div>
`;

  window._notasCursoMap = cursoMap;
  _cargarSituacionDocenteGlobal(cursoMap);
}

async function _cargarSituacionDocenteGlobal(cursoMap) {
  const contenedor = document.getElementById('sit-docente-global');
  if (!contenedor) return;

  const hoy = new Date();
  const cursoIds = Object.keys(cursoMap);
  if (!cursoIds.length) { contenedor.innerHTML = '<div class="empty-state">Sin cursos asignados.</div>'; return; }

  const periodosActivosPorNivel = {};
  PERIODOS.forEach(p => {
    if (new Date(p.fecha_inicio) <= hoy && hoy <= new Date(p.fecha_fin)) {
      periodosActivosPorNivel[p.nivel] = p.id;
    }
  });
  if (!Object.keys(periodosActivosPorNivel).length) {
    PERIODOS.forEach(p => {
      if (!periodosActivosPorNivel[p.nivel]) periodosActivosPorNivel[p.nivel] = p.id;
    });
  }

  const cursosPorNivel = {};
  cursoIds.forEach(id => {
    const cu = cursoMap[id];
    const niv = cu?.nivel;
    if (!cursosPorNivel[niv]) cursosPorNivel[niv] = [];
    cursosPorNivel[niv].push(id);
  });

  const { data: alumnos } = await sb.from('alumnos')
    .select('id,nombre,apellido,curso_id').in('curso_id', cursoIds).eq('activo', true);
  if (!alumnos?.length) { contenedor.innerHTML = '<div class="empty-state">Sin alumnos.</div>'; return; }

  // Notas numéricas (secundario/ciclo 2) y conceptuales (primaria ciclo 1)
  const notasPorAlumnoMateria = {}; // "alumnoId_materiaId" → [nota numérica]
  const concPorAlumnoMateria  = {}; // "alumnoId_materiaId" → 'MB'/'B'/'R'/'I'

  for (const [nivel, ids] of Object.entries(cursosPorNivel)) {
    const pid = periodosActivosPorNivel[nivel];
    if (!pid || !ids.length) continue;
    const { data: califs } = await sb.from('calificaciones')
      .select('alumno_id,nota,ausente,materia_id,promedio_concepto_manual,instancia_id')
      .in('curso_id', ids).eq('periodo_id', pid).limit(3000);
    (califs || []).forEach(c => {
      if (c.ausente || c.materia_id === null) return;
      const k = `${c.alumno_id}_${c.materia_id}`;
      if (c.nota !== null) {
        if (!notasPorAlumnoMateria[k]) notasPorAlumnoMateria[k] = [];
        notasPorAlumnoMateria[k].push(c.nota);
      }
      // promedio_concepto_manual: fila sin instancia = promedio del período por materia
      if (c.promedio_concepto_manual && c.instancia_id === null) {
        concPorAlumnoMateria[k] = c.promedio_concepto_manual;
      }
    });
  }

  const CONC_ORD = ['MB', 'B', 'R', 'I'];

  const _cursoUsaConc = (cuId) => {
    const cu = cursoMap[cuId];
    if (!cu) return false;
    return cu.nivel === 'inicial' || (cu.nivel === 'primario' && _esPrimerCiclo(cu.nombre)) || CONFIG_NOTAS[cu.nivel]?.escala === 'conceptual';
  };

  const getPromedio = (al) => {
    if (_cursoUsaConc(al.curso_id)) return null;
    const keys = Object.keys(notasPorAlumnoMateria).filter(k => k.startsWith(al.id + '_'));
    if (!keys.length) return null;
    const proms = keys.map(k => {
      const ns = notasPorAlumnoMateria[k];
      return ns.reduce((a, b) => a + b, 0) / ns.length;
    });
    return proms.reduce((a, b) => a + b, 0) / proms.length;
  };

  const getConcProm = (al) => {
    if (!_cursoUsaConc(al.curso_id)) return null;
    const keys = Object.keys(concPorAlumnoMateria).filter(k => k.startsWith(al.id + '_'));
    const vals = keys.map(k => concPorAlumnoMateria[k]).filter(Boolean);
    if (!vals.length) return null;
    // Modal: valor más frecuente, priorizando el más alto en la escala
    const cnt = {};
    vals.forEach(v => cnt[v] = (cnt[v] || 0) + 1);
    const maxCnt = Math.max(...Object.values(cnt));
    return CONC_ORD.find(v => cnt[v] === maxCnt) || null;
  };

  // Mini-stats para las cards de curso
  const cursoStatsDo = {};
  alumnos.forEach(al => {
    if (!cursoStatsDo[al.curso_id]) cursoStatsDo[al.curso_id] = { apr: 0, obs: 0, crit: 0, sin: 0 };
    const st = cursoStatsDo[al.curso_id];
    const cu = cursoMap[al.curso_id];
    if (_cursoUsaConc(al.curso_id)) {
      const c = getConcProm(al);
      if (!c)              st.sin++;
      else if (c === 'MB' || c === 'B') st.apr++;
      else if (c === 'R') st.obs++;
      else                st.crit++;
    } else {
      const promR = _redondearProm(getPromedio(al));
      const min = CONFIG_NOTAS[cu?.nivel]?.nota_minima ?? 7;
      const rec = CONFIG_NOTAS[cu?.nivel]?.nota_recuperacion ?? 4;
      if (promR === null) st.sin++;
      else if (promR >= min) st.apr++;
      else if (promR >= rec) st.obs++;
      else st.crit++;
    }
  });
  Object.entries(cursoStatsDo).forEach(([cId, st]) => {
    const el = document.getElementById(`card-stat-${cId}`);
    if (el) el.innerHTML = _mkMiniStat(st.apr, st.obs, st.crit, st.sin);
  });

  // Stats por materia (solo cursos numéricos — secundario)
  const materiaStatsDo = {};
  alumnos.forEach(al => {
    const cu = cursoMap[al.curso_id];
    if (!cu || _cursoUsaConc(al.curso_id)) return;
    (cu.materias || []).forEach(m => {
      const combId = `${al.curso_id}_${m.id}`;
      if (!materiaStatsDo[combId]) materiaStatsDo[combId] = { apr: 0, obs: 0, crit: 0, sin: 0 };
      const notas = notasPorAlumnoMateria[`${al.id}_${m.id}`];
      const st = materiaStatsDo[combId];
      if (!notas?.length) { st.sin++; return; }
      const prom = notas.reduce((a, b) => a + b, 0) / notas.length;
      const min = CONFIG_NOTAS[cu.nivel]?.nota_minima ?? 7;
      const rec = CONFIG_NOTAS[cu.nivel]?.nota_recuperacion ?? 4;
      if (prom >= min) st.apr++;
      else if (prom >= rec) st.obs++;
      else st.crit++;
    });
  });
  Object.entries(materiaStatsDo).forEach(([combId, st]) => {
    const el = document.getElementById(`card-stat-${combId}`);
    if (el) el.innerHTML = _mkMiniStat(st.apr, st.obs, st.crit, st.sin);
  });

  const alumnosConCurso = alumnos.map(al => ({
    ...al,
    cursoNombre: cursoMap[al.curso_id]
      ? `${cursoMap[al.curso_id].nombre}${cursoMap[al.curso_id].division}`
      : '',
  }));

  const nivelesConCursos = Object.keys(cursosPorNivel);
  const periodoLabel = nivelesConCursos.length === 1
    ? (PERIODOS.find(p => p.id === periodosActivosPorNivel[nivelesConCursos[0]])?.nombre || 'Período activo')
    : (Object.keys(periodosActivosPorNivel).length ? 'Período activo' : 'Año en curso');

  const alumnosConc = alumnosConCurso.filter(al => _cursoUsaConc(al.curso_id));
  const alumnosNum  = alumnosConCurso.filter(al => !_cursoUsaConc(al.curso_id));

  if (alumnosConc.length && alumnosNum.length) {
    contenedor.innerHTML =
      renderSituacionCardConceptual(alumnosConc, getConcProm, 'docg-c-', periodoLabel + ' · Conceptual') +
      renderSituacionCard(alumnosNum, getPromedio, 'docg-n-', periodoLabel + ' · Numérico');
  } else if (alumnosConc.length) {
    contenedor.innerHTML = renderSituacionCardConceptual(alumnosConc, getConcProm, 'docg-', periodoLabel);
  } else {
    contenedor.innerHTML = renderSituacionCard(alumnosNum, getPromedio, 'docg-', periodoLabel);
  }
}

async function verNotasCursoDocente(cursoId, nivel, materiaId, nombreCurso, nombreMateria) {
  const c = document.getElementById('page-notas');
  showLoading('notas');

  const periodosCurso = PERIODOS.filter(p => p.nivel === nivel).sort((a,b) => (a.nombre||'').localeCompare(b.nombre||''));
  const hoy = new Date();
  const periodoActual = periodosCurso.find(p =>
    new Date(p.fecha_inicio) <= hoy && hoy <= new Date(p.fecha_fin)
  ) || periodosCurso[0];

  let PERIODO_SEL = periodoActual?.id || '';

  const cargarVista = async () => {
    const [alumnosRes, instanciasRes, califRes, configRes, cierreRes, promManualRes] = await Promise.all([
      sb.from('alumnos').select('*').eq('curso_id', cursoId).eq('activo', true).order('apellido'),
      sb.from('instancias_evaluativas')
        .select('*, tipos_instancia_evaluativa(nombre,es_recuperatorio)')
        .eq('curso_id', cursoId).eq('materia_id', materiaId)
        .eq('periodo_id', PERIODO_SEL).order('fecha'),
      sb.from('calificaciones').select('*')
        .eq('curso_id', cursoId).eq('materia_id', materiaId)
        .eq('periodo_id', PERIODO_SEL),
      sb.from('config_calificaciones').select('*')
        .eq('usuario_id', USUARIO_ACTUAL.id)
        .eq('materia_id', materiaId).eq('curso_id', cursoId).maybeSingle(),
      sb.from('cierres_materia_cuatrimestre').select('*')
        .eq('curso_id', cursoId).eq('materia_id', materiaId).eq('periodo_id', PERIODO_SEL).maybeSingle(),
      sb.from('calificaciones').select('*')
        .eq('curso_id', cursoId).eq('materia_id', materiaId)
        .eq('periodo_id', PERIODO_SEL).is('instancia_id', null).eq('promedio_editado', true),
    ]);

    const alumnos    = alumnosRes.data  || [];
    const instancias = instanciasRes.data || [];
    const califs     = califRes.data    || [];
    const config     = configRes.data;
    const cierre     = cierreRes.data;

    const promManualIdx = {};
    (promManualRes.data || []).forEach(r => { promManualIdx[r.alumno_id] = r; });

    const cierreAbierto = !cierre?.cerrado_at;

    window._docNotas_alumnos   = alumnos;
    window._docNotas_cursoId   = cursoId;
    window._docNotas_materiaId = materiaId;
    window._docNotas_periodoId = PERIODO_SEL;
    window._docNotas_instId    = USUARIO_ACTUAL.institucion_id;
    window._docNotas_promIdx   = promManualIdx;

    const notaMin   = config?.nota_minima_aprobacion ?? 7;
    const recReempl = config?.recuperatorio_reemplaza ?? true;

    // Indexar calificaciones: alumnoId_instanciaId → calificacion
    const califIdx = {};
    califs.forEach(c => { califIdx[`${c.alumno_id}_${c.instancia_id}`] = c; });

    // Calcular promedios
    const promedios = {};
    alumnos.forEach(al => {
      const usadas = {};
      instancias.forEach(inst => {
        const calif = califIdx[`${al.id}_${inst.id}`];
        if (!calif || calif.ausente || calif.nota === null) return;
        const esRecup = inst.tipos_instancia_evaluativa?.es_recuperatorio;
        if (esRecup && recReempl && inst.instancia_original_id) {
          usadas[inst.instancia_original_id] = calif.nota; // reemplaza
        } else if (!esRecup) {
          usadas[inst.id] = calif.nota;
        } else if (esRecup && !recReempl) {
          // promedia: guardar ambas
          if (!usadas[`recup_${inst.instancia_original_id}`]) {
            usadas[`recup_${inst.instancia_original_id}`] = calif.nota;
          }
        }
      });
      const vals = Object.values(usadas);
      promedios[al.id] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });

    return `
      <!-- Tabs de período -->
        <div class="periodo-tabs">
            ${periodosCurso.map(p => `
            <button class="periodo-tab ${PERIODO_SEL === p.id ? 'on' : ''}"
            onclick="cambioPeriodoDoc('${p.id}')">
            ${p.nombre}
            </button>`).join('')}
        </div>

      <!-- Situación académica -->
      ${renderSituacionCard(alumnos, al => promedios[al.id], `doc-${PERIODO_SEL.slice(-4)}-`, 'Situación en esta materia', _umbralMin(nivel, nombreCurso) ?? 7, _umbralRec(nivel, nombreCurso) ?? 4)}

      <!-- Botones acción -->
      ${(() => {
        if (cierre?.validado_at) {
          const esDir = ['director_general','directivo_nivel','secretario','vicedirector'].includes(USUARIO_ACTUAL.rol);
          return `
            <div style="background:var(--azul-l);border-left:3px solid var(--azul);border-radius:var(--rad);
              padding:10px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:11px;color:var(--azul)">✅ Cuatrimestre validado por el preceptor — notas bloqueadas</span>
              ${esDir ? `<button class="btn-s" style="font-size:11px"
                onclick="reabrirCierreMateria('${cursoId}','${materiaId}','${PERIODO_SEL}','${_escCal(nombreMateria)}')">
                🔓 Reabrir
              </button>` : ''}
            </div>`;
        }
        if (cierre?.cerrado_at) return `
          <div style="background:var(--amb-l);border-left:3px solid var(--ambar);border-radius:var(--rad);
            padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:8px;font-size:11px;color:var(--ambar)">
            ⏳ Cuatrimestre cerrado — pendiente de validación del preceptor
          </div>`;
        return `
          <div class="acc" style="margin-bottom:12px">
            <button class="btn-p" onclick="abrirCargaBulk('${cursoId}','${materiaId}','${PERIODO_SEL}')">
              📝 Cargar notas
            </button>
            <button class="btn-s" onclick="abrirEditarBulk('${cursoId}','${materiaId}','${PERIODO_SEL}')">
              ✏️ Editar notas
            </button>
            <button class="btn-s" onclick="crearInstancia('${cursoId}','${materiaId}','${PERIODO_SEL}','${nivel}')">
              + Nueva instancia
            </button>
            <button class="btn-s" onclick="abrirConfigCalif('${cursoId}','${materiaId}',${notaMin},${recReempl})">
              ⚙️ Configurar
            </button>
            <button class="btn-d" onclick="cerrarCuatrimestreDocente('${cursoId}','${materiaId}','${PERIODO_SEL}','${nombreMateria.replace(/'/g,"\\'")}')">
              🔒 Cerrar cuatrimestre
            </button>
          </div>`;
      })()}
      <!-- Grilla -->
      ${!instancias.length
        ? `<div class="empty-state">Sin instancias evaluativas.<br>Creá una con el botón "Nueva instancia".</div>`
        : `<div style="display:flex;justify-content:flex-end;gap:4px;margin-bottom:6px">
            <button onclick="_scrollGrilla(-1)" style="background:var(--surf2);border:1px solid var(--brd);border-radius:6px;padding:4px 12px;cursor:pointer;font-size:14px;color:var(--txt2)">◀</button>
            <button onclick="_scrollGrilla(1)"  style="background:var(--surf2);border:1px solid var(--brd);border-radius:6px;padding:4px 12px;cursor:pointer;font-size:14px;color:var(--txt2)">▶</button>
          </div>
          <div id="grilla-notas-wrap" style="overflow-x:auto">
          <table class="grilla-notas" style="table-layout:auto">
            <thead>
              <tr>
                <th style="text-align:left;min-width:180px;position:sticky;left:0;z-index:2;background:var(--surf2)">Alumno</th>
                ${instancias.map(inst => `
                  <th class="${inst.tipos_instancia_evaluativa?.es_recuperatorio ? 'th-recup' : ''}"
                    title="${[inst.tipos_instancia_evaluativa?.nombre, inst.nombre].filter(Boolean).join(' · ')}"
                    style="width:68px;min-width:68px;max-width:68px">
                    <div style="font-size:8px;font-weight:700;letter-spacing:.06em;color:var(--txt3);font-family:'DM Mono',monospace;text-transform:uppercase;margin:0 auto;width:60px">${_abrevTipo(inst.tipos_instancia_evaluativa?.nombre)}</div>
                    <div style="font-size:9px;font-weight:600;width:60px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;margin:0 auto">${inst.nombre || inst.tipos_instancia_evaluativa?.nombre || '—'}</div>
                    <div style="font-size:9px;opacity:.6">${formatFechaCorta(inst.fecha)}</div>
                  </th>`).join('')}
                <th>Prom.</th>
              </tr>
            </thead>
            <tbody>
              ${alumnos.map(al => {
                const prom = promedios[al.id];
                return `
                  <tr>
                    <td style="font-size:11px;font-weight:500;white-space:nowrap;cursor:pointer;position:sticky;left:0;z-index:1;background:var(--bg);box-shadow:2px 0 4px rgba(0,0,0,.06)"
                      onclick="verAlumnoNotas('${al.id}','${cursoId}','${materiaId}','${PERIODO_SEL}')">
                      ${al.apellido}, ${al.nombre}
                    </td>
                    ${instancias.map(inst => {
                      const calif = califIdx[`${al.id}_${inst.id}`];
                      if (!calif) return `
                        <td>
                          <span class="nota-cell nota-nd" style="cursor:pointer"
                            onclick="abrirModalNota('${al.id}','${inst.id}','${cursoId}','${materiaId}','${PERIODO_SEL}',null)">
                            —
                          </span>
                        </td>`;
                      if (calif.ausente) return `<td><span class="nota-cell nota-nd">A</span></td>`;
                      const nota = calif.nota;
                      return `
                        <td>
                          <span class="nota-cell ${NOTA_CLS(nota, nivel, nombreCurso)}" style="cursor:pointer"
                            onclick="abrirModalNota('${al.id}','${inst.id}','${cursoId}','${materiaId}','${PERIODO_SEL}',${nota})">
                            ${nota % 1 === 0 ? nota : nota.toFixed(1)}
                          </span>
                        </td>`;
                    }).join('')}
                    ${(() => {
                      const pmRec    = promManualIdx[al.id];
                      const editado  = pmRec?.promedio_editado;
                      const promFin  = editado ? pmRec.promedio_manual : prom;
                      const promRnd  = promFin !== null ? Math.round(promFin) : null;
                      return `<td style="min-width:56px">
                        <div style="text-align:center">
                          ${promRnd !== null
                            ? `<span style="font-weight:700;color:${editado ? 'var(--ambar)' : NOTA_COLOR(promRnd, nivel, nombreCurso)}">${promRnd}</span>
                               ${editado ? '<div style="font-size:8px;color:var(--ambar)">(manual)</div>' : ''}`
                            : `<span style="color:var(--txt3)">—</span>`}
                          ${cierreAbierto ? `
                            <button onclick="_toggleDocPromEdit('${al.id}')"
                              style="background:none;border:none;cursor:pointer;font-size:10px;color:var(--txt3);padding:0;display:block;margin:1px auto 0">✏️</button>
                            <div id="doc-prom-ed-${al.id}" style="display:none;margin-top:2px">
                              <input type="number" id="doc-prom-${al.id}" min="1" max="10" step="0.5"
                                value="${editado && pmRec.promedio_manual !== null ? pmRec.promedio_manual : (promRnd ?? '')}"
                                style="width:44px;text-align:center;border:1.5px solid var(--ambar);
                                  border-radius:4px;padding:2px;font-size:11px;font-weight:700">
                            </div>` : ''}
                        </div>
                      </td>`;
                    })()}
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div></div>
        ${cierreAbierto ? `
        <button class="btn-s" style="width:100%;margin-top:10px"
          onclick="guardarPromediosDocente()">💾 Guardar promedios editados</button>` : ''}`}`;
  };

  window.cambioPeriodoDoc = async (pid) => {
    PERIODO_SEL = pid;
    document.getElementById('contenido-notas-doc').innerHTML = await cargarVista();
    inyectarEstilosNotas();
  };

  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <button onclick="rNotasDocente()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--txt2)">←</button>
      <div>
        <div class="pg-t">${nombreCurso} · ${nombreMateria}</div>
        <div class="pg-s">Calificaciones ${new Date().getFullYear()}</div>
      </div>
    </div>
    <div id="contenido-notas-doc">${await cargarVista()}</div>`;
}

function _toggleDocPromEdit(alumnoId) {
  const el = document.getElementById(`doc-prom-ed-${alumnoId}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function guardarPromediosDocente() {
  const alumnos   = window._docNotas_alumnos   || [];
  const cursoId   = window._docNotas_cursoId;
  const materiaId = window._docNotas_materiaId;
  const periodoId = window._docNotas_periodoId;
  const instId    = window._docNotas_instId;
  const promIdx   = window._docNotas_promIdx   || {};

  let saved = 0, errors = 0;

  for (const al of alumnos) {
    const inp = document.getElementById(`doc-prom-${al.id}`);
    if (!inp || inp.value === '') continue;
    const num = parseFloat(inp.value);
    if (isNaN(num)) continue;

    const existing = promIdx[al.id];
    const datos = {
      institucion_id:  instId,
      alumno_id:       al.id,
      materia_id:      materiaId,
      curso_id:        cursoId,
      periodo_id:      periodoId,
      instancia_id:    null,
      promedio_editado: true,
      promedio_manual:  num,
      registrado_por:   USUARIO_ACTUAL.id,
    };

    if (existing?.id) {
      const { error } = await sb.from('calificaciones').update(datos).eq('id', existing.id);
      if (error) errors++; else saved++;
    } else {
      const { error } = await sb.from('calificaciones').insert([datos]);
      if (error) errors++; else saved++;
    }
  }

  if (errors) { alert(`${errors} promedio(s) no se pudo guardar.`); return; }
  if (saved) window.cambioPeriodoDoc?.(periodoId);
}

// ─── MODAL NOTA INDIVIDUAL ────────────────────────────
function abrirModalNota(alumnoId, instanciaId, cursoId, materiaId, periodoId, notaActual) {
  document.getElementById('modal-nota')?.remove();
  const modal = document.createElement('div');
  modal.id    = 'modal-nota';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px`;
  modal.innerHTML = `
    <div style="background:var(--surf);border-radius:var(--rad-lg);padding:20px;width:100%;max-width:300px">
      <div style="font-size:13px;font-weight:700;margin-bottom:14px">Nota del alumno</div>
      <div class="sec-lb">Nota (1-10)</div>
      <input type="number" id="modal-nota-val" min="1" max="10" step="1"
        value="${notaActual ?? ''}" placeholder="Ej: 8"
        style="margin-bottom:10px;font-size:22px;font-weight:700;text-align:center">
      <label style="display:flex;align-items:center;gap:8px;font-size:12px;margin-bottom:14px;cursor:pointer">
        <input type="checkbox" id="modal-nota-aus" ${notaActual === null && notaActual !== undefined ? 'checked' : ''}>
        Ausente en la evaluación
      </label>
      <div class="acc">
        <button class="btn-p" onclick="guardarNotaModal('${alumnoId}','${instanciaId}','${cursoId}','${materiaId}','${periodoId}')">
          Guardar
        </button>
        <button class="btn-s" onclick="document.getElementById('modal-nota').remove()">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function guardarNotaModal(alumnoId, instanciaId, cursoId, materiaId, periodoId) {
  const ausente = document.getElementById('modal-nota-aus')?.checked || false;
  const nota    = parseFloat(document.getElementById('modal-nota-val')?.value);

  if (!ausente && (isNaN(nota) || nota < 1 || nota > 10)) {
    alert('Ingresá una nota entre 1 y 10, o marcá Ausente.');
    return;
  }

  const { error } = await sb.from('calificaciones').upsert({
    institucion_id: USUARIO_ACTUAL.institucion_id,
    alumno_id:      alumnoId,
    instancia_id:   instanciaId,
    curso_id:       cursoId,
    materia_id:     materiaId,
    periodo_id:     periodoId,
    nota:           ausente ? null : Math.round(nota),
    ausente,
    registrado_por: USUARIO_ACTUAL.id,
  }, { onConflict: 'alumno_id,instancia_id' });

  if (error) { alert('Error: ' + error.message); return; }

  document.getElementById('modal-nota')?.remove();
  await verificarAlertasAcademicas(alumnoId, cursoId, materiaId, periodoId);
  window.cambioPeriodoDoc?.(periodoId);
}

// ─── CARGA EN BULK (todos los alumnos de una instancia) ─
async function abrirCargaBulk(cursoId, materiaId, periodoId) {
  const [{ data: todasInstancias }, { data: alumnos }] = await Promise.all([
    sb.from('instancias_evaluativas')
      .select('*, tipos_instancia_evaluativa(nombre)')
      .eq('curso_id', cursoId).eq('materia_id', materiaId)
      .eq('periodo_id', periodoId).order('fecha'),
    sb.from('alumnos').select('*').eq('curso_id', cursoId).eq('activo', true).order('apellido'),
  ]);

  if (!todasInstancias?.length) {
    alert('Primero creá una instancia evaluativa con el botón "+ Nueva instancia".');
    return;
  }

  // Filtrar solo instancias sin notas completas
  const instIds = todasInstancias.map(i => i.id);
  const { data: califExist } = await sb.from('calificaciones')
    .select('alumno_id,instancia_id').in('instancia_id', instIds);

  const gradedPerInst = {};
  (califExist || []).forEach(c => {
    gradedPerInst[c.instancia_id] = (gradedPerInst[c.instancia_id] || 0) + 1;
  });
  const alumnoCount = (alumnos || []).length;
  const instancias = todasInstancias.filter(i => (gradedPerInst[i.id] || 0) < alumnoCount);

  if (!instancias.length) {
    alert('Todas las instancias ya tienen notas cargadas. Usá "Editar notas" para modificarlas.');
    return;
  }

  document.getElementById('modal-bulk')?.remove();
  const modal = document.createElement('div');
  modal.id    = 'modal-bulk';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px`;
  modal.innerHTML = `
    <div style="background:var(--surf);border-radius:var(--rad-lg);padding:20px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto">
      <div style="font-size:14px;font-weight:700;margin-bottom:12px">📝 Cargar notas</div>

      <div class="sec-lb">Instancia evaluativa</div>
      <select id="bulk-inst-sel" class="sel-estilizado" style="margin-bottom:14px">
        ${instancias.map(i => `
          <option value="${i.id}">${i.tipos_instancia_evaluativa?.nombre} · ${formatFechaLatam(i.fecha)}</option>
        `).join('')}
      </select>

      <div class="card" style="padding:0;margin-bottom:14px">
        ${(alumnos || []).map((al, idx) => `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
            border-bottom:${idx < alumnos.length - 1 ? '1px solid var(--brd)' : 'none'}">
            <div class="asist-av">${al.apellido[0]}${al.nombre[0]}</div>
            <div style="flex:1;font-size:12px;font-weight:500">${al.apellido}, ${al.nombre}</div>
            <input type="number" min="1" max="10" step="1" placeholder="—"
              data-alumno="${al.id}"
              style="width:58px;text-align:center;border:1.5px solid var(--brd);border-radius:var(--rad);
                padding:6px;font-size:14px;font-weight:700;background:var(--surf)">
            <label style="font-size:10px;display:flex;align-items:center;gap:4px;color:var(--txt2)">
              <input type="checkbox" data-aus="${al.id}"> Aus.
            </label>
          </div>`).join('')}
      </div>

      <div class="acc">
        <button class="btn-p" style="flex:1" onclick="guardarBulk('${cursoId}','${materiaId}','${periodoId}')">
          💾 Guardar todas
        </button>
        <button class="btn-s" onclick="document.getElementById('modal-bulk').remove()">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function guardarBulk(cursoId, materiaId, periodoId) {
  const instId    = document.getElementById('bulk-inst-sel')?.value;
  const inputs    = document.querySelectorAll('[data-alumno]');
  const registros = [];

  inputs.forEach(inp => {
    const alumnoId = inp.dataset.alumno;
    const nota     = parseFloat(inp.value);
    const ausente  = document.querySelector(`[data-aus="${alumnoId}"]`)?.checked || false;
    if (!ausente && isNaN(nota)) return; // sin dato, skip
    registros.push({
      institucion_id: USUARIO_ACTUAL.institucion_id,
      alumno_id:      alumnoId,
      instancia_id:   instId,
      curso_id:       cursoId,
      materia_id:     materiaId,
      periodo_id:     periodoId,
      nota:           ausente ? null : Math.round(nota),
      ausente,
      registrado_por: USUARIO_ACTUAL.id,
    });
  });

  if (!registros.length) {
    alert('No ingresaste ninguna nota. Completá al menos una.');
    return;
  }

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const { error } = await sb.from('calificaciones').upsert(registros, {
    onConflict: 'alumno_id,instancia_id',
  });

  if (error) {
    btn.disabled = false;
    btn.textContent = '💾 Guardar todas';
    alert('Error: ' + error.message);
    return;
  }

  document.getElementById('modal-bulk')?.remove();
  window.cambioPeriodoDoc?.(periodoId);
}

// ─── EDITAR NOTAS EN BULK ────────────────────────────
async function abrirEditarBulk(cursoId, materiaId, periodoId) {
  const [{ data: instancias }, { data: alumnos }] = await Promise.all([
    sb.from('instancias_evaluativas')
      .select('*, tipos_instancia_evaluativa(nombre)')
      .eq('curso_id', cursoId).eq('materia_id', materiaId)
      .eq('periodo_id', periodoId).order('fecha'),
    sb.from('alumnos').select('*').eq('curso_id', cursoId).eq('activo', true).order('apellido'),
  ]);

  if (!instancias?.length) {
    alert('No hay instancias evaluativas en este período.');
    return;
  }

  // Cargar todas las calificaciones existentes
  const instIds = instancias.map(i => i.id);
  const { data: califs } = await sb.from('calificaciones')
    .select('*').in('instancia_id', instIds);

  // Índice: alumno_instancia → calificacion
  const califIdx = {};
  (califs || []).forEach(c => { califIdx[`${c.alumno_id}_${c.instancia_id}`] = c; });

  // Guardar en window para acceso dinámico
  window._editCalifIdx  = califIdx;
  window._editAlumnos   = alumnos || [];
  window._editInstancias = instancias;

  document.getElementById('modal-bulk')?.remove();
  const modal = document.createElement('div');
  modal.id    = 'modal-bulk';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px`;
  modal.innerHTML = `
    <div style="background:var(--surf);border-radius:var(--rad-lg);padding:20px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto">
      <div style="font-size:14px;font-weight:700;margin-bottom:12px">✏️ Editar notas</div>

      <div class="sec-lb">Instancia evaluativa</div>
      <select id="bulk-inst-sel" style="margin-bottom:14px" onchange="recargarFormEdit()">
        ${instancias.map(i => `
          <option value="${i.id}">${i.tipos_instancia_evaluativa?.nombre} · ${formatFechaLatam(i.fecha)}</option>
        `).join('')}
      </select>

      <div id="edit-form-alumnos" class="card" style="padding:0;margin-bottom:14px"></div>

      <div class="acc">
        <button class="btn-p" style="flex:1" onclick="guardarBulk('${cursoId}','${materiaId}','${periodoId}')">
          💾 Guardar cambios
        </button>
        <button class="btn-s" onclick="document.getElementById('modal-bulk').remove()">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  recargarFormEdit(); // Inicializar con la primera instancia
}

function recargarFormEdit() {
  const instId    = document.getElementById('bulk-inst-sel')?.value;
  const alumnos   = window._editAlumnos || [];
  const califIdx  = window._editCalifIdx || {};
  const contenedor = document.getElementById('edit-form-alumnos');
  if (!contenedor) return;

  contenedor.innerHTML = alumnos.map((al, idx) => {
    const calif = califIdx[`${al.id}_${instId}`];
    const nota  = calif?.nota ?? '';
    const aus   = calif?.ausente ?? false;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
        border-bottom:${idx < alumnos.length - 1 ? '1px solid var(--brd)' : 'none'}">
        <div class="asist-av">${al.apellido[0]}${al.nombre[0]}</div>
        <div style="flex:1;font-size:12px;font-weight:500">${al.apellido}, ${al.nombre}</div>
        ${calif ? '<span style="font-size:9px;color:var(--verde);margin-right:4px">●</span>' : '<span style="font-size:9px;color:var(--txt3);margin-right:4px">○</span>'}
        <input type="number" min="1" max="10" step="1" placeholder="—"
          value="${nota}"
          data-alumno="${al.id}"
          style="width:58px;text-align:center;border:1.5px solid var(--brd);border-radius:var(--rad);
            padding:6px;font-size:14px;font-weight:700;background:var(--surf)">
        <label style="font-size:10px;display:flex;align-items:center;gap:4px;color:var(--txt2)">
          <input type="checkbox" data-aus="${al.id}" ${aus ? 'checked' : ''}> Aus.
        </label>
      </div>`;
  }).join('');
}

// ─── CREAR INSTANCIA EVALUATIVA ───────────────────────
async function crearInstancia(cursoId, materiaId, periodoId, nivel) {
  // Recargar tipos si están vacíos
  if (!TIPOS_EVAL.length) {
    const { data } = await sb.from('tipos_instancia_evaluativa')
      .select('*').eq('institucion_id', USUARIO_ACTUAL.institucion_id)
      .eq('activo', true).order('nombre');
    TIPOS_EVAL = data || [];
  }

  const hoy = hoyISO();

  const { data: instExist } = await sb.from('instancias_evaluativas')
    .select('*, tipos_instancia_evaluativa(nombre)')
    .eq('curso_id', cursoId)
    .eq('periodo_id', periodoId)
    .eq('creado_por', USUARIO_ACTUAL.id)
    .gte('fecha', hoy)
    .order('fecha');

  document.getElementById('modal-instancia')?.remove();
  const modal = document.createElement('div');
  modal.id    = 'modal-instancia';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px`;
  modal.innerHTML = `
    <div style="background:var(--surf);border-radius:16px;width:100%;max-width:440px;max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.18)">

      <!-- Header -->
      <div style="padding:20px 22px 16px;border-bottom:1px solid var(--brd);display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:16px;font-weight:700;font-family:'Lora',serif">Nueva instancia</div>
          <div style="font-size:11px;color:var(--txt2);margin-top:2px">Evaluación · ${new Date().toLocaleDateString('es-AR',{month:'long',year:'numeric'})}</div>
        </div>
        <button onclick="document.getElementById('modal-instancia').remove()"
          style="background:var(--surf2);border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:16px;color:var(--txt2);display:flex;align-items:center;justify-content:center">✕</button>
      </div>

      <!-- Body -->
      <div style="padding:20px 22px">

        <!-- Nombre -->
        <div style="margin-bottom:16px">
          <label style="display:block;font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--txt2);text-transform:uppercase;margin-bottom:6px">Nombre</label>
          <input type="text" id="inst-nombre" placeholder="Ej: 2° Parcial — Unidad 3"
            style="width:100%;padding:10px 12px;border:1.5px solid var(--brd);border-radius:10px;font-size:13px;
              background:var(--surf);color:var(--txt);font-family:inherit;box-sizing:border-box;
              transition:border-color .15s;outline:none"
            onfocus="this.style.borderColor='var(--verde)'" onblur="this.style.borderColor='var(--brd)'">
        </div>

        <!-- Tipo -->
        <div style="margin-bottom:16px">
          <label style="display:block;font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--txt2);text-transform:uppercase;margin-bottom:6px">Tipo de evaluación</label>
          <select id="inst-tipo" onchange="checkRecupModal(this)"
            style="width:100%;padding:10px 12px;border:1.5px solid var(--brd);border-radius:10px;font-size:13px;
              background:var(--surf);color:var(--txt);font-family:inherit;box-sizing:border-box;cursor:pointer;
              appearance:none;background-image:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><path fill=%22%23888%22 d=%22M8 10L3 5h10z%22/></svg>');
              background-repeat:no-repeat;background-position:right 12px center;background-size:12px">
            <option value="">— Elegí tipo —</option>
            <optgroup label="Evaluaciones">
              ${TIPOS_EVAL.filter(t => !t.es_recuperatorio).map(t =>
                `<option value="${t.id}" data-recup="false">${t.nombre}</option>`).join('')}
            </optgroup>
            <optgroup label="Recuperatorios">
              ${TIPOS_EVAL.filter(t => t.es_recuperatorio).map(t =>
                `<option value="${t.id}" data-recup="true">${t.nombre}</option>`).join('')}
            </optgroup>
          </select>
        </div>

        <!-- Recuperatorio de -->
        <div id="recup-orig-sel" style="display:none;margin-bottom:16px">
          <label style="display:block;font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--txt2);text-transform:uppercase;margin-bottom:6px">Recuperatorio de</label>
          <select id="inst-orig"
            style="width:100%;padding:10px 12px;border:1.5px solid var(--brd);border-radius:10px;font-size:13px;
              background:var(--surf);color:var(--txt);font-family:inherit;box-sizing:border-box;cursor:pointer">
            <option value="">— Elegí instancia original —</option>
            ${(instExist || []).filter(i => !i.tipos_instancia_evaluativa?.es_recuperatorio).map(i =>
              `<option value="${i.id}">${i.tipos_instancia_evaluativa?.nombre} · ${formatFechaLatam(i.fecha)}</option>`
            ).join('')}
          </select>
        </div>

        <!-- Fecha -->
        <div style="margin-bottom:16px">
          <label style="display:block;font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--txt2);text-transform:uppercase;margin-bottom:6px">Fecha</label>
          ${renderFechaInput('inst-fecha', hoy)}
        </div>

        ${instExist?.length ? `
        <div style="background:var(--amb-l);border-radius:10px;padding:10px 14px;margin-bottom:16px;border-left:3px solid var(--ambar)">
          <div style="font-size:10px;font-weight:700;color:var(--ambar);margin-bottom:6px">Ya tenés programado</div>
          ${instExist.map(i => `
            <div style="font-size:11px;color:var(--txt);display:flex;align-items:center;gap:6px;margin-bottom:3px">
              <span style="color:var(--ambar)">·</span> ${i.tipos_instancia_evaluativa?.nombre} · ${formatFechaLatam(i.fecha)}
            </div>`).join('')}
        </div>` : ''}

        <!-- Descripción -->
        <div style="margin-bottom:20px">
          <label style="display:block;font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--txt2);text-transform:uppercase;margin-bottom:6px">Descripción <span style="font-weight:400;text-transform:none">(opcional)</span></label>
          <textarea id="inst-desc" rows="2" placeholder="Temas, materiales, unidades..."
            style="width:100%;padding:10px 12px;border:1.5px solid var(--brd);border-radius:10px;font-size:12px;
              background:var(--surf);color:var(--txt);font-family:inherit;box-sizing:border-box;resize:vertical;
              transition:border-color .15s;outline:none"
            onfocus="this.style.borderColor='var(--verde)'" onblur="this.style.borderColor='var(--brd)'"></textarea>
        </div>

        <!-- Acciones -->
        <div style="display:flex;gap:8px">
          <button onclick="guardarInstancia('${cursoId}','${materiaId}','${periodoId}')"
            style="flex:1;padding:12px;background:var(--verde);color:#fff;border:none;border-radius:10px;
              font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity .15s"
            onmouseover="this.style.opacity='.88'" onmouseout="this.style.opacity='1'">
            Crear instancia
          </button>
          <button onclick="document.getElementById('modal-instancia').remove()"
            style="padding:12px 18px;background:var(--surf2);color:var(--txt2);border:1.5px solid var(--brd);
              border-radius:10px;font-size:13px;cursor:pointer;font-family:inherit">
            Cancelar
          </button>
        </div>

      </div>
    </div>`;
  document.body.appendChild(modal);
}

function checkRecupModal(sel) {
  const esRecup = sel.options[sel.selectedIndex]?.dataset?.recup === 'true';
  document.getElementById('recup-orig-sel').style.display = esRecup ? 'block' : 'none';
}

async function guardarInstancia(cursoId, materiaId, periodoId) {
  const nombre  = document.getElementById('inst-nombre')?.value?.trim();
  const tipoId  = document.getElementById('inst-tipo')?.value;
  const fecha   = getFechaInput('inst-fecha');
  const origId  = document.getElementById('inst-orig')?.value || null;
  const desc    = document.getElementById('inst-desc')?.value || null;

  if (!nombre) { alert('El nombre es obligatorio.'); return; }
  if (!tipoId) { alert('Elegí un tipo.'); return; }
  if (!fecha)  { alert('La fecha es obligatoria.'); return; }

  const tipo = TIPOS_EVAL.find(t => t.id === tipoId);

  const { error } = await sb.from('instancias_evaluativas').insert({
    institucion_id:        USUARIO_ACTUAL.institucion_id,
    curso_id:              cursoId,
    materia_id:            materiaId,
    tipo_id:               tipoId,
    periodo_id:            periodoId,
    creado_por:            USUARIO_ACTUAL.id,
    nombre,
    fecha,
    descripcion:           desc,
    es_recuperatorio:      tipo?.es_recuperatorio || false,
    instancia_original_id: origId || null,
  });

  if (error) { alert('Error al crear: ' + error.message); return; }

  document.getElementById('modal-instancia')?.remove();
  window.cambioPeriodoDoc?.(periodoId);
}

// ─── CONFIG ───────────────────────────────────────────
function abrirConfigCalif(cursoId, materiaId, notaMin, recReempl) {
  document.getElementById('modal-config-calif')?.remove();
  const modal = document.createElement('div');
  modal.id    = 'modal-config-calif';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px`;
  modal.innerHTML = `
    <div style="background:var(--surf);border-radius:var(--rad-lg);padding:20px;width:100%;max-width:360px">
      <div style="font-size:14px;font-weight:700;margin-bottom:14px">⚙️ Configuración</div>

      <div class="sec-lb">Nota mínima de aprobación</div>
      <input type="number" id="cfg-nota-min" min="1" max="10" step="0.5" value="${notaMin}"
        style="margin-bottom:12px;font-size:20px;font-weight:700;text-align:center;width:80px">

      <div class="sec-lb">Recuperatorio</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
          <input type="radio" name="cfg-recup" value="true" ${recReempl ? 'checked' : ''}>
          Reemplaza la nota original
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
          <input type="radio" name="cfg-recup" value="false" ${!recReempl ? 'checked' : ''}>
          Se promedia con la nota original
        </label>
      </div>

      <div class="acc">
        <button class="btn-p" onclick="guardarConfigCalif('${cursoId}','${materiaId}')">Guardar</button>
        <button class="btn-s" onclick="document.getElementById('modal-config-calif').remove()">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function guardarConfigCalif(cursoId, materiaId) {
  const notaMin   = parseFloat(document.getElementById('cfg-nota-min')?.value);
  const recReempl = document.querySelector('[name="cfg-recup"]:checked')?.value === 'true';

  await sb.from('config_calificaciones').upsert({
    institucion_id:          USUARIO_ACTUAL.institucion_id,
    usuario_id:              USUARIO_ACTUAL.id,
    materia_id:              materiaId,
    curso_id:                cursoId,
    nota_minima_aprobacion:  notaMin,
    recuperatorio_reemplaza: recReempl,
  }, { onConflict: 'usuario_id,materia_id,curso_id' });

  document.getElementById('modal-config-calif')?.remove();
}

// ═══════════════════════════════════════════════════════
// DIRECTIVO / PRECEPTOR — SOLO LECTURA
// ═══════════════════════════════════════════════════════
async function rNotasDirectivo(nivelForzado) {
  // Si viene desde tabs de nivel (director_general multinivel), renderizar en el sub-contenedor
  const tabBody = document.getElementById('notas-tab-body');
  const c      = tabBody || document.getElementById('page-notas');
  const instId = USUARIO_ACTUAL.institucion_id;
  const rol    = USUARIO_ACTUAL.rol;
  const nivel  = nivelForzado || USUARIO_ACTUAL.nivel;

  const { data: cursos } = await sb.from('cursos')
    .select('*').eq('institucion_id', instId).order('nivel').order('nombre');

  let filtrados = cursos || [];
  if (nivel) filtrados = filtrados.filter(cu => cu.nivel === nivel);

  const niveles = ['inicial','primario','secundario'];
  const colores = { inicial:'#1a7a4a', primario:'#1a5276', secundario:'#6c3483' };

  c.innerHTML = `
    ${tabBody ? '' : '<div class="pg-t">Calificaciones</div>'}
    <div class="pg-s">${rol === 'preceptor' ? 'Preceptoría' : 'Vista institucional'} · Solo lectura</div>
    <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;padding:9px 13px;
      background:var(--surf1);border-radius:8px;font-size:10px;color:var(--txt2);margin-bottom:14px;border:1px solid var(--brd)">
      <span style="font-weight:600;color:var(--txt1);flex-shrink:0">Situación por alumno:</span>
      <span><span style="color:var(--verde);font-weight:800">●</span>&ensp;Al día — 0 ó 1 mat. desaprobada</span>
      <span><span style="color:var(--ambar);font-weight:800">●</span>&ensp;En seguimiento — 2 mat. desaprobadas</span>
      <span><span style="color:var(--rojo);font-weight:800">●</span>&ensp;En riesgo — 3 o más mat. desaprobadas</span>
    </div>
    ${rol === 'eoe' ? `
    <div style="margin-bottom:14px">
      <div style="position:relative">
        <input type="text" id="eoe-notas-search" placeholder="Buscar alumno por nombre..."
          style="width:100%;padding:9px 34px 9px 12px;font-size:12px;box-sizing:border-box"
          oninput="_debounceNotasEOE(this.value)">
        <button id="eoe-notas-clear" style="display:none;position:absolute;right:8px;top:50%;transform:translateY(-50%);
          background:none;border:none;cursor:pointer;font-size:16px;color:var(--txt2);line-height:1"
          onclick="_limpiarBusquedaNotasEOE()">×</button>
      </div>
      <div id="eoe-notas-drop" style="position:relative;z-index:20"></div>
    </div>` : ''}
    ${rol === 'preceptor' ? `<div id="preceptor-cierre-resumen">
      <div style="text-align:center;padding:12px;color:var(--txt3);font-size:11px">
        <div class="spinner" style="margin:0 auto 8px"></div>Cargando estado de cierres...
      </div>
    </div>` : ''}
    ${niveles.map(n => {
      const cs = filtrados.filter(cu => cu.nivel === n);
      if (!cs.length) return '';
      return `
        <div class="sec-lb" style="color:${colores[n]}">${labelNivelCalif(n)}</div>
        ${cs.map(cu => `
          <div class="card" style="display:flex;align-items:flex-start;justify-content:space-between;
            padding:14px 16px;margin-bottom:8px;cursor:pointer;border-left:3px solid ${colores[n]}"
            onclick="verCalifCurso('${cu.id}','${cu.nivel}')">
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:700;font-family:'Lora',serif">${cu.nombre}${cu.division}</div>
              <div style="font-size:11px;color:var(--txt2)">${cu.nivel}</div>
              <div id="card-stat-${cu.id}"></div>
            </div>
            <span style="font-size:22px;color:${colores[n]};flex-shrink:0;margin-left:8px">→</span>
          </div>`).join('')}`;
    }).join('')}
    <div class="sec-lb" style="margin-top:14px">Situación de alumnos</div>
    <div id="sit-dir-global" style="text-align:center;padding:20px;color:var(--txt3);font-size:11px">
      <div class="spinner" style="margin:0 auto 8px"></div>Calculando situación...
    </div>
    ${rol !== 'preceptor' && rol !== 'eoe' ? `
    <div class="sec-lb" style="margin-top:18px">Gestión del ciclo lectivo</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">
      <button class="btn-s" onclick="_cerrarCuatrimestreTrayectoria(1)" style="font-size:11px">
        🔒 Cerrar Cuatrimestre 1
      </button>
      <button class="btn-s" onclick="_cerrarCuatrimestreTrayectoria(2)" style="font-size:11px">
        🔒 Cerrar Cuatrimestre 2
      </button>
      <button class="btn-s" onclick="_mostrarCierreAnual()" style="font-size:11px">
        🎓 Cierre anual / Promoción
      </button>
    </div>
    <div style="font-size:10px;color:var(--txt2);margin-bottom:14px">
      El cierre de cuatrimestre genera alertas automáticas según la cantidad de materias desaprobadas (Res. 1650/2024).
    </div>` : ''}`;

  _cargarSituacionDirectivoGlobal(filtrados);
  if (rol === 'preceptor') _cargarResumenCierrePreceptor(filtrados.map(cu => cu.id));
}

async function _cargarSituacionDirectivoGlobal(cursos) {
  const contenedor = document.getElementById('sit-dir-global');
  if (!contenedor || !cursos?.length) return;

  const hoy = new Date();
  const cursoIds  = cursos.map(c => c.id);

  // Período activo por nivel
  const periodosActivosPorNivel = {};
  PERIODOS.forEach(p => {
    if (new Date(p.fecha_inicio) <= hoy && hoy <= new Date(p.fecha_fin)) {
      periodosActivosPorNivel[p.nivel] = p.id;
    }
  });
  if (!Object.keys(periodosActivosPorNivel).length) {
    PERIODOS.forEach(p => { if (!periodosActivosPorNivel[p.nivel]) periodosActivosPorNivel[p.nivel] = p.id; });
  }

  const { data: alumnos } = await sb.from('alumnos')
    .select('id,nombre,apellido,curso_id,cursos(nombre,division)')
    .in('curso_id', cursoIds).eq('activo', true);

  if (!alumnos?.length) { contenedor.innerHTML = '<div class="empty-state">Sin alumnos.</div>'; return; }

  // Agrupar cursos por nivel para queries por período correcto
  const cursosPorNivel = {};
  cursos.forEach(cu => {
    if (!cursosPorNivel[cu.nivel]) cursosPorNivel[cu.nivel] = [];
    cursosPorNivel[cu.nivel].push(cu.id);
  });

  const notasPorAlumnoMateria = {};
  for (const [nivel, ids] of Object.entries(cursosPorNivel)) {
    const pid = periodosActivosPorNivel[nivel];
    if (!pid || !ids.length) continue;
    const { data: califs } = await sb.from('calificaciones')
      .select('alumno_id,nota,ausente,materia_id')
      .in('curso_id', ids).eq('periodo_id', pid).limit(3000);
    (califs || []).forEach(c => {
      if (c.ausente || c.nota === null) return;
      const k = `${c.alumno_id}_${c.materia_id}`;
      if (!notasPorAlumnoMateria[k]) notasPorAlumnoMateria[k] = [];
      notasPorAlumnoMateria[k].push(c.nota);
    });
  }

  // Cuenta materias con promedio bajo el umbral de aprobación para un alumno
  const getDesaprobadasCount = (al) => {
    const keys = Object.keys(notasPorAlumnoMateria).filter(k => k.startsWith(al.id + '_'));
    if (!keys.length) return null;
    const cu  = cursos.find(c => c.id === al.curso_id);
    const min = CONFIG_NOTAS[cu?.nivel]?.nota_minima ?? 7;
    return keys.filter(k => {
      const ns = notasPorAlumnoMateria[k];
      return Math.round(ns.reduce((a, b) => a + b, 0) / ns.length) < min;
    }).length;
  };

  // Métricas por curso para las cards: verde=0–1 desap, amarillo=2, rojo=3+
  const cursoStats = {};
  alumnos.forEach(al => {
    if (!cursoStats[al.curso_id]) cursoStats[al.curso_id] = { apr: 0, obs: 0, crit: 0, sin: 0 };
    const desap = getDesaprobadasCount(al);
    const st    = cursoStats[al.curso_id];
    if (desap === null) st.sin++;
    else if (desap >= 3)  st.crit++;
    else if (desap === 2) st.obs++;
    else                  st.apr++;
  });
  Object.entries(cursoStats).forEach(([cId, st]) => {
    const el = document.getElementById(`card-stat-${cId}`);
    if (el) el.innerHTML = _mkMiniStat(st.apr, st.obs, st.crit, st.sin);
  });

  const alumnosConCurso = alumnos.map(al => ({
    ...al,
    cursoNombre: al.cursos ? `${al.cursos.nombre}${al.cursos.division}` : '',
  }));

  const nivelesConCursos = Object.keys(cursosPorNivel);
  const primerPeriodoLabel = nivelesConCursos.length === 1
    ? (PERIODOS.find(p => p.id === periodosActivosPorNivel[nivelesConCursos[0]])?.nombre || 'Año en curso')
    : 'Período activo';
  contenedor.innerHTML = renderSituacionCardDesap(alumnosConCurso, getDesaprobadasCount, 'dirg-', primerPeriodoLabel);
}

async function verCalifCurso(cursoId, nivel) {
  const c = document.getElementById('page-notas');
  showLoading('notas');

  // --- MODO: preceptor/directivo-readonly-primaria ---
  // Primaria/inicial: usar la tabla de materias comunes (readonly)
  if (nivel === 'primario' || nivel === 'inicial') {
    const { data: curso } = await sb.from('cursos').select('nombre,division').eq('id', cursoId).single();
    await verNotasPrimariaGrado(cursoId, nivel, `${curso?.nombre || ''}${curso?.division || ''}`, false);
    return;
  }

  // --- MODO: secundario (sin cambios) ---
  const periodosCurso = PERIODOS.filter(p => p.nivel === nivel).sort((a,b) => (a.nombre||'').localeCompare(b.nombre||''));
  let PERIODO_SEL     = periodosCurso[0]?.id || '';

  const { data: curso } = await sb.from('cursos').select('*').eq('id', cursoId).single();

  const { data: _piData } = await sb.from('periodos_intensificacion')
    .select('id,nombre').eq('institucion_id', USUARIO_ACTUAL.institucion_id)
    .eq('ciclo_lectivo', new Date().getFullYear()).order('fecha_inicio');
  const periIntensif = _piData || [];
  let _modoIntensif = null;

  const renderIntensifCurso = async () => {
    const { data: alumnos } = await sb.from('alumnos')
      .select('id,nombre,apellido').eq('curso_id', cursoId).eq('activo', true).order('apellido');
    const alumnoIds = (alumnos || []).map(a => a.id);
    if (!alumnoIds.length) return '<div class="empty-state">Sin alumnos en este curso.</div>';
    const { data: estados } = await sb.from('materias_estado_alumno')
      .select('id,estado,nota_intensif_1,nota_intensif_2,alumno_id,materia_id,materias(nombre)')
      .eq('periodo_id', _modoIntensif).in('alumno_id', alumnoIds);
    if (!estados?.length) return `<div style="text-align:center;padding:24px;color:var(--txt3);font-size:12px">
      Sin alumnos asignados a este período en este curso.<br>
      <span style="font-size:10px">Agregá desde el módulo <b>Intensificación</b>.</span>
    </div>`;
    const puedeEditar = ['director_general','directivo_nivel','secretario','vicedirector','preceptor','docente'].includes(USUARIO_ACTUAL.rol);
    return `
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px">
        ${estados.map(e => {
          const clr    = ESTADO_INTENSIF_COLOR[e.estado] || 'var(--txt2)';
          const alumno = alumnos.find(a => a.id === e.alumno_id);
          return `<div style="display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid var(--brd);gap:10px">
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600">${alumno?.apellido || ''}, ${alumno?.nombre || ''}</div>
              <div style="font-size:10px;color:var(--txt2)">${e.materias?.nombre || '—'}</div>
              <span style="font-size:10px;font-weight:600;color:${clr}">${ESTADO_INTENSIF_LABEL[e.estado] || e.estado}</span>
            </div>
            <div style="display:flex;gap:10px;align-items:center;flex-shrink:0">
              <div style="text-align:center">
                <div style="font-size:9px;color:var(--txt2);margin-bottom:2px">Intensif. 1</div>
                ${puedeEditar
                  ? `<input type="number" value="${e.nota_intensif_1 ?? ''}" min="1" max="10" step="0.5"
                      style="width:55px;padding:5px;border:1.5px solid var(--brd);border-radius:var(--rad);font-size:13px;font-weight:700;text-align:center;background:var(--surf);color:var(--txt)"
                      onchange="_guardarNotaIntensifCal('${e.id}',1,this.value)">`
                  : `<span style="font-size:16px;font-weight:700;color:${NOTA_COLOR(e.nota_intensif_1)}">${e.nota_intensif_1 ?? '—'}</span>`}
              </div>
              <div style="text-align:center">
                <div style="font-size:9px;color:var(--txt2);margin-bottom:2px">Intensif. 2</div>
                ${puedeEditar
                  ? `<input type="number" value="${e.nota_intensif_2 ?? ''}" min="1" max="10" step="0.5"
                      style="width:55px;padding:5px;border:1.5px solid var(--brd);border-radius:var(--rad);font-size:13px;font-weight:700;text-align:center;background:var(--surf);color:var(--txt)"
                      onchange="_guardarNotaIntensifCal('${e.id}',2,this.value)">`
                  : `<span style="font-size:16px;font-weight:700;color:${NOTA_COLOR(e.nota_intensif_2)}">${e.nota_intensif_2 ?? '—'}</span>`}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  };

  const renderGrilla = async () => {
    const tabBar = `<div class="periodo-tabs" style="align-items:center">
      ${periodosCurso.map(p => `<button class="periodo-tab ${!_modoIntensif && PERIODO_SEL === p.id ? 'on' : ''}" onclick="cambioPeriodoDir('${p.id}')">${p.nombre}</button>`).join('')}
      ${periIntensif.map(p => `<button class="periodo-tab ${_modoIntensif === p.id ? 'on' : ''}" style="border-color:var(--ambar)" onclick="cambioIntensifDir('${p.id}')">◈ ${p.nombre}</button>`).join('')}
    </div>`;
    if (_modoIntensif) return tabBar + (await renderIntensifCurso());
    const [alumnosRes, materiasRes, cierresRes, cierreCursoRes] = await Promise.all([
      sb.from('alumnos').select('*').eq('curso_id', cursoId).eq('activo', true).order('apellido'),
      sb.from('materias').select('*')
        .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
        .eq('nivel', nivel).eq('activo', true).order('nombre'),
      sb.from('cierres_materia_cuatrimestre').select('*')
        .eq('curso_id', cursoId).eq('periodo_id', PERIODO_SEL),
      sb.from('cierres_curso_cuatrimestre').select('*')
        .eq('curso_id', cursoId).eq('periodo_id', PERIODO_SEL).maybeSingle(),
    ]);

    const alumnos  = alumnosRes.data || [];
    const materias = materiasRes.data || [];
    const cierresMap = {};
    (cierresRes.data || []).forEach(c => { cierresMap[c.materia_id] = c; });
    const cierreCurso = cierreCursoRes.data;

    const isPrecep = USUARIO_ACTUAL.rol === 'preceptor';
    const todasCerradas  = materias.length > 0 && materias.every(m => cierresMap[m.id]?.cerrado_at);
    const todasValidadas = materias.length > 0 && materias.every(m => cierresMap[m.id]?.validado_at);
    const pendientesValid = materias.filter(m => cierresMap[m.id]?.cerrado_at && !cierresMap[m.id]?.validado_at);

    const cierreCursoBanner = cierreCurso?.validado_at
      ? `<div style="background:var(--azul-l);border-left:3px solid var(--azul);border-radius:var(--rad);
          padding:10px 14px;margin-bottom:12px;font-size:11px;color:var(--azul);font-weight:600">
          🏆 Cuatrimestre cerrado y validado por preceptoría
        </div>`
      : (isPrecep && todasValidadas && materias.length)
        ? `<div style="background:var(--verde-l);border-left:3px solid var(--verde);border-radius:var(--rad);
            padding:10px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:11px;font-weight:600;color:var(--verde)">✅ Todas las materias validadas</span>
            <button class="btn-p" style="font-size:11px"
              onclick="validarCierreCurso('${cursoId}','${PERIODO_SEL}','${_escCal(curso?.nombre)}${_escCal(curso?.division)}')">
              🏆 Cerrar cuatrimestre
            </button>
          </div>`
        : '';

    const validacionPendHTML = (isPrecep && pendientesValid.length) ? `
      <div style="background:var(--amb-l);border-left:3px solid var(--ambar);border-radius:var(--rad);
        padding:10px 14px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:var(--ambar);margin-bottom:4px">
          ⏳ ${pendientesValid.length} materia(s) pendiente(s) de validación
        </div>
        <div style="font-size:10px;color:var(--txt2)">Hacé clic en el encabezado de cada materia para ver las notas y validar.</div>
      </div>` : '';

    // Calcular promedios por alumno por materia
    const promediosMap = {};
    for (const m of materias) {
      const { data: califs } = await sb.from('calificaciones')
        .select('alumno_id, nota, ausente, instancias_evaluativas(es_recuperatorio)')
        .eq('curso_id', cursoId).eq('materia_id', m.id).eq('periodo_id', PERIODO_SEL);

      alumnos.forEach(al => {
        const notas = (califs || []).filter(c =>
          c.alumno_id === al.id && !c.ausente && c.nota !== null &&
          !c.instancias_evaluativas?.es_recuperatorio
        ).map(c => c.nota);
        if (!promediosMap[al.id]) promediosMap[al.id] = {};
        promediosMap[al.id][m.id] = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
      });
    }

    return `
      ${cierreCursoBanner}
      ${tabBar}
      ${validacionPendHTML}
      ${!materias.length ? '<div class="empty-state">Sin materias configuradas</div>' : `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:6px">
        <div style="display:flex;gap:10px;font-size:10px;color:var(--txt2);align-items:center;flex-wrap:wrap">
          <span style="font-weight:600;color:var(--txt1)">Filas:</span>
          <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:rgba(192,57,43,.18);margin-right:3px;vertical-align:middle"></span>3+ mat. desaprobadas</span>
          <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:rgba(245,176,65,.22);margin-right:3px;vertical-align:middle"></span>2 mat. desaprobadas</span>
        </div>
        <div style="display:flex;gap:4px">
          <button onclick="_scrollGrilla(-1)" style="background:var(--surf2);border:1px solid var(--brd);border-radius:6px;padding:4px 12px;cursor:pointer;font-size:14px;color:var(--txt2)">◀</button>
          <button onclick="_scrollGrilla(1)"  style="background:var(--surf2);border:1px solid var(--brd);border-radius:6px;padding:4px 12px;cursor:pointer;font-size:14px;color:var(--txt2)">▶</button>
        </div>
      </div>
      <div id="grilla-notas-wrap" style="overflow-x:auto">
        <table class="grilla-notas" style="table-layout:auto">
          <thead>
            <tr>
              <th style="text-align:left;min-width:180px;position:sticky;left:0;z-index:2;background:var(--surf2)">Alumno</th>
              ${materias.map(m => {
                const cierre = cierresMap[m.id];
                const validado = !!cierre?.validado_at;
                const cerrado  = !!cierre?.cerrado_at;
                const headerBg = validado ? 'background:var(--verde-l)' : cerrado ? 'background:var(--amb-l)' : '';
                const icon = validado ? '✅ ' : cerrado ? '⏳ ' : '';
                return `
                  <th style="font-size:9px;width:75px;white-space:normal;line-height:1.3;cursor:pointer;vertical-align:top;padding:4px 2px;${headerBg}"
                    onclick="verGrillaMateriaPreceptor('${cursoId}','${m.id}','${_escCal(m.nombre)}','${PERIODO_SEL}','${nivel}')">
                    ${icon}${m.nombre}
                    ${isPrecep && cerrado && !validado ? `
                      <div style="margin-top:4px">
                        <button onclick="event.stopPropagation();validarCierreMateria('${cursoId}','${m.id}','${PERIODO_SEL}','${_escCal(m.nombre)}')"
                          style="font-size:8px;padding:2px 5px;background:var(--ambar);color:white;border:none;border-radius:3px;cursor:pointer;white-space:nowrap">
                          ✓ Validar
                        </button>
                      </div>` : ''}
                  </th>`;
              }).join('')}
            </tr>
          </thead>
          <tbody>
            ${alumnos.map(al => {
              const _nMin = CONFIG_NOTAS[nivel]?.nota_minima ?? 7;
              const desap = materias.filter(m => {
                const p = promediosMap[al.id]?.[m.id];
                return p !== null && p !== undefined && Math.round(p) < _nMin;
              }).length;
              const filaClass = desap >= 3 ? 'fila-riesgo' : desap === 2 ? 'fila-obs' : '';
              return `
                <tr class="${filaClass}">
                  <td style="font-size:11px;font-weight:500;cursor:pointer;white-space:nowrap;position:sticky;left:0;z-index:1;background:var(--bg);box-shadow:2px 0 4px rgba(0,0,0,.06)"
                    onclick="verAlumnoNotas('${al.id}','${cursoId}',null,'${PERIODO_SEL}')">
                    ${al.apellido}, ${al.nombre}
                  </td>
                  ${materias.map(m => {
                    const prom = promediosMap[al.id]?.[m.id];
                    if (prom === null || prom === undefined) return `<td><span class="grilla-nd">—</span></td>`;
                    return `
                      <td>
                        <span style="display:inline-block;min-width:28px;padding:2px 4px;border-radius:5px;
                          font-size:11px;font-weight:700;text-align:center;
                          background:${NOTA_BG(Math.round(prom))};color:${NOTA_COLOR(Math.round(prom))}">
                          ${Math.round(prom)}
                        </span>
                      </td>`;
                  }).join('')}
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div></div>`}`;
  };

  window.cambioPeriodoDir = async (pid) => {
    PERIODO_SEL = pid;
    _modoIntensif = null;
    document.getElementById('contenido-calif-dir').innerHTML = await renderGrilla();
    inyectarEstilosNotas();
  };

  window.cambioIntensifDir = async (pid) => {
    _modoIntensif = pid;
    document.getElementById('contenido-calif-dir').innerHTML = await renderGrilla();
    inyectarEstilosNotas();
  };

  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <button onclick="rNotasDirectivo()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--txt2)">←</button>
      <div>
        <div class="pg-t">${curso?.nombre}${curso?.division} · Calificaciones</div>
        <div class="pg-s">${nivel} · Solo lectura</div>
      </div>
    </div>
    <div id="contenido-calif-dir">${await renderGrilla()}</div>`;
}

// ═══════════════════════════════════════════════════════
// EOE
// ═══════════════════════════════════════════════════════
async function rNotasEOE() {
  const c      = document.getElementById('page-notas');
  const instId = USUARIO_ACTUAL.institucion_id;

  const { data: alertas } = await sb.from('alertas_academicas')
    .select('*, alumnos(nombre,apellido,curso_id,cursos(nombre,division,nivel)), materias(nombre)')
    .eq('institucion_id', instId)
    .order('created_at', { ascending: false }).limit(40);

  const labels = {
    nota_baja:           '⚠️ Nota baja',
    promedio_bajo:       '📉 Promedio bajo',
    riesgo_academico:    '🔴 Riesgo académico',
    multiples_reprobadas:'🚨 Múltiples reprobadas',
  };

  c.innerHTML = `
    <div class="pg-t">Calificaciones</div>
    <div class="pg-s">Alertas académicas</div>
    ${!(alertas?.length)
      ? '<div class="empty-state">✅ Sin alertas académicas activas</div>'
      : alertas.map(a => {
          const al    = a.alumnos;
          const cu    = al?.cursos;
          const color = ['riesgo_academico','multiples_reprobadas'].includes(a.tipo_alerta)
            ? 'var(--rojo)' : 'var(--ambar)';
          return `
            <div class="card" id="alerta-ac-${a.id}" style="margin-bottom:8px;padding:12px 14px;border-left:3px solid ${color}">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;cursor:pointer" onclick="verAlumnoNotas('${al?.id}',null,null,null)">
                <div>
                  <div style="font-size:12px;font-weight:600">${al?.apellido}, ${al?.nombre}</div>
                  <div style="font-size:10px;color:var(--txt2)">${cu?.nombre}${cu?.division} · ${cu?.nivel}</div>
                </div>
                <span class="tag ${color === 'var(--rojo)' ? 'tr' : 'ta'}">${labels[a.tipo_alerta] || a.tipo_alerta}</span>
              </div>
              <div style="font-size:10px;color:var(--txt2);margin-top:4px">
                ${a.detalle || ''} · ${formatFechaLatam(a.fecha)}
              </div>
              ${USUARIO_ACTUAL.rol === 'eoe' ? `
              <div style="margin-top:8px;border-top:1px solid var(--brd);padding-top:8px">
                <button class="btn-s" style="font-size:11px" onclick="event.stopPropagation();_resolverAlertaAcad('${a.id}',this)">✓ Resolver</button>
              </div>` : ''}
            </div>`;
        }).join('')}`;
}

// ═══════════════════════════════════════════════════════
// VER ALUMNO
// ═══════════════════════════════════════════════════════
async function verAlumnoNotas(alumnoId, cursoId, materiaId, periodoId) {
  const c = document.getElementById('page-notas');
  showLoading('notas');

  const { data: al } = await sb.from('alumnos')
    .select('*, cursos(nombre,division,nivel)').eq('id', alumnoId).single();

  let query = sb.from('calificaciones')
    .select('*, instancias_evaluativas(nombre,fecha,tipos_instancia_evaluativa(nombre,es_recuperatorio)), materias(nombre)')
    .eq('alumno_id', alumnoId);
  if (periodoId) query = query.eq('periodo_id', periodoId);

  const { data: califs } = await query.order('materias(nombre)');

  const porMateria = {};
  (califs || []).forEach(c => {
    const mat = c.materias?.nombre || 'Sin materia';
    if (!porMateria[mat]) porMateria[mat] = { notas:[], matId: c.materia_id };
    porMateria[mat].notas.push(c);
  });

  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <button onclick="rNotas()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--txt2)">←</button>
      <div>
        <div class="pg-t">${al?.apellido}, ${al?.nombre}</div>
        <div class="pg-s">${al?.cursos?.nombre}${al?.cursos?.division} · ${al?.cursos?.nivel}</div>
      </div>
    </div>

    ${!Object.keys(porMateria).length
      ? '<div class="empty-state">Sin calificaciones registradas</div>'
      : Object.entries(porMateria).map(([materia, { notas }]) => {
          const vals = notas.filter(n => !n.ausente && n.nota !== null &&
            !n.instancias_evaluativas?.tipos_instancia_evaluativa?.es_recuperatorio).map(n => n.nota);
          const prom = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
          return `
            <div class="card" style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <div style="font-size:13px;font-weight:700">${materia}</div>
                ${prom !== null
                  ? `<span style="font-size:18px;font-weight:700;color:${NOTA_COLOR(Math.round(prom))}">${Math.round(prom)}</span>`
                  : '<span style="color:var(--txt3);font-size:12px">Sin promedio</span>'}
              </div>
              ${notas.map(n => {
                const inst = n.instancias_evaluativas;
                const esR  = inst?.tipos_instancia_evaluativa?.es_recuperatorio;
                return `
                  <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--brd)">
                    <div style="flex:1">
                      <div style="font-size:11px;font-weight:500">
                        ${inst?.tipos_instancia_evaluativa?.nombre || '—'} · ${inst?.nombre || ''}
                        ${esR ? '<span class="tag tp" style="font-size:9px;margin-left:4px">Recup.</span>' : ''}
                      </div>
                      <div style="font-size:10px;color:var(--txt2)">${formatFechaLatam(inst?.fecha)}</div>
                    </div>
                    ${n.ausente
                      ? '<span class="tag tgr">Ausente</span>'
                      : n.nota !== null
                        ? `<span style="font-size:15px;font-weight:700;color:${NOTA_COLOR(n.nota)}">${n.nota % 1 === 0 ? n.nota : n.nota.toFixed(1)}</span>`
                        : '<span style="color:var(--txt3)">—</span>'}
                  </div>`;
              }).join('')}
            </div>`;
        }).join('')}`;
}

// ═══════════════════════════════════════════════════════
// ALERTAS ACADÉMICAS
// ═══════════════════════════════════════════════════════
async function verificarAlertasAcademicas(alumnoId, cursoId, materiaId, periodoId) {
  const instId  = USUARIO_ACTUAL.institucion_id;
  const notaMin = 7;

  // Notas de esta materia y período
  const { data: califs } = await sb.from('calificaciones')
    .select('nota, ausente, instancias_evaluativas(es_recuperatorio)')
    .eq('alumno_id', alumnoId).eq('materia_id', materiaId).eq('periodo_id', periodoId);

  const notas = (califs || []).filter(c => !c.ausente && c.nota !== null && !c.instancias_evaluativas?.es_recuperatorio).map(c => c.nota);
  const prom  = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
  const ultNota = (califs || []).filter(c => !c.ausente && c.nota !== null).slice(-1)[0]?.nota;

  if (ultNota !== undefined && ultNota < notaMin) {
    await insertAlertaAcad(instId, alumnoId, cursoId, materiaId, 'nota_baja', `Nota: ${ultNota}`);
  }
  if (prom !== null && prom < notaMin) {
    await insertAlertaAcad(instId, alumnoId, cursoId, materiaId, 'promedio_bajo', `Promedio: ${Math.round(prom)}`);
  }

  const { data: todasCalifs } = await sb.from('calificaciones')
    .select('materia_id, nota, ausente')
    .eq('alumno_id', alumnoId).eq('periodo_id', periodoId).eq('curso_id', cursoId);

  const materiasBajas = [...new Set(
    (todasCalifs || []).filter(c => !c.ausente && c.nota !== null && c.nota < notaMin)
      .map(c => c.materia_id)
  )];
  if (materiasBajas.length >= 2) {
    await insertAlertaAcad(instId, alumnoId, cursoId, null,
      'multiples_reprobadas', `${materiasBajas.length} materias con nota baja`);
  }
}

async function insertAlertaAcad(instId, alumnoId, cursoId, materiaId, tipo, detalle) {
  const { data: existe } = await sb.from('alertas_academicas')
    .select('id').eq('alumno_id', alumnoId).eq('tipo_alerta', tipo)
    .eq('materia_id', materiaId || null).maybeSingle();
  if (existe) return;
  await sb.from('alertas_academicas').insert({
    institucion_id: instId,
    alumno_id:      alumnoId,
    curso_id:       cursoId,
    materia_id:     materiaId,
    tipo_alerta:    tipo,
    detalle,
  });
}

// ═══════════════════════════════════════════════════════
// PRIMARIA / INICIAL — GRILLA DE GRADO
// --- MODO: docente-grado-primaria (editable=true) ---
// --- MODO: preceptor-readonly-primaria (editable=false) ---
// --- MODO: directivo-readonly-primaria (editable=false) ---
// ═══════════════════════════════════════════════════════

async function verNotasPrimariaGrado(cursoId, nivel, nombreCurso, editable = true) {
  const c      = document.getElementById('page-notas');
  const instId = USUARIO_ACTUAL.institucion_id;
  showLoading('notas');

  const periodosCurso = PERIODOS.filter(p => p.nivel === nivel).sort((a,b) => (a.nombre||'').localeCompare(b.nombre||''));
  const hoy = new Date();
  const periodoActual = periodosCurso.find(p =>
    new Date(p.fecha_inicio) <= hoy && hoy <= new Date(p.fecha_fin)
  ) || periodosCurso[0];
  let PERIODO_SEL = periodoActual?.id || '';

  // Detección de escala: inicial y ciclo 1 (1°-3°) siempre conceptual
  const esCiclo1   = nivel === 'inicial' || _esPrimerCiclo(nombreCurso);
  const escalaConc = CONFIG_NOTAS[nivel]?.escala_conceptual_valores || ['MB', 'B', 'R', 'I'];
  const escala2    = CONFIG_NOTAS[nivel]?.escala || 'numerica';
  const usaConc    = esCiclo1 || escala2 === 'conceptual';

  const cargarVista = async () => {
    const [alumnosRes, materiasRes, instContRes] = await Promise.all([
      sb.from('alumnos').select('id,nombre,apellido')
        .eq('curso_id', cursoId).eq('activo', true).order('apellido'),
      sb.from('materias').select('id,nombre')
        .eq('institucion_id', instId).eq('nivel', nivel)
        .eq('tipo', 'comun').eq('activo', true).order('nombre'),
      PERIODO_SEL
        ? sb.from('instancias_calificacion').select('alumno_id,materia_id')
            .eq('curso_id', cursoId).eq('periodo_id', PERIODO_SEL)
        : Promise.resolve({ data: [] }),
    ]);
    const alumnos  = alumnosRes.data || [];
    const materias = materiasRes.data || [];

    const instCounts = {};
    (instContRes.data || []).forEach(r => {
      const k = `${r.alumno_id}:${r.materia_id}`;
      instCounts[k] = (instCounts[k] || 0) + 1;
    });

    // Calificaciones sin instancia (formato primaria: una nota por alumno × materia × período)
    let califData = [];
    if (PERIODO_SEL) {
      const { data } = await sb.from('calificaciones').select('*')
        .eq('curso_id', cursoId).eq('periodo_id', PERIODO_SEL).is('instancia_id', null);
      califData = data || [];
    }

    // Índice: "alumnoId:materiaId" → row; "alumnoId:prom" → fila de promedio (materia_id null)
    const cIdx = {};
    califData.forEach(r => {
      const k = r.materia_id ? `${r.alumno_id}:${r.materia_id}` : `${r.alumno_id}:prom`;
      cIdx[k] = r;
    });

    window._pGcIdx       = cIdx;
    window._pGalumnos    = alumnos;
    window._pGmaterias   = materias;
    window._pGcursoId    = cursoId;
    window._pGperiodo    = PERIODO_SEL;
    window._pGinstId     = instId;
    window._pGusaConc    = usaConc;
    window._pGescala     = escalaConc;
    window._pGinstCounts = instCounts;

    // Valor actual de la celda (desde DB)
    const getCellVal = (aId, mId) => {
      const r = cIdx[`${aId}:${mId}`];
      if (!r) return '';
      return usaConc ? (r.promedio_concepto_manual || '') : (r.nota != null ? String(r.nota) : '');
    };

    // Promedio calculado: modal (conceptual) o media aritmética (numérica)
    const calcProm = (aId) => {
      const vals = materias.map(m => {
        const r = cIdx[`${aId}:${m.id}`];
        if (!r) return null;
        return usaConc ? (r.promedio_concepto_manual || null) : (r.nota != null ? r.nota : null);
      }).filter(v => v !== null && v !== '');
      if (!vals.length) return null;
      if (usaConc) {
        const cnt = {};
        vals.forEach(v => cnt[v] = (cnt[v] || 0) + 1);
        const maxCnt = Math.max(...Object.values(cnt));
        // Priorizar el valor más alto en la escala (índice más bajo = más alto)
        return escalaConc.find(v => cnt[v] === maxCnt) || null;
      }
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };

    const mkSelect = (id, cur) => `
      <select id="${id}" class="sel-prim-grade"
        style="font-size:10px;border:1.5px solid var(--brd);border-radius:4px;
          padding:2px 2px;background:var(--surf);width:50px;cursor:pointer">
        <option value="">—</option>
        ${escalaConc.map(v => `<option value="${v}" ${cur === v ? 'selected' : ''}>${v}</option>`).join('')}
      </select>`;

    const mkNumber = (id, cur) => `
      <input type="number" id="${id}" value="${cur}" min="1" max="10" step="0.5" placeholder="—"
        style="width:44px;text-align:center;border:1.5px solid var(--brd);border-radius:4px;
          padding:2px 3px;font-size:11px;font-weight:700;background:var(--surf)">`;

    const mkCell = (al, m, cur, count) => {
      const clr = cur
        ? (usaConc ? 'var(--txt)' : NOTA_COLOR(parseFloat(cur), nivel, nombreCurso))
        : 'var(--txt3)';
      const badge = count > 0
        ? `<div style="font-size:8px;color:var(--txt3);line-height:1.4">${count} eval.</div>`
        : '';
      const icon    = editable ? '✏' : '▸';
      const iconClr = editable ? 'var(--verde)' : 'var(--azul)';
      return `
        <div style="text-align:center;cursor:pointer;padding:2px"
          onclick="abrirPanelInstancias('${al.id}','${m.id}','${cursoId}','${PERIODO_SEL}',${editable})">
          <span style="font-size:12px;font-weight:700;color:${clr}">${cur || '—'}</span>
          ${badge}
          <div style="font-size:9px;color:${iconClr};margin-top:1px">${icon}</div>
        </div>`;
    };

    const mkPromEditor = (aId, promFinal) => `
      <button onclick="_editarPromPrimG('${aId}')"
        style="background:none;border:none;cursor:pointer;font-size:11px;
          color:var(--txt3);padding:0;line-height:1" title="Editar promedio">✏️</button>
      <div id="prom-ed-${aId}" style="display:none;margin-top:3px">
        ${usaConc
          ? mkSelect(`pg-prom-${aId}`, typeof promFinal === 'string' ? promFinal : '')
          : `<input type="number" id="pg-prom-${aId}" min="1" max="10" step="0.5"
              value="${typeof promFinal === 'number' ? promFinal : ''}"
              style="width:44px;text-align:center;border:1.5px solid var(--ambar);
                border-radius:4px;padding:2px;font-size:11px;font-weight:700">`}
      </div>`;

    return `
      <div class="periodo-tabs">
        ${periodosCurso.length
          ? periodosCurso.map(p => `
            <button class="periodo-tab ${PERIODO_SEL === p.id ? 'on' : ''}"
              onclick="cambioPeriodoPrimG('${p.id}')">
              ${p.nombre}
            </button>`).join('')
          : '<div style="font-size:11px;color:var(--txt3)">Sin períodos configurados</div>'}
      </div>

      ${editable ? `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <button class="btn-p" id="btn-guardar-prim" onclick="guardarNotasPrimariaGrado()">💾 Guardar promedios</button>
        ${PERIODO_SEL ? `<button class="btn-s" onclick="abrirCargaMasivaMateria('${cursoId}','${PERIODO_SEL}')">📝 Cargar por materia</button>` : ''}
        <span style="font-size:10px;color:var(--txt3)">Los cambios no guardados se perderán</span>
      </div>` : `
      <div style="background:var(--azul-l);border-left:4px solid var(--azul);border-radius:var(--rad);
        padding:8px 14px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
        <span style="font-size:16px">👁️</span>
        <span style="font-size:11px;font-weight:600;color:var(--azul)">Solo lectura</span>
      </div>`}

      ${!PERIODO_SEL
        ? '<div class="empty-state">Sin períodos configurados para este nivel.</div>'
        : !materias.length
          ? '<div class="empty-state">Sin materias comunes configuradas para este nivel.</div>'
          : !alumnos.length
            ? '<div class="empty-state">Sin alumnos activos en el curso.</div>'
            : `<div style="display:flex;justify-content:flex-end;gap:4px;margin-bottom:6px">
          <button onclick="_scrollGrilla(-1)" style="background:var(--surf2);border:1px solid var(--brd);border-radius:6px;padding:4px 12px;cursor:pointer;font-size:14px;color:var(--txt2)">◀</button>
          <button onclick="_scrollGrilla(1)"  style="background:var(--surf2);border:1px solid var(--brd);border-radius:6px;padding:4px 12px;cursor:pointer;font-size:14px;color:var(--txt2)">▶</button>
        </div>
        <div id="grilla-notas-wrap" style="overflow-x:auto">
        <table class="grilla-notas" style="table-layout:auto">
          <thead>
            <tr>
              <th style="text-align:left;min-width:150px;position:sticky;left:0;z-index:2;background:var(--surf2)">Alumno</th>
              ${materias.map(m => `
                <th style="font-size:9px;max-width:58px;white-space:normal;line-height:1.3;padding:5px 3px">
                  ${m.nombre}
                </th>`).join('')}
              <th style="background:var(--azul-l);color:var(--azul);font-size:9px;min-width:60px">PROMEDIO</th>
            </tr>
          </thead>
          <tbody>
            ${alumnos.map(al => {
              const promCalc    = calcProm(al.id);
              const promRow     = cIdx[`${al.id}:prom`];
              const promEditado = promRow?.promedio_editado;
              const promFinal   = promEditado
                ? (usaConc ? promRow.promedio_concepto_manual : promRow.promedio_manual)
                : promCalc;
              const promTxt     = promFinal !== null && promFinal !== undefined
                ? (typeof promFinal === 'number' ? String(Math.round(promFinal)) : String(promFinal))
                : null;

              return `
                <tr>
                  <td style="font-size:11px;font-weight:500;white-space:nowrap;position:sticky;
                    left:0;background:var(--bg);box-shadow:2px 0 3px rgba(0,0,0,.06)">
                    ${al.apellido}, ${al.nombre}
                  </td>
                  ${materias.map(m => `
                    <td style="text-align:center;padding:4px 3px">
                      ${mkCell(al, m, getCellVal(al.id, m.id), instCounts[`${al.id}:${m.id}`] || 0)}
                    </td>`).join('')}
                  <td style="background:var(--azul-l);text-align:center;padding:4px 3px">
                    ${promTxt
                      ? `<div>
                          <span style="font-size:12px;font-weight:700;
                            color:${promEditado ? 'var(--ambar)' : 'var(--azul)'}">
                            ${promTxt}
                          </span>
                          ${promEditado ? '<div style="font-size:8px;color:var(--ambar)">(manual)</div>' : ''}
                          ${editable ? mkPromEditor(al.id, promFinal) : ''}
                        </div>`
                      : (editable
                          ? `<div><span class="grilla-nd">—</span>${mkPromEditor(al.id, null)}</div>`
                          : '<span class="grilla-nd">—</span>')}
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div></div>
      ${editable ? `
      <button class="btn-p" style="width:100%;margin-top:14px"
        onclick="guardarNotasPrimariaGrado()">💾 Guardar promedios</button>` : ''}`}`;
  };

  window.cambioPeriodoPrimG = async (pid) => {
    PERIODO_SEL = pid;
    document.getElementById('contenido-prim-g').innerHTML = await cargarVista();
    inyectarEstilosNotas();
  };

  const volverFn = editable ? 'rNotasDocente' : 'rNotasDirectivo';

  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <button onclick="${volverFn}()" style="background:none;border:none;font-size:20px;
        cursor:pointer;color:var(--txt2)">←</button>
      <div>
        <div class="pg-t">${nombreCurso}</div>
        <div class="pg-s">Calificaciones · ${usaConc ? 'Conceptual' : 'Numérica'} · ${nivel}</div>
      </div>
    </div>
    <div id="contenido-prim-g">${await cargarVista()}</div>`;
}

function _editarPromPrimG(alumnoId) {
  const ed = document.getElementById(`prom-ed-${alumnoId}`);
  if (ed) ed.style.display = ed.style.display === 'none' ? 'block' : 'none';
}

async function guardarNotasPrimariaGrado() {
  const btn = document.getElementById('btn-guardar-prim');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  const alumnos   = window._pGalumnos || [];
  const cIdx      = window._pGcIdx    || {};
  const cursoId   = window._pGcursoId;
  const periodoId = window._pGperiodo;
  const instId    = window._pGinstId;
  const usaConc   = window._pGusaConc;

  let errors = 0;

  for (const al of alumnos) {
    const promEl = document.getElementById(`pg-prom-${al.id}`);
    if (!promEl || !promEl.value) continue;

    const promRow   = cIdx[`${al.id}:prom`];
    const promDatos = {
      institucion_id:   instId,
      alumno_id:        al.id,
      materia_id:       null,
      curso_id:         cursoId,
      periodo_id:       periodoId,
      instancia_id:     null,
      promedio_editado: true,
      registrado_por:   USUARIO_ACTUAL.id,
    };
    if (usaConc) {
      promDatos.promedio_concepto_manual = promEl.value;
    } else {
      const num = parseFloat(promEl.value);
      promDatos.promedio_manual = isNaN(num) ? null : num;
    }
    if (promRow?.id) {
      const { error } = await sb.from('calificaciones').update(promDatos).eq('id', promRow.id);
      if (error) { errors++; console.error('Error guardando promedio:', error.message); }
    } else {
      const { error: promErr } = await sb.from('calificaciones').insert([promDatos]);
      if (promErr) console.warn('Promedio no guardado (constraint DB):', promErr.message);
    }
  }

  if (errors) alert(`${errors} promedio(s) no se pudo guardar. Revisá la conexión y reintentá.`);

  await window.cambioPeriodoPrimG?.(periodoId);
  if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar promedios'; }
}

// ═══════════════════════════════════════════════════════
// PANEL DE INSTANCIAS EVALUATIVAS (PRIMARIA / INICIAL)
// ═══════════════════════════════════════════════════════

async function _fetchTiposInstancia() {
  if (window._tiposInstanciaCache) return window._tiposInstanciaCache;
  const { data } = await sb.from('tipos_instancia_evaluativa')
    .select('nombre')
    .eq('institucion_id', INSTITUCION_ACTUAL.id)
    .eq('activo', true)
    .order('created_at');
  window._tiposInstanciaCache = data || [];
  return window._tiposInstanciaCache;
}

function _onTipoChange(sel) {
  const wrap  = sel.closest('.panel-inst-nombre-wrap');
  const libre = wrap?.querySelector('.panel-inst-nombre-libre');
  const back  = wrap?.querySelector('.panel-inst-nombre-back');
  if (!libre) return;
  if (sel.value === '__otro__') {
    sel.style.display = 'none';
    if (back) back.style.display = '';
    libre.style.display = '';
    libre.focus();
  } else {
    sel.style.display = '';
    if (back) back.style.display = 'none';
    libre.style.display = 'none';
    libre.value = '';
  }
}

function _resetTipoOtro(btn) {
  const wrap  = btn.closest('.panel-inst-nombre-wrap');
  const sel   = wrap?.querySelector('.panel-inst-tipo');
  const libre = wrap?.querySelector('.panel-inst-nombre-libre');
  if (!sel || !libre) return;
  sel.value = '';
  sel.style.display = '';
  libre.style.display = 'none';
  libre.value = '';
  btn.style.display = 'none';
}

function _getNombreDeRow(row) {
  const tipo = row.querySelector('.panel-inst-tipo');
  if (tipo) {
    if (tipo.value === '__otro__') return row.querySelector('.panel-inst-nombre-libre')?.value?.trim() || '';
    return tipo.value;
  }
  return row.querySelector('.panel-inst-nombre')?.value?.trim() || '';
}

async function abrirPanelInstancias(alumnoId, materiaId, cursoId, periodoId, editable) {
  const al = (window._pGalumnos  || []).find(a => a.id === alumnoId);
  const m  = (window._pGmaterias || []).find(x => x.id === materiaId);
  const nombreAlumno  = al ? `${al.apellido}, ${al.nombre}` : '';
  const nombreMateria = m?.nombre || '';
  const periodoNombre = PERIODOS.find(p => p.id === periodoId)?.nombre || '';
  const usaConc    = window._pGusaConc;
  const escalaConc = window._pGescala || ['MB', 'B', 'R', 'I'];

  const [instRes, notaFinalRes] = await Promise.all([
    sb.from('instancias_calificacion').select('*')
      .eq('alumno_id', alumnoId).eq('materia_id', materiaId)
      .eq('curso_id', cursoId).eq('periodo_id', periodoId)
      .order('created_at'),
    sb.from('calificaciones').select('*')
      .eq('alumno_id', alumnoId).eq('materia_id', materiaId)
      .eq('curso_id', cursoId).eq('periodo_id', periodoId)
      .is('instancia_id', null).maybeSingle(),
  ]);

  const tiposInst = await _fetchTiposInstancia();

  window._panelInst        = (instRes.data || []).map(i => ({ ...i }));
  window._panelMeta        = { alumnoId, materiaId, cursoId, periodoId, usaConc, escalaConc };
  window._panelNotaFinalRow = notaFinalRes.data;

  const notaFinalActual = notaFinalRes.data
    ? (usaConc ? notaFinalRes.data.promedio_concepto_manual : notaFinalRes.data.nota)
    : null;
  const promSugerido = _calcPromSugerido(window._panelInst, usaConc, escalaConc);

  const mkNombreControl = (val) => {
    if (!tiposInst.length) {
      return `<input type="text" class="panel-inst-nombre" value="${(val||'').replace(/"/g,'&quot;')}" placeholder="Ej: Evaluación escrita" style="flex:1;border:1.5px solid var(--brd);border-radius:6px;padding:5px 8px;font-size:12px;background:var(--surf)">`;
    }
    const isOtro = val && !tiposInst.find(t => t.nombre === val);
    return `<div class="panel-inst-nombre-wrap" style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
      <select class="panel-inst-tipo" onchange="_onTipoChange(this)" style="display:${isOtro ? 'none' : ''};border:1.5px solid var(--brd);border-radius:6px;padding:5px 8px;font-size:12px;background:var(--surf);width:100%">
        <option value="">— Tipo —</option>
        ${tiposInst.map(t => `<option value="${_esc(t.nombre)}"${t.nombre === val && !isOtro ? ' selected' : ''}>${_esc(t.nombre)}</option>`).join('')}
        <option value="__otro__"${isOtro ? ' selected' : ''}>Otro...</option>
      </select>
      <input type="text" class="panel-inst-nombre-libre" value="${isOtro ? _esc(val||'') : ''}" placeholder="Escribí el nombre..."
        style="display:${isOtro ? '' : 'none'};border:1.5px solid var(--brd);border-radius:6px;padding:5px 8px;font-size:12px;background:var(--surf);width:100%">
      <button type="button" class="panel-inst-nombre-back" onclick="_resetTipoOtro(this)"
        style="display:${isOtro ? '' : 'none'};font-size:9px;color:var(--txt2);background:none;border:none;cursor:pointer;padding:0;text-align:left;align-self:flex-start">← Cambiar tipo</button>
    </div>`;
  };

  const mkValorInput = (cls, val) => usaConc
    ? `<select class="${cls}" onchange="_actualizarPromSugerido()"
        style="flex-shrink:0;width:68px;border:1.5px solid var(--brd);border-radius:6px;padding:5px 4px;font-size:12px;background:var(--surf)">
        <option value="">—</option>
        ${escalaConc.map(v => `<option value="${v}" ${(val || '') === v ? 'selected' : ''}>${v}</option>`).join('')}
       </select>`
    : `<input type="number" class="${cls}" value="${val || ''}" min="1" max="10" step="1"
        oninput="_actualizarPromSugerido()"
        style="flex-shrink:0;width:56px;text-align:center;border:1.5px solid var(--brd);border-radius:6px;padding:5px;font-size:12px;font-weight:700;background:var(--surf)">`;

  const mkNotaFinalInput = (val) => usaConc
    ? `<select id="panel-nota-final"
        style="border:1.5px solid var(--verde);border-radius:6px;padding:5px 8px;font-size:13px;font-weight:700;background:var(--surf)">
        <option value="">—</option>
        ${escalaConc.map(v => `<option value="${v}" ${(val || '') === v ? 'selected' : ''}>${v}</option>`).join('')}
       </select>`
    : `<input type="number" id="panel-nota-final" value="${val || ''}" min="1" max="10" step="0.5"
        style="width:68px;text-align:center;border:1.5px solid var(--verde);border-radius:6px;padding:6px;font-size:14px;font-weight:700;background:var(--surf)">`;

  const renderInstRow = (inst, idx) => editable ? `
    <div class="panel-inst-row" data-idx="${idx}"
      style="display:flex;align-items:flex-start;gap:8px;padding:10px;background:var(--surf2);border-radius:8px;margin-bottom:6px">
      ${mkNombreControl(inst.nombre || '')}
      ${mkValorInput('panel-inst-valor', usaConc ? inst.valor_conceptual : inst.valor_numerico)}
      <button onclick="_removeInstRow(${idx})"
        style="flex-shrink:0;background:none;border:none;cursor:pointer;color:var(--rojo);font-size:16px;padding:2px 4px;line-height:1;margin-top:2px">✕</button>
    </div>` : `
    <div style="display:flex;align-items:center;padding:9px 10px;background:var(--surf2);border-radius:8px;margin-bottom:6px">
      <span style="flex:1;font-size:11px;color:var(--txt)">${inst.nombre || '—'}</span>
      <span style="font-size:12px;font-weight:700">
        ${usaConc ? (inst.valor_conceptual || '—') : (inst.valor_numerico != null ? inst.valor_numerico : '—')}
      </span>
    </div>`;

  document.getElementById('panel-instancias')?.remove();
  const modal = document.createElement('div');
  modal.id = 'panel-instancias';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px`;
  modal.innerHTML = `
    <div style="background:var(--surf);border-radius:16px;width:100%;max-width:520px;max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.18)">
      <div style="padding:18px 20px 14px;border-bottom:1px solid var(--brd);display:flex;align-items:flex-start;justify-content:space-between">
        <div>
          <div style="font-size:15px;font-weight:700;font-family:'Lora',serif">${nombreAlumno}</div>
          <div style="font-size:11px;color:var(--txt2)">${nombreMateria} · ${periodoNombre}</div>
        </div>
        <button onclick="document.getElementById('panel-instancias').remove()"
          style="background:var(--surf2);border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:14px;color:var(--txt2);display:flex;align-items:center;justify-content:center">✕</button>
      </div>

      <div style="padding:16px 20px">
        ${editable
          ? `<button onclick="_addInstRow()" class="btn-s" style="width:100%;margin-bottom:12px;font-size:11px">+ Agregar instancia</button>`
          : `<div style="background:var(--azul-l);border-left:3px solid var(--azul);border-radius:var(--rad);padding:8px 12px;margin-bottom:12px;font-size:11px;color:var(--azul);font-weight:600">👁 Solo lectura</div>`}

        <div id="panel-inst-rows">
          ${window._panelInst.length
            ? window._panelInst.map((inst, idx) => renderInstRow(inst, idx)).join('')
            : `<div style="text-align:center;color:var(--txt3);font-size:11px;padding:20px 0">Sin instancias cargadas${editable ? ' · Agregá una arriba' : ''}</div>`}
        </div>

        <div style="border-top:1px solid var(--brd);margin:14px 0;padding-top:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <span style="font-size:11px;color:var(--txt2)">Promedio sugerido</span>
            <span id="panel-prom-sug" style="font-size:13px;font-weight:700;color:var(--azul)">
              ${promSugerido != null ? promSugerido : '—'}
            </span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:11px;font-weight:600">Nota final de boletín</span>
            ${editable
              ? mkNotaFinalInput(notaFinalActual)
              : `<span style="font-size:14px;font-weight:700">${notaFinalActual || '—'}</span>`}
          </div>
        </div>

        ${editable ? `
        <div style="display:flex;gap:8px;margin-top:4px">
          <button onclick="guardarPanelInstancias('${alumnoId}','${materiaId}','${cursoId}','${periodoId}')"
            class="btn-p" style="flex:1">Guardar</button>
          <button onclick="document.getElementById('panel-instancias').remove()" class="btn-s">Cancelar</button>
        </div>` : `
        <button onclick="document.getElementById('panel-instancias').remove()" class="btn-s" style="width:100%">Cerrar</button>`}
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function _addInstRow() {
  const meta      = window._panelMeta;
  const container = document.getElementById('panel-inst-rows');
  if (!container || !meta) return;

  const idx        = window._panelInst.length;
  const escalaConc = meta.escalaConc;
  const tiposInst  = window._tiposInstanciaCache || [];
  window._panelInst.push({ id: null, nombre: '', valor_numerico: null, valor_conceptual: null });

  const mkVal = () => meta.usaConc
    ? `<select class="panel-inst-valor" onchange="_actualizarPromSugerido()"
        style="flex-shrink:0;width:68px;border:1.5px solid var(--brd);border-radius:6px;padding:5px 4px;font-size:12px;background:var(--surf)">
        <option value="">—</option>
        ${escalaConc.map(v => `<option value="${v}">${v}</option>`).join('')}
       </select>`
    : `<input type="number" class="panel-inst-valor" min="1" max="10" step="1"
        oninput="_actualizarPromSugerido()"
        style="flex-shrink:0;width:56px;text-align:center;border:1.5px solid var(--brd);border-radius:6px;padding:5px;font-size:12px;font-weight:700;background:var(--surf)">`;

  const mkNombre = () => {
    if (!tiposInst.length) {
      return `<input type="text" class="panel-inst-nombre" value="" placeholder="Ej: Evaluación escrita"
        style="flex:1;border:1.5px solid var(--brd);border-radius:6px;padding:5px 8px;font-size:12px;background:var(--surf)">`;
    }
    return `<div class="panel-inst-nombre-wrap" style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
      <select class="panel-inst-tipo" onchange="_onTipoChange(this)" style="border:1.5px solid var(--brd);border-radius:6px;padding:5px 8px;font-size:12px;background:var(--surf);width:100%">
        <option value="">— Tipo —</option>
        ${tiposInst.map(t => `<option value="${_esc(t.nombre)}">${_esc(t.nombre)}</option>`).join('')}
        <option value="__otro__">Otro...</option>
      </select>
      <input type="text" class="panel-inst-nombre-libre" value="" placeholder="Escribí el nombre..."
        style="display:none;border:1.5px solid var(--brd);border-radius:6px;padding:5px 8px;font-size:12px;background:var(--surf);width:100%">
      <button type="button" class="panel-inst-nombre-back" onclick="_resetTipoOtro(this)"
        style="display:none;font-size:9px;color:var(--txt2);background:none;border:none;cursor:pointer;padding:0;text-align:left;align-self:flex-start">← Cambiar tipo</button>
    </div>`;
  };

  if (container.querySelector('div:only-child')?.textContent?.includes('Sin instancias')) {
    container.innerHTML = '';
  }

  const row = document.createElement('div');
  row.className = 'panel-inst-row';
  row.dataset.idx = idx;
  row.style.cssText = 'display:flex;align-items:flex-start;gap:8px;padding:10px;background:var(--surf2);border-radius:8px;margin-bottom:6px';
  row.innerHTML = `
    ${mkNombre()}
    ${mkVal()}
    <button onclick="_removeInstRow(${idx})"
      style="flex-shrink:0;background:none;border:none;cursor:pointer;color:var(--rojo);font-size:16px;padding:2px 4px;line-height:1;margin-top:2px">✕</button>`;
  container.appendChild(row);
}

function _removeInstRow(idx) {
  const row = document.querySelector(`.panel-inst-row[data-idx="${idx}"]`);
  if (row) row.remove();
  if (window._panelInst[idx]) window._panelInst[idx]._deleted = true;
  _actualizarPromSugerido();
  const container = document.getElementById('panel-inst-rows');
  if (container && !container.querySelector('.panel-inst-row')) {
    container.innerHTML = `<div style="text-align:center;color:var(--txt3);font-size:11px;padding:20px 0">Sin instancias · Agregá una arriba</div>`;
  }
}

function _calcPromSugerido(instancias, usaConc, escalaConc) {
  const vals = instancias
    .filter(i => !i._deleted)
    .map(i => usaConc ? i.valor_conceptual : i.valor_numerico)
    .filter(v => v !== null && v !== '' && v !== undefined);
  if (!vals.length) return null;
  if (usaConc) {
    const cnt = {};
    vals.forEach(v => cnt[v] = (cnt[v] || 0) + 1);
    const maxCnt = Math.max(...Object.values(cnt));
    return escalaConc.find(v => cnt[v] === maxCnt) || null;
  }
  const nums = vals.map(v => parseFloat(v)).filter(v => !isNaN(v));
  if (!nums.length) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length * 10) / 10;
}

function _actualizarPromSugerido() {
  const meta = window._panelMeta;
  if (!meta) return;
  const rows = document.querySelectorAll('.panel-inst-row');
  const insts = [...rows].map(row => {
    const valor = row.querySelector('.panel-inst-valor')?.value || '';
    return meta.usaConc
      ? { valor_conceptual: valor || null }
      : { valor_numerico: valor !== '' ? parseFloat(valor) : null };
  });
  const prom = _calcPromSugerido(insts, meta.usaConc, meta.escalaConc);
  const el = document.getElementById('panel-prom-sug');
  if (el) el.textContent = prom !== null ? String(prom) : '—';
  const nfEl = document.getElementById('panel-nota-final');
  if (nfEl && prom !== null && !nfEl.dataset.manual) nfEl.value = String(prom);
}

async function guardarPanelInstancias(alumnoId, materiaId, cursoId, periodoId) {
  const saveBtn = document.querySelector('#panel-instancias .btn-p');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando...'; }

  const meta   = window._panelMeta;
  const instId = USUARIO_ACTUAL.institucion_id;
  const rows   = document.querySelectorAll('.panel-inst-row');

  const toSave   = [];
  const toDelete = (window._panelInst || []).filter(i => i._deleted && i.id).map(i => i.id);

  [...rows].forEach(row => {
    const idx    = parseInt(row.dataset.idx);
    const orig   = window._panelInst[idx] || {};
    const nombre = _getNombreDeRow(row);
    const valor  = row.querySelector('.panel-inst-valor')?.value;
    if (!nombre) return;
    const entry = {
      alumno_id:        alumnoId,
      materia_id:       materiaId,
      curso_id:         cursoId,
      periodo_id:       periodoId,
      institucion_id:   instId,
      nombre,
      valor_numerico:   meta.usaConc ? null : (valor ? Math.round(parseFloat(valor)) : null),
      valor_conceptual: meta.usaConc ? (valor || null) : null,
    };
    if (orig.id) entry._id = orig.id;
    toSave.push(entry);
  });

  let errors = 0;

  if (toDelete.length) {
    const { error } = await sb.from('instancias_calificacion').delete().in('id', toDelete);
    if (error) errors++;
  }

  for (const inst of toSave) {
    const { _id, ...data } = inst;
    const { error } = _id
      ? await sb.from('instancias_calificacion').update(data).eq('id', _id)
      : await sb.from('instancias_calificacion').insert([data]);
    if (error) { errors++; console.error('Error guardando instancia:', error.message); }
  }

  // Guardar nota final de boletín
  const notaFinalEl  = document.getElementById('panel-nota-final');
  const notaFinalVal = notaFinalEl?.value;
  if (notaFinalVal) {
    const cIdx     = window._pGcIdx || {};
    const existRow = cIdx[`${alumnoId}:${materiaId}`];
    const datos = {
      institucion_id: instId,
      alumno_id:      alumnoId,
      materia_id:     materiaId,
      curso_id:       cursoId,
      periodo_id:     periodoId,
      instancia_id:   null,
      registrado_por: USUARIO_ACTUAL.id,
    };
    if (meta.usaConc) {
      datos.promedio_concepto_manual = notaFinalVal;
      datos.nota = null;
    } else {
      datos.nota = parseFloat(notaFinalVal) || null;
    }
    const { error } = existRow?.id
      ? await sb.from('calificaciones').update(datos).eq('id', existRow.id)
      : await sb.from('calificaciones').insert([datos]);
    if (error) { errors++; console.error('Error guardando nota final:', error.message); }
  }

  if (errors) alert(`${errors} error(s) al guardar. Revisá la conexión.`);
  document.getElementById('panel-instancias')?.remove();
  await window.cambioPeriodoPrimG?.(periodoId);
}

// ─── CARGA MASIVA POR MATERIA (PRIMARIA/INICIAL) ──────

async function abrirCargaMasivaMateria(cursoId, periodoId) {
  if (!periodoId) { alert('No hay un período seleccionado para este nivel.'); return; }
  const materias   = window._pGmaterias || [];
  const alumnos    = window._pGalumnos  || [];
  const usaConc    = window._pGusaConc;
  const escalaConc = window._pGescala || ['MB', 'B', 'R', 'I'];
  const tiposInst  = await _fetchTiposInstancia();

  if (!materias.length) { alert('Sin materias configuradas.'); return; }

  const mkNombreControl = () => {
    if (!tiposInst.length) {
      return `<input type="text" id="cm-nombre" placeholder="Ej: Evaluación escrita"
        style="width:100%;border:1.5px solid var(--brd);border-radius:6px;padding:8px 10px;font-size:12px;background:var(--surf)">`;
    }
    return `<div style="display:flex;flex-direction:column;gap:6px">
      <div class="panel-inst-nombre-wrap">
        <select id="cm-tipo" class="panel-inst-tipo" onchange="_onTipoChange(this)"
          style="border:1.5px solid var(--brd);border-radius:6px;padding:8px 10px;font-size:12px;background:var(--surf);width:100%">
          <option value="">— Tipo de instancia —</option>
          ${tiposInst.map(t => `<option value="${_esc(t.nombre)}">${_esc(t.nombre)}</option>`).join('')}
          <option value="__otro__">Otro...</option>
        </select>
        <input type="text" class="panel-inst-nombre-libre" placeholder="Escribí el nombre..."
          style="display:none;border:1.5px solid var(--brd);border-radius:6px;padding:8px 10px;font-size:12px;background:var(--surf);width:100%">
        <button type="button" class="panel-inst-nombre-back" onclick="_resetTipoOtro(this)"
          style="display:none;font-size:10px;color:var(--txt2);background:none;border:none;cursor:pointer;padding:0;text-align:left">← Cambiar tipo</button>
      </div>
      <input type="text" id="cm-desc" placeholder="Descripción o nombre específico (ej: N°1, Unidad 3...)"
        style="border:1.5px solid var(--brd);border-radius:6px;padding:8px 10px;font-size:12px;background:var(--surf);width:100%;box-sizing:border-box">
    </div>`;
  };

  document.getElementById('modal-carga-masiva')?.remove();
  const modal = document.createElement('div');
  modal.id = 'modal-carga-masiva';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px`;
  modal.innerHTML = `
    <div style="background:var(--surf);border-radius:16px;width:100%;max-width:480px;max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.18)">
      <div style="padding:18px 20px 14px;border-bottom:1px solid var(--brd);display:flex;align-items:flex-start;justify-content:space-between">
        <div>
          <div style="font-size:15px;font-weight:700;font-family:'Lora',serif">📝 Carga por materia</div>
          <div style="font-size:11px;color:var(--txt2)">Una instancia evaluativa · Todos los alumnos</div>
        </div>
        <button onclick="document.getElementById('modal-carga-masiva').remove()"
          style="background:var(--surf2);border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:14px;color:var(--txt2);display:flex;align-items:center;justify-content:center">✕</button>
      </div>
      <div style="padding:16px 20px">
        <div style="margin-bottom:14px">
          <label style="display:block;font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--txt2);text-transform:uppercase;margin-bottom:6px">Materia</label>
          <select id="cm-materia" style="width:100%;padding:8px 10px;border:1.5px solid var(--brd);border-radius:6px;font-size:12px;background:var(--surf)">
            ${materias.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('')}
          </select>
        </div>
        <div style="margin-bottom:14px">
          <label style="display:block;font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--txt2);text-transform:uppercase;margin-bottom:6px">Instancia evaluativa</label>
          ${mkNombreControl()}
        </div>
        <div style="margin-bottom:14px">
          <label style="display:block;font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--txt2);text-transform:uppercase;margin-bottom:6px">Notas de alumnos</label>
          <div class="card" style="padding:0">
            ${alumnos.map((al, idx) => `
              <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
                border-bottom:${idx < alumnos.length - 1 ? '1px solid var(--brd)' : 'none'}">
                <div style="flex:1;font-size:12px;font-weight:500">${al.apellido}, ${al.nombre}</div>
                ${usaConc
                  ? `<select class="cm-nota" data-alumno="${al.id}"
                      style="width:70px;border:1.5px solid var(--brd);border-radius:6px;padding:4px 6px;font-size:12px;background:var(--surf)">
                      <option value="">—</option>
                      ${escalaConc.map(v => `<option value="${v}">${v}</option>`).join('')}
                     </select>`
                  : `<input type="number" class="cm-nota" data-alumno="${al.id}" min="1" max="10" step="1" placeholder="—"
                      style="width:60px;text-align:center;border:1.5px solid var(--brd);border-radius:6px;padding:5px;font-size:13px;font-weight:700;background:var(--surf)">`}
              </div>`).join('')}
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="guardarCargaMasivaMateria('${cursoId}','${periodoId}')" class="btn-p" style="flex:1">💾 Guardar</button>
          <button onclick="document.getElementById('modal-carga-masiva').remove()" class="btn-s">Cancelar</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function guardarCargaMasivaMateria(cursoId, periodoId) {
  const saveBtn = document.querySelector('#modal-carga-masiva .btn-p');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando...'; }

  const materiaId  = document.getElementById('cm-materia')?.value;
  const usaConc    = window._pGusaConc;
  const escalaConc = window._pGescala || ['MB', 'B', 'R', 'I'];
  const instId     = USUARIO_ACTUAL.institucion_id;

  const tipoEl   = document.getElementById('cm-tipo');
  const libreEl  = document.querySelector('#modal-carga-masiva .panel-inst-nombre-libre');
  const nombreEl = document.getElementById('cm-nombre');
  const descEl   = document.getElementById('cm-desc');
  const desc     = descEl?.value?.trim() || '';
  let nombre;
  if (tipoEl) {
    const base = tipoEl.value === '__otro__' ? (libreEl?.value?.trim() || '') : tipoEl.value;
    nombre = base && desc ? `${base} — ${desc}` : (base || desc);
  } else {
    nombre = nombreEl?.value?.trim() || '';
  }

  if (!materiaId) {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Guardar'; }
    alert('Seleccioná una materia.');
    return;
  }
  if (!nombre) {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Guardar'; }
    alert('Ingresá el nombre de la instancia.');
    return;
  }

  const notaEls = document.querySelectorAll('.cm-nota');
  const inserts  = [];
  notaEls.forEach(el => {
    const val = el.value;
    if (!val) return;
    inserts.push({
      alumno_id:        el.dataset.alumno,
      materia_id:       materiaId,
      curso_id:         cursoId,
      periodo_id:       periodoId,
      institucion_id:   instId,
      nombre,
      valor_numerico:   usaConc ? null : Math.round(parseFloat(val)),
      valor_conceptual: usaConc ? val : null,
    });
  });

  if (!inserts.length) {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Guardar'; }
    alert('No ingresaste ninguna nota.');
    return;
  }

  const { error } = await sb.from('instancias_calificacion').insert(inserts);
  if (error) {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Guardar'; }
    alert('Error: ' + error.message);
    return;
  }

  // Actualizar nota final de boletín (si no fue editada manualmente)
  const cIdx = window._pGcIdx || {};
  for (const ins of inserts) {
    const aId = ins.alumno_id;
    const { data: allInsts } = await sb.from('instancias_calificacion').select('*')
      .eq('alumno_id', aId).eq('materia_id', materiaId)
      .eq('curso_id', cursoId).eq('periodo_id', periodoId);
    const promSug = _calcPromSugerido(allInsts || [], usaConc, escalaConc);
    if (promSug === null) continue;
    const promRow = cIdx[`${aId}:${materiaId}`];
    if (promRow?.promedio_editado) continue;
    const datos = {
      institucion_id: instId,
      alumno_id:      aId,
      materia_id:     materiaId,
      curso_id:       cursoId,
      periodo_id:     periodoId,
      instancia_id:   null,
      registrado_por: USUARIO_ACTUAL.id,
    };
    if (usaConc) {
      datos.promedio_concepto_manual = String(promSug);
      datos.nota = null;
    } else {
      datos.nota = typeof promSug === 'number' ? promSug : null;
    }
    if (promRow?.id) {
      await sb.from('calificaciones').update(datos).eq('id', promRow.id);
    } else {
      await sb.from('calificaciones').insert([datos]);
    }
  }

  document.getElementById('modal-carga-masiva')?.remove();
  await window.cambioPeriodoPrimG?.(periodoId);
}

async function _resolverAlertaAcad(alertaId, btn) {
  if (!confirm('¿Marcás esta alerta como resuelta?')) return;
  btn.disabled = true;
  btn.textContent = 'Procesando...';
  const { error } = await sb.from('alertas_academicas').delete().eq('id', alertaId);
  if (error) {
    btn.disabled = false;
    btn.textContent = '✓ Resolver';
    alert('Error: ' + error.message);
    return;
  }
  document.getElementById(`alerta-ac-${alertaId}`)?.remove();
}

// ═══════════════════════════════════════════════════════
// BUSCADOR EOE — calificaciones
// ═══════════════════════════════════════════════════════
let _notasEOETimer = null;

function _debounceNotasEOE(q) {
  clearTimeout(_notasEOETimer);
  const clr = document.getElementById('eoe-notas-clear');
  if (clr) clr.style.display = q ? 'block' : 'none';
  if (!q.trim()) {
    const drop = document.getElementById('eoe-notas-drop');
    if (drop) drop.innerHTML = '';
    return;
  }
  _notasEOETimer = setTimeout(() => _buscarAlumnoNotasEOE(q.trim()), 400);
}

async function _buscarAlumnoNotasEOE(q) {
  const drop = document.getElementById('eoe-notas-drop');
  if (!drop) return;
  drop.innerHTML = '<div style="padding:6px 12px;font-size:11px;color:var(--txt2)">Buscando...</div>';

  const { data } = await sb.from('alumnos')
    .select('id,nombre,apellido,curso_id,cursos(id,nombre,division,nivel)')
    .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
    .eq('activo', true)
    .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%`)
    .limit(8);

  if (!data?.length) {
    drop.innerHTML = '<div style="padding:6px 12px;font-size:11px;color:var(--txt2)">Sin resultados.</div>';
    return;
  }

  drop.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;margin-top:4px">
      ${data.map(al => {
        const cu  = al.cursos;
        const cur = cu ? `${cu.nombre}${cu.division || ''} · ${cu.nivel}` : '';
        return `
          <div style="padding:9px 12px;border-bottom:1px solid var(--brd);cursor:pointer;font-size:12px"
            onmouseover="this.style.background='var(--surf2)'" onmouseout="this.style.background=''"
            onclick="_verAlumnoNotasEOE('${al.id}','${al.apellido}, ${al.nombre}','${cu?.id || ''}','${cu?.nivel || ''}')">
            <span style="font-weight:600">${al.apellido}, ${al.nombre}</span>
            ${cur ? `<span style="color:var(--txt2);font-size:10px;margin-left:6px">${cur}</span>` : ''}
          </div>`;
      }).join('')}
    </div>`;
}

async function _verAlumnoNotasEOE(alumnoId, nombre, cursoId, nivel) {
  const drop = document.getElementById('eoe-notas-drop');
  if (drop) drop.innerHTML = '';
  const inp  = document.getElementById('eoe-notas-search');
  if (inp)   inp.value = nombre;
  const clr  = document.getElementById('eoe-notas-clear');
  if (clr)   clr.style.display = 'block';

  // Navega al alumno en modo solo lectura
  verAlumnoNotas(alumnoId, cursoId, null, null);
}

function _limpiarBusquedaNotasEOE() {
  const inp = document.getElementById('eoe-notas-search');
  if (inp) inp.value = '';
  const drop = document.getElementById('eoe-notas-drop');
  if (drop) drop.innerHTML = '';
  const clr  = document.getElementById('eoe-notas-clear');
  if (clr)   clr.style.display = 'none';
  rNotas();
}

// ─── UTILIDADES ───────────────────────────────────────
function labelNivelCalif(n) {
  return { inicial:'🌱 Inicial', primario:'📚 Primario', secundario:'🎓 Secundario' }[n] || n;
}

// ─── ESTILOS ──────────────────────────────────────────
function inyectarEstilosNotas() {
  if (document.getElementById('notas-styles')) return;
  const st = document.createElement('style');
  st.id = 'notas-styles';
  st.textContent = `
    .grilla-notas { width:100%; border-collapse:collapse; font-size:11px; table-layout:fixed; }
    .grilla-notas th { padding:6px 4px; text-align:center; background:var(--surf2); border-bottom:2px solid var(--brd); font-weight:700; color:var(--txt2); font-size:10px; overflow:hidden; }
    .grilla-notas td { padding:5px 4px; text-align:center; border-bottom:1px solid var(--brd); overflow:hidden; }
    .grilla-notas tr:hover td { background:var(--surf2); }
    .grilla-notas .th-recup { background:var(--azul-l); color:var(--azul); }
    .nota-cell { display:inline-block; min-width:26px; padding:2px 4px; border-radius:5px; font-size:11px; font-weight:700; text-align:center; }
    .nota-ok   { background:var(--verde-l); color:var(--verde); }
    .nota-warn { background:var(--amb-l);   color:var(--ambar); }
    .nota-risk { background:var(--rojo-l);  color:var(--rojo);  }
    .nota-nd   { background:var(--gris-l);  color:var(--gris);  }
    .fila-riesgo td { background:rgba(192,57,43,.08) !important; }
    .fila-obs td    { background:rgba(245,176,65,.10) !important; }
    .curso-card-asist { cursor:pointer !important; }
    .periodo-tabs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px; }
    .periodo-tab {
      padding:7px 16px; border-radius:20px; border:1.5px solid var(--brd);
      cursor:pointer; font-size:12px; font-weight:600; background:var(--surf2);
      color:var(--txt2); font-family:inherit; transition:all .15s;
    }
    .periodo-tab.on { background:var(--verde); color:#fff; border-color:var(--verde); }
    @media(max-width:768px){
      .grilla-notas { font-size:10px; }
      .grilla-notas th { font-size:9px; padding:4px 2px; }
      .grilla-notas td { padding:4px 2px; }
      .nota-cell { min-width:22px; font-size:10px; }
    }
  `;
  document.head.appendChild(st);
}

// ─── CIERRE DE PERÍODO ────────────────────────────────

async function cerrarPeriodo(cursoId, materiaId, periodoId, nombrePeriodo) {
  if (!confirm(`¿Cerrás el ${nombrePeriodo}? El preceptor deberá validarlo para que quede bloqueado.`)) return;

  const { error } = await sb.from('periodos_evaluativos')
    .update({
      cerrado:     true,
      cerrado_por: USUARIO_ACTUAL.id,
      cerrado_at:  new Date().toISOString(),
    }).eq('id', periodoId);

  if (error) { alert('Error: ' + error.message); return; }
  window.cambioPeriodoDoc?.(periodoId);
}

async function validarCierrePeriodo(periodoId, nombrePeriodo) {
  if (!confirm(`¿Validás el cierre del ${nombrePeriodo}? Las notas quedarán bloqueadas.`)) return;

  const { error } = await sb.from('periodos_evaluativos')
    .update({
      validado_por: USUARIO_ACTUAL.id,
      validado_at:  new Date().toISOString(),
    }).eq('id', periodoId);

  if (error) { alert('Error: ' + error.message); return; }
  alert('✅ Período validado y bloqueado.');
  rNotas();
}

async function reabrirPeriodo(periodoId, nombrePeriodo) {
  if (!confirm(`¿Reabrís el ${nombrePeriodo}? El docente podrá editar las notas nuevamente.`)) return;

  await sb.from('periodos_evaluativos').update({
    cerrado:      false,
    cerrado_por:  null,
    cerrado_at:   null,
    validado_por: null,
    validado_at:  null,
  }).eq('id', periodoId);

  rNotas();
}

// ─── CIERRE DE CUATRIMESTRE (por materia/curso) ──────

async function cerrarCuatrimestreDocente(cursoId, materiaId, periodoId, nombreMateria) {
  if (!confirm(`¿Cerrás el cuatrimestre para "${nombreMateria}"? El preceptor deberá validarlo.`)) return;

  const instId = USUARIO_ACTUAL.institucion_id;
  const { error } = await sb.from('cierres_materia_cuatrimestre').upsert({
    institucion_id: instId,
    curso_id:   cursoId,
    materia_id: materiaId,
    periodo_id: periodoId,
    cerrado_por: USUARIO_ACTUAL.id,
    cerrado_at:  new Date().toISOString(),
    validado_por: null,
    validado_at:  null,
  }, { onConflict: 'curso_id,materia_id,periodo_id' });

  if (error) { alert('Error al cerrar: ' + error.message); return; }
  window.cambioPeriodoDoc?.(periodoId);
}

async function validarCierreMateria(cursoId, materiaId, periodoId, nombreMateria, contexto, nivel) {
  if (!confirm(`¿Validás el cierre de "${nombreMateria}"? Las notas quedarán bloqueadas.`)) return;

  const { error } = await sb.from('cierres_materia_cuatrimestre')
    .update({ validado_por: USUARIO_ACTUAL.id, validado_at: new Date().toISOString() })
    .eq('curso_id', cursoId).eq('materia_id', materiaId).eq('periodo_id', periodoId);

  if (error) { alert('Error al validar: ' + error.message); return; }
  if (contexto === 'grilla') {
    verGrillaMateriaPreceptor(cursoId, materiaId, nombreMateria, periodoId, nivel);
  } else {
    window.cambioPeriodoDir?.(periodoId);
  }
}

async function reabrirCierreMateria(cursoId, materiaId, periodoId, nombreMateria, contexto, nivel) {
  if (!confirm(`¿Reabrís el cuatrimestre de "${nombreMateria}"? Se borrará el cierre y la validación.`)) return;

  const { error } = await sb.from('cierres_materia_cuatrimestre')
    .update({ cerrado_por: null, cerrado_at: null, validado_por: null, validado_at: null })
    .eq('curso_id', cursoId).eq('materia_id', materiaId).eq('periodo_id', periodoId);

  if (error) { alert('Error al reabrir: ' + error.message); return; }
  if (contexto === 'grilla') {
    verGrillaMateriaPreceptor(cursoId, materiaId, nombreMateria, periodoId, nivel);
  } else {
    window.cambioPeriodoDoc?.(periodoId);
  }
}

async function validarCierreCurso(cursoId, periodoId, nombreCurso) {
  if (!confirm(`¿Cerrás el cuatrimestre completo del curso "${nombreCurso}"? Esta acción confirma que todas las materias están revisadas.`)) return;

  const instId = USUARIO_ACTUAL.institucion_id;
  const { error } = await sb.from('cierres_curso_cuatrimestre').upsert({
    institucion_id: instId,
    curso_id:   cursoId,
    periodo_id: periodoId,
    validado_por: USUARIO_ACTUAL.id,
    validado_at:  new Date().toISOString(),
  }, { onConflict: 'curso_id,periodo_id' });

  if (error) { alert('Error al cerrar curso: ' + error.message); return; }
  alert('🏆 Cuatrimestre cerrado para este curso.');
  window.cambioPeriodoDir?.(periodoId);
}

async function verGrillaMateriaPreceptor(cursoId, materiaId, nombreMateria, periodoId, nivel) {
  const c = document.getElementById('page-notas');
  showLoading('notas');

  const { data: curso } = await sb.from('cursos').select('nombre,division').eq('id', cursoId).single();
  const nombreCurso = `${curso?.nombre || ''}${curso?.division || ''}`;

  const [alumnosRes, instanciasRes, califRes, cierreRes] = await Promise.all([
    sb.from('alumnos').select('*').eq('curso_id', cursoId).eq('activo', true).order('apellido'),
    sb.from('instancias_evaluativas')
      .select('*, tipos_instancia_evaluativa(nombre,es_recuperatorio)')
      .eq('curso_id', cursoId).eq('materia_id', materiaId).eq('periodo_id', periodoId).order('fecha'),
    sb.from('calificaciones').select('*')
      .eq('curso_id', cursoId).eq('materia_id', materiaId).eq('periodo_id', periodoId),
    sb.from('cierres_materia_cuatrimestre').select('*')
      .eq('curso_id', cursoId).eq('materia_id', materiaId).eq('periodo_id', periodoId).maybeSingle(),
  ]);

  const alumnos    = alumnosRes.data    || [];
  const instancias = instanciasRes.data || [];
  const califs     = califRes.data      || [];
  const cierre     = cierreRes.data;

  const califIdx = {};
  califs.forEach(cf => { califIdx[`${cf.alumno_id}_${cf.instancia_id}`] = cf; });

  const promedios = {};
  alumnos.forEach(al => {
    const notas = instancias
      .filter(inst => !inst.tipos_instancia_evaluativa?.es_recuperatorio)
      .map(inst => { const cf = califIdx[`${al.id}_${inst.id}`]; return (cf && !cf.ausente && cf.nota !== null) ? cf.nota : null; })
      .filter(n => n !== null);
    promedios[al.id] = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
  });

  const esDirectivo = ['director_general','directivo_nivel','secretario','vicedirector'].includes(USUARIO_ACTUAL.rol);

  const estadoBanner = cierre?.validado_at
    ? `<div style="background:var(--verde-l);border-left:3px solid var(--verde);border-radius:var(--rad);
        padding:10px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:11px;font-weight:600;color:var(--verde)">✅ Materia validada por preceptoría</span>
        ${esDirectivo ? `<button class="btn-s" style="font-size:11px"
          onclick="reabrirCierreMateria('${cursoId}','${materiaId}','${periodoId}','${_escCal(nombreMateria)}','grilla','${nivel}')">
          🔓 Reabrir
        </button>` : ''}
      </div>`
    : cierre?.cerrado_at
      ? `<div style="background:var(--amb-l);border-left:3px solid var(--ambar);border-radius:var(--rad);
          padding:10px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;font-weight:600;color:var(--ambar)">⏳ Cerrado por docente — pendiente de validación</span>
          ${USUARIO_ACTUAL.rol === 'preceptor' ? `
            <button class="btn-p" style="font-size:11px;background:var(--ambar)"
              onclick="validarCierreMateria('${cursoId}','${materiaId}','${periodoId}','${_escCal(nombreMateria)}','grilla','${nivel}')">
              ✓ Validar cierre
            </button>` : ''}
        </div>`
      : `<div style="background:var(--surf2);border-radius:var(--rad);padding:8px 12px;margin-bottom:12px;font-size:11px;color:var(--txt2)">
          ℹ️ El docente aún no cerró el cuatrimestre para esta materia.
        </div>`;

  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <button onclick="verCalifCurso('${cursoId}','${nivel}')"
        style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--txt2)">←</button>
      <div>
        <div class="pg-t">${nombreCurso} · ${_escCal(nombreMateria)}</div>
        <div class="pg-s">Grilla de notas · Solo lectura</div>
      </div>
    </div>
    ${estadoBanner}
    ${!instancias.length
      ? '<div class="empty-state">Sin instancias evaluativas en este período.</div>'
      : `<div style="display:flex;justify-content:flex-end;gap:4px;margin-bottom:6px">
          <button onclick="_scrollGrilla(-1)" style="background:var(--surf2);border:1px solid var(--brd);border-radius:6px;padding:4px 12px;cursor:pointer;font-size:14px;color:var(--txt2)">◀</button>
          <button onclick="_scrollGrilla(1)"  style="background:var(--surf2);border:1px solid var(--brd);border-radius:6px;padding:4px 12px;cursor:pointer;font-size:14px;color:var(--txt2)">▶</button>
        </div>
        <div style="overflow-x:auto">
          <table class="grilla-notas" style="table-layout:auto">
            <thead>
              <tr>
                <th style="text-align:left;min-width:180px;position:sticky;left:0;z-index:2;background:var(--surf2)">Alumno</th>
                ${instancias.map(inst => `
                  <th class="${inst.tipos_instancia_evaluativa?.es_recuperatorio ? 'th-recup' : ''}"
                    title="${[inst.tipos_instancia_evaluativa?.nombre, inst.nombre].filter(Boolean).join(' · ')}"
                    style="width:68px;min-width:68px">
                    <div style="font-size:8px;font-weight:700;letter-spacing:.06em;color:var(--txt3);font-family:'DM Mono',monospace;text-transform:uppercase">${_abrevTipo(inst.tipos_instancia_evaluativa?.nombre)}</div>
                    <div style="font-size:9px;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${inst.nombre || inst.tipos_instancia_evaluativa?.nombre || '—'}</div>
                    <div style="font-size:9px;opacity:.6">${formatFechaCorta(inst.fecha)}</div>
                  </th>`).join('')}
                <th style="font-size:9px">Prom.</th>
              </tr>
            </thead>
            <tbody>
              ${alumnos.map(al => {
                const prom = promedios[al.id];
                return `
                  <tr>
                    <td style="font-size:11px;font-weight:500;white-space:nowrap;position:sticky;left:0;z-index:1;background:var(--bg);box-shadow:2px 0 4px rgba(0,0,0,.06)">
                      ${al.apellido}, ${al.nombre}
                    </td>
                    ${instancias.map(inst => {
                      const cf = califIdx[`${al.id}_${inst.id}`];
                      if (!cf)          return `<td><span class="nota-cell nota-nd">—</span></td>`;
                      if (cf.ausente)   return `<td><span class="nota-cell nota-nd">A</span></td>`;
                      const nota = cf.nota;
                      if (nota === null) return `<td><span class="nota-cell nota-nd">—</span></td>`;
                      return `<td><span class="nota-cell ${NOTA_CLS(nota, nivel, nombreCurso)}">${nota % 1 === 0 ? nota : nota.toFixed(1)}</span></td>`;
                    }).join('')}
                    <td>
                      ${prom !== null
                        ? `<span style="font-weight:700;color:${NOTA_COLOR(Math.round(prom), nivel, nombreCurso)}">${Math.round(prom)}</span>`
                        : `<span style="color:var(--txt3)">—</span>`}
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`}`;
}

async function _cargarResumenCierrePreceptor(cursoIds) {
  const sec = document.getElementById('preceptor-cierre-resumen');
  if (!sec || !cursoIds.length) return;

  const [cierresRes, cursosCerradosRes] = await Promise.all([
    sb.from('cierres_materia_cuatrimestre')
      .select('id,cerrado_at,validado_at,materia_id,curso_id,materias(nombre),cursos(nombre,division),periodos_evaluativos(nombre)')
      .in('curso_id', cursoIds),
    sb.from('cierres_curso_cuatrimestre')
      .select('id,validado_at,curso_id,cursos(nombre,division),periodos_evaluativos(nombre)')
      .in('curso_id', cursoIds),
  ]);

  const cierres        = cierresRes.data        || [];
  const cursosCerrados = cursosCerradosRes.data  || [];

  if (!cierres.length && !cursosCerrados.length) {
    sec.innerHTML = `<div style="background:var(--surf2);border-radius:var(--rad);padding:10px 14px;margin-bottom:12px;font-size:11px;color:var(--txt2)">
      ℹ️ No hay materias cerradas por los docentes todavía.
    </div>`;
    return;
  }

  const pendientes = cierres.filter(c => !c.validado_at);
  const validadas  = cierres.filter(c => !!c.validado_at);

  sec.innerHTML = `
    <div style="background:var(--surf2);border-radius:var(--rad);padding:12px 14px;margin-bottom:14px">
      <div style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">
        Estado de cierre de cuatrimestre
      </div>
      <div class="metrics m3" style="margin-bottom:${pendientes.length || cursosCerrados.length ? '12px' : '0'}">
        <div class="mc" style="background:var(--amb-l)">
          <div class="mc-v" style="color:var(--ambar);font-size:20px">${pendientes.length}</div>
          <div class="mc-l">Pendientes de validación</div>
        </div>
        <div class="mc" style="background:var(--verde-l)">
          <div class="mc-v" style="color:var(--verde);font-size:20px">${validadas.length}</div>
          <div class="mc-l">Materias validadas</div>
        </div>
        <div class="mc" style="background:var(--azul-l)">
          <div class="mc-v" style="color:var(--azul);font-size:20px">${cursosCerrados.length}</div>
          <div class="mc-l">Cursos cerrados</div>
        </div>
      </div>
      ${pendientes.length ? `
        <div style="font-size:10px;font-weight:700;color:var(--ambar);margin-bottom:6px">⏳ Pendientes de validación</div>
        ${pendientes.map(c => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--brd)">
            <span style="font-size:11px">${c.cursos?.nombre}${c.cursos?.division} · ${c.materias?.nombre}</span>
            <span style="font-size:10px;color:var(--txt2)">${c.periodos_evaluativos?.nombre || ''}</span>
          </div>`).join('')}
      ` : ''}
      ${cursosCerrados.length ? `
        <div style="font-size:10px;font-weight:700;color:var(--azul);margin-bottom:6px;margin-top:${pendientes.length ? '10px' : '0'}">
          🏆 Cursos cerrados
        </div>
        ${cursosCerrados.map(c => `
          <div style="font-size:11px;padding:5px 0;border-bottom:1px solid var(--brd)">
            ${c.cursos?.nombre}${c.cursos?.division} · ${c.periodos_evaluativos?.nombre || ''}
          </div>`).join('')}
      ` : ''}
    </div>`;
}

// ═══════════════════════════════════════════════════════
// INTENSIFICACIÓN / TRAYECTORIAS — ver intensificacion.js
// ═══════════════════════════════════════════════════════


// opts (opcional, para el cierre por período desde Parámetros → Períodos y escalas):
//   nivelFiltro         — restringe el cierre a los cursos de ese nivel
//   periodoEvaluativoId — se guarda en cierres_periodo como referencia del período cerrado
//   sinConfirm          — el llamador ya confirmó (evita doble confirm)
//   sinReRender         — no re-renderiza la página de notas al terminar (lo hace el llamador)
//   etiqueta            — texto para los mensajes (default "Cuatrimestre N")
// Sin opts: comportamiento idéntico al anterior (botones C1/C2 de Calificaciones).
async function _cerrarCuatrimestreTrayectoria(cuatrimestre, opts = {}) {
  const { nivelFiltro = null, periodoEvaluativoId = null,
          sinConfirm = false, sinReRender = false } = opts;
  const etiqueta = opts.etiqueta || `Cuatrimestre ${cuatrimestre}`;
  const instId = USUARIO_ACTUAL.institucion_id;
  const anio   = new Date().getFullYear();

  const tipoCierre = cuatrimestre === 1 ? 'cuatrimestre_1' : 'cuatrimestre_2';
  // Verificar si ya se cerró este período (array-based: puede haber varias filas
  // del mismo tipo, una por nivel, desde el cierre por período).
  let qCierre = sb.from('cierres_periodo')
    .select('id').eq('institucion_id', instId)
    .eq('ciclo_lectivo', anio).eq('tipo', tipoCierre);
  if (nivelFiltro) qCierre = qCierre.eq('nivel', nivelFiltro);
  const { data: cierreRows } = await qCierre.limit(1);
  const cierreExist = (cierreRows || [])[0] || null;

  if (!sinConfirm) {
    if (cierreExist) {
      if (!confirm(`${etiqueta} ya fue cerrado. ¿Querés re-generar las alertas?`)) return;
    } else {
      if (!confirm(`¿Cerrar ${etiqueta}? Se generarán alertas automáticas según la cantidad de materias desaprobadas.`)) return;
    }
  }

  // Obtener cursos del nivel del usuario (o todos para director_general).
  // nivelFiltro (cierre por período) tiene prioridad sobre el scope por rol.
  let qCursos = sb.from('cursos').select('id,nombre,division,nivel').eq('institucion_id', instId);
  if (nivelFiltro) {
    qCursos = qCursos.eq('nivel', nivelFiltro);
  } else if (esDirectivoNivel(USUARIO_ACTUAL.rol) && USUARIO_ACTUAL.nivel) {
    qCursos = qCursos.eq('nivel', USUARIO_ACTUAL.nivel);
  }
  const { data: cursos } = await qCursos;
  const cursoIds = (cursos || []).map(c => c.id);
  if (!cursoIds.length) { alert('Sin cursos para cerrar.'); return; }

  // Obtener alumnos
  const { data: alumnos } = await sb.from('alumnos')
    .select('id,nombre,apellido,curso_id').in('curso_id', cursoIds).or('activo.is.null,activo.eq.true');
  if (!alumnos?.length) { alert('Sin alumnos activos.'); return; }

  // Obtener períodos evaluativos del cuatrimestre
  const periodosPorNivel = {};
  PERIODOS.forEach(p => { periodosPorNivel[p.nivel] = periodosPorNivel[p.nivel] || []; periodosPorNivel[p.nivel].push(p); });

  // Calcular materias desaprobadas por alumno (notas promedio < 7)
  const desaprobadasPorAlumno = {};
  const materiaDesaprobadaIds = {};

  for (const cu of (cursos || [])) {
    const alumnosCurso = alumnos.filter(a => a.curso_id === cu.id);
    if (!alumnosCurso.length) continue;

    const periodos = periodosPorNivel[cu.nivel] || [];
    if (!periodos.length) continue;

    // Para el cuatrimestre solicitado, usar los períodos correspondientes
    // Cuatrimestre 1: primero, Cuatrimestre 2: segundo
    const periodosQ = periodos.filter((_, i) => cuatrimestre === 1 ? i < Math.ceil(periodos.length / 2) : i >= Math.floor(periodos.length / 2));
    const periodoIds = periodosQ.map(p => p.id);
    if (!periodoIds.length) continue;

    const { data: califs } = await sb.from('calificaciones')
      .select('alumno_id,materia_id,nota,ausente')
      .in('periodo_id', periodoIds).eq('curso_id', cu.id);

    (califs || []).forEach(c => {
      if (c.ausente || c.nota === null) return;
      const k = `${c.alumno_id}_${c.materia_id}`;
      if (!desaprobadasPorAlumno[c.alumno_id]) desaprobadasPorAlumno[c.alumno_id] = {};
      if (!desaprobadasPorAlumno[c.alumno_id][c.materia_id]) desaprobadasPorAlumno[c.alumno_id][c.materia_id] = [];
      desaprobadasPorAlumno[c.alumno_id][c.materia_id].push(c.nota);
    });
  }

  // Generar alertas y colectar pendientes de intensificación
  let alertasGeneradas = 0;
  // ciclo_lectivo_cursado: mismo año para Q1 (intensif. intra-año), año siguiente para Q2 (recursada)
  const cicloResolucion = cuatrimestre === 1 ? anio : anio + 1;
  const pendientesIntensif = []; // {alumno_id, materia_id, curso_id}

  for (const alumno of alumnos) {
    const materiasAlumno = desaprobadasPorAlumno[alumno.id] || {};
    const matsBajas = Object.entries(materiasAlumno)
      .filter(([_, notas]) => notas.reduce((a, b) => a + b, 0) / notas.length < 7)
      .map(([matId]) => matId);
    const n = matsBajas.length;
    if (!n) continue;

    let tipo;
    if (n <= 2)      tipo = 'riesgo_1';
    else if (n <= 4) tipo = 'riesgo_2';
    else             tipo = 'edt_requerido';

    // Verificar si ya existe alerta para este alumno/cuatrimestre
    const { data: existe } = await sb.from('alertas_academicas')
      .select('id').eq('alumno_id', alumno.id)
      .eq('ciclo_lectivo', anio).eq('cuatrimestre', cuatrimestre)
      .not('tipo', 'is', null).maybeSingle();

    if (existe) {
      await sb.from('alertas_academicas').update({
        tipo, materias_ids: matsBajas, leida: false, resuelta: false,
      }).eq('id', existe.id);
    } else {
      await sb.from('alertas_academicas').insert({
        institucion_id: instId,
        alumno_id:      alumno.id,
        tipo,
        materias_ids:   matsBajas,
        ciclo_lectivo:  anio,
        cuatrimestre,
        leida:          false,
        resuelta:       false,
      });
    }
    alertasGeneradas++;

    // Colectar materias para trayectoria
    for (const matId of matsBajas) {
      pendientesIntensif.push({ alumno_id: alumno.id, materia_id: matId, curso_id: alumno.curso_id });
    }
  }

  // Crear registros en materias_estado_alumno para los que no existan aún
  if (pendientesIntensif.length) {
    const alumnoIds = [...new Set(pendientesIntensif.map(d => d.alumno_id))];
    const { data: existentes } = await sb.from('materias_estado_alumno')
      .select('alumno_id,materia_id')
      .in('alumno_id', alumnoIds)
      .eq('ciclo_lectivo_origen', anio);
    const existSet = new Set((existentes || []).map(e => `${e.alumno_id}_${e.materia_id}`));
    const nuevos = pendientesIntensif.filter(d => !existSet.has(`${d.alumno_id}_${d.materia_id}`));
    if (nuevos.length) {
      await sb.from('materias_estado_alumno').insert(nuevos.map(d => ({
        ...d,
        ciclo_lectivo_origen:  anio,
        ciclo_lectivo_cursado: cicloResolucion,
        estado:                'pendiente_intensif',
        institucion_id:        instId,
      })));
    }
  }

  // Registrar cierre
  if (!cierreExist) {
    await sb.from('cierres_periodo').insert({
      institucion_id: instId, ciclo_lectivo: anio,
      tipo: tipoCierre, nivel: nivelFiltro, periodo_evaluativo_id: periodoEvaluativoId,
      cerrado_por: USUARIO_ACTUAL.id,
    });
  }

  alert(`✅ ${etiqueta} cerrado.\n${alertasGeneradas} alumno(s) con alertas generadas.`);
  if (!sinReRender) rNotas();
}

async function _mostrarCierreAnual() {
  const instId = USUARIO_ACTUAL.institucion_id;
  const anio   = new Date().getFullYear();
  const c      = document.getElementById('page-notas');
  showLoading('notas');

  // Cursos secundarios (la promoción automática aplica a secundaria)
  let qCursos = sb.from('cursos').select('id,nombre,division,nivel').eq('institucion_id', instId).eq('nivel', 'secundario');
  if (esDirectivoNivel(USUARIO_ACTUAL.rol)) qCursos = qCursos.eq('nivel', USUARIO_ACTUAL.nivel || 'secundario');
  const { data: cursos } = await qCursos;
  const cursoIds = (cursos || []).map(cu => cu.id);

  if (!cursoIds.length) {
    c.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <button onclick="rNotas()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--txt2)">←</button>
        <div class="pg-t">Cierre anual / Promoción</div>
      </div>
      <div class="empty-state">Sin cursos de nivel secundario para gestionar.</div>`;
    return;
  }

  const { data: alumnos } = await sb.from('alumnos')
    .select('id,nombre,apellido,curso_id').in('curso_id', cursoIds).or('activo.is.null,activo.eq.true');

  // Obtener alertas del ciclo lectivo actual para calcular estado
  const { data: alertas } = await sb.from('alertas_academicas')
    .select('alumno_id,tipo,materias_ids')
    .in('alumno_id', (alumnos || []).map(a => a.id))
    .eq('ciclo_lectivo', anio).eq('resuelta', false).not('tipo', 'is', null);

  const alertasPorAlumno = {};
  (alertas || []).forEach(al => {
    if (!alertasPorAlumno[al.alumno_id]) alertasPorAlumno[al.alumno_id] = al;
    else if ((al.materias_ids?.length || 0) > (alertasPorAlumno[al.alumno_id].materias_ids?.length || 0)) {
      alertasPorAlumno[al.alumno_id] = al;
    }
  });

  const cursoMap = Object.fromEntries((cursos || []).map(cu => [cu.id, cu]));

  const PROMO_TIPO = {
    promovido:             { label: 'Promovido automáticamente', color: 'var(--verde)',  tag: 'tg' },
    promocion_acompanada:  { label: 'Promoción acompañada',      color: 'var(--ambar)', tag: 'ta' },
    edt_requerido:         { label: 'EDT requerido',             color: 'var(--rojo)',  tag: 'tr' },
  };

  const clasificados = (alumnos || []).map(al => {
    const alerta = alertasPorAlumno[al.id];
    const n      = alerta?.materias_ids?.length || 0;
    let decision = n === 0 ? 'promovido' : n <= 2 ? 'promovido' : n <= 4 ? 'promocion_acompanada' : 'edt_requerido';
    return { ...al, decision, materias_n: n, curso: cursoMap[al.curso_id] };
  });

  const grupos = {
    promovido:            clasificados.filter(a => a.decision === 'promovido'),
    promocion_acompanada: clasificados.filter(a => a.decision === 'promocion_acompanada'),
    edt_requerido:        clasificados.filter(a => a.decision === 'edt_requerido'),
  };

  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <button onclick="rNotas()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--txt2)">←</button>
      <div>
        <div class="pg-t">Cierre anual ${anio}</div>
        <div class="pg-s">Promoción y trayectorias — Res. 1650/2024</div>
      </div>
    </div>

    <div style="background:var(--azul-l);border-left:4px solid var(--azul);border-radius:var(--rad);padding:10px 14px;margin-bottom:16px;font-size:11px;color:var(--azul)">
      <strong>Reglas de promoción:</strong> ≤2 desaprobadas → automática · 3–4 → decisión del equipo directivo · 5+ → interviene el EDT
    </div>

    ${Object.entries(grupos).filter(([, lista]) => lista.length).map(([tipo, lista]) => {
      const info = PROMO_TIPO[tipo];
      return `
        <div class="sec-lb" style="color:${info.color}">${info.label} (${lista.length})</div>
        <div class="card" style="padding:0;margin-bottom:14px;overflow:hidden">
          ${lista.map(al => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--brd)">
              <div style="flex:1">
                <div style="font-size:12px;font-weight:600">${al.apellido}, ${al.nombre}</div>
                <div style="font-size:10px;color:var(--txt2)">${al.curso?.nombre || ''}${al.curso?.division || ''} · ${al.materias_n} mat. desaprobada(s)</div>
              </div>
              ${tipo === 'promocion_acompanada' ? `
                <select onchange="_confirmarPromocionAlumno('${al.id}',this.value)"
                  style="font-size:11px;padding:5px 8px;border:1px solid var(--brd);border-radius:var(--rad);background:var(--surf);color:var(--txt)">
                  <option value="">— Decisión —</option>
                  <option value="promovido">Promover</option>
                  <option value="no_promovido">No promover</option>
                </select>` : `
                <span class="tag ${info.tag}" style="font-size:9px">${tipo === 'promovido' ? 'Promovido' : 'EDT'}</span>`}
            </div>`).join('')}
        </div>`;
    }).join('')}

    <div style="margin-top:8px;font-size:11px;color:var(--txt3)">
      La promoción efectiva (actualizar curso_id del alumno) se realiza desde Configuración → Alumnos al inicio del próximo ciclo lectivo.
    </div>`;
}

async function _confirmarPromocionAlumno(alumnoId, decision) {
  if (!decision) return;
  const label = decision === 'promovido' ? 'promover' : 'no promover';
  if (!confirm(`¿Confirmás ${label} a este alumno?`)) return;

  const anio = new Date().getFullYear();
  const { error } = await sb.from('alertas_academicas').update({
    tipo: decision === 'promovido' ? 'resuelta' : 'promocion_acompanada',
    resuelta: decision === 'promovido',
  }).eq('alumno_id', alumnoId).eq('ciclo_lectivo', anio).not('tipo', 'is', null);

  if (error) { alert('Error: ' + error.message); return; }
  alert(`✅ Decisión registrada: ${label}.`);
}

// Funciones de carga manual movidas a intensificacion.js

async function _mostrarFormAgregarIntensif_DEAD() {
  const instId = USUARIO_ACTUAL.institucion_id;
  const anio   = new Date().getFullYear();

  let qCursos = sb.from('cursos').select('id,nombre,division,nivel').eq('institucion_id', instId).order('nombre');
  // director_general ve todos; los demás ven solo su nivel
  if (USUARIO_ACTUAL.rol !== 'director_general' && USUARIO_ACTUAL.nivel) {
    qCursos = qCursos.eq('nivel', USUARIO_ACTUAL.nivel);
  }
  const { data: cursos } = await qCursos;

  const existing = document.getElementById('modal-agregar-intensif');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-agregar-intensif';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.45);z-index:1000;display:flex;align-items:flex-end';
  modal.innerHTML = `
    <div style="background:var(--bg);border-radius:16px 16px 0 0;padding:20px;width:100%;max-height:90vh;overflow-y:auto;box-sizing:border-box">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:14px;font-weight:700">Agregar materia pendiente</div>
        <button onclick="document.getElementById('modal-agregar-intensif').remove()"
          style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--txt2);line-height:1">×</button>
      </div>

      <div style="font-size:11px;color:var(--txt2);background:var(--surf);border-radius:var(--rad);padding:10px 12px;margin-bottom:14px">
        Usá este formulario para registrar materias pendientes de alumnos que ya estaban intensificando antes de usar el sistema, o para correcciones manuales.
      </div>

      <div style="margin-bottom:12px">
        <label style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;display:block;margin-bottom:4px">Curso</label>
        <select id="ai-curso" onchange="_onCursoAgregarIntensif()"
          style="width:100%;padding:9px 12px;border:1.5px solid var(--brd);border-radius:var(--rad);font-size:12px;background:var(--surf);color:var(--txt);box-sizing:border-box">
          <option value="">— Seleccionar curso —</option>
          ${(cursos || []).map(cu => `<option value="${cu.id}">${cu.nombre}${cu.division ? ' ' + cu.division : ''} (${cu.nivel})</option>`).join('')}
        </select>
      </div>

      <div style="margin-bottom:12px">
        <label style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;display:block;margin-bottom:4px">Alumno/a</label>
        <select id="ai-alumno"
          style="width:100%;padding:9px 12px;border:1.5px solid var(--brd);border-radius:var(--rad);font-size:12px;background:var(--surf);color:var(--txt);box-sizing:border-box">
          <option value="">— Elegir curso primero —</option>
        </select>
      </div>

      <div style="margin-bottom:12px">
        <label style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;display:block;margin-bottom:4px">Materia</label>
        <select id="ai-materia"
          style="width:100%;padding:9px 12px;border:1.5px solid var(--brd);border-radius:var(--rad);font-size:12px;background:var(--surf);color:var(--txt);box-sizing:border-box">
          <option value="">— Elegir curso primero —</option>
        </select>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div>
          <label style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;display:block;margin-bottom:4px">Ciclo de origen</label>
          <input type="number" id="ai-ciclo" value="${anio - 1}" min="2020" max="${anio}"
            style="width:100%;padding:9px 12px;border:1.5px solid var(--brd);border-radius:var(--rad);font-size:12px;background:var(--surf);color:var(--txt);box-sizing:border-box">
          <div style="font-size:10px;color:var(--txt2);margin-top:3px">Año que debió cursar la materia.</div>
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;display:block;margin-bottom:4px">Estado inicial</label>
          <select id="ai-estado"
            style="width:100%;padding:9px 12px;border:1.5px solid var(--brd);border-radius:var(--rad);font-size:12px;background:var(--surf);color:var(--txt);box-sizing:border-box">
            <option value="pendiente_intensif">Pendiente de intensif.</option>
            <option value="intensificando">Intensificando</option>
            <option value="recursando">Recursando</option>
          </select>
        </div>
      </div>

      <button id="ai-btn-guardar" class="btn-p" onclick="_guardarNuevaIntensif()" style="width:100%;font-size:13px">
        Guardar materia pendiente
      </button>
    </div>`;

  document.body.appendChild(modal);
}

