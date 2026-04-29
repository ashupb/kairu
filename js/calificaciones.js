// =====================================================
// CALIFICACIONES.JS v2 — Módulo completo
// =====================================================

let TIPOS_EVAL   = [];
let PERIODOS     = [];
let CONFIG_NOTAS = {}; // keyed por nivel, poblado en rNotas()

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
  const criticos    = alumnos.filter(al => { const p = getPromedio(al); return p !== null && p < notaRec; });
  const observacion = alumnos.filter(al => { const p = getPromedio(al); return p !== null && p >= notaRec && p < notaMin; });
  const aprobados   = alumnos.filter(al => { const p = getPromedio(al); return p !== null && p >= notaMin; });
  const sinNotas    = alumnos.filter(al => getPromedio(al) === null);

  const listaHTML = (lista, color) => lista.map(al => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--brd)">
      <div>
        <div style="font-size:12px;font-weight:500">${al.apellido}, ${al.nombre}</div>
        ${al.cursoNombre ? `<div style="font-size:10px;color:var(--txt2)">${al.cursoNombre}</div>` : ''}
      </div>
      <span style="font-size:13px;font-weight:700;color:${color}">${(getPromedio(al) ?? 0).toFixed(1)}</span>
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

function toggleSit(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const visible = el.style.display !== 'none';
  el.style.display = visible ? 'none' : 'block';
}

// ─── RENDER PRINCIPAL ─────────────────────────────────
async function rNotas() {
  showLoading('notas');
  const instId = USUARIO_ACTUAL.institucion_id;
  const rol    = USUARIO_ACTUAL.rol;

  const [tiposRes, periodosRes, cfgNotasRes] = await Promise.all([
    sb.from('tipos_evaluacion').select('*').eq('institucion_id', instId).eq('activo', true).order('nombre'),
    sb.from('periodos_evaluativos').select('*').eq('institucion_id', instId).eq('anio', 2026).order('nivel').order('numero'),
    sb.from('config_asistencia').select('*').eq('institucion_id', instId),
  ]);
  TIPOS_EVAL   = tiposRes.data  || [];
  PERIODOS     = periodosRes.data || [];
  CONFIG_NOTAS = {};
  (cfgNotasRes.data || []).forEach(c => CONFIG_NOTAS[c.nivel] = c);

  if (rol === 'docente')                                              await rNotasDocente();
  else if (rol === 'director_general' || rol === 'directivo_nivel')  await rNotasDirectivo();
  else if (rol === 'preceptor')                                       await rNotasDirectivo();
  else if (rol === 'eoe')                                             await rNotasEOE();
  else await rNotasDirectivo();

  inyectarEstilosNotas();
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
        const labelNivel = cu.nivel === 'inicial' ? 'sala' : 'grado';
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
                  <div style="font-size:12px;font-weight:500">${m.nombre}</div>
                  <span style="color:var(--verde)">→</span>
                </div>`).join('')}
            </div>
          </div>`;
      }
      return cu.materias.map(m => `
        <div class="card" style="display:flex;align-items:center;justify-content:space-between;
          padding:14px 16px;margin-bottom:8px;cursor:pointer;border-left:3px solid var(--verde)"
          onclick="verNotasCursoDocente('${cu.id}','${cu.nivel}','${m.id}','${cu.nombre}${cu.division}','${m.nombre.replace(/'/g,"\\'")}')">
          <div>
            <div style="font-size:15px;font-weight:700;font-family:'Lora',serif">${cu.nombre}${cu.division}</div>
            <div style="font-size:12px;color:var(--txt2)">${m.nombre}</div>
          </div>
          <span style="font-size:22px;color:var(--verde)">→</span>
        </div>`).join('');
    }).join('')}
    <div class="sec-lb" style="margin-top:14px">Situación de mis alumnos</div>
    <div id="sit-docente-global" style="text-align:center;padding:20px;color:var(--txt3);font-size:11px">
      <div class="spinner" style="margin:0 auto 8px"></div>Calculando situación...
    </div>`;

  window._notasCursoMap = cursoMap;
  _cargarSituacionDocenteGlobal(cursoMap);
}

async function _cargarSituacionDocenteGlobal(cursoMap) {
  const contenedor = document.getElementById('sit-docente-global');
  if (!contenedor) return;

  const hoy = new Date();
  const cursoIds = Object.keys(cursoMap);
  if (!cursoIds.length) { contenedor.innerHTML = '<div class="empty-state">Sin cursos asignados.</div>'; return; }

  // Período activo por nivel (el docente puede tener cursos en varios niveles)
  const periodosActivosPorNivel = {};
  PERIODOS.forEach(p => {
    if (new Date(p.fecha_inicio) <= hoy && hoy <= new Date(p.fecha_fin)) {
      periodosActivosPorNivel[p.nivel] = p.id;
    }
  });

  // Si no hay períodos activos, usar los primeros de cada nivel
  if (!Object.keys(periodosActivosPorNivel).length) {
    PERIODOS.forEach(p => {
      if (!periodosActivosPorNivel[p.nivel]) periodosActivosPorNivel[p.nivel] = p.id;
    });
  }

  // Agrupar cursoIds por nivel para hacer queries por período correcto
  const cursosPorNivel = {};
  cursoIds.forEach(id => {
    const cu = cursoMap[id];
    const niv = cu?.nivel;
    if (!cursosPorNivel[niv]) cursosPorNivel[niv] = [];
    cursosPorNivel[niv].push(id);
  });

  // Fetch alumnos
  const { data: alumnos } = await sb.from('alumnos')
    .select('id,nombre,apellido,curso_id').in('curso_id', cursoIds).eq('activo', true);
  if (!alumnos?.length) { contenedor.innerHTML = '<div class="empty-state">Sin alumnos.</div>'; return; }

  // Fetch calificaciones por nivel (con su período activo correspondiente)
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

  const getPromedio = (al) => {
    const keys = Object.keys(notasPorAlumnoMateria).filter(k => k.startsWith(al.id + '_'));
    if (!keys.length) return null;
    const proms = keys.map(k => {
      const ns = notasPorAlumnoMateria[k];
      return ns.reduce((a, b) => a + b, 0) / ns.length;
    });
    return proms.reduce((a, b) => a + b, 0) / proms.length;
  };

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

  contenedor.innerHTML = renderSituacionCard(alumnosConCurso, getPromedio, 'docg-', periodoLabel);
}

async function verNotasCursoDocente(cursoId, nivel, materiaId, nombreCurso, nombreMateria) {
  const c = document.getElementById('page-notas');
  showLoading('notas');

  const periodosCurso = PERIODOS.filter(p => p.nivel === nivel);
  const hoy = new Date();
  const periodoActual = periodosCurso.find(p =>
    new Date(p.fecha_inicio) <= hoy && hoy <= new Date(p.fecha_fin)
  ) || periodosCurso[0];

  let PERIODO_SEL = periodoActual?.id || '';

  const cargarVista = async () => {
    const [alumnosRes, instanciasRes, califRes, configRes] = await Promise.all([
      sb.from('alumnos').select('*').eq('curso_id', cursoId).eq('activo', true).order('apellido'),
      sb.from('instancias_evaluativas')
        .select('*, tipos_evaluacion(nombre,es_recuperatorio)')
        .eq('curso_id', cursoId).eq('materia_id', materiaId)
        .eq('periodo_id', PERIODO_SEL).order('fecha'),
      sb.from('calificaciones').select('*')
        .eq('curso_id', cursoId).eq('materia_id', materiaId)
        .eq('periodo_id', PERIODO_SEL),
      sb.from('config_calificaciones').select('*')
        .eq('usuario_id', USUARIO_ACTUAL.id)
        .eq('materia_id', materiaId).eq('curso_id', cursoId).maybeSingle(),
    ]);

    const alumnos    = alumnosRes.data  || [];
    const instancias = instanciasRes.data || [];
    const califs     = califRes.data    || [];
    const config     = configRes.data;

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
        const esRecup = inst.tipos_evaluacion?.es_recuperatorio;
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
        const p = periodosCurso.find(p => p.id === PERIODO_SEL);
        if (!p) return '';
        if (p.validado_at) return `
          <div style="background:var(--azul-l);border-left:3px solid var(--azul);border-radius:var(--rad);
            padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:8px;font-size:11px;color:var(--azul)">
            🔒 <strong>${p.nombre}</strong> — validado y bloqueado por el preceptor
          </div>`;
        if (p.cerrado) return `
          <div style="background:var(--amb-l);border-left:3px solid var(--ambar);border-radius:var(--rad);
            padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:8px;font-size:11px;color:var(--ambar)">
            ⏳ <strong>${p.nombre}</strong> cerrado — pendiente de validación del preceptor
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
            <button class="btn-d" onclick="cerrarPeriodo('${cursoId}','${materiaId}','${PERIODO_SEL}','${p.nombre}')">
              🔒 Cerrar período
            </button>
          </div>`;
      })()}
      <!-- Grilla -->
      ${!instancias.length
        ? `<div class="empty-state">Sin instancias evaluativas.<br>Creá una con el botón "Nueva instancia".</div>`
        : `<div style="overflow-x:auto">
          <table class="grilla-notas">
            <thead>
              <tr>
                <th style="text-align:left;min-width:140px">Alumno</th>
                ${instancias.map(inst => `
                  <th class="${inst.tipos_evaluacion?.es_recuperatorio ? 'th-recup' : ''}"
                    title="${inst.tipos_evaluacion?.nombre || ''}"
                    style="width:68px;min-width:68px;max-width:68px">
                    <div style="font-size:9px;width:60px;line-height:1.3;overflow:hidden;
                      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
                      word-break:normal;overflow-wrap:normal;margin:0 auto">
                      ${inst.tipos_evaluacion?.nombre || '—'}
                    </div>
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
                    <td style="font-size:11px;font-weight:500;white-space:nowrap;cursor:pointer"
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
                    <td>
                      ${prom !== null
                        ? `<span style="font-weight:700;color:${NOTA_COLOR(prom, nivel, nombreCurso)}">${prom.toFixed(1)}</span>`
                        : `<span style="color:var(--txt3)">—</span>`}
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`}`;
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
      <input type="number" id="modal-nota-val" min="1" max="10" step="0.5"
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
    nota:           ausente ? null : nota,
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
      .select('*, tipos_evaluacion(nombre)')
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
          <option value="${i.id}">${i.tipos_evaluacion?.nombre} · ${formatFechaLatam(i.fecha)}</option>
        `).join('')}
      </select>

      <div class="card" style="padding:0;margin-bottom:14px">
        ${(alumnos || []).map((al, idx) => `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
            border-bottom:${idx < alumnos.length - 1 ? '1px solid var(--brd)' : 'none'}">
            <div class="asist-av">${al.apellido[0]}${al.nombre[0]}</div>
            <div style="flex:1;font-size:12px;font-weight:500">${al.apellido}, ${al.nombre}</div>
            <input type="number" min="1" max="10" step="0.5" placeholder="—"
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
      nota:           ausente ? null : nota,
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
      .select('*, tipos_evaluacion(nombre)')
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
          <option value="${i.id}">${i.tipos_evaluacion?.nombre} · ${formatFechaLatam(i.fecha)}</option>
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
        <input type="number" min="1" max="10" step="0.5" placeholder="—"
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
    const { data } = await sb.from('tipos_evaluacion')
      .select('*').eq('institucion_id', USUARIO_ACTUAL.institucion_id)
      .eq('activo', true).order('nombre');
    TIPOS_EVAL = data || [];
  }

  const hoy = hoyISO();

  const { data: instExist } = await sb.from('instancias_evaluativas')
    .select('*, tipos_evaluacion(nombre)')
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
            ${(instExist || []).filter(i => !i.tipos_evaluacion?.es_recuperatorio).map(i =>
              `<option value="${i.id}">${i.tipos_evaluacion?.nombre} · ${formatFechaLatam(i.fecha)}</option>`
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
              <span style="color:var(--ambar)">·</span> ${i.tipos_evaluacion?.nombre} · ${formatFechaLatam(i.fecha)}
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
async function rNotasDirectivo() {
  const c      = document.getElementById('page-notas');
  const instId = USUARIO_ACTUAL.institucion_id;
  const rol    = USUARIO_ACTUAL.rol;
  const nivel  = USUARIO_ACTUAL.nivel;

  const { data: cursos } = await sb.from('cursos')
    .select('*').eq('institucion_id', instId).order('nivel').order('nombre');

  let filtrados = cursos || [];
  if (nivel) filtrados = filtrados.filter(cu => cu.nivel === nivel);

  const niveles = ['inicial','primario','secundario'];
  const colores = { inicial:'#1a7a4a', primario:'#1a5276', secundario:'#6c3483' };

  c.innerHTML = `
    <div class="pg-t">Calificaciones</div>
    <div class="pg-s">${rol === 'preceptor' ? 'Preceptoría' : 'Vista institucional'} · Solo lectura</div>
    ${rol === 'preceptor' ? `<div style="font-size:11px;color:var(--txt2);background:var(--surf2);border-radius:var(--rad);padding:8px 12px;margin-bottom:12px">
      Ingresá a cada curso para revisar y validar el cierre de período.
    </div>` : ''}
    ${niveles.map(n => {
      const cs = filtrados.filter(cu => cu.nivel === n);
      if (!cs.length) return '';
      return `
        <div class="sec-lb" style="color:${colores[n]}">${labelNivelCalif(n)}</div>
        ${cs.map(cu => `
          <div class="card" style="display:flex;align-items:center;justify-content:space-between;
            padding:14px 16px;margin-bottom:8px;cursor:pointer;border-left:3px solid ${colores[n]}"
            onclick="verCalifCurso('${cu.id}','${cu.nivel}')">
            <div>
              <div style="font-size:15px;font-weight:700;font-family:'Lora',serif">${cu.nombre}${cu.division}</div>
              <div style="font-size:11px;color:var(--txt2)">${cu.nivel}</div>
            </div>
            <span style="font-size:22px;color:${colores[n]}">→</span>
          </div>`).join('')}`;
    }).join('')}
    <div class="sec-lb" style="margin-top:14px">Situación de alumnos</div>
    <div id="sit-dir-global" style="text-align:center;padding:20px;color:var(--txt3);font-size:11px">
      <div class="spinner" style="margin:0 auto 8px"></div>Calculando situación...
    </div>`;

  _cargarSituacionDirectivoGlobal(filtrados);
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

  const getPromedio = (al) => {
    const keys = Object.keys(notasPorAlumnoMateria).filter(k => k.startsWith(al.id + '_'));
    if (!keys.length) return null;
    const proms = keys.map(k => {
      const ns = notasPorAlumnoMateria[k];
      return ns.reduce((a, b) => a + b, 0) / ns.length;
    });
    return proms.reduce((a, b) => a + b, 0) / proms.length;
  };

  const alumnosConCurso = alumnos.map(al => ({
    ...al,
    cursoNombre: al.cursos ? `${al.cursos.nombre}${al.cursos.division}` : '',
  }));

  const nivelesConCursos = Object.keys(cursosPorNivel);
  const primerPeriodoLabel = nivelesConCursos.length === 1
    ? (PERIODOS.find(p => p.id === periodosActivosPorNivel[nivelesConCursos[0]])?.nombre || 'Año en curso')
    : 'Período activo';
  contenedor.innerHTML = renderSituacionCard(alumnosConCurso, getPromedio, 'dirg-', primerPeriodoLabel);
}

async function verCalifCurso(cursoId, nivel) {
  const c = document.getElementById('page-notas');
  showLoading('notas');

  const periodosCurso = PERIODOS.filter(p => p.nivel === nivel);
  let PERIODO_SEL     = periodosCurso[0]?.id || '';

  const { data: curso } = await sb.from('cursos').select('*').eq('id', cursoId).single();

  const renderGrilla = async () => {
    const [alumnosRes, materiasRes] = await Promise.all([
      sb.from('alumnos').select('*').eq('curso_id', cursoId).eq('activo', true).order('apellido'),
      sb.from('materias').select('*')
        .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
        .eq('nivel', nivel).eq('activo', true).order('nombre'),
    ]);

    const alumnos  = alumnosRes.data || [];
    const materias = materiasRes.data || [];

    // Períodos de este nivel que están cerrados y pendientes de validación
    const periodosPendCurso = periodosCurso.filter(p => p.cerrado && !p.validado_at);
    const validacionPendHTML = (USUARIO_ACTUAL.rol === 'preceptor' && periodosPendCurso.length) ? `
      <div style="background:var(--amb-l);border-left:3px solid var(--ambar);border-radius:var(--rad);
        padding:10px 14px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:var(--ambar);margin-bottom:8px">
          ⏳ Pendiente de validación
        </div>
        ${periodosPendCurso.map(p => `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:11px;font-weight:600">${p.nombre}</span>
            <button class="btn-p" style="font-size:10px;padding:5px 12px;background:var(--ambar)"
              onclick="validarCierrePeriodo('${p.id}','${p.nombre}')">
              ✓ Validar este curso
            </button>
          </div>`).join('')}
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

    // Promedio global por alumno (media de todas las materias)
    const promedioGlobal = {};
    alumnos.forEach(al => {
      const vals = materias
        .map(m => promediosMap[al.id]?.[m.id])
        .filter(v => v !== null && v !== undefined);
      promedioGlobal[al.id] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
    const getProm = al => promedioGlobal[al.id] ?? null;

    return `
      ${renderSituacionCard(alumnos, getProm, `dir-${cursoId.slice(-4)}-${PERIODO_SEL.slice(-4)}-`, 'Situación del curso', _umbralMin(nivel, curso?.nombre) ?? 7, _umbralRec(nivel, curso?.nombre) ?? 4)}
        <div class="periodo-tabs" style="align-items:center">
            ${periodosCurso.map(p => {
              const esSel = PERIODO_SEL === p.id;
              const estado = p.validado_at ? '🔒' : p.cerrado ? '⏳' : '';
              return `
                <button class="periodo-tab ${esSel ? 'on' : ''}"
                  onclick="cambioPeriodoDir('${p.id}')">
                  ${estado} ${p.nombre}
                </button>`;
            }).join('')}
            ${(() => {
              const pSel = periodosCurso.find(p => p.id === PERIODO_SEL);
              if (!pSel?.validado_at) return '';
              const esDir = USUARIO_ACTUAL.rol === 'director_general' || USUARIO_ACTUAL.rol === 'directivo_nivel';
              if (!esDir) return '';
              return `
                <button class="btn-d" style="font-size:10px;padding:5px 12px;margin-left:8px"
                  onclick="reabrirPeriodo('${PERIODO_SEL}','${pSel.nombre}')">
                  🔓 Reabrir para edición
                </button>`;
            })()}
        </div>
      ${validacionPendHTML}
      ${!materias.length ? '<div class="empty-state">Sin materias configuradas</div>' : `
      <div style="overflow-x:auto">
        <table class="grilla-notas">
          <thead>
            <tr>
              <th style="text-align:left;min-width:140px">Alumno</th>
              ${materias.map(m => `
                <th style="font-size:9px;max-width:55px;white-space:normal;line-height:1.3">${m.nombre}</th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${alumnos.map(al => {
              const enRiesgo = materias.filter(m => {
                const p = promediosMap[al.id]?.[m.id];
                return p !== null && p !== undefined && p < 7;
              }).length;
              return `
                <tr class="${enRiesgo >= 2 ? 'fila-riesgo' : ''}">
                  <td style="font-size:11px;font-weight:500;cursor:pointer;white-space:nowrap"
                    onclick="verAlumnoNotas('${al.id}','${cursoId}',null,'${PERIODO_SEL}')">
                    ${al.apellido}, ${al.nombre}
                    ${enRiesgo >= 2 ? '<span class="tag tr" style="font-size:9px;margin-left:4px">Riesgo</span>' : ''}
                  </td>
                  ${materias.map(m => {
                    const prom = promediosMap[al.id]?.[m.id];
                    if (prom === null || prom === undefined) return `<td><span class="grilla-nd">—</span></td>`;
                    return `
                      <td>
                        <span style="display:inline-block;min-width:28px;padding:2px 4px;border-radius:5px;
                          font-size:11px;font-weight:700;text-align:center;
                          background:${NOTA_BG(prom)};color:${NOTA_COLOR(prom)}">
                          ${prom.toFixed(1)}
                        </span>
                      </td>`;
                  }).join('')}
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`}`;
  };

  window.cambioPeriodoDir = async (pid) => {
    PERIODO_SEL = pid;
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
            <div class="card" style="margin-bottom:8px;padding:12px 14px;border-left:3px solid ${color};cursor:pointer"
              onclick="verAlumnoNotas('${al?.id}',null,null,null)">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div>
                  <div style="font-size:12px;font-weight:600">${al?.apellido}, ${al?.nombre}</div>
                  <div style="font-size:10px;color:var(--txt2)">${cu?.nombre}${cu?.division} · ${cu?.nivel}</div>
                </div>
                <span class="tag ${color === 'var(--rojo)' ? 'tr' : 'ta'}">${labels[a.tipo_alerta] || a.tipo_alerta}</span>
              </div>
              <div style="font-size:10px;color:var(--txt2);margin-top:4px">
                ${a.detalle || ''} · ${formatFechaLatam(a.fecha)}
              </div>
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
    .select('*, instancias_evaluativas(nombre,fecha,tipos_evaluacion(nombre,es_recuperatorio)), materias(nombre)')
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
            !n.instancias_evaluativas?.tipos_evaluacion?.es_recuperatorio).map(n => n.nota);
          const prom = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
          return `
            <div class="card" style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <div style="font-size:13px;font-weight:700">${materia}</div>
                ${prom !== null
                  ? `<span style="font-size:18px;font-weight:700;color:${NOTA_COLOR(prom)}">${prom.toFixed(1)}</span>`
                  : '<span style="color:var(--txt3);font-size:12px">Sin promedio</span>'}
              </div>
              ${notas.map(n => {
                const inst = n.instancias_evaluativas;
                const esR  = inst?.tipos_evaluacion?.es_recuperatorio;
                return `
                  <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--brd)">
                    <div style="flex:1">
                      <div style="font-size:11px;font-weight:500">
                        ${inst?.tipos_evaluacion?.nombre || '—'} · ${inst?.nombre || ''}
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
    await insertAlertaAcad(instId, alumnoId, cursoId, materiaId, 'promedio_bajo', `Promedio: ${prom.toFixed(1)}`);
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
    .fila-riesgo td { background:rgba(192,57,43,.06) !important; }
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