// =====================================================
// CALIFICACIONES.JS v2 — Módulo completo
// =====================================================

let TIPOS_EVAL   = [];
let PERIODOS     = [];

const NOTA_COLOR = (n) => n >= 7 ? 'var(--verde)' : n >= 5 ? 'var(--ambar)' : 'var(--rojo)';
const NOTA_BG    = (n) => n >= 7 ? 'var(--verde-l)' : n >= 5 ? 'var(--amb-l)' : 'var(--rojo-l)';
const NOTA_CLS   = (n) => n >= 7 ? 'nota-ok' : n >= 5 ? 'nota-warn' : 'nota-risk';

// ─── RENDER PRINCIPAL ─────────────────────────────────
async function rNotas() {
  showLoading('notas');
  const instId = USUARIO_ACTUAL.institucion_id;
  const rol    = USUARIO_ACTUAL.rol;

  const [tiposRes, periodosRes] = await Promise.all([
    sb.from('tipos_evaluacion').select('*').eq('institucion_id', instId).eq('activo', true).order('nombre'),
    sb.from('periodos_evaluativos').select('*').eq('institucion_id', instId).eq('anio', 2026).order('nivel').order('numero'),
  ]);
  TIPOS_EVAL = tiposRes.data  || [];
  PERIODOS   = periodosRes.data || [];

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

  const { data: asigs } = await sb.from('docente_cursos')
    .select('*, cursos(id,nombre,division,nivel), materias(id,nombre)')
    .eq('usuario_id', miId).eq('activo', true);

  if (!asigs?.length) {
    c.innerHTML = `<div class="pg-t">Calificaciones</div><div class="empty-state">Sin cursos asignados.</div>`;
    return;
  }

  const cursoMap = {};
  asigs.forEach(a => {
    const cu = a.cursos;
    if (!cursoMap[cu.id]) cursoMap[cu.id] = { ...cu, materias: [] };
    cursoMap[cu.id].materias.push(a.materias);
  });

  c.innerHTML = `
    <div class="pg-t">Calificaciones</div>
    <div class="pg-s">Seleccioná curso y materia</div>
    <div class="sec-lb">Mis clases</div>
    ${Object.values(cursoMap).map(cu =>
      cu.materias.map(m => `
        <div class="card" style="display:flex;align-items:center;justify-content:space-between;
          padding:14px 16px;margin-bottom:8px;cursor:pointer;border-left:3px solid var(--verde)"
          onclick="verNotasCursoDocente('${cu.id}','${cu.nivel}','${m.id}','${cu.nombre}${cu.division}','${m.nombre}')">
          <div>
            <div style="font-size:15px;font-weight:700;font-family:'Lora',serif">${cu.nombre}${cu.division}</div>
            <div style="font-size:12px;color:var(--txt2)">${m.nombre}</div>
          </div>
          <span style="font-size:22px;color:var(--verde)">→</span>
        </div>`).join('')
    ).join('')}`;

  window._notasCursoMap = cursoMap;
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

      <!-- Stats -->
      <div class="metrics m3" style="margin-bottom:12px">
        <div class="mc">
          <div class="mc-v" style="color:var(--verde)">${alumnos.filter(al => (promedios[al.id] ?? -1) >= notaMin).length}</div>
          <div class="mc-l">Aprobados</div>
        </div>
        <div class="mc">
          <div class="mc-v" style="color:var(--rojo)">${alumnos.filter(al => promedios[al.id] !== null && promedios[al.id] < notaMin).length}</div>
          <div class="mc-l">En riesgo</div>
        </div>
        <div class="mc">
          <div class="mc-v" style="color:var(--txt3)">${alumnos.filter(al => promedios[al.id] === null).length}</div>
          <div class="mc-l">Sin notas</div>
        </div>
      </div>

      <!-- Botones acción -->
      <div class="acc" style="margin-bottom:12px">
        <button class="btn-p" onclick="abrirCargaBulk('${cursoId}','${materiaId}','${PERIODO_SEL}')">
          📝 Cargar notas
        </button>
        <button class="btn-s" onclick="crearInstancia('${cursoId}','${materiaId}','${PERIODO_SEL}','${nivel}')">
          + Nueva instancia
        </button>
        <button class="btn-s" onclick="abrirConfigCalif('${cursoId}','${materiaId}',${notaMin},${recReempl})">
          ⚙️ Configurar
        </button>
      </div>

      <!-- Grilla -->
      ${!instancias.length
        ? `<div class="empty-state">Sin instancias evaluativas.<br>Creá una con el botón "Nueva instancia".</div>`
        : `<div style="overflow-x:auto">
          <table class="grilla-notas">
            <thead>
              <tr>
                <th style="text-align:left;min-width:140px">Alumno</th>
                ${instancias.map(inst => `
                  <th class="${inst.tipos_evaluacion?.es_recuperatorio ? 'th-recup' : ''}">
                    <div style="font-size:9px;max-width:60px;white-space:normal;line-height:1.3">
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
                          <span class="nota-cell ${NOTA_CLS(nota)}" style="cursor:pointer"
                            onclick="abrirModalNota('${al.id}','${inst.id}','${cursoId}','${materiaId}','${PERIODO_SEL}',${nota})">
                            ${nota % 1 === 0 ? nota : nota.toFixed(1)}
                          </span>
                        </td>`;
                    }).join('')}
                    <td>
                      ${prom !== null
                        ? `<span style="font-weight:700;color:${NOTA_COLOR(prom)}">${prom.toFixed(1)}</span>`
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
  const { data: instancias } = await sb.from('instancias_evaluativas')
    .select('*, tipos_evaluacion(nombre)')
    .eq('curso_id', cursoId).eq('materia_id', materiaId)
    .eq('periodo_id', periodoId).order('fecha');

  if (!instancias?.length) {
    alert('Primero creá una instancia evaluativa con el botón "+ Nueva instancia".');
    return;
  }

  const { data: alumnos } = await sb.from('alumnos')
    .select('*').eq('curso_id', cursoId).eq('activo', true).order('apellido');

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

// ─── CREAR INSTANCIA EVALUATIVA ───────────────────────
async function crearInstancia(cursoId, materiaId, periodoId, nivel) {
  const { data: instExist } = await sb.from('instancias_evaluativas')
    .select('*, tipos_evaluacion(nombre)')
    .eq('curso_id', cursoId)
    .eq('periodo_id', periodoId).order('fecha')
    .eq('creado_por', USUARIO_ACTUAL.id) 
    .gte('fecha', hoy)                     
    .order('fecha');

  const hoy = new Date().toISOString().split('T')[0];

  document.getElementById('modal-instancia')?.remove();
  const modal = document.createElement('div');
  modal.id    = 'modal-instancia';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px`;
  modal.innerHTML = `
    <div style="background:var(--surf);border-radius:var(--rad-lg);padding:20px;width:100%;max-width:420px;max-height:90vh;overflow-y:auto">
      <div style="font-size:14px;font-weight:700;margin-bottom:14px">Nueva instancia evaluativa</div>

      <div class="sec-lb">Nombre</div>
      <input type="text" id="inst-nombre" placeholder="Ej: 2° Parcial — Unidad 3" style="margin-bottom:10px">

      <div class="sec-lb">Tipo</div>
      <select id="inst-tipo" class="sel-estilizado" style="margin-bottom:10px" onchange="checkRecupModal(this)">
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

      <div id="recup-orig-sel" style="display:none;margin-bottom:10px">
        <div class="sec-lb">Recuperatorio de</div>
        <select id="inst-orig" class="sel-estilizado">
          <option value="">— Elegí instancia original —</option>
          ${(instExist || []).filter(i => !i.tipos_evaluacion?.es_recuperatorio).map(i =>
            `<option value="${i.id}">${i.tipos_evaluacion?.nombre} · ${formatFechaLatam(i.fecha)}</option>`
          ).join('')}
        </select>
      </div>

      <div class="sec-lb">Fecha</div>
      <input type="date" id="inst-fecha" class="input-fecha" value="${hoy}" style="margin-bottom:10px">

      ${instExist?.length ? `
        <div style="background:var(--amb-l);border-radius:var(--rad);padding:8px 10px;font-size:10px;color:var(--ambar);margin-bottom:10px">
          ⚠️ Ya programado en este período:
          ${instExist.map(i => `<div>· ${i.tipos_evaluacion?.nombre} · ${formatFechaLatam(i.fecha)}</div>`).join('')}
        </div>` : ''}

      <div class="sec-lb">Descripción (opcional)</div>
      <textarea id="inst-desc" rows="2" placeholder="Temas evaluados, materiales..." style="margin-bottom:14px"></textarea>

      <div class="acc">
        <button class="btn-p" onclick="guardarInstancia('${cursoId}','${materiaId}','${periodoId}')">Crear</button>
        <button class="btn-s" onclick="document.getElementById('modal-instancia').remove()">Cancelar</button>
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
  const fecha   = document.getElementById('inst-fecha')?.value;
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
    <div class="pg-s">Vista institucional · Solo lectura</div>
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
    }).join('')}`;
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
        <div class="periodo-tabs">
            ${periodosCurso.map(p => `
            <button class="periodo-tab ${PERIODO_SEL === p.id ? 'on' : ''}"
            onclick="cambioPeriodoDoc('${p.id}')">
            ${p.nombre}
            </button>`).join('')}
        </div>

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
    .grilla-notas { width:100%; border-collapse:collapse; font-size:11px; }
    .grilla-notas th { padding:6px 4px; text-align:center; background:var(--surf2); border-bottom:2px solid var(--brd); font-weight:700; color:var(--txt2); font-size:10px; }
    .grilla-notas td { padding:5px 4px; text-align:center; border-bottom:1px solid var(--brd); }
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