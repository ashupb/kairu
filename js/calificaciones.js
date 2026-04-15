// =====================================================
// CALIFICACIONES.JS — Módulo completo
// =====================================================

let TIPOS_EVAL    = [];
let PERIODOS      = [];
let CONFIG_CALIF  = {};

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

  if (rol === 'docente')                                     await rNotasDocente();
  else if (rol === 'director_general' || rol === 'directivo_nivel') await rNotasDirectivo();
  else if (rol === 'preceptor')                              await rNotasPreceptor();
  else if (rol === 'eoe')                                    await rNotasEOE();

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
    if (!cursoMap[cu.id]) cursoMap[cu.id] = { ...cu, materias:[] };
    cursoMap[cu.id].materias.push(a.materias);
  });

  c.innerHTML = `
  <div class="pg-t">Calificaciones</div>
  <div class="pg-s">Seleccioná curso y materia</div>
  <div class="sec-lb">Mis clases</div>
  ${Object.values(cursoMap).map(cu =>
    cu.materias.map(m => `
      <div class="card" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;margin-bottom:8px;cursor:pointer;border-left:3px solid var(--verde)"
        onclick="verNotasCursoDocente('${cu.id}','${cu.nivel}','${m.id}','${cu.nombre}${cu.division}','${m.nombre}')">
        <div>
          <div style="font-size:14px;font-weight:700;font-family:'Lora',serif">${cu.nombre}${cu.division}</div>
          <div style="font-size:12px;color:var(--txt2)">${m.nombre}</div>
        </div>
        <div style="font-size:20px;color:var(--verde)">→</div>
      </div>`).join('')
    ).join('')}`;
    

  window._notasCursoMap = cursoMap;
}

async function verNotasCursoDocente(cursoId, nivel, materiaId, nombreCurso, nombreMateria) {
  const c = document.getElementById('page-notas');
  showLoading('notas');

  const periodosCurso = PERIODOS.filter(p => p.nivel === nivel);
  const periodoActual = periodosCurso.find(p => {
    const hoy = new Date();
    return new Date(p.fecha_inicio) <= hoy && hoy <= new Date(p.fecha_fin);
  }) || periodosCurso[0];

  let PERIODO_SEL = periodoActual?.id || '';

  const renderContenido = async () => {
    const [alumnosRes, instanciasRes, califRes, configRes] = await Promise.all([
      sb.from('alumnos').select('*').eq('curso_id', cursoId).eq('activo', true).order('apellido'),
      sb.from('instancias_evaluativas').select('*, tipos_evaluacion(nombre,es_recuperatorio)')
        .eq('curso_id', cursoId).eq('materia_id', materiaId)
        .eq('periodo_id', PERIODO_SEL).order('fecha'),
      sb.from('calificaciones').select('*')
        .eq('curso_id', cursoId).eq('materia_id', materiaId)
        .eq('periodo_id', PERIODO_SEL),
      sb.from('config_calificaciones').select('*')
      .eq('usuario_id', USUARIO_ACTUAL.id)
      .eq('materia_id', materiaId).eq('curso_id', cursoId).maybeSingle(),
    ]);


    const alumnos    = alumnosRes.data    || [];
    const instancias = instanciasRes.data || [];
    const califs     = califRes.data      || [];
    const config     = configRes.data;

    const notaMin   = config?.nota_minima_aprobacion ?? 7;
    const recReempl = config?.recuperatorio_reemplaza ?? true;

    // Indexar calificaciones
    const califIdx = {};
    califs.forEach(c => califIdx[`${c.alumno_id}_${c.instancia_id}`] = c);

    // Calcular promedios
    const promedios = {};
    alumnos.forEach(al => {
      const notasAl = [];
      instancias.forEach(inst => {
        const calif = califIdx[`${al.id}_${inst.id}`];
        if (!calif || calif.ausente) return;

        // Si es recuperatorio y reemplaza, buscar la instancia original
        if (inst.tipos_evaluacion?.es_recuperatorio && recReempl && inst.instancia_original_id) {
          const keyOrig = `${al.id}_${inst.instancia_original_id}`;
          const orig    = califIdx[keyOrig];
          if (orig) {
            const idx = notasAl.findIndex(n => n.instanciaId === inst.instancia_original_id);
            if (idx >= 0) notasAl[idx].nota = calif.nota;
            else notasAl.push({ nota: calif.nota, instanciaId: inst.instancia_original_id });
            return;
          }
        }
        if (!inst.tipos_evaluacion?.es_recuperatorio || !recReempl) {
          notasAl.push({ nota: calif.nota, instanciaId: inst.id });
        }
      });
      const vals = notasAl.filter(n => n.nota !== null && n.nota !== undefined);
      promedios[al.id] = vals.length ? vals.reduce((a,b) => a + b.nota, 0) / vals.length : null;
    });

    return `
      <!-- Selector de período -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
        ${periodosCurso.map(p => `
          <button class="nivel-tab-ag ${PERIODO_SEL===p.id?'on':''}"
            style="${PERIODO_SEL===p.id?'background:var(--verde);color:#fff;border-color:var(--verde)':''}"
            onclick="cambioPeriodo('${p.id}')">
            ${p.nombre}
          </button>`).join('')}
      </div>

        <div class="acc" style="margin-top:14px">
            <button class="btn-p" onclick="cargarNotasInstancia('${cursoId}','${materiaId}','${PERIODO_SEL}')">
                📝 Cargar notas
            </button>
            <button class="btn-s" onclick="crearInstancia('${cursoId}','${materiaId}','${PERIODO_SEL}','${nivel}')">
                + Nueva instancia
            </button>
            <button class="btn-s" onclick="abrirConfigCalif('${cursoId}','${materiaId}',${notaMin},${recReempl})">
                ⚙️ Configurar
            </button>
        </div>

      <!-- Stats -->
      ${instancias.length ? `
      <div class="metrics m3" style="margin-bottom:14px">
        <div class="mc">
          <div class="mc-v" style="color:var(--verde)">${alumnos.filter(al => promedios[al.id] >= notaMin).length}</div>
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
      </div>` : ''}

      <!-- Grilla de calificaciones -->
      <div style="overflow-x:auto">
        <table class="grilla-notas">
          <thead>
            <tr>
              <th style="text-align:left;min-width:140px">Alumno</th>
              ${instancias.map(inst => `
                <th class="${inst.tipos_evaluacion?.es_recuperatorio?'th-recup':''}"
                  title="${inst.nombre} · ${formatFechaLatam(inst.fecha)}">
                  <div style="font-size:9px;max-width:60px;white-space:normal;line-height:1.2">${inst.tipos_evaluacion?.nombre||'—'}</div>
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
                  <td style="font-size:11px;font-weight:500;cursor:pointer;white-space:nowrap"
                    onclick="verAlumnoNotas('${al.id}','${cursoId}','${materiaId}','${PERIODO_SEL}')">
                    ${al.apellido}, ${al.nombre}
                  </td>
                  ${instancias.map(inst => {
                    const calif = califIdx[`${al.id}_${inst.id}`];
                    const nota  = calif?.nota;
                    const aus   = calif?.ausente;
                    if (aus) return `<td><span class="nota-cell nota-nd">A</span></td>`;
                    if (nota === null || nota === undefined) return `
                        <td>
                            <span class="nota-cell nota-nd" style="cursor:pointer"
                            onclick="editarNota('${al.id}','${inst.id}','${cursoId}','${materiaId}','${PERIODO_SEL}',null)">
                            —
                            </span>
                        </td>`;
                  }).join('')}
                  <td>
                    ${prom !== null
                      ? `<span style="font-weight:700;color:${NOTA_COLOR(prom)}">${prom.toFixed(1)}</span>`
                      : '<span style="color:var(--txt3)">—</span>'}
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Acciones -->
      <div class="acc" style="margin-top:14px">
        <button class="btn-p" onclick="crearInstancia('${cursoId}','${materiaId}','${PERIODO_SEL}','${nivel}')">+ Nueva instancia evaluativa</button>
        <button class="btn-s" onclick="abrirConfigCalif('${cursoId}','${materiaId}',${notaMin},${recReempl})">⚙️ Configurar</button>
      </div>`;
    
  };

  // Función para cambiar período sin recargar toda la página
  window.cambioPeriodo = async (pid) => {
    PERIODO_SEL = pid;
    document.getElementById('contenido-notas').innerHTML = await renderContenido();
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
    <div id="contenido-notas">${await renderContenido()}</div>`;
}

// ─── CREAR INSTANCIA EVALUATIVA ───────────────────────
async function crearInstancia(cursoId, materiaId, periodoId, nivel) {
  const c = document.getElementById('page-notas');

  // Verificar conflictos en el calendario del curso
  const { data: instExist } = await sb.from('instancias_evaluativas')
    .select('*, tipos_evaluacion(nombre)')
    .eq('curso_id', cursoId).eq('periodo_id', periodoId)
    .order('fecha');

  const recuperatorios = TIPOS_EVAL.filter(t => t.es_recuperatorio);
  const normales       = TIPOS_EVAL.filter(t => !t.es_recuperatorio);

  // Mostrar modal
  const modal = document.createElement('div');
  modal.id    = 'modal-instancia';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px`;
  modal.innerHTML = `
    <div style="background:var(--surf);border-radius:var(--rad-lg);padding:20px;width:100%;max-width:420px;max-height:90vh;overflow-y:auto">
      <div style="font-size:14px;font-weight:700;margin-bottom:14px">Nueva instancia evaluativa</div>

      <div class="sec-lb">Nombre</div>
      <input type="text" id="inst-nombre" placeholder="Ej: 2° Parcial — Unidad 3" style="margin-bottom:10px">

      <div class="sec-lb">Tipo</div>
      <select id="inst-tipo" class="sel-estilizado" style="margin-bottom:10px" onchange="checkRecup(this)">
        <option value="">— Elegí tipo —</option>
        <optgroup label="Evaluaciones">
          ${normales.map(t => `<option value="${t.id}" data-recup="false">${t.nombre}</option>`).join('')}
        </optgroup>
        <optgroup label="Recuperatorios">
          ${recuperatorios.map(t => `<option value="${t.id}" data-recup="true">${t.nombre}</option>`).join('')}
        </optgroup>
      </select>

      <div id="recup-orig" style="display:none;margin-bottom:10px">
        <div class="sec-lb">Recuperatorio de</div>
        <select id="inst-orig" class="sel-estilizado">
          <option value="">— Elegí instancia original —</option>
          ${(instExist||[]).filter(i=>!i.tipos_evaluacion?.es_recuperatorio).map(i =>
            `<option value="${i.id}">${i.tipos_evaluacion?.nombre} · ${formatFechaLatam(i.fecha)}</option>`
          ).join('')}
        </select>
      </div>

      <div class="sec-lb">Fecha</div>
      <input type="date" id="inst-fecha" class="input-fecha" style="margin-bottom:10px">

      ${instExist?.length ? `
      <div style="background:var(--amb-l);border-radius:var(--rad);padding:8px 10px;font-size:10px;color:var(--ambar);margin-bottom:10px">
        ⚠️ Instancias ya programadas en este período:
        ${instExist.map(i => `<div>${i.tipos_evaluacion?.nombre} · ${formatFechaLatam(i.fecha)}</div>`).join('')}
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

window.checkRecup = (sel) => {
  const opt    = sel.options[sel.selectedIndex];
  const esRecup = opt?.dataset?.recup === 'true';
  document.getElementById('recup-orig').style.display = esRecup ? 'block' : 'none';
};

async function guardarInstancia(cursoId, materiaId, periodoId) {
  const nombre  = document.getElementById('inst-nombre')?.value?.trim();
  const tipoId  = document.getElementById('inst-tipo')?.value;
  const fechaRaw = document.getElementById('inst-fecha')?.value;
  const fecha    = fechaRaw;
  const origId  = document.getElementById('inst-orig')?.value || null;
  const desc    = document.getElementById('inst-desc')?.value || null;

  if (!nombre) { alert('El nombre es obligatorio.'); return; }
  if (!tipoId) { alert('Elegí un tipo.'); return; }
  if (!fecha)  { alert('La fecha es obligatoria.'); return; }

  const tipo = TIPOS_EVAL.find(t => t.id === tipoId);

  const { error } = await sb.from('instancias_evaluativas').insert({
    institucion_id:       USUARIO_ACTUAL.institucion_id,
    curso_id:             cursoId,
    materia_id:           materiaId,
    tipo_id:              tipoId,
    periodo_id:           periodoId,
    creado_por:           USUARIO_ACTUAL.id,
    nombre,
    fecha,
    descripcion:          desc,
    es_recuperatorio:     tipo?.es_recuperatorio || false,
    instancia_original_id: origId,
  });

  if (error) { alert('Error: ' + error.message); return; }

  // También agregar al calendario del curso
  await sb.from('calendario_curso').insert({
    institucion_id: USUARIO_ACTUAL.institucion_id,
    curso_id:       cursoId,
    creado_por:     USUARIO_ACTUAL.id,
    titulo:         nombre,
    fecha,
    tipo:           'evaluacion',
    materia_id:     materiaId,
  });

  document.getElementById('modal-instancia')?.remove();
  window.cambioPeriodo?.(periodoId);

  // Normalizar fecha
    let fechaNorm = fecha;
    if (fecha.includes('/')) {
    const [m,d,y] = fecha.split('/');
    fechaNorm = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
}

// ─── EDITAR NOTA ──────────────────────────────────────
async function editarNota(alumnoId, instanciaId, cursoId, materiaId, periodoId, notaActual) {
  const modal = document.createElement('div');
  modal.id    = 'modal-nota';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px`;
  modal.innerHTML = `
    <div style="background:var(--surf);border-radius:var(--rad-lg);padding:20px;width:100%;max-width:300px">
      <div style="font-size:13px;font-weight:700;margin-bottom:14px">Editar nota</div>
      <div class="sec-lb">Nota (1-10)</div>
      <input type="number" id="nota-val" min="1" max="10" step="0.5" value="${notaActual || ''}" style="margin-bottom:10px;font-size:20px;font-weight:700;text-align:center">
      <label style="display:flex;align-items:center;gap:8px;font-size:11px;margin-bottom:14px;cursor:pointer">
        <input type="checkbox" id="nota-ausente"> Ausente en la evaluación
      </label>
      <div class="acc">
        <button class="btn-p" onclick="guardarNota('${alumnoId}','${instanciaId}','${cursoId}','${materiaId}','${periodoId}')">Guardar</button>
        <button class="btn-s" onclick="document.getElementById('modal-nota').remove()">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function guardarNota(alumnoId, instanciaId, cursoId, materiaId, periodoId) {
  const nota   = parseFloat(document.getElementById('nota-val')?.value);
  const ausente = document.getElementById('nota-ausente')?.checked || false;

  if (!ausente && (isNaN(nota) || nota < 1 || nota > 10)) {
    alert('La nota debe ser entre 1 y 10.');
    return;
  }

  const payload = {
    institucion_id: USUARIO_ACTUAL.institucion_id,
    alumno_id:      alumnoId,
    instancia_id:   instanciaId,
    curso_id:       cursoId,
    materia_id:     materiaId,
    periodo_id:     periodoId,
    nota:           ausente ? null : nota,
    ausente,
    registrado_por: USUARIO_ACTUAL.id,
  };

  const { error } = await sb.from('calificaciones').upsert(payload, {
    onConflict: 'alumno_id,instancia_id',
  });

  if (error) { alert('Error: ' + error.message); return; }

  document.getElementById('modal-nota')?.remove();
  await verificarAlertasAcademicas(alumnoId, cursoId, materiaId, periodoId);
  window.cambioPeriodo?.(periodoId);
}

// ─── CARGAR NOTAS DE UNA INSTANCIA (todos los alumnos) ─
async function cargarNotasInstancia(cursoId, materiaId, periodoId) {
  // Atajo rápido para cargar notas en bulk
  const { data: alumnos } = await sb.from('alumnos')
    .select('*').eq('curso_id', cursoId).eq('activo', true).order('apellido');

  const { data: instancias } = await sb.from('instancias_evaluativas')
    .select('*, tipos_evaluacion(nombre)')
    .eq('curso_id', cursoId).eq('materia_id', materiaId)
    .eq('periodo_id', periodoId).order('fecha');

  if (!instancias?.length) {
    alert('Primero creá una instancia evaluativa.');
    return;
  }

  const modal = document.createElement('div');
  modal.id    = 'modal-bulk';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px`;
  modal.innerHTML = `
    <div style="background:var(--surf);border-radius:var(--rad-lg);padding:20px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto">
      <div style="font-size:14px;font-weight:700;margin-bottom:12px">Cargar notas</div>

      <div class="sec-lb">Instancia evaluativa</div>
      <select id="bulk-inst" class="sel-estilizado" style="margin-bottom:14px">
        ${instancias.map(i => `<option value="${i.id}">${i.tipos_evaluacion?.nombre} · ${formatFechaLatam(i.fecha)}</option>`).join('')}
      </select>

      <div class="card" style="padding:0;margin-bottom:14px">
        ${(alumnos||[]).map(al => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid var(--brd)">
            <div style="flex:1;font-size:12px;font-weight:500">${al.apellido}, ${al.nombre}</div>
            <input type="number" min="1" max="10" step="0.5" placeholder="—"
              data-alumno="${al.id}"
              style="width:60px;text-align:center;border:1px solid var(--brd);border-radius:var(--rad);padding:5px;font-size:13px;font-weight:700">
            <label style="font-size:10px;display:flex;align-items:center;gap:4px">
              <input type="checkbox" data-aus="${al.id}"> Ausente
            </label>
          </div>`).join('')}
      </div>

      <div class="acc">
        <button class="btn-p" onclick="guardarNotasBulk('${cursoId}','${materiaId}','${periodoId}')"> Guardar todas </button>
        <button class="btn-s" onclick="document.getElementById('modal-bulk').remove()">Cancelar</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
}

async function guardarNotasBulk(cursoId, materiaId, periodoId) {
  const instId  = document.getElementById('bulk-inst')?.value;
  const inputs  = document.querySelectorAll('[data-alumno]');
  const registros = [];

  inputs.forEach(inp => {
    const alumnoId = inp.dataset.alumno;
    const nota     = parseFloat(inp.value);
    const ausente  = document.querySelector(`[data-aus="${alumnoId}"]`)?.checked || false;
    if (!ausente && isNaN(nota)) return;
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

  if (!registros.length) { alert('No ingresaste ninguna nota.'); return; }

  const { error } = await sb.from('calificaciones').upsert(registros, {
    onConflict: 'alumno_id,instancia_id',
  });

  if (error) { alert('Error: ' + error.message); return; }

  document.getElementById('modal-bulk')?.remove();
  window.cambioPeriodo?.(periodoId);
}

// ─── CONFIG CALIFICACIONES ────────────────────────────
async function abrirConfigCalif(cursoId, materiaId, notaMin, recReempl) {
  const modal = document.createElement('div');
  modal.id    = 'modal-config-calif';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px`;
  modal.innerHTML = `
    <div style="background:var(--surf);border-radius:var(--rad-lg);padding:20px;width:100%;max-width:360px">
      <div style="font-size:14px;font-weight:700;margin-bottom:14px">⚙️ Configuración de calificaciones</div>

      <div class="sec-lb">Nota mínima de aprobación</div>
      <input type="number" id="cfg-nota-min" min="1" max="10" step="0.5" value="${notaMin}"
        style="margin-bottom:12px;font-size:18px;font-weight:700;text-align:center;width:80px">

      <div class="sec-lb">Recuperatorio</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
          <input type="radio" name="recup" value="true" ${recReempl?'checked':''}>
          Reemplaza la nota original
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
          <input type="radio" name="recup" value="false" ${!recReempl?'checked':''}>
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
  const recReempl = document.querySelector('[name="recup"]:checked')?.value === 'true';

  await sb.from('config_calificaciones').upsert({
    institucion_id:           USUARIO_ACTUAL.institucion_id,
    usuario_id:               USUARIO_ACTUAL.id,
    materia_id:               materiaId,
    curso_id:                 cursoId,
    nota_minima_aprobacion:   notaMin,
    recuperatorio_reemplaza:  recReempl,
  }, { onConflict: 'usuario_id,materia_id,curso_id' });

  document.getElementById('modal-config-calif')?.remove();
}

// ═══════════════════════════════════════════════════════
// DIRECTIVO / PRECEPTOR / EOE — SOLO LECTURA
// ═══════════════════════════════════════════════════════
async function rNotasDirectivo() {
  const c      = document.getElementById('page-notas');
  const instId = USUARIO_ACTUAL.institucion_id;
  const nivel  = USUARIO_ACTUAL.nivel; // null para director_general

  const { data: cursos } = await sb.from('cursos')
    .select('*').eq('institucion_id', instId)
    .order('nivel').order('nombre');

  const filtrados = nivel ? cursos.filter(cu => cu.nivel === nivel) : cursos;
  const niveles   = ['inicial','primario','secundario'];
  const colores   = { inicial:'#1a7a4a', primario:'#1a5276', secundario:'#6c3483' };

  c.innerHTML = `
    <div class="pg-t">Calificaciones</div>
    <div class="pg-s">Vista institucional</div>
    ${niveles.map(n => {
      const cs = filtrados.filter(cu => cu.nivel === n);
      if (!cs.length) return '';
      return `
        <div class="sec-lb" style="color:${colores[n]}">${labelNivelCalif(n)}</div>
        <div class="curso-grid-asist">
          ${cs.map(cu => `
            <div class="curso-card-asist" onclick="verCalifCurso('${cu.id}','${cu.nivel}')">
              <div class="cca-top">
                <div class="cca-badge" style="background:${colores[n]}18;color:${colores[n]}">${cu.nombre}${cu.division}</div>
                <span>→</span>
              </div>
              <div style="font-size:10px;color:var(--txt2);margin-top:4px">Ver calificaciones</div>
            </div>`).join('')}
        </div>`;
    }).join('')}`;
}

async function rNotasPreceptor() {
  await rNotasDirectivo(); // misma vista
}

async function rNotasEOE() {
  const c      = document.getElementById('page-notas');
  const instId = USUARIO_ACTUAL.institucion_id;

  // EOE ve alertas académicas
  const { data: alertas } = await sb.from('alertas_academicas')
    .select('*, alumnos(nombre,apellido,cursos(nombre,division,nivel)), materias(nombre)')
    .eq('institucion_id', instId)
    .order('created_at', { ascending: false }).limit(40);

  c.innerHTML = `
    <div class="pg-t">Calificaciones</div>
    <div class="pg-s">Alertas académicas activas</div>
    ${!(alertas?.length) ? '<div class="empty-state">✅ Sin alertas académicas activas</div>' :
      alertas.map(a => {
        const al  = a.alumnos;
        const cu  = al?.cursos;
        const labels = {
          nota_baja:           '⚠️ Nota baja',
          promedio_bajo:       '📉 Promedio bajo',
          riesgo_academico:    '🔴 Riesgo académico',
          multiples_reprobadas:'🚨 Múltiples reprobadas',
        };
        const color = ['riesgo_academico','multiples_reprobadas'].includes(a.tipo_alerta) ? 'var(--rojo)' : 'var(--ambar)';
        return `
          <div class="card" style="margin-bottom:8px;padding:12px 14px;border-left:3px solid ${color};cursor:pointer"
            onclick="verCalifAlumno('${al?.id}')">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <div style="font-size:12px;font-weight:600">${al?.apellido}, ${al?.nombre}</div>
                <div style="font-size:10px;color:var(--txt2)">${cu?.nombre}${cu?.division} · ${a.materias?.nombre||'General'}</div>
              </div>
              <span class="tag ${color===('var(--rojo)')?'tr':'ta'}">${labels[a.tipo_alerta]||a.tipo_alerta}</span>
            </div>
            <div style="font-size:10px;color:var(--txt2);margin-top:4px">${a.detalle||''} · ${formatFechaLatam(a.fecha)}</div>
          </div>`;
      }).join('')}`;
}

async function verCalifCurso(cursoId, nivel) {
  const c = document.getElementById('page-notas');
  showLoading('notas');

  const periodosCurso = PERIODOS.filter(p => p.nivel === nivel);
  const periodoActual = periodosCurso[0];
  let PERIODO_SEL     = periodoActual?.id || '';

  const renderVista = async () => {
    const [alumnosRes, materiasRes] = await Promise.all([
      sb.from('alumnos').select('*').eq('curso_id', cursoId).eq('activo', true).order('apellido'),
      sb.from('materias').select('*').eq('institucion_id', USUARIO_ACTUAL.institucion_id).eq('nivel', nivel).order('nombre'),
    ]);

    const alumnos  = alumnosRes.data || [];
    const materias = materiasRes.data || [];

    // Para cada materia, calcular promedio por alumno
    const promediosMap = {}; // [alumnoId][materiaId] = promedio
    for (const m of materias) {
      const { data: califs } = await sb.from('calificaciones')
        .select('alumno_id, nota, ausente, instancias_evaluativas(es_recuperatorio)')
        .eq('curso_id', cursoId).eq('materia_id', m.id).eq('periodo_id', PERIODO_SEL);

      alumnos.forEach(al => {
        const notasAl = (califs||[])
          .filter(c => c.alumno_id === al.id && !c.ausente && c.nota !== null && !c.instancias_evaluativas?.es_recuperatorio);
        const vals = notasAl.map(c => c.nota);
        if (!promediosMap[al.id]) promediosMap[al.id] = {};
        promediosMap[al.id][m.id] = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
      });
    }

    return `
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
        ${periodosCurso.map(p => `
          <button class="nivel-tab-ag ${PERIODO_SEL===p.id?'on':''}"
            style="${PERIODO_SEL===p.id?'background:var(--verde);color:#fff;border-color:var(--verde)':''}"
            onclick="cambioPeriodoCalif('${p.id}')">
            ${p.nombre}
          </button>`).join('')}
      </div>

      <div style="overflow-x:auto">
        <table class="grilla-notas">
          <thead>
            <tr>
              <th style="text-align:left;min-width:140px">Alumno</th>
              ${materias.map(m => `<th style="font-size:9px;max-width:55px;white-space:normal;line-height:1.2">${m.nombre}</th>`).join('')}
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
                    onclick="verCalifAlumno('${al.id}')">
                    ${al.apellido}, ${al.nombre}
                    ${enRiesgo >= 2 ? '<span class="tag tr" style="font-size:9px;margin-left:4px">Riesgo</span>' : ''}
                  </td>
                  ${materias.map(m => {
                    const prom = promediosMap[al.id]?.[m.id];
                    if (prom === null || prom === undefined) return `<td><span class="grilla-nd">—</span></td>`;
                    return `<td><span style="display:inline-block;width:28px;height:28px;border-radius:6px;font-size:11px;font-weight:700;line-height:28px;text-align:center;background:${NOTA_BG(prom)};color:${NOTA_COLOR(prom)}">${prom.toFixed(1)}</span></td>`;
                  }).join('')}
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  };

  window.cambioPeriodoCalif = async (pid) => {
    PERIODO_SEL = pid;
    document.getElementById('contenido-calif-dir').innerHTML = await renderVista();
    inyectarEstilosNotas();
  };

  const { data: curso } = await sb.from('cursos').select('*').eq('id', cursoId).single();

  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <button onclick="rNotasDirectivo()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--txt2)">←</button>
      <div>
        <div class="pg-t">${curso?.nombre}${curso?.division} · Calificaciones</div>
        <div class="pg-s">${nivel}</div>
      </div>
    </div>
    <div id="contenido-calif-dir">${await renderVista()}</div>`;
}

// ─── VER ALUMNO ───────────────────────────────────────
async function verCalifAlumno(alumnoId) {
  const c = document.getElementById('page-notas');
  showLoading('notas');

  const { data: al } = await sb.from('alumnos')
    .select('*, cursos(nombre,division,nivel)').eq('id', alumnoId).single();

  const nivel  = al?.cursos?.nivel || 'secundario';
  const periodosCurso = PERIODOS.filter(p => p.nivel === nivel);

  const { data: califs } = await sb.from('calificaciones')
    .select('*, instancias_evaluativas(nombre,fecha,tipos_evaluacion(nombre,es_recuperatorio)), materias(nombre)')
    .eq('alumno_id', alumnoId).order('materias(nombre)');

  // Agrupar por materia y período
  const porMateria = {};
  califs?.forEach(c => {
    const mat = c.materias?.nombre || 'Sin materia';
    if (!porMateria[mat]) porMateria[mat] = [];
    porMateria[mat].push(c);
  });

  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <button onclick="history.back()" onclick="rNotas()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--txt2)">←</button>
      <div>
        <div class="pg-t">${al?.apellido}, ${al?.nombre}</div>
        <div class="pg-s">${al?.cursos?.nombre}${al?.cursos?.division} · ${nivel}</div>
      </div>
    </div>

    ${Object.keys(porMateria).length === 0 ? '<div class="empty-state">Sin calificaciones registradas</div>' :
      Object.entries(porMateria).map(([materia, notas]) => {
        const vals  = notas.filter(n => !n.ausente && n.nota !== null && !n.instancias_evaluativas?.tipos_evaluacion?.es_recuperatorio);
        const prom  = vals.length ? vals.reduce((a,b) => a + b.nota, 0) / vals.length : null;
        return `
          <div class="card" style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <div style="font-size:13px;font-weight:700">${materia}</div>
              ${prom !== null ? `
                <span style="font-size:16px;font-weight:700;color:${NOTA_COLOR(prom)}">${prom.toFixed(1)}</span>
              ` : '<span style="color:var(--txt3);font-size:12px">Sin promedio</span>'}
            </div>
            ${notas.map(n => {
              const inst = n.instancias_evaluativas;
              const esRecup = inst?.tipos_evaluacion?.es_recuperatorio;
              return `
                <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--brd)">
                  <div style="flex:1">
                    <div style="font-size:11px;font-weight:500">${inst?.tipos_evaluacion?.nombre||'—'} · ${inst?.nombre||''}</div>
                    <div style="font-size:10px;color:var(--txt2)">${formatFechaLatam(inst?.fecha)}</div>
                  </div>
                  ${n.ausente
                    ? '<span class="tag tgr">Ausente</span>'
                    : n.nota !== null
                      ? `<span style="font-size:14px;font-weight:700;color:${NOTA_COLOR(n.nota)}">${n.nota % 1 === 0 ? n.nota : n.nota.toFixed(1)}</span>`
                      : '<span style="color:var(--txt3)">—</span>'}
                  ${esRecup ? '<span class="tag tp" style="font-size:9px">Recup.</span>' : ''}
                </div>`;
            }).join('')}
          </div>`;
      }).join('')}`;
}

// ─── ALERTAS ACADÉMICAS ───────────────────────────────
async function verificarAlertasAcademicas(alumnoId, cursoId, materiaId, periodoId) {
  const { data: califs } = await sb.from('calificaciones')
    .select('nota, ausente, instancias_evaluativas(es_recuperatorio)')
    .eq('alumno_id', alumnoId).eq('materia_id', materiaId).eq('periodo_id', periodoId);

  const notas   = (califs||[]).filter(c => !c.ausente && c.nota !== null && !c.instancias_evaluativas?.es_recuperatorio).map(c => c.nota);
  const prom    = notas.length ? notas.reduce((a,b)=>a+b,0)/notas.length : null;
  const notaMin = 7;

  const instId  = USUARIO_ACTUAL.institucion_id;

  // Nota baja en instancia
  const ultimaNota = califs?.filter(c => !c.ausente && c.nota !== null).slice(-1)[0]?.nota;
  if (ultimaNota !== undefined && ultimaNota < notaMin) {
    await insertAlertaAcad(instId, alumnoId, cursoId, materiaId, 'nota_baja', `Nota: ${ultimaNota}`);
  }

  // Promedio bajo
  if (prom !== null && prom < notaMin) {
    await insertAlertaAcad(instId, alumnoId, cursoId, materiaId, 'promedio_bajo', `Promedio: ${prom.toFixed(1)}`);
  }

  // Verificar materias en riesgo total
  const { data: todasCalifs } = await sb.from('calificaciones')
    .select('materia_id, nota, ausente, instancias_evaluativas(es_recuperatorio)')
    .eq('alumno_id', alumnoId).eq('curso_id', cursoId).eq('periodo_id', periodoId);

  const porMateria = {};
  (todasCalifs||[]).forEach(c => {
    if (!c.ausente && c.nota !== null && !c.instancias_evaluativas?.es_recuperatorio) {
      if (!porMateria[c.materia_id]) porMateria[c.materia_id] = [];
      porMateria[c.materia_id].push(c.nota);
    }
  });

  const materiasRiesgo = Object.entries(porMateria).filter(([mid, notas]) => {
    const p = notas.reduce((a,b)=>a+b,0)/notas.length;
    return p < notaMin;
  }).length;

  if (materiasRiesgo >= 2) {
    await insertAlertaAcad(instId, alumnoId, cursoId, null, 'riesgo_academico',
      `${materiasRiesgo} materias con promedio bajo`, materiasRiesgo);
  }
}

async function insertAlertaAcad(instId, alumnoId, cursoId, materiaId, tipo, detalle, totalMaterias = null) {
  const { data: existe } = await sb.from('alertas_academicas')
    .select('id').eq('alumno_id', alumnoId).eq('tipo_alerta', tipo)
    .eq('materia_id', materiaId || null).maybeSingle();
  if (existe) return;

  await sb.from('alertas_academicas').insert({
    institucion_id:        instId,
    alumno_id:             alumnoId,
    curso_id:              cursoId,
    materia_id:            materiaId,
    tipo_alerta:           tipo,
    detalle,
    total_materias_riesgo: totalMaterias,
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
    .grilla-notas{width:100%;border-collapse:collapse;font-size:11px;}
    .grilla-notas th{padding:6px 4px;text-align:center;background:var(--surf2);border-bottom:2px solid var(--brd);font-weight:700;color:var(--txt2);font-size:10px;}
    .grilla-notas td{padding:5px 4px;text-align:center;border-bottom:1px solid var(--brd);}
    .grilla-notas tr:hover td{background:var(--surf2);}
    .grilla-notas .th-recup{background:var(--azul-l);color:var(--azul);}
    .nota-cell{display:inline-block;min-width:26px;padding:2px 4px;border-radius:5px;font-size:11px;font-weight:700;text-align:center;}
    .fila-riesgo td{background:var(--rojo-l)!important;opacity:.9;}

    .nota-ok   { background:var(--verde-l); color:var(--verde); }
    .nota-warn { background:var(--amb-l);   color:var(--ambar); }
    .nota-risk { background:var(--rojo-l);  color:var(--rojo);  }
    .nota-nd   { background:var(--gris-l);  color:var(--gris);  }
    .curso-card-asist { cursor: pointer !important; }

    @media(max-width:768px){
      .grilla-notas{font-size:10px;}
      .grilla-notas th{font-size:9px;padding:4px 2px;}
      .grilla-notas td{padding:4px 2px;}
      .nota-cell{min-width:22px;font-size:10px;}
    }
  `;
  document.head.appendChild(st);
}