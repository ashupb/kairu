// =====================================================
// ASISTENCIA.JS v2
// =====================================================

let TIPOS_JUST   = [];
let CONFIG_ASIST = {};
let HORA_SEL     = null;

function validarFechaHabilInput(inputEl) {
  const val = inputEl.value;
  if (!val) return;
  if (!esFechaHabil(val)) {
    alert('No se toma asistencia los fines de semana, feriados ni días sin clases. Se seleccionó el día hábil anterior.');
    inputEl.value = diaHabilMasReciente(val);
  }
}

const ESTADOS_ASIST = {
  presente:    { label:'Presente',    short:'P', icon:'✅', color:'var(--verde)',  bg:'var(--verde-l)', valor:0 },
  ausente:     { label:'Ausente',     short:'A', icon:'❌', color:'var(--rojo)',   bg:'var(--rojo-l)',  valor:1 },
  media_falta: { label:'Media falta', short:'M', icon:'🕐', color:'var(--ambar)', bg:'var(--amb-l)',   valor:0.5 },
  tardanza:    { label:'Tardanza',    short:'T', icon:'⏰', color:'var(--ambar)', bg:'var(--amb-l)',   valor:0.25 },
  justificado: { label:'Justificado', short:'J', icon:'📋', color:'var(--azul)',  bg:'var(--azul-l)',  valor:0 },
};

const NIVEL_COLORS = {
  inicial:'#1a7a4a', primario:'#1a5276', secundario:'#6c3483'
};

// ─── RENDER PRINCIPAL ─────────────────────────────────
async function rAsist() {
  showLoading('asist');
  const instId = USUARIO_ACTUAL.institucion_id;
  const rol    = USUARIO_ACTUAL.rol;

  const [configRes, justRes, noLectRes] = await Promise.all([
    sb.from('config_asistencia').select('*').eq('institucion_id', instId),
    sb.from('tipos_justificacion').select('*').eq('institucion_id', instId).eq('activo', true),
    sb.from('dias_no_lectivos').select('id,fecha,motivo').eq('institucion_id', instId).order('fecha'),
  ]);
  TIPOS_JUST   = justRes.data || [];
  CONFIG_ASIST = {};
  (configRes.data || []).forEach(c => CONFIG_ASIST[c.nivel] = c);
  window._diasNoLectivos     = new Set((noLectRes.data || []).map(r => r.fecha));
  window._diasNoLectivosData = noLectRes.data || [];

  if (rol === 'director_general' || rol === 'directivo_nivel') await rAsistDirector();
  else if (rol === 'docente')   await rAsistDocente();
  else if (rol === 'preceptor') await rAsistPreceptor();
  else if (rol === 'eoe')       await rAsistEOE();

  inyectarEstilosAsist();

  if (window._pendingAlumnoId) {
    const id = window._pendingAlumnoId;
    window._pendingAlumnoId = null;
    await verAlumnoAsist(id);
  }
}

// ═══════════════════════════════════════════════════════
// DIRECTOR
// ═══════════════════════════════════════════════════════
async function rAsistDirector() {
  const c      = document.getElementById('page-asist');
  const instId = USUARIO_ACTUAL.institucion_id;
  const hoy    = hoyISO();
  const nivel  = USUARIO_ACTUAL.rol === 'directivo_nivel' ? USUARIO_ACTUAL.nivel : null;

  const [cursosRes, alumnosRes, asistHoyRes] = await Promise.all([
    sb.from('cursos').select('*').eq('institucion_id', instId)
      .order('nivel').order('nombre')
      .then(r => nivel ? { data: (r.data||[]).filter(c => c.nivel === nivel) } : r),
    sb.from('alumnos').select('id,curso_id').eq('institucion_id', instId).or('activo.is.null,activo.eq.true'),
    sb.from('asistencia').select('alumno_id,estado').eq('fecha', hoy).is('hora_clase', null),
  ]);

  const cursos   = cursosRes.data  || [];
  const alumnos  = alumnosRes.data || [];
  const asistHoy = asistHoyRes.data || [];
  const asistSet = new Set(asistHoy.map(a => a.alumno_id));

  // Contadores globales de estados del día
  const contadorEstados = { presente:0, ausente:0, media_falta:0, tardanza:0, justificado:0 };
  asistHoy.forEach(a => { if (contadorEstados[a.estado] !== undefined) contadorEstados[a.estado]++; });
  const totalRegistradosHoy = asistHoy.length;
  const totalAlumnosHoy     = alumnos.length;
  const pctAsistHoy         = totalRegistradosHoy > 0
    ? Math.round((contadorEstados.presente + contadorEstados.tardanza + contadorEstados.media_falta) / totalRegistradosHoy * 100)
    : null;

  // Calcular estado por curso
  const alumnosPorCurso = {};
  alumnos.forEach(a => {
    if (!alumnosPorCurso[a.curso_id]) alumnosPorCurso[a.curso_id] = [];
    alumnosPorCurso[a.curso_id].push(a.id);
  });

  const niveles = nivel ? [nivel] : ['inicial','primario','secundario'];
  const hoyHabil = esFechaHabil(hoy);
  const totalPendiente = hoyHabil ? cursos.filter(cu => {
    const ids = alumnosPorCurso[cu.id] || [];
    return ids.length > 0 && ids.filter(id => asistSet.has(id)).length < ids.length;
  }).length : 0;

  const pctColor = pctAsistHoy === null ? 'var(--txt3)' : pctAsistHoy>=85?'var(--verde)':pctAsistHoy>=70?'var(--ambar)':'var(--rojo)';
  const contCardsHTML = totalRegistradosHoy > 0 ? `
    <div class="mc-asist-grid">
      <div class="mc-asist" style="border-top:3px solid var(--verde)">
        <div class="mc-asist-v" style="color:var(--verde)">${contadorEstados.presente}</div>
        <div class="mc-asist-l">Presentes</div>
      </div>
      <div class="mc-asist" style="border-top:3px solid var(--rojo)">
        <div class="mc-asist-v" style="color:var(--rojo)">${contadorEstados.ausente}</div>
        <div class="mc-asist-l">Ausentes</div>
      </div>
      <div class="mc-asist" style="border-top:3px solid var(--azul)">
        <div class="mc-asist-v" style="color:var(--azul)">${contadorEstados.justificado}</div>
        <div class="mc-asist-l">Justificados</div>
      </div>
      <div class="mc-asist" style="border-top:3px solid var(--ambar)">
        <div class="mc-asist-v" style="color:var(--ambar)">${contadorEstados.media_falta + contadorEstados.tardanza}</div>
        <div class="mc-asist-l">Tard. / M.F.</div>
      </div>
      <div class="mc-asist" style="border-top:3px solid ${pctColor}">
        <div class="mc-asist-v" style="color:${pctColor}">${pctAsistHoy === null ? '—' : pctAsistHoy + '%'}</div>
        <div class="mc-asist-l">Asistencia</div>
      </div>
    </div>` : '';

  c.innerHTML = `
    <div class="pg-t">Asistencia</div>
    <div class="pg-s">${formatFechaLatam(hoy)} · Estado de listas</div>
    ${contCardsHTML}
    ${totalPendiente > 0 ? `
    <div class="alr" style="margin-bottom:14px">
      <div class="alr-t">⏳ ${totalPendiente} curso${totalPendiente>1?'s':''} con lista pendiente hoy</div>
    </div>` : `
    <div class="card" style="margin-bottom:14px;display:flex;align-items:center;gap:8px">
      <span style="font-size:18px">✓</span>
      <span style="font-size:12px;color:var(--verde);font-weight:600">Todos los preceptores están al día</span>
    </div>`}
    ${['director_general','directivo_nivel'].includes(USUARIO_ACTUAL.rol) ? `<div id="dnl-seccion">${_renderDNLSeccion()}</div>` : ''}
    ${niveles.map(n => {
      const cs = cursos.filter(cu => cu.nivel === n);
      if (!cs.length) return '';
      return `
        <div class="sec-lb" style="color:${NIVEL_COLORS[n]}">${labelNivel(n)}</div>
        <div class="curso-grid-asist">
          ${cs.map(cu => {
            const ids       = alumnosPorCurso[cu.id] || [];
            const total     = ids.length;
            const registrados = Math.min(total, ids.filter(id => asistSet.has(id)).length);
            const listo     = total > 0 && registrados >= total;
            const enProg    = registrados > 0 && registrados < total;
            const statusClr = listo ? 'var(--verde)' : enProg ? 'var(--ambar)' : total > 0 ? 'var(--rojo)' : 'var(--txt3)';
            const statusLbl = listo ? '✓ Al día' : enProg ? `${registrados}/${total}` : total > 0 ? 'Pendiente' : 'Sin alumnos';
            return `
              <div class="curso-card-asist" style="border-top:3px solid ${NIVEL_COLORS[n]}" onclick="verCursoDirector('${cu.id}','${cu.nivel}')">
                <div class="cca-badge" style="background:${NIVEL_COLORS[n]}18;color:${NIVEL_COLORS[n]};display:inline-block;margin-bottom:10px">${cu.nombre}${cu.division||''}</div>
                <div class="cca-bottom">
                  <span style="font-size:11px;color:var(--txt2)">${total} alumno${total!==1?'s':''}</span>
                  <span class="cca-status" style="color:${statusClr}">${statusLbl}</span>
                </div>
              </div>`;
          }).join('')}
        </div>`;
    }).join('')}`;
}

async function verCursoDirector(cursoId, nivel) {
  const c = document.getElementById('page-asist');
  showLoading('asist');

  const [cursoRes, alumnosRes, asistRes] = await Promise.all([
    sb.from('cursos').select('*').eq('id', cursoId).single(),
    sb.from('alumnos').select('*').eq('curso_id', cursoId).eq('activo', true).order('apellido'),
    sb.from('asistencia').select('*').eq('curso_id', cursoId).is('hora_clase', null)
      .gte('fecha', (() => { const d = new Date(); d.setMonth(d.getMonth()-1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })())
      .order('fecha'),
  ]);

  const curso   = cursoRes.data;
  const alumnos = alumnosRes.data || [];
  const asists  = asistRes.data   || [];
  const config  = CONFIG_ASIST[nivel] || {};

  // Agrupar asistencias por fecha
  const fechas = [...new Set(asists.map(a => a.fecha))].sort();

  // Calcular totales por alumno — solo registros diarios (hora_clase null).
  // Registros por hora/materia (secundario) no computan para regularidad.
  const totalPorAlumno = {};
  alumnos.forEach(al => totalPorAlumno[al.id] = 0);
  // Deduplicar por alumno+fecha antes de sumar (defensivo contra duplicados históricos)
  const asistDiarios = {};
  asists.filter(a => !a.hora_clase).forEach(a => {
    asistDiarios[`${a.alumno_id}_${a.fecha}`] = a;
  });
  Object.values(asistDiarios).forEach(a => {
    if (a.estado === 'justificado' && !config.justificadas_cuentan) return;
    const val = ESTADOS_ASIST[a.estado]?.valor || 0;
    totalPorAlumno[a.alumno_id] = (totalPorAlumno[a.alumno_id] || 0) + val;
  });

  // Stats generales de hoy — solo registros diarios
  const hoy     = hoyISO();
  const asistHoy = asists.filter(a => a.fecha === hoy && !a.hora_clase);
  // Deduplicar por alumno (por si hay duplicados del mismo día)
  const asistHoyMap = {};
  asistHoy.forEach(a => { asistHoyMap[a.alumno_id] = a; });
  const asistHoyUniq = Object.values(asistHoyMap);
  const presHoy = asistHoyUniq.filter(a => ['presente','tardanza','media_falta'].includes(a.estado)).length;
  const ausHoy  = asistHoyUniq.filter(a => a.estado === 'ausente').length;
  const pctPres = alumnos.length ? Math.round(presHoy/alumnos.length*100) : 0;

  // Alumnos en riesgo
  const enRiesgo = alumnos.filter(al => totalPorAlumno[al.id] >= (config.umbral_alerta_2 ?? 20));

  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <button onclick="rAsistDirector()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--txt2)">←</button>
      <div>
        <div class="pg-t">${curso?.nombre}${curso?.division}</div>
        <div class="pg-s">${nivel} · ${alumnos.length} alumnos</div>
      </div>
    </div>

    <!-- Stats hoy -->
    <div class="metrics m3" style="margin-bottom:14px">
      <div class="mc">
        <div class="mc-v" style="color:var(--verde)">${presHoy}</div>
        <div class="mc-l">Presentes hoy</div>
      </div>
      <div class="mc">
        <div class="mc-v" style="color:var(--rojo)">${ausHoy}</div>
        <div class="mc-l">Ausentes hoy</div>
      </div>
      <div class="mc">
        <div class="mc-v" style="color:${pctPres>=80?'var(--verde)':pctPres>=60?'var(--ambar)':'var(--rojo)'}">${pctPres}%</div>
        <div class="mc-l">Asistencia hoy</div>
      </div>
    </div>

    ${enRiesgo.length ? `
    <div class="alr" style="margin-bottom:14px">
      <div class="alr-t">⚠️ ${enRiesgo.length} alumno(s) con faltas elevadas</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        ${enRiesgo.map(al => `
          <span class="tag tr" style="cursor:pointer" onclick="verAlumnoAsist('${al.id}')">
            ${al.apellido}
          </span>`).join('')}
      </div>
    </div>` : ''}

    <!-- Tabs -->
    <div style="display:flex;gap:6px;margin-bottom:14px">
      <button class="btn-p" style="font-size:11px" onclick="mostrarGrillaDirector('${cursoId}','${nivel}')">📊 Grilla completa</button>
    </div>

    <!-- Resumen por alumno -->
    <div class="sec-lb">Estado por alumno</div>
    <div class="card" style="padding:0">
      ${alumnos.map(al => {
        const faltas = totalPorAlumno[al.id] || 0;
        const color  = faltas >= (config.umbral_alerta_2??20) ? 'var(--rojo)' : faltas >= (config.umbral_alerta_1??10) ? 'var(--ambar)' : 'var(--verde)';
        const pct    = config.umbral_regularidad ? Math.min(Math.round(faltas/config.umbral_regularidad*100),100) : 0;
        return `
          <div class="asist-alumno-row" onclick="verAlumnoAsist('${al.id}')">
            <div class="asist-av">${(al.apellido||'?')[0]}${(al.nombre||'?')[0]}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600">${al.apellido}, ${al.nombre}</div>
              <div style="margin-top:4px;background:var(--gris-l);border-radius:3px;height:5px">
                <div style="width:${pct}%;background:${color};height:5px;border-radius:3px"></div>
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:13px;font-weight:700;color:${color}">${faltas}</div>
              <div style="font-size:9px;color:var(--txt3)">faltas</div>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

async function mostrarGrillaDirector(cursoId, nivel) {
  const c = document.getElementById('page-asist');
  showLoading('asist');

  const [alumnosRes, asistRes, cursoRes] = await Promise.all([
    sb.from('alumnos').select('*').eq('curso_id', cursoId).eq('activo', true).order('apellido'),
    sb.from('asistencia').select('*').eq('curso_id', cursoId).is('hora_clase', null).order('fecha'),
    sb.from('cursos').select('*').eq('id', cursoId).single(),
  ]);

  const alumnos = alumnosRes.data || [];
  const asists  = asistRes.data   || [];
  const curso   = cursoRes.data;

  // Obtener fechas únicas
  const fechas = [...new Set(asists.filter(a => !a.hora_clase).map(a => a.fecha))].sort();

  // Indexar asistencias
  const asistIdx = {};
  asists.forEach(a => {
    if (!a.hora_clase) asistIdx[`${a.alumno_id}_${a.fecha}`] = a.estado;
  });

  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <button onclick="verCursoDirector('${cursoId}','${nivel}')" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--txt2)">←</button>
      <div>
        <div class="pg-t">Grilla · ${curso?.nombre}${curso?.division}</div>
        <div class="pg-s">${fechas.length} días registrados</div>
      </div>
    </div>

    ${!fechas.length ? '<div class="empty-state">Sin registros aún</div>' : `
    <div style="display:flex;gap:6px;margin-bottom:8px">
      <button class="btn-s" style="font-size:11px" onclick="_descargarGrillaCSV()">⬇ Descargar Excel</button>
    </div>
    <div style="display:flex;align-items:stretch;gap:4px">
      <button onclick="document.getElementById('gw').scrollLeft-=150" style="background:var(--surf2);border:1px solid var(--brd);border-radius:var(--rad);padding:0 10px;cursor:pointer;font-size:18px;flex-shrink:0;color:var(--txt2)">‹</button>
      <div id="gw" style="overflow-x:auto;flex:1">
        <table class="grilla-asist">
          <thead>
            <tr>
              <th style="text-align:left;min-width:180px;position:sticky;left:0;z-index:2;background:var(--bg)">Alumno</th>
              ${fechas.map(f => `<th title="${f}">${formatFechaCorta(f).split(' ')[0]}<br><span style="font-weight:400">${formatFechaCorta(f).split(' ')[1]||''}</span></th>`).join('')}
              <th style="background:var(--rojo-l);color:var(--rojo)">Total</th>
            </tr>
          </thead>
          <tbody>
            ${alumnos.map(al => {
              let total = 0;
              const celdas = fechas.map(f => {
                const est = asistIdx[`${al.id}_${f}`];
                if (!est) return `<td><span class="grilla-nd">—</span></td>`;
                const st = ESTADOS_ASIST[est];
                total += st?.valor || 0;
                return `<td><span class="grilla-cell" style="background:${st?.bg};color:${st?.color}" title="${st?.label}">${st?.short}</span></td>`;
              }).join('');
              const colorT = total >= 10 ? 'var(--rojo)' : total >= 5 ? 'var(--ambar)' : 'var(--verde)';
              return `<tr>
                <td style="font-size:11px;font-weight:500;white-space:nowrap;position:sticky;left:0;background:var(--bg);box-shadow:2px 0 3px rgba(0,0,0,.06)">${al.apellido}, ${al.nombre}</td>
                ${celdas}
                <td style="background:var(--rojo-l)"><span style="font-weight:700;color:${colorT}">${total}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <button onclick="document.getElementById('gw').scrollLeft+=150" style="background:var(--surf2);border:1px solid var(--brd);border-radius:var(--rad);padding:0 10px;cursor:pointer;font-size:18px;flex-shrink:0;color:var(--txt2)">›</button>
    </div>
    <div class="asist-leyenda" style="margin-top:12px">
      ${Object.entries(ESTADOS_ASIST).map(([k,v]) => `
        <span style="font-size:10px;padding:2px 8px;border-radius:20px;background:${v.bg};color:${v.color}">${v.short} = ${v.label}</span>
      `).join('')}
    </div>`}`;

  window._grillaData = { alumnos, fechas, asistIdx, nombreCurso: `${curso?.nombre}${curso?.division||''}`, config:{} };
}

// ═══════════════════════════════════════════════════════
// PRECEPTOR
// --- MODO: preceptor-readonly-primaria ---
//   Primario/inicial: la asistencia la toma el docente de grado.
//   El preceptor solo puede ver las listas (modo verificación).
// --- MODO: secundario (sin cambios) ---
// ═══════════════════════════════════════════════════════
async function rAsistPreceptor() {
  const c      = document.getElementById('page-asist');
  const instId = USUARIO_ACTUAL.institucion_id;
  const hoy    = hoyISO();
  const nivel  = USUARIO_ACTUAL.nivel || 'secundario';

  // Primario/inicial: preceptor es solo lectura (asistencia la toma el docente de grado)
  const readonly = nivel === 'primario' || nivel === 'inicial';

  const _dAyer = new Date(); _dAyer.setDate(_dAyer.getDate()-1);
  const ayer   = `${_dAyer.getFullYear()}-${String(_dAyer.getMonth()+1).padStart(2,'0')}-${String(_dAyer.getDate()).padStart(2,'0')}`;

  const cursosIds = USUARIO_ACTUAL.cursos_ids;
  let query = sb.from('cursos').select('*').eq('institucion_id', instId).eq('nivel', nivel).order('nombre');
  if (cursosIds?.length) query = query.in('id', cursosIds);
  const { data: cursos } = await query;

  if (!cursos?.length) {
    c.innerHTML = `<div class="pg-t">Asistencia</div><div class="empty-state">Sin cursos asignados</div>`;
    return;
  }

  const hoyHabil  = esFechaHabil(hoy);
  const ayerHabil = esFechaHabil(ayer);

  let bloqueoAyer = false;
  let cursosAyerPendientes = [];

  // En primario/inicial no hay bloqueo: la asistencia la toma el docente de grado
  if (!readonly && ayerHabil) {
    const { data: asistAyer } = await sb.from('asistencia')
      .select('curso_id').eq('fecha', ayer).is('hora_clase', null)
      .in('curso_id', cursos.map(c => c.id));
    const cursosConListaAyer = new Set((asistAyer||[]).map(a => a.curso_id));
    cursosAyerPendientes = cursos.filter(cu => !cursosConListaAyer.has(cu.id));
    bloqueoAyer = cursosAyerPendientes.length > 0;
  }

  // Listas de hoy
  const { data: asistHoy } = await sb.from('asistencia')
    .select('curso_id').eq('fecha', hoy).is('hora_clase', null)
    .in('curso_id', cursos.map(c => c.id));
  const cursosConLista = new Set((asistHoy||[]).map(a => a.curso_id));
  const pendientesHoy  = !readonly && hoyHabil ? cursos.filter(cu => !cursosConLista.has(cu.id)) : [];
  const todasHoy       = !hoyHabil || pendientesHoy.length === 0;

  const resumenHTML = await buildResumenDia(instId, hoy);

  c.innerHTML = `
    <div class="pg-t">${readonly ? 'Asistencia' : 'Tomar lista'}</div>
    <div class="pg-s">${formatFechaLatam(hoy)}</div>

    ${readonly ? `
    <div style="background:var(--azul-l);border-left:4px solid var(--azul);border-radius:var(--rad);padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:8px">
      <span style="font-size:18px">👁️</span>
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--azul)">Modo verificación</div>
        <div style="font-size:10px;color:var(--txt2)">La asistencia la registra el docente de grado. Podés ver las listas y el historial.</div>
      </div>
    </div>` : ''}

    ${!readonly && bloqueoAyer ? `
    <div style="background:var(--rojo-l);border:2px solid var(--rojo);border-radius:var(--rad-lg);padding:14px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--rojo);margin-bottom:6px">
        🔒 Debés completar las listas del día anterior
      </div>
      <div style="font-size:11px;color:var(--txt2);margin-bottom:10px">
        ${formatFechaLatam(ayer)} — Cursos pendientes:
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${cursosAyerPendientes.map(cu => `
          <button class="btn-d" style="font-size:11px" onclick="mostrarListaCurso('${cu.id}','${nivel}','${ayer}',true)">
            ${cu.nombre}${cu.division} — ${formatFechaLatam(ayer)}
          </button>`).join('')}
      </div>
    </div>` : ''}

    ${!readonly && !bloqueoAyer ? `
    <div style="background:${todasHoy?'var(--verde-l)':'var(--rojo-l)'};border-left:4px solid ${todasHoy?'var(--verde)':'var(--rojo)'};border-radius:var(--rad);padding:12px 14px;margin-bottom:14px">
      <div style="font-size:12px;font-weight:600;color:${todasHoy?'var(--verde)':'var(--rojo)'}">
        ${todasHoy ? '✅ Todas las listas de hoy registradas' : `⏳ Listas pendientes — ${formatFechaLatam(hoy)}`}
      </div>
      ${!todasHoy ? `
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
          ${pendientesHoy.map(c=>`<span style="font-size:11px;color:var(--rojo);font-weight:500">${c.nombre}${c.division}</span>`).join('<span style="color:var(--txt3)"> · </span>')}
        </div>` : ''}
    </div>` : ''}

    <div class="sec-lb">Mis cursos</div>
    <div class="curso-grid-asist">
      ${cursos.map(cu => {
        const listo = cursosConLista.has(cu.id);
        const onclick = readonly
          ? `mostrarListaCurso('${cu.id}','${nivel}','${hoy}',false)`
          : (bloqueoAyer
            ? `mostrarListaCurso('${cu.id}','${nivel}','${ayer}',true)`
            : `mostrarListaCurso('${cu.id}','${nivel}','${hoy}',true)`);
        return `
          <div class="curso-card-asist" onclick="${onclick}">
            <div class="cca-top">
              <div class="cca-badge" style="background:${listo?'var(--verde-l)':'var(--gris-l)'};color:${listo?'var(--verde)':'var(--txt2)'}">
                ${cu.nombre}${cu.division}
              </div>
              <span>${listo ? '✅' : (readonly ? '—' : '⏳')}</span>
            </div>
            <div style="font-size:10px;color:var(--txt2);margin-top:6px">
              ${readonly
                ? (listo ? 'Ver lista registrada' : 'Sin registros hoy')
                : (listo ? 'Lista registrada' : 'Tomar lista →')}
            </div>
          </div>`;
      }).join('')}
    </div>

    ${readonly ? `
    <div class="sec-lb">Ver lista de otro día</div>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
      ${renderFechaInput('fecha-prec-hist', diaHabilMasReciente(hoy), {wrapStyle:'flex:1;min-width:140px', onchange:"validarFechaHabilCustom('fecha-prec-hist')"})}
      <select id="curso-prec-hist" class="sel-estilizado" style="flex:1;min-width:140px">
        ${cursos.map(cu=>`<option value="${cu.id}|${nivel}">${cu.nombre}${cu.division}</option>`).join('')}
      </select>
      <button class="btn-s" style="font-size:11px" onclick="verListaHistoricaReadonly()">Ver →</button>
    </div>` : `
    <div class="sec-lb">Editar lista de otro día</div>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
      ${renderFechaInput('fecha-prec-hist', diaHabilMasReciente(hoy), {wrapStyle:'flex:1;min-width:140px', onchange:"validarFechaHabilCustom('fecha-prec-hist')"})}
      <select id="curso-prec-hist" class="sel-estilizado" style="flex:1;min-width:140px">
        ${cursos.map(cu=>`<option value="${cu.id}|${nivel}">${cu.nombre}${cu.division}</option>`).join('')}
      </select>
      <button class="btn-s" style="font-size:11px" onclick="editarListaHistorica()">Editar →</button>
    </div>`}

    <div class="sec-lb">📊 Grilla de asistencias</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
      ${cursos.map(cu=>`
        <button class="btn-s" style="font-size:11px" onclick="mostrarGrillaPreceptor('${cu.id}','${nivel}','${cu.nombre}${cu.division}')">
          📊 ${cu.nombre}${cu.division}
        </button>`).join('')}
    </div>

    ${resumenHTML}`;
}

function editarListaHistorica() {
  const fecha  = getFechaInput('fecha-prec-hist');
  const val    = document.getElementById('curso-prec-hist')?.value;
  if (!fecha || !val) return;
  const [cursoId, nivel] = val.split('|');
  mostrarListaCurso(cursoId, nivel, fecha, true);
}

function verListaHistoricaReadonly() {
  const fecha = getFechaInput('fecha-prec-hist');
  const val   = document.getElementById('curso-prec-hist')?.value;
  if (!fecha || !val) return;
  const [cursoId, nivel] = val.split('|');
  mostrarListaCurso(cursoId, nivel, fecha, false);
}

async function mostrarGrillaPreceptor(cursoId, nivel, nombreCurso, volverFn = null) {
  const c = document.getElementById('page-asist');
  showLoading('asist');

  const [alumnosRes, asistRes] = await Promise.all([
    sb.from('alumnos').select('*').eq('curso_id', cursoId).eq('activo', true).order('apellido'),
    sb.from('asistencia').select('*').eq('curso_id', cursoId).is('hora_clase', null).order('fecha'),
  ]);

  const alumnos = alumnosRes.data || [];
  const asists  = asistRes.data   || [];
  const fechas  = [...new Set(asists.map(a => a.fecha))].sort();
  const asistIdx = {};
  asists.forEach(a => asistIdx[`${a.alumno_id}_${a.fecha}`] = a.estado);
  const config = CONFIG_ASIST[nivel] || {};

  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <button onclick="${volverFn || 'rAsistPreceptor'}()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--txt2)">←</button>
      <div>
        <div class="pg-t">Grilla · ${nombreCurso}</div>
        <div class="pg-s">${fechas.length} días registrados</div>
      </div>
    </div>

    ${!fechas.length ? '<div class="empty-state">Sin registros aún. Tomá la primera lista.</div>' : `
    <div style="display:flex;gap:6px;margin-bottom:8px">
      <button class="btn-s" style="font-size:11px" onclick="_descargarGrillaCSV()">⬇ Descargar Excel</button>
    </div>
    <div style="display:flex;align-items:stretch;gap:4px">
      <button onclick="document.getElementById('gw').scrollLeft-=150" style="background:var(--surf2);border:1px solid var(--brd);border-radius:var(--rad);padding:0 10px;cursor:pointer;font-size:18px;flex-shrink:0;color:var(--txt2)">‹</button>
      <div id="gw" style="overflow-x:auto;flex:1">
        <table class="grilla-asist">
          <thead>
            <tr>
              <th style="text-align:left;min-width:180px;position:sticky;left:0;z-index:2;background:var(--bg)">Alumno</th>
              ${fechas.map(f => {
                const d = new Date(f+'T12:00:00');
                return `<th>${d.getDate()}/${d.getMonth()+1}</th>`;
              }).join('')}
              <th style="background:var(--rojo-l);color:var(--rojo)">Faltas</th>
            </tr>
          </thead>
          <tbody>
            ${alumnos.map(al => {
              let total = 0;
              const celdas = fechas.map(f => {
                const est = asistIdx[`${al.id}_${f}`];
                if (!est) return `<td><span class="grilla-nd">—</span></td>`;
                const st = ESTADOS_ASIST[est];
                total += st?.valor || 0;
                return `<td><span class="grilla-cell" style="background:${st?.bg};color:${st?.color}">${st?.short}</span></td>`;
              }).join('');
              const colorT = total >= (config.umbral_alerta_2??20) ? 'var(--rojo)' : total >= (config.umbral_alerta_1??10) ? 'var(--ambar)' : 'var(--verde)';
              return `<tr>
                <td style="font-size:11px;font-weight:500;cursor:pointer;position:sticky;left:0;background:var(--bg);white-space:nowrap;box-shadow:2px 0 3px rgba(0,0,0,.06)" onclick="verAlumnoAsist('${al.id}')">
                  ${al.apellido}, ${al.nombre}
                </td>
                ${celdas}
                <td style="background:var(--rojo-l)"><span style="font-weight:700;color:${colorT}">${total}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <button onclick="document.getElementById('gw').scrollLeft+=150" style="background:var(--surf2);border:1px solid var(--brd);border-radius:var(--rad);padding:0 10px;cursor:pointer;font-size:18px;flex-shrink:0;color:var(--txt2)">›</button>
    </div>
    <div class="asist-leyenda" style="margin-top:10px">
      ${Object.entries(ESTADOS_ASIST).map(([k,v]) => `
        <span style="font-size:10px;padding:2px 8px;border-radius:20px;background:${v.bg};color:${v.color}">${v.short}=${v.label}</span>
      `).join('')}
    </div>`}`;

  window._grillaData = { alumnos, fechas, asistIdx, nombreCurso, config };
}

// ═══════════════════════════════════════════════════════
// DOCENTE
// ═══════════════════════════════════════════════════════
async function rAsistDocente() {
  const c      = document.getElementById('page-asist');
  const instId = USUARIO_ACTUAL.institucion_id;
  const hoy    = hoyISO();
  const miId   = USUARIO_ACTUAL.id;

  const { data: asignaciones } = await sb.from('asignaciones')
    .select('tipo_docente, cursos(id,nombre,division,nivel), materias(id,nombre)')
    .eq('docente_id', miId)
    .eq('anio_lectivo', new Date().getFullYear());

  const asigs = asignaciones || [];
  if (!asigs.length) {
    c.innerHTML = `<div class="pg-t">Asistencia</div><div class="empty-state">Sin cursos asignados.</div>`;
    return;
  }

  // Grado (inicial/primario): toman lista completa del curso sin hora
  const gradoAsigs  = asigs.filter(a => a.tipo_docente === 'grado');
  // Especial en secundario: toman lista por hora/materia
  const clasesAsigs = asigs.filter(a => a.tipo_docente !== 'grado' && a.cursos?.nivel === 'secundario');
  // Especial en inicial/primario: NO toman asistencia (la toma la maestra de grado)

  if (!gradoAsigs.length && !clasesAsigs.length) {
    c.innerHTML = `
      <div class="pg-t">Asistencia</div>
      <div class="empty-state">
        Tus asignaciones son como docente especial en inicial o primaria.
        La asistencia la registra la maestra de sala o grado.
      </div>`;
    return;
  }

  // Listas ya tomadas hoy para cursos de grado
  const gradoCursoIds = gradoAsigs.map(a => a.cursos?.id).filter(Boolean);
  let gradoTomadas = new Set();
  if (gradoCursoIds.length) {
    const { data: agHoy } = await sb.from('asistencia')
      .select('curso_id').eq('fecha', hoy).is('hora_clase', null).in('curso_id', gradoCursoIds);
    gradoTomadas = new Set((agHoy||[]).map(a => a.curso_id));
  }

  // Listas ya tomadas hoy para clases por hora
  const { data: asistHoy } = await sb.from('asistencia')
    .select('curso_id,materia_id').eq('fecha', hoy).eq('registrado_por', miId);
  const clasesTomadas = new Set((asistHoy||[]).map(a => `${a.curso_id}_${a.materia_id}`));

  const cursoMapClases = {};
  clasesAsigs.forEach(a => {
    const cu = a.cursos;
    if (!cursoMapClases[cu.id]) cursoMapClases[cu.id] = { ...cu, materias:[] };
    cursoMapClases[cu.id].materias.push(a.materias);
  });

  c.innerHTML = `
    <div class="pg-t">Asistencia</div>
    <div class="pg-s">${formatFechaLatam(hoy)}</div>

    ${gradoAsigs.length ? `
    <div class="card" style="margin-bottom:14px">
      <div style="font-size:13px;font-weight:600;margin-bottom:12px">🏫 Mis cursos</div>
      <div class="curso-grid-asist">
        ${gradoAsigs.map(a => {
          const cu     = a.cursos;
          const tomada = gradoTomadas.has(cu.id);
          return `
            <div class="curso-card-asist"
              onclick="mostrarListaCurso('${cu.id}','${cu.nivel}','${hoy}',true,null,null,'rAsistDocente')">
              <div class="cca-top">
                <div class="cca-badge" style="background:${tomada?'var(--verde-l)':'var(--rojo-l)'};color:${tomada?'var(--verde)':'var(--rojo)'}">
                  ${cu.nombre}${cu.division}
                </div>
                <span>${tomada?'✅':'⏳'}</span>
              </div>
              <div style="font-size:10px;color:var(--txt2);margin-top:6px">
                ${tomada?'Lista registrada':'Tomar lista →'}
              </div>
            </div>`;
        }).join('')}
      </div>
      <div style="margin-top:12px">
        <div class="sec-lb" style="margin-top:0;margin-bottom:6px">Cargar lista de otro día</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          ${renderFechaInput('fecha-grado-hist', diaHabilMasReciente(hoy), {wrapStyle:'flex:1;min-width:140px', onchange:"validarFechaHabilCustom('fecha-grado-hist')"})}
          ${gradoAsigs.length > 1 ? `
          <select id="curso-grado-hist" class="sel-estilizado" style="flex:1;min-width:140px">
            ${gradoAsigs.map(a => `<option value="${a.cursos.id}|${a.cursos.nivel}">${a.cursos.nombre}${a.cursos.division}</option>`).join('')}
          </select>` : `<input type="hidden" id="curso-grado-hist" value="${gradoAsigs[0].cursos.id}|${gradoAsigs[0].cursos.nivel}">`}
          <button class="btn-s" style="font-size:11px" onclick="editarListaGrado()">Ver lista →</button>
        </div>
      </div>
    </div>` : ''}

    ${clasesAsigs.length ? `
    <div class="card" style="margin-bottom:14px">
      <div style="font-size:13px;font-weight:600;margin-bottom:12px">📋 Tomar lista</div>
      <div style="margin-bottom:10px">
        <div class="sec-lb" style="margin-top:0">Mis clases</div>
        <div class="docente-cursos-list">
          ${Object.values(cursoMapClases).map(cu =>
            cu.materias.map(m => {
              const key    = `${cu.id}_${m.id}`;
              const tomada = clasesTomadas.has(key);
              return `
                <div class="doc-curso-card ${tomada?'tomada':''}"
                  data-curso="${cu.id}" data-materia="${m.id}" data-nivel="${cu.nivel}"
                  onclick="selClaseDocente(this,'${cu.id}','${m.id}','${cu.nivel}')">
                  <div style="font-size:14px;font-weight:700;font-family:'Lora',serif">${cu.nombre}${cu.division}</div>
                  <div style="font-size:10px;color:var(--txt2)">${m.nombre}</div>
                  <div style="font-size:10px;margin-top:4px;color:${tomada?'var(--verde)':'var(--rojo)'}">
                    ${tomada?'✅ Tomada':'⏳ Pendiente'}
                  </div>
                </div>`;
            }).join('')
          ).join('')}
        </div>
      </div>
      <div id="sel-hora-doc" style="display:none;margin-bottom:10px">
        <div class="sec-lb">Hora de clase</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap" id="horas-chips">
          ${[1,2,3,4,5,6,7,8].map(h=>`
            <button class="hora-chip" data-hora="${h}" onclick="selHoraDoc(this)">${h}°</button>
          `).join('')}
        </div>
      </div>
      <div id="sel-fecha-doc" style="display:none;margin-bottom:10px">
        <div class="sec-lb">Fecha (podés cargar días anteriores)</div>
        ${renderFechaInput('fecha-doc', diaHabilMasReciente(hoy), {onchange:"validarFechaHabilCustom('fecha-doc')"})}
      </div>
      <button class="btn-p" id="btn-ir-lista-doc" style="width:100%;display:none" onclick="irListaDocente()">
        Ver lista →
      </button>
    </div>` : ''}

    ${gradoAsigs.length ? `
    <div class="sec-lb">📊 Grilla (mis cursos)</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
      ${gradoAsigs.map(a => {
        const cu = a.cursos;
        return `<button class="btn-s" style="font-size:11px"
          onclick="mostrarGrillaPreceptor('${cu.id}','${cu.nivel}','${cu.nombre}${cu.division}','rAsistDocente')">
          📊 ${cu.nombre}${cu.division}
        </button>`;
      }).join('')}
    </div>` : ''}

    ${clasesAsigs.length ? `
    <div class="sec-lb">📊 Grilla (mis clases)</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
      ${Object.values(cursoMapClases).map(cu =>
        cu.materias.map(m => `
          <button class="btn-s" style="font-size:11px"
            onclick="mostrarGrillaDocente('${cu.id}','${cu.nivel}','${m.id}','${cu.nombre}${cu.division} · ${m.nombre}')">
            📊 ${cu.nombre}${cu.division} · ${m.nombre}
          </button>`).join('')
      ).join('')}
    </div>` : ''}`;

  window._docCursoMap = cursoMapClases;
  window._docCursoSel = null;
  window._docMatSel   = null;
  HORA_SEL = null;
}

function editarListaGrado() {
  const fecha = getFechaInput('fecha-grado-hist');
  const val   = document.getElementById('curso-grado-hist')?.value;
  if (!fecha || !val) return;
  const [cursoId, nivel] = val.split('|');
  mostrarListaCurso(cursoId, nivel, fecha, true, null, null, 'rAsistDocente');
}

function selClaseDocente(btn, cursoId, materiaId, nivel) {
  document.querySelectorAll('.doc-curso-card').forEach(b => b.classList.remove('activa'));
  btn.classList.add('activa');
  window._docCursoSel = cursoId;
  window._docMatSel   = materiaId;
  window._docNivelSel = nivel;
  document.getElementById('sel-hora-doc').style.display = 'block';
  document.getElementById('sel-fecha-doc').style.display = 'block';
  document.getElementById('btn-ir-lista-doc').style.display = 'block';
}

function selHoraDoc(btn) {
  document.querySelectorAll('.hora-chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  HORA_SEL = parseInt(btn.dataset.hora);
}

async function irListaDocente() {
  const cursoId   = window._docCursoSel;
  const materiaId = window._docMatSel;
  const nivel     = window._docNivelSel || 'secundario';
  const fecha     = getFechaInput('fecha-doc');
  if (!cursoId)   { alert('Elegí una clase.'); return; }
  if (!materiaId) { alert('Elegí una clase.'); return; }
  if (!HORA_SEL)  { alert('Elegí la hora.'); return; }
  await mostrarListaCurso(cursoId, nivel, fecha, true, materiaId, HORA_SEL);
}


async function mostrarGrillaDocente(cursoId, nivel, materiaId, titulo) {
  const c = document.getElementById('page-asist');
  showLoading('asist');

  const [alumnosRes, asistRes] = await Promise.all([
    sb.from('alumnos').select('*').eq('curso_id', cursoId).eq('activo', true).order('apellido'),
    sb.from('asistencia').select('*').eq('curso_id', cursoId).eq('materia_id', materiaId).order('fecha').order('hora_clase'),
  ]);

  const alumnos = alumnosRes.data || [];
  const asists  = asistRes.data   || [];
  const fechas  = [...new Set(asists.map(a => a.fecha))].sort();
  const asistIdx = {};
  asists.forEach(a => asistIdx[`${a.alumno_id}_${a.fecha}`] = a.estado);
  const config = CONFIG_ASIST[nivel] || {};

  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <button onclick="rAsistDocente()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--txt2)">←</button>
      <div>
        <div class="pg-t">${titulo}</div>
        <div class="pg-s">${fechas.length} clases registradas</div>
      </div>
    </div>

    ${!fechas.length ? '<div class="empty-state">Sin clases registradas aún.</div>' : `
    <div style="display:flex;gap:6px;margin-bottom:8px">
      <button class="btn-s" style="font-size:11px" onclick="_descargarGrillaCSV()">⬇ Descargar Excel</button>
    </div>
    <div style="display:flex;align-items:stretch;gap:4px">
      <button onclick="document.getElementById('gw').scrollLeft-=150" style="background:var(--surf2);border:1px solid var(--brd);border-radius:var(--rad);padding:0 10px;cursor:pointer;font-size:18px;flex-shrink:0;color:var(--txt2)">‹</button>
      <div id="gw" style="overflow-x:auto;flex:1">
        <table class="grilla-asist">
          <thead>
            <tr>
              <th style="text-align:left;min-width:180px;position:sticky;left:0;z-index:2;background:var(--bg)">Alumno</th>
              ${fechas.map(f => {
                const d = new Date(f+'T12:00:00');
                return `<th>${d.getDate()}/${d.getMonth()+1}</th>`;
              }).join('')}
              <th style="background:var(--rojo-l);color:var(--rojo)">Faltas</th>
            </tr>
          </thead>
          <tbody>
            ${alumnos.map(al => {
              let total = 0;
              const celdas = fechas.map(f => {
                const est = asistIdx[`${al.id}_${f}`];
                if (!est) return `<td><span class="grilla-nd">—</span></td>`;
                const st = ESTADOS_ASIST[est];
                total += st?.valor || 0;
                return `<td><span class="grilla-cell" style="background:${st?.bg};color:${st?.color}">${st?.short}</span></td>`;
              }).join('');
              const colorT = total >= (config.umbral_alerta_2??20) ? 'var(--rojo)' : total >= (config.umbral_alerta_1??10) ? 'var(--ambar)' : 'var(--verde)';
              return `<tr>
                <td style="font-size:11px;font-weight:500;white-space:nowrap;position:sticky;left:0;background:var(--bg);box-shadow:2px 0 3px rgba(0,0,0,.06)">${al.apellido}, ${al.nombre}</td>
                ${celdas}
                <td style="background:var(--rojo-l)"><strong style="color:${colorT}">${total}</strong></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <button onclick="document.getElementById('gw').scrollLeft+=150" style="background:var(--surf2);border:1px solid var(--brd);border-radius:var(--rad);padding:0 10px;cursor:pointer;font-size:18px;flex-shrink:0;color:var(--txt2)">›</button>
    </div>
    <div class="asist-leyenda" style="margin-top:10px">
      ${Object.entries(ESTADOS_ASIST).map(([k,v]) => `
        <span style="font-size:10px;padding:2px 8px;border-radius:20px;background:${v.bg};color:${v.color}">${v.short}=${v.label}</span>
      `).join('')}
    </div>`}`;

  window._grillaData = { alumnos, fechas, asistIdx, nombreCurso: titulo, config };
}

// ═══════════════════════════════════════════════════════
// LISTA COMPARTIDA (preceptor + director)
// ═══════════════════════════════════════════════════════
async function mostrarListaCurso(cursoId, nivel, fecha, editable, materiaId = null, horaClase = null, volverFn = null) {
  const c = document.getElementById('page-asist');
  showLoading('asist');

  const [alumnosRes, asistRes, cursoRes] = await Promise.all([
    sb.from('alumnos').select('*').eq('curso_id', cursoId).eq('activo', true).order('apellido'),
    sb.from('asistencia').select('*')
      .eq('curso_id', cursoId).eq('fecha', fecha)
      .is('hora_clase', horaClase)
      .is('materia_id', materiaId),
    sb.from('cursos').select('*').eq('id', cursoId).single(),
  ]);

  const alumnos  = alumnosRes.data || [];
  const asistMap = {};
  (asistRes.data||[]).forEach(a => asistMap[a.alumno_id] = a);
  const curso    = cursoRes.data;

  const yaRegistrado = Object.keys(asistMap).length > 0;

  // Estado local
  window._estadoAsist = {};
  window._justAsist   = {};
  alumnos.forEach(al => {
    window._estadoAsist[al.id] = asistMap[al.id]?.estado || 'presente';
    window._justAsist[al.id]   = asistMap[al.id]?.justificacion_id || null;
  });

  const titulo = `${curso?.nombre}${curso?.division}${horaClase ? ' · '+horaClase+'° hora' : ''}`;

  const volver = volverFn || (horaClase ? 'rAsistDocente' : 'rAsistPreceptor');

  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <button onclick="${volver}()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--txt2)">←</button>
      <div>
        <div class="pg-t">${titulo}</div>
        <div class="pg-s">${formatFechaLatam(fecha)} · ${alumnos.length} alumnos</div>
      </div>
    </div>

    ${yaRegistrado && editable ? `
    <div style="background:var(--verde-l);border-radius:var(--rad);padding:8px 12px;font-size:11px;color:var(--verde);margin-bottom:10px">
      ✅ Lista ya registrada. Podés modificarla.
    </div>` : ''}

    ${editable ? `
    <div class="asist-leyenda">
      ${Object.entries(ESTADOS_ASIST).map(([k,v]) => `
        <span style="font-size:10px;padding:3px 8px;border-radius:20px;background:${v.bg};color:${v.color}">${v.icon} ${v.label}</span>
      `).join('')}
    </div>` : ''}

    <div class="card" style="padding:0;overflow:hidden">
      ${alumnos.map(al => {
        const est = window._estadoAsist[al.id];
        return `
          <div class="asist-fila" id="fila-${al.id}">
            <div class="asist-fila-top">
              <div class="asist-av">${(al.apellido||'?')[0]}${(al.nombre||'?')[0]}</div>
              <div class="asist-info">
                <div class="asist-nombre">${al.apellido}, ${al.nombre}</div>
              </div>
              ${editable ? `
              <div class="asist-btns">
                ${Object.entries(ESTADOS_ASIST).map(([k,v]) => `
                  <button class="asist-btn ${est===k?'on':''}"
                    style="${est===k?`background:${v.color};color:#fff;border-color:${v.color}`:''}"
                    data-alumno="${al.id}" data-estado="${k}"
                    onclick="setEstadoAsist('${al.id}','${k}',this)"
                    title="${v.label}">
                    ${v.icon}
                  </button>`).join('')}
              </div>` : `
              <div style="font-size:13px">${ESTADOS_ASIST[est]?.icon||'—'}</div>`}
            </div>
            ${editable ? `
            <div id="just-${al.id}" style="display:${est==='justificado'?'block':'none'};padding:8px 14px;background:var(--azul-l);border-top:1px solid var(--brd)">
              <select class="sel-estilizado" style="font-size:11px" onchange="window._justAsist['${al.id}']=this.value">
                <option value="">— Motivo de justificación —</option>
                ${TIPOS_JUST.map(t => `<option value="${t.id}" ${asistMap[al.id]?.justificacion_id===t.id?'selected':''}>${t.nombre}</option>`).join('')}
              </select>
            </div>` : ''}
          </div>`;
      }).join('')}
    </div>

    ${editable ? `
    <button class="btn-p" style="width:100%;margin-top:14px;padding:14px;font-size:13px"
      id="btn-guardar-asist"
      onclick="guardarAsistencia('${cursoId}','${nivel}','${fecha}',${horaClase||'null'},'${materiaId||''}')">
      💾 Confirmar lista
    </button>` : ''}
    <div id="asist-resumen"></div>`;
}

function setEstadoAsist(alumnoId, estado, btn) {
  window._estadoAsist[alumnoId] = estado;
  const fila = document.getElementById(`fila-${alumnoId}`);
  fila?.querySelectorAll('.asist-btn').forEach(b => {
    const k = b.dataset.estado;
    const v = ESTADOS_ASIST[k];
    if (k === estado) {
      b.classList.add('on');
      b.style.cssText = `background:${v.color};color:#fff;border-color:${v.color}`;
    } else {
      b.classList.remove('on');
      b.style.cssText = '';
    }
  });
  const justDiv = document.getElementById(`just-${alumnoId}`);
  if (justDiv) justDiv.style.display = estado === 'justificado' ? 'block' : 'none';
}

async function guardarAsistencia(cursoId, nivel, fecha, horaClase, materiaId) {
  const btn = document.getElementById('btn-guardar-asist');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  const instId  = USUARIO_ACTUAL.institucion_id;
  const estados = window._estadoAsist || {};
  const justs   = window._justAsist   || {};

  const { data: alumnos } = await sb.from('alumnos')
    .select('id').eq('curso_id', cursoId).eq('activo', true);

  const registros = (alumnos||[]).map(al => ({
    institucion_id:   instId,
    alumno_id:        al.id,
    curso_id:         cursoId,
    fecha,
    estado:           estados[al.id] || 'presente',
    justificacion_id: justs[al.id]   || null,
    hora_clase:       horaClase || null,
    materia_id:       materiaId || null,
    registrado_por:   USUARIO_ACTUAL.id,
  }));

  // Para registros diarios (hora_clase = null), PostgreSQL no aplica el
  // UNIQUE constraint sobre columnas NULL, por lo que upsert siempre
  // inserta filas nuevas en vez de actualizar. Solución: DELETE + INSERT.
  let error;
  if (!horaClase) {
    const delRes = await sb.from('asistencia')
      .delete()
      .eq('curso_id', cursoId)
      .eq('fecha', fecha)
      .is('hora_clase', null);
    if (delRes.error) {
      error = delRes.error;
    } else {
      const insRes = await sb.from('asistencia').insert(registros);
      error = insRes.error;
    }
  } else {
    const upsRes = await sb.from('asistencia').upsert(registros, {
      onConflict: 'alumno_id,fecha,hora_clase,materia_id',
      ignoreDuplicates: false,
    });
    error = upsRes.error;
  }

  if (error) {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Confirmar lista'; }
    alert('Error: ' + error.message);
    return;
  }

  await verificarAlertas(alumnos.map(a => a.id), instId, nivel);

  if (btn) { btn.textContent = '✅ Lista guardada'; }
  mostrarResumenAsist(estados);
  setTimeout(() => {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Confirmar lista'; }
  }, 2000);
}

function mostrarResumenAsist(estados) {
  const totales = { presente:0, ausente:0, media_falta:0, tardanza:0, justificado:0 };
  Object.values(estados).forEach(e => { if (totales[e]!==undefined) totales[e]++; });
  const div = document.getElementById('asist-resumen');
  if (!div) return;
  div.innerHTML = `
    <div class="card" style="margin-top:12px">
      <div class="card-t">Resumen de hoy</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        ${Object.entries(totales).filter(([k,v])=>v>0).map(([k,v])=>{
          const st = ESTADOS_ASIST[k];
          return `<div style="text-align:center;padding:8px;background:${st.bg};border-radius:var(--rad)">
            <div style="font-size:18px;font-weight:700;color:${st.color}">${v}</div>
            <div style="font-size:10px;color:${st.color}">${st.label}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════
// EOE
// ═══════════════════════════════════════════════════════
async function rAsistEOE() {
  const c      = document.getElementById('page-asist');
  const instId = USUARIO_ACTUAL.institucion_id;

  const { data: alertas } = await sb.from('alertas_asistencia')
    .select('*, alumnos(nombre, apellido, curso_id, cursos(nombre, division, nivel))')
    .eq('institucion_id', instId)
    .order('tipo_alerta', { ascending: false })
    .order('created_at', { ascending: false });

  c.innerHTML = `
    <div class="pg-t">Asistencia</div>
    <div class="pg-s">Alertas activas</div>
    ${!(alertas?.length)
      ? '<div class="empty-state">✅ Sin alertas de asistencia activas</div>'
      : alertas.map(a => {
          const al  = a.alumnos;
          const cu  = al?.cursos;
          const labels = ['','⚠️ Primer aviso','⚠️ Segundo aviso','🔴 Tercer aviso','🚨 Riesgo de regularidad'];
          const cls    = a.tipo_alerta >= 3 ? 'var(--rojo)' : 'var(--ambar)';
          return `
            <div class="card" id="alerta-card-${a.id}" style="margin-bottom:8px;padding:12px 14px;border-left:3px solid ${cls}">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;cursor:pointer" onclick="verAlumnoAsist('${al?.id}')">
                <div>
                  <div style="font-size:12px;font-weight:600">${al?.apellido}, ${al?.nombre}</div>
                  <div style="font-size:10px;color:var(--txt2)">${cu?.nombre}${cu?.division} · ${cu?.nivel}</div>
                </div>
                <span class="tag ${a.tipo_alerta>=3?'tr':'ta'}">${labels[a.tipo_alerta]}</span>
              </div>
              <div style="font-size:11px;color:var(--txt2);margin-top:6px">
                ${a.total_faltas} faltas · ${formatFechaLatam(a.fecha)}
              </div>
              ${USUARIO_ACTUAL.rol === 'preceptor' ? `
              <div style="margin-top:8px;border-top:1px solid var(--brd);padding-top:8px">
                <button class="btn-s" style="font-size:11px" onclick="event.stopPropagation();_tomarAccionAlerta('${a.id}',this)">✓ Acción tomada</button>
              </div>` : ''}
            </div>`;
        }).join('')}`;
}

// ═══════════════════════════════════════════════════════
// VER ALUMNO
// ═══════════════════════════════════════════════════════
async function verAlumnoAsist(alumnoId) {
  const c = document.getElementById('page-asist');
  showLoading('asist');

  const [alumnoRes, asistRes, alertasRes] = await Promise.all([
    sb.from('alumnos').select('*, cursos(nombre,division,nivel)').eq('id', alumnoId).single(),
    sb.from('asistencia').select('*').eq('alumno_id', alumnoId).is('hora_clase', null).order('fecha', {ascending:true}),
    sb.from('alertas_asistencia').select('*').eq('alumno_id', alumnoId).order('created_at', {ascending:false}),
  ]);

  const al      = alumnoRes.data;
  const asists  = asistRes.data   || [];
  const alertas = alertasRes.data || [];
  const nivel   = al?.cursos?.nivel || 'secundario';
  const config  = CONFIG_ASIST[nivel] || {};

  // Deduplicar por fecha: si hay registros duplicados para la misma fecha
  // (causados por el bug anterior del upsert), tomar solo uno por día.
  const porFecha = new Map();
  asists.filter(a => !a.hora_clase).forEach(a => porFecha.set(a.fecha, a));

  let totalFaltas = 0;
  const conteo = {};
  porFecha.forEach(a => {
    conteo[a.estado] = (conteo[a.estado]||0) + 1;
    if (a.estado !== 'justificado' || config.justificadas_cuentan) {
      totalFaltas += ESTADOS_ASIST[a.estado]?.valor || 0;
    }
  });

  const pct   = config.umbral_regularidad ? Math.min(Math.round(totalFaltas/config.umbral_regularidad*100),100) : 0;
  const color = totalFaltas >= (config.umbral_alerta_2??20) ? 'var(--rojo)' : totalFaltas >= (config.umbral_alerta_1??10) ? 'var(--ambar)' : 'var(--verde)';

  const anio  = INSTITUCION_ACTUAL?.anio_lectivo || new Date().getFullYear();
  const desde = `${anio}-01-01`;
  const hasta = hoyISO();

  window._alumnoAsistFull   = asists;
  window._alumnoAsistConfig = config;

  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <button onclick="rAsist()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--txt2)">←</button>
      <div>
        <div class="pg-t">${al?.apellido}, ${al?.nombre}</div>
        <div class="pg-s">${al?.cursos?.nombre}${al?.cursos?.division} · ${nivel}</div>
      </div>
    </div>

    ${alertas.length ? `
    <div class="alr" style="margin-bottom:12px">
      <div class="alr-t">${['','⚠️ Primer aviso','⚠️ Segundo aviso','🔴 Tercer aviso','🚨 Riesgo de regularidad'][alertas[0].tipo_alerta]}</div>
      <div class="alr-d">Total computado: ${totalFaltas} faltas</div>
    </div>` : ''}

    <div class="card" style="margin-bottom:12px">
      <div class="card-t">Resumen del año</div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px">
        <span>Faltas computables</span>
        <strong style="color:${color}">${totalFaltas} / ${config.umbral_regularidad||25}</strong>
      </div>
      <div style="background:var(--gris-l);border-radius:4px;height:8px;margin-bottom:12px">
        <div style="width:${pct}%;background:${color};height:8px;border-radius:4px"></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
        ${Object.entries(conteo).filter(([k,v])=>v>0).map(([k,v])=>{
          const st = ESTADOS_ASIST[k];
          return `<div style="text-align:center;padding:8px;background:${st.bg};border-radius:var(--rad)">
            <div style="font-size:16px;font-weight:700;color:${st.color}">${v}</div>
            <div style="font-size:9px;color:${st.color}">${st.label}</div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="sec-lb">Grilla de asistencia</div>
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
      <label style="font-size:11px;color:var(--txt2)">Desde</label>
      <input type="date" id="alumno-asist-desde" value="${desde}" class="sel-estilizado" style="font-size:11px;padding:4px 8px">
      <label style="font-size:11px;color:var(--txt2)">Hasta</label>
      <input type="date" id="alumno-asist-hasta" value="${hasta}" class="sel-estilizado" style="font-size:11px;padding:4px 8px">
      <button class="btn-s" style="font-size:11px" onclick="_filtrarGrillaAlumno()">Filtrar</button>
    </div>
    <div id="alumno-grilla-wrap">
      ${_renderGrillaAlumnoHTML(asists, config, desde, hasta)}
    </div>`;
}

function _filtrarGrillaAlumno() {
  const desde = document.getElementById('alumno-asist-desde')?.value;
  const hasta = document.getElementById('alumno-asist-hasta')?.value;
  const wrap  = document.getElementById('alumno-grilla-wrap');
  if (wrap) wrap.innerHTML = _renderGrillaAlumnoHTML(window._alumnoAsistFull || [], window._alumnoAsistConfig || {}, desde, hasta);
}

function _renderGrillaAlumnoHTML(asists, config, desde, hasta) {
  const filtered = asists.filter(a => !a.hora_clase && (!desde || a.fecha >= desde) && (!hasta || a.fecha <= hasta));
  const fechas   = [...new Set(filtered.map(a => a.fecha))].sort();
  const asistIdx = {};
  filtered.forEach(a => { asistIdx[a.fecha] = a.estado; });

  if (!fechas.length) return `<div class="empty-state">Sin registros en el período seleccionado</div>`;

  let totalGrilla = 0;
  fechas.forEach(f => {
    const est = asistIdx[f];
    if (est && (est !== 'justificado' || config.justificadas_cuentan)) totalGrilla += ESTADOS_ASIST[est]?.valor || 0;
  });
  const colorT = totalGrilla >= (config.umbral_alerta_2??20) ? 'var(--rojo)' : totalGrilla >= (config.umbral_alerta_1??10) ? 'var(--ambar)' : 'var(--verde)';

  return `
    <div style="display:flex;align-items:stretch;gap:4px">
      <button onclick="document.getElementById('gw-al').scrollLeft-=150" style="background:var(--surf2);border:1px solid var(--brd);border-radius:var(--rad);padding:0 10px;cursor:pointer;font-size:18px;flex-shrink:0;color:var(--txt2)">‹</button>
      <div id="gw-al" style="overflow-x:auto;flex:1">
        <table class="grilla-asist">
          <thead>
            <tr>
              <th style="text-align:left;min-width:70px;position:sticky;left:0;z-index:2;background:var(--bg)"></th>
              ${fechas.map(f => { const d = new Date(f+'T12:00:00'); return `<th>${d.getDate()}/${d.getMonth()+1}</th>`; }).join('')}
              <th style="background:var(--rojo-l);color:var(--rojo)">Faltas</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-size:11px;font-weight:500;white-space:nowrap;position:sticky;left:0;background:var(--bg);box-shadow:2px 0 3px rgba(0,0,0,.06)">Estado</td>
              ${fechas.map(f => {
                const est = asistIdx[f];
                if (!est) return `<td><span class="grilla-nd">—</span></td>`;
                const st = ESTADOS_ASIST[est];
                return `<td><span class="grilla-cell" style="background:${st?.bg};color:${st?.color}" title="${st?.label}">${st?.short}</span></td>`;
              }).join('')}
              <td style="background:var(--rojo-l)"><span style="font-weight:700;color:${colorT}">${totalGrilla}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <button onclick="document.getElementById('gw-al').scrollLeft+=150" style="background:var(--surf2);border:1px solid var(--brd);border-radius:var(--rad);padding:0 10px;cursor:pointer;font-size:18px;flex-shrink:0;color:var(--txt2)">›</button>
    </div>
    <div class="asist-leyenda" style="margin-top:10px">
      ${Object.entries(ESTADOS_ASIST).map(([k,v]) => `
        <span style="font-size:10px;padding:2px 8px;border-radius:20px;background:${v.bg};color:${v.color}">${v.short}=${v.label}</span>
      `).join('')}
    </div>`;
}

// ═══════════════════════════════════════════════════════
// ALERTAS
// ═══════════════════════════════════════════════════════
async function verificarAlertas(alumnoIds, instId, nivel) {
  const config = CONFIG_ASIST[nivel];
  if (!config) return;

  for (const alumnoId of alumnoIds) {
    // Solo contar registros diarios (hora_clase IS NULL).
    // Los registros por hora/materia son del docente de secundario y no
    // computan para regularidad.
    const { data: registros } = await sb.from('asistencia')
      .select('estado,fecha').eq('alumno_id', alumnoId).is('hora_clase', null);

    // Deduplicar por fecha antes de sumar (defensivo contra duplicados históricos)
    const porFecha = new Map();
    (registros||[]).forEach(r => porFecha.set(r.fecha, r));

    let totalFaltas = 0;
    porFecha.forEach(r => {
      if (r.estado === 'justificado' && !config.justificadas_cuentan) return;
      totalFaltas += ESTADOS_ASIST[r.estado]?.valor || 0;
    });

    let tipoAlerta = 0;
    if (totalFaltas >= config.umbral_regularidad) tipoAlerta = 4;
    else if (totalFaltas >= config.umbral_riesgo)   tipoAlerta = 3;
    else if (totalFaltas >= config.umbral_alerta_3) tipoAlerta = 3;
    else if (totalFaltas >= config.umbral_alerta_2) tipoAlerta = 2;
    else if (totalFaltas >= config.umbral_alerta_1) tipoAlerta = 1;

    if (tipoAlerta > 0) {
      const { data: existente } = await sb.from('alertas_asistencia')
        .select('id').eq('alumno_id', alumnoId).eq('tipo_alerta', tipoAlerta).maybeSingle();
      if (!existente) {
        await sb.from('alertas_asistencia').insert({
          institucion_id: instId, alumno_id: alumnoId,
          tipo_alerta: tipoAlerta, total_faltas: totalFaltas,
        });
      }
    }
  }
}

async function _tomarAccionAlerta(alertaId, btn) {
  if (!confirm('¿Confirmás que se tomó acción sobre esta alerta?')) return;
  btn.disabled = true;
  btn.textContent = 'Procesando...';
  const { error } = await sb.from('alertas_asistencia').delete().eq('id', alertaId);
  if (error) {
    btn.disabled = false;
    btn.textContent = '✓ Acción tomada';
    alert('Error: ' + error.message);
    return;
  }
  const card = document.getElementById(`alerta-card-${alertaId}`);
  if (card) card.remove();
}

// ─── DÍAS NO LECTIVOS ─────────────────────────────────
function _renderDNLSeccion() {
  const data = window._diasNoLectivosData || [];
  return `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${data.length?'10':'0'}px">
        <div class="sec-lb" style="margin:0">🏫 Días sin clases</div>
        <button class="btn-s" style="font-size:11px" onclick="_abrirAddDNL()">+ Agregar</button>
      </div>
      <div id="dnl-add-form"></div>
      ${data.length ? `
        <div style="display:flex;flex-direction:column;gap:4px;margin-top:8px">
          ${data.map(d => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--surf2);border-radius:var(--rad)">
              <div>
                <span style="font-size:12px;font-weight:600">${formatFechaLatam(d.fecha)}</span>
                ${d.motivo ? `<span style="font-size:11px;color:var(--txt2);margin-left:8px">${_esc(d.motivo)}</span>` : ''}
              </div>
              <button onclick="_delDiaNoLect('${d.id}','${d.fecha}')" style="background:none;border:none;color:var(--rojo);cursor:pointer;font-size:18px;padding:0 4px" title="Eliminar">×</button>
            </div>`).join('')}
        </div>` : `<p style="font-size:11px;color:var(--txt3);margin:6px 0 0">Sin días registrados.</p>`}
    </div>`;
}

function _abrirAddDNL() {
  const form = document.getElementById('dnl-add-form');
  if (!form) return;
  form.innerHTML = `
    <div style="display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap;margin-top:8px;padding:8px;background:var(--surf2);border-radius:var(--rad)">
      <div>
        <div style="font-size:10px;color:var(--txt3);margin-bottom:2px">Fecha</div>
        <input type="date" id="dnl-fecha" class="inp-base" style="font-size:12px;padding:5px 8px">
      </div>
      <div style="flex:1;min-width:120px">
        <div style="font-size:10px;color:var(--txt3);margin-bottom:2px">Motivo (opcional)</div>
        <input type="text" id="dnl-motivo" class="inp-base" placeholder="Ej: Paro docente" style="font-size:12px;padding:5px 8px;width:100%;box-sizing:border-box">
      </div>
      <div style="display:flex;gap:4px">
        <button class="btn-p" style="font-size:11px" onclick="_guardarDiaNoLect()">Guardar</button>
        <button class="btn-s" style="font-size:11px" onclick="document.getElementById('dnl-add-form').innerHTML=''">Cancelar</button>
      </div>
    </div>`;
}

async function _guardarDiaNoLect() {
  const fecha  = document.getElementById('dnl-fecha')?.value;
  const motivo = document.getElementById('dnl-motivo')?.value?.trim() || null;
  if (!fecha) { alert('Seleccioná una fecha.'); return; }
  const instId = USUARIO_ACTUAL.institucion_id;
  const { error } = await sb.from('dias_no_lectivos')
    .upsert({ institucion_id: instId, fecha, motivo }, { onConflict: 'institucion_id,fecha' });
  if (error) { alert('Error al guardar: ' + error.message); return; }
  const { data } = await sb.from('dias_no_lectivos').select('id,fecha,motivo').eq('institucion_id', instId).order('fecha');
  window._diasNoLectivos     = new Set((data || []).map(r => r.fecha));
  window._diasNoLectivosData = data || [];
  const sec = document.getElementById('dnl-seccion');
  if (sec) sec.innerHTML = _renderDNLSeccion();
}

async function _delDiaNoLect(id, fecha) {
  if (!confirm(`¿Eliminar el día ${formatFechaLatam(fecha)} de días sin clases?`)) return;
  const { error } = await sb.from('dias_no_lectivos').delete().eq('id', id);
  if (error) { alert('Error al eliminar: ' + error.message); return; }
  window._diasNoLectivos?.delete(fecha);
  window._diasNoLectivosData = (window._diasNoLectivosData || []).filter(d => d.id !== id);
  const sec = document.getElementById('dnl-seccion');
  if (sec) sec.innerHTML = _renderDNLSeccion();
}

// ═══════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════
function labelNivel(n) {
  return { inicial:'🌱 Inicial', primario:'📚 Primario', secundario:'🎓 Secundario' }[n] || n;
}

// ═══════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════
function inyectarEstilosAsist() {
  if (document.getElementById('asist-styles')) return;
  const st = document.createElement('style');
  st.id = 'asist-styles';
  st.textContent = `
    /* Cards de métricas institucionales */
    .mc-asist-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px;}
    .mc-asist{background:var(--surf);border:1px solid var(--brd);border-radius:var(--rad-lg);padding:14px 10px;text-align:center;}
    .mc-asist-v{font-size:26px;font-weight:700;line-height:1.1;font-family:'DM Mono',monospace;}
    .mc-asist-l{font-size:10px;color:var(--txt2);font-weight:600;letter-spacing:.4px;margin-top:6px;}
    @media(max-width:520px){.mc-asist-grid{grid-template-columns:repeat(3,1fr);}}

    /* Grilla de cursos */
    .curso-grid-asist{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:14px;}
    .curso-card-asist{background:var(--surf);border:1px solid var(--brd);border-radius:var(--rad-lg);padding:14px;cursor:pointer;transition:all .15s;}
    .curso-card-asist:hover{border-color:var(--verde);transform:translateY(-1px);}
    .cca-badge{font-size:16px;font-weight:700;font-family:'Lora',serif;padding:4px 10px;border-radius:8px;}
    .cca-bottom{display:flex;align-items:center;justify-content:space-between;}
    .cca-status{font-size:11px;font-weight:600;}

    /* Leyenda */
    .asist-leyenda{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}

    /* Fila de alumno en lista */
    .asist-fila-top{display:flex;align-items:center;gap:8px;padding:8px 12px;}
    .asist-av{width:28px;height:28px;border-radius:50%;background:var(--verde-l);color:var(--verde);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;}
    .asist-info{flex:1;min-width:0;}
    .asist-nombre{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .asist-btns{display:flex;gap:3px;flex-shrink:0;}
    .asist-btn{width:26px;height:26px;border-radius:6px;border:1.5px solid var(--brd);cursor:pointer;font-size:12px;background:var(--surf2);transition:all .12s;display:flex;align-items:center;justify-content:center;}
    .asist-btn:hover{border-color:var(--verde-m);}

    /* Fila resumen director */
    .asist-alumno-row{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--brd);cursor:pointer;transition:background .1s;}
    .asist-alumno-row:last-child{border-bottom:none;}
    .asist-alumno-row:hover{background:var(--surf2);}

    /* Grilla de asistencias */
    .grilla-asist{width:100%;border-collapse:collapse;font-size:11px;}
    .grilla-asist th{padding:6px 4px;text-align:center;background:var(--surf2);border-bottom:2px solid var(--brd);font-weight:700;color:var(--txt2);font-size:10px;white-space:nowrap;}
    .grilla-asist td{padding:4px 3px;text-align:center;border-bottom:1px solid var(--brd);}
    .grilla-asist tr:hover td{background:var(--surf2);}
    .grilla-cell{display:inline-block;width:22px;height:22px;border-radius:5px;font-size:10px;font-weight:700;line-height:22px;cursor:default;}
    .grilla-nd{display:inline-block;width:22px;height:22px;border-radius:5px;font-size:10px;color:var(--txt3);line-height:22px;}

    /* Selector docente */
    .docente-cursos-list{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px;}
    .doc-curso-card{padding:8px 14px;border:1.5px solid var(--brd);border-radius:var(--rad);cursor:pointer;background:var(--surf2);transition:all .12s;}
    .doc-curso-card:hover{border-color:var(--verde);}
    .doc-curso-card.sel{border-color:var(--verde);background:var(--verde-l);}
    .doc-curso-card.tomada{border-color:var(--verde);background:var(--verde-l);}
    .doc-curso-card.activa{border-color:var(--azul);background:var(--azul-l);}

    /* Hora chips */
    .hora-chip{padding:6px 12px;border-radius:20px;border:1px solid var(--brd);cursor:pointer;font-size:11px;background:var(--surf2);color:var(--txt2);font-family:inherit;transition:all .12s;}
    .hora-chip.on{background:var(--verde);color:#fff;border-color:var(--verde);}

    @media(max-width:768px){
      .curso-grid-asist{grid-template-columns:repeat(2,1fr);}
      .asist-btns{gap:3px;}
      .asist-btn{width:30px;height:30px;font-size:13px;}
      .asist-leyenda{display:none;}
      .grilla-asist{font-size:10px;}
      .grilla-cell{width:18px;height:18px;font-size:9px;line-height:18px;}
    }
  `;
  document.head.appendChild(st);
}

// Navegar a la asistencia de un alumno desde cualquier módulo
function irAsistAlumno(alumnoId) {
  window._pendingAlumnoId = alumnoId;
  goPage('asist');
}

// Descarga CSV de la grilla actualmente renderizada
function _descargarGrillaCSV() {
  const d = window._grillaData;
  if (!d) return;
  const enc = ['Alumno', ...d.fechas.map(f => {
    const dt = new Date(f + 'T12:00:00');
    return `${dt.getDate()}/${dt.getMonth()+1}/${dt.getFullYear()}`;
  }), 'Faltas'];
  const filas = d.alumnos.map(al => {
    let total = 0;
    const celdas = d.fechas.map(f => {
      const est = d.asistIdx[`${al.id}_${f}`];
      if (!est) return '-';
      total += ESTADOS_ASIST[est]?.valor || 0;
      return ESTADOS_ASIST[est]?.short || '-';
    });
    return [`"${al.apellido}, ${al.nombre}"`, ...celdas, total];
  });
  const csv  = '﻿' + [enc, ...filas].map(r => r.join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `asistencia_${(d.nombreCurso||'curso').replace(/\s+/g,'_')}_${hoyISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function buildResumenDia(instId, fecha) {
  // Resumen basado en listas del preceptor (hora_clase null)
  const { data: registros } = await sb.from('asistencia')
    .select('estado, curso_id, cursos(nivel)')
    .eq('institucion_id', instId)
    .eq('fecha', fecha)
    .is('hora_clase', null);

  if (!registros?.length) return `
    <div class="card" style="text-align:center;padding:14px">
      <div style="font-size:11px;color:var(--txt3)">Sin asistencias registradas hoy</div>
    </div>`;

  const totales = { presente:0, ausente:0, media_falta:0, tardanza:0, justificado:0 };
  registros.forEach(r => totales[r.estado] = (totales[r.estado]||0) + 1);
  const total = registros.length;

  return `
    <div class="sec-lb">Resumen del día institucional</div>
    <div class="card">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">
        ${Object.entries(totales).filter(([k,v])=>v>0).map(([k,v])=>{
          const st  = ESTADOS_ASIST[k];
          const pct = Math.round(v/total*100);
          return `<div style="text-align:center;padding:10px;background:${st.bg};border-radius:var(--rad)">
            <div style="font-size:20px;font-weight:700;color:${st.color}">${v}</div>
            <div style="font-size:9px;color:${st.color};font-weight:600">${st.label}</div>
            <div style="font-size:9px;color:${st.color};opacity:.7">${pct}%</div>
          </div>`;
        }).join('')}
      </div>
      <div style="font-size:10px;color:var(--txt3);text-align:right">${total} registros totales · ${formatFechaLatam(fecha)}</div>
    </div>`;
}