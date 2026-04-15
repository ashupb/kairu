// =====================================================
// DASHBOARD.JS — Panel principal por rol
// =====================================================

async function rDash() {
  const rol = USUARIO_ACTUAL?.rol;
  if (rol === 'director_general' || rol === 'directivo_nivel') {
    await rDashDirector();
  } else if (rol === 'eoe') {
    await rDashEOE();
  } else if (rol === 'docente') {
    await rDashDocente();
  } else if (rol === 'preceptor') {
    await rDashPreceptor();
  } else {
    await rDashDirector();
  }
}

// ─── DIRECTOR ────────────────────────────────────────
let NIVEL_ACTIVO = 'todos';

async function rDashDirector() {
  showLoading('dash');
  const instId = USUARIO_ACTUAL.institucion_id;
  const miId   = USUARIO_ACTUAL.id;
  const hoy    = new Date().toISOString().split('T')[0];

  const [probRes, objRes, eventosRes, respRes] = await Promise.all([
    sb.from('problematicas').select('*').eq('institucion_id', instId).in('estado',['abierta','en_seguimiento']),
    sb.from('objetivos').select('*').eq('institucion_id', instId),
    sb.from('eventos_institucionales')
      .select('*, usuarios(nombre_completo)')
      .eq('institucion_id', instId)
      .eq('fecha_inicio', hoy)
      .order('hora', { nullsFirst: false }),
    sb.from('evento_respuestas')
      .select('*, eventos_institucionales(nombre, hora, lugar, nivel, convocados_ids, convocatoria_grupos)')
      .eq('usuario_id', miId)
      .eq('respuesta', 'pendiente'),
  ]);

  const problematicas = probRes.data    || [];
  const objetivos     = objRes.data     || [];
  const eventosHoy    = eventosRes.data || [];
  const pendientes    = (respRes.data   || []).filter(r => r.eventos_institucionales);

  const objRiesgo = objetivos.filter(o => o.estado === 'riesgo' || o.estado === 'risk');

  const now     = new Date();
  const hora    = now.getHours();
  const saludo  = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  const apellido = (USUARIO_ACTUAL.nombre_completo || '').split(',')[0];
  const fechaStr = now.toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long'});
  const instNombre = INSTITUCION_ACTUAL?.nombre || 'la institución';

  const NIVEL_CONFIG = {
    inicial:    { color:'#1a7a4a', bg:'#e8f5ee', label:'🌱 Inicial' },
    primario:   { color:'#1a5276', bg:'#eaf2fb', label:'📚 Primario' },
    secundario: { color:'#6c3483', bg:'#f5eef8', label:'🎓 Secundario' },
    todos:      { color:'#b8963e', bg:'#fdf6e8', label:'🏫 Toda la institución' },
  };

  // Tabs de nivel
  const tabsHTML = `
    <div class="nivel-tabs" style="margin-bottom:12px">
      ${Object.entries(NIVEL_CONFIG).map(([k,v]) => `
        <button class="nivel-tab ${NIVEL_ACTIVO===k?'on':''}"
          style="${NIVEL_ACTIVO===k?`background:${v.color};color:#fff;border-color:${v.color}`:''}"
          onclick="setNivel('${k}')">
          ${v.label}
        </button>`).join('')}
    </div>`;

  // Eventos de hoy filtrados por nivel
  const eventosFiltrados = eventosHoy.filter(e =>
    NIVEL_ACTIVO === 'todos' || e.nivel === NIVEL_ACTIVO || e.nivel === 'todos'
  );

  // HTML eventos de hoy
  const eventosHoyHTML = () => {
    if (!eventosFiltrados.length) return `
      <div style="font-size:11px;color:var(--txt3);text-align:center;padding:16px">
        Sin eventos programados para hoy
        <div style="margin-top:8px">
          <button class="btn-s" style="font-size:10px" onclick="goPage('agenda')">Ver agenda completa →</button>
        </div>
      </div>`;

    return eventosFiltrados.map(e => {
      const nc  = NIVEL_CONFIG[e.nivel] || NIVEL_CONFIG.todos;
      const esConvocado = (e.convocados_ids || []).includes(miId);
      const esCre = e.creado_por === miId;
      return `
        <div class="ev-hoy-row" onclick="goPage('agenda')" style="border-left:3px solid ${nc.color}">
          <div class="ev-hoy-hora">${e.hora || '—'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.nombre}</div>
            <div style="font-size:10px;color:var(--txt2)">${e.lugar || ''} ${e.lugar && nc.label ? '·' : ''} ${nc.label}</div>
          </div>
          <div style="flex-shrink:0;display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
            ${esCre ? '<span class="tag tp">Creador</span>' : ''}
            ${esConvocado && !esCre ? '<span class="tag tg">Convocado</span>' : ''}
            ${!esConvocado && !esCre ? '<span class="tag tgr">Info</span>' : ''}
          </div>
        </div>`;
    }).join('');
  };

  // Pendientes de respuesta
  const pendientesHTML = pendientes.length ? `
    <div class="sec-lb">Eventos pendientes de respuesta</div>
    ${pendientes.map(r => {
      const e  = r.eventos_institucionales;
      const nc = NIVEL_CONFIG[e.nivel] || NIVEL_CONFIG.todos;
      return `
        <div class="card" style="padding:12px 14px;margin-bottom:8px;border-left:3px solid ${nc.color}">
          <div style="font-size:12px;font-weight:600;margin-bottom:4px">${e.nombre}</div>
          <div style="font-size:10px;color:var(--txt2);margin-bottom:8px">${e.hora||''} ${e.lugar?'· '+e.lugar:''}</div>
          <div style="display:flex;gap:6px">
            <button class="btn-p" style="font-size:10px;padding:5px 12px" onclick="responderEvento('${r.id}','aceptada',this)">✓ Acepto</button>
            <button class="btn-d" style="font-size:10px;padding:5px 12px" onclick="responderEvento('${r.id}','rechazada',this)">✗ No puedo</button>
          </div>
        </div>`;
    }).join('')}` : '';

  // Panel por nivel
  const nivelPanelHTML = (nivel) => {
    const ps  = problematicas.filter(p => p.nivel === nivel || !p.nivel);
    const evs = eventosHoy.filter(e => e.nivel === nivel || e.nivel === 'todos');
    const nc  = NIVEL_CONFIG[nivel];
    return `
      <div class="nivel-panel" style="border-top:3px solid ${nc.color}">
        <div style="font-size:13px;font-weight:700;margin-bottom:10px;color:${nc.color}">${nc.label}</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
          <div class="ns"><div class="ns-v" style="color:var(--rojo)">${ps.filter(p=>p.urgencia==='alta').length}</div><div class="ns-l">Urgentes</div></div>
          <div class="ns"><div class="ns-v" style="color:var(--ambar)">${ps.length}</div><div class="ns-l">Situaciones</div></div>
          <div class="ns"><div class="ns-v" style="color:${nc.color}">${evs.length}</div><div class="ns-l">Eventos hoy</div></div>
        </div>
        ${ps.filter(p=>p.urgencia==='alta').length ? `
          <div style="margin-top:8px;padding:8px 10px;background:var(--rojo-l);border-radius:var(--rad);font-size:11px;color:var(--rojo)">
            ⚠️ ${ps.filter(p=>p.urgencia==='alta').length} situación(es) urgente(s)
            <button class="btn-d" style="font-size:9px;padding:3px 8px;margin-left:8px" onclick="goPage('prob')">Ver →</button>
          </div>` : ''}
      </div>`;
  };

  const c = document.getElementById('page-dash');
  // Alertas de alumnos en cursos del preceptor
    const cursoIds = cursos.map(c => c.id);
    const { data: alumnosCurso } = await sb.from('alumnos').select('id').in('curso_id', cursoIds);
    const alumnoIds = (alumnosCurso || []).map(a => a.id);

    let alertasAlumnos = [];
    if (alumnoIds.length) {
      const { data } = await sb.from('alertas_asistencia')
        .select('*, alumnos(nombre, apellido, cursos(nombre,division))')
        .in('alumno_id', alumnoIds)
        .order('tipo_alerta', { ascending: false })
        .limit(8);
      alertasAlumnos = data || [];
    }
  c.innerHTML = `
    <div class="pg-t">${saludo}, ${apellido} 👋</div>
    <div class="pg-s" style="margin-bottom:14px">${fechaStr} · ${instNombre}</div>

    ${objRiesgo.length ? `
    <div class="alr" style="margin-bottom:14px">
      <div class="alr-t">⚠️ ${objRiesgo.length} objetivo(s) en riesgo</div>
      <div class="acc"><button class="btn-d" onclick="goPage('obj')">Ver objetivos →</button></div>
    </div>` : ''}

    ${pendientesHTML}

    <div class="sec-lb">Hoy en la institución</div>
    ${tabsHTML}
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:14px">
      ${eventosHoyHTML()}
    </div>

    <div class="sec-lb">Estado por nivel</div>
    <div id="nivel-contenido">
      ${NIVEL_ACTIVO === 'todos'
        ? ['inicial','primario','secundario'].map(nivelPanelHTML).join('')
        : nivelPanelHTML(NIVEL_ACTIVO)}
    </div>

    <div class="sec-lb" style="margin-top:14px">Resumen institucional</div>
    <div class="metrics m3">
      <div class="mc"><div class="mc-v" style="color:var(--rojo)">${problematicas.filter(p=>p.urgencia==='alta').length}</div><div class="mc-l">Urgentes</div></div>
      <div class="mc"><div class="mc-v" style="color:var(--ambar)">${objetivos.length}</div><div class="mc-l">Objetivos activos</div></div>
      <div class="mc"><div class="mc-v" style="color:var(--azul)">${eventosHoy.length}</div><div class="mc-l">Eventos hoy</div></div>
    </div>`;

  inyectarEstilosDash();
}

async function responderEvento(respuestaId, respuesta, btn) {
  btn.disabled = true;
  await sb.from('evento_respuestas').update({ respuesta }).eq('id', respuestaId);
  rDash();
}

function setNivel(nivel) {
  NIVEL_ACTIVO = nivel;
  rDashDirector();
}

function inyectarEstilosDash() {
  if (document.getElementById('dash-styles')) return;
  const st = document.createElement('style');
  st.id = 'dash-styles';
  st.textContent = `
    .nivel-tabs{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;}
    .nivel-tab{padding:6px 14px;border-radius:20px;border:1px solid var(--brd);cursor:pointer;font-size:11px;background:var(--surf2);color:var(--txt2);font-family:inherit;transition:all .15s;}
    .nivel-panel{background:var(--surf);border:1px solid var(--brd);border-radius:var(--rad-lg);padding:14px;margin-bottom:10px;}
    .ns{background:var(--surf2);border-radius:var(--rad);padding:8px;text-align:center;}
    .ns-v{font-size:20px;font-weight:700;font-family:'Lora',serif;}
    .ns-l{font-size:10px;color:var(--txt2);margin-top:2px;}
    .ev-hoy-row{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--brd);cursor:pointer;transition:background .1s;}
    .ev-hoy-row:last-child{border-bottom:none;}
    .ev-hoy-row:hover{background:var(--surf2);}
    .ev-hoy-hora{font-size:12px;font-weight:700;color:var(--verde);min-width:40px;}
  `;
  document.head.appendChild(st);
}

// ─── EOE ─────────────────────────────────────────────
async function rDashEOE() {
  showLoading('dash');
  const instId = USUARIO_ACTUAL.institucion_id;
  const miId   = USUARIO_ACTUAL.id;
  const hoy    = new Date().toISOString().split('T')[0];

  const [casosRes, eventosRes, respRes] = await Promise.all([
    sb.from('problematicas').select('*').eq('institucion_id', instId).in('estado',['abierta','en_seguimiento']),
    sb.from('eventos_institucionales').select('*').eq('institucion_id', instId).eq('fecha_inicio', hoy).order('hora', { nullsFirst: false }),
    sb.from('evento_respuestas').select('*, eventos_institucionales(nombre, hora, lugar)').eq('usuario_id', miId).eq('respuesta','pendiente'),
  ]);

  const casos     = casosRes.data    || [];
  const eventos   = eventosRes.data  || [];
  const pendientes = (respRes.data   || []).filter(r => r.eventos_institucionales);
  const urgentes  = casos.filter(p => p.urgencia === 'alta');

  const apellido = (USUARIO_ACTUAL.nombre_completo||'').split(',')[0];

  document.getElementById('page-dash').innerHTML = `
    <div class="pg-t">Bienvenida, ${apellido} 👋</div>
    <div class="pg-s">Orientación escolar · ${new Date().toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})}</div>

    ${urgentes.length ? `<div class="alr"><div class="alr-t">⚠️ ${urgentes.length} caso(s) urgente(s)</div>
    <div class="acc"><button class="btn-d" onclick="goPage('eoe')">Ver casos →</button></div></div>` : ''}

    ${pendientes.length ? `
    <div class="sec-lb">Eventos pendientes de respuesta</div>
    ${pendientes.map(r => `
      <div class="card" style="padding:12px 14px;margin-bottom:8px">
        <div style="font-size:12px;font-weight:600">${r.eventos_institucionales.nombre}</div>
        <div style="font-size:10px;color:var(--txt2);margin-bottom:8px">${r.eventos_institucionales.hora||''} ${r.eventos_institucionales.lugar?'· '+r.eventos_institucionales.lugar:''}</div>
        <div style="display:flex;gap:6px">
          <button class="btn-p" style="font-size:10px" onclick="responderEvento('${r.id}','aceptada',this)">✓ Acepto</button>
          <button class="btn-d" style="font-size:10px" onclick="responderEvento('${r.id}','rechazada',this)">✗ No puedo</button>
        </div>
      </div>`).join('')}` : ''}

    <div class="sec-lb">Hoy en la institución</div>
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px">
      ${eventos.length ? eventos.map(e=>`
        <div class="ev-hoy-row" onclick="goPage('agenda')" style="border-left:3px solid var(--azul)">
          <div class="ev-hoy-hora">${e.hora||'—'}</div>
          <div><div style="font-size:12px;font-weight:600">${e.nombre}</div>
          <div style="font-size:10px;color:var(--txt2)">${e.lugar||''}</div></div>
        </div>`).join('')
      : '<div style="font-size:11px;color:var(--txt3);text-align:center;padding:14px">Sin eventos hoy</div>'}
    </div>

    <div class="metrics m3">
      <div class="mc"><div class="mc-v" style="color:var(--rojo)">${urgentes.length}</div><div class="mc-l">Urgentes</div></div>
      <div class="mc"><div class="mc-v" style="color:var(--ambar)">${casos.length - urgentes.length}</div><div class="mc-l">Seguimiento</div></div>
      <div class="mc"><div class="mc-v" style="color:var(--azul)">${eventos.length}</div><div class="mc-l">Eventos hoy</div></div>
    </div>
    <div class="acc">
      <button class="btn-p" onclick="goPage('eoe')">Mis casos</button>
      <button class="btn-s" onclick="goPage('leg')">Legajos</button>
      <button class="btn-s" onclick="goPage('agenda')">Agenda</button>
    </div>`;

  inyectarEstilosDash();
}

// ─── DOCENTE ─────────────────────────────────────────
async function rDashDocente() {
  showLoading('dash');
  const miId = USUARIO_ACTUAL.id;
  const hoy  = new Date().toISOString().split('T')[0];

  const [eventosRes, respRes] = await Promise.all([
    sb.from('eventos_institucionales').select('*').eq('institucion_id', USUARIO_ACTUAL.institucion_id).eq('fecha_inicio', hoy).order('hora', { nullsFirst: false }),
    sb.from('evento_respuestas').select('*, eventos_institucionales(nombre, hora, lugar)').eq('usuario_id', miId).eq('respuesta','pendiente'),
  ]);

  const eventos   = eventosRes.data || [];
  const pendientes = (respRes.data  || []).filter(r => r.eventos_institucionales);
  const apellido  = (USUARIO_ACTUAL.nombre_completo||'').split(',')[0];

  document.getElementById('page-dash').innerHTML = `
    <div class="pg-t">Bienvenido/a, ${apellido} 👋</div>
    <div class="pg-s">${new Date().toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})}</div>

    ${pendientes.length ? `
    <div class="sec-lb">Pendientes de respuesta</div>
    ${pendientes.map(r => `
      <div class="card" style="padding:12px 14px;margin-bottom:8px">
        <div style="font-size:12px;font-weight:600">${r.eventos_institucionales.nombre}</div>
        <div style="font-size:10px;color:var(--txt2);margin-bottom:8px">${r.eventos_institucionales.hora||''} ${r.eventos_institucionales.lugar?'· '+r.eventos_institucionales.lugar:''}</div>
        <div style="display:flex;gap:6px">
          <button class="btn-p" style="font-size:10px" onclick="responderEvento('${r.id}','aceptada',this)">✓ Acepto</button>
          <button class="btn-d" style="font-size:10px" onclick="responderEvento('${r.id}','rechazada',this)">✗ No puedo</button>
        </div>
      </div>`).join('')}` : ''}

    <div class="sec-lb">Hoy en la institución</div>
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px">
      ${eventos.length ? eventos.map(e=>`
        <div class="ev-hoy-row" onclick="goPage('agenda')" style="border-left:3px solid var(--verde)">
          <div class="ev-hoy-hora">${e.hora||'—'}</div>
          <div><div style="font-size:12px;font-weight:600">${e.nombre}</div>
          <div style="font-size:10px;color:var(--txt2)">${e.lugar||''}</div></div>
        </div>`).join('')
      : '<div style="font-size:11px;color:var(--txt3);text-align:center;padding:14px">Sin eventos hoy</div>'}
    </div>

    <div class="sec-lb">Accesos rápidos</div>
    <div class="acc">
      <button class="btn-p" onclick="goPage('asist')">Tomar asistencia</button>
      <button class="btn-s" onclick="goPage('notas')">Calificaciones</button>
      <button class="btn-s" onclick="goPage('agenda')">Agenda</button>
      <button class="btn-s" onclick="goPage('prob')">Reportar situación</button>
    </div>`;

  inyectarEstilosDash();
}

// ─── PRECEPTOR ───────────────────────────────────────
async function rDashPreceptor() {
  showLoading('dash');
  const miId   = USUARIO_ACTUAL.id;
  const instId = USUARIO_ACTUAL.institucion_id;
  const nivel  = USUARIO_ACTUAL.nivel || 'secundario';
  const hoy    = new Date().toISOString().split('T')[0];

  const cursosIds = USUARIO_ACTUAL.cursos_ids;
  let query = sb.from('cursos').select('*').eq('institucion_id', instId).eq('nivel', nivel).order('nombre');
  if (cursosIds?.length) query = query.in('id', cursosIds);

  const [cursosRes, eventosRes, respRes] = await Promise.all([
    query,
    sb.from('eventos_institucionales').select('*').eq('institucion_id', instId).eq('fecha_inicio', hoy).order('hora', { nullsFirst: false }),
    sb.from('evento_respuestas').select('*, eventos_institucionales(nombre, hora, lugar)').eq('usuario_id', miId).eq('respuesta','pendiente'),
  ]);

  const cursos    = cursosRes.data   || [];
  const eventos   = eventosRes.data  || [];
  const pendResp  = (respRes.data    || []).filter(r => r.eventos_institucionales);
  const apellido  = (USUARIO_ACTUAL.nombre_completo||'').split(',')[0];

  // Alertas de alumnos en cursos del preceptor
  const cursoIds = cursos.map(c => c.id);
  let alertasAlumnos = [];
  if (cursoIds.length) {
    const { data: alumnosCurso } = await sb.from('alumnos').select('id').in('curso_id', cursoIds);
    const alumnoIds = (alumnosCurso || []).map(a => a.id);
    if (alumnoIds.length) {
      const { data } = await sb.from('alertas_asistencia')
        .select('*, alumnos(nombre, apellido, cursos(nombre,division))')
        .in('alumno_id', alumnoIds)
        .order('tipo_alerta', { ascending: false })
        .limit(8);
      alertasAlumnos = data || [];
    }
  }

  // Verificar listas registradas hoy
  const { data: asistHoy } = await sb.from('asistencia')
    .select('curso_id').eq('fecha', hoy).is('hora_clase', null)
    .in('curso_id', cursos.map(c => c.id));

  const cursosConLista = new Set((asistHoy||[]).map(a => a.curso_id));
  const pendientes  = cursos.filter(c => !cursosConLista.has(c.id));
  const completados = cursos.filter(c => cursosConLista.has(c.id));
  const todasListas = pendientes.length === 0 && cursos.length > 0;

  document.getElementById('page-dash').innerHTML = `
    <div class="pg-t">Bienvenido/a, ${apellido} 👋</div>
    <div class="pg-s">${new Date().toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})}</div>

    <!-- Placa de listas -->
    <div style="background:${todasListas?'var(--verde-l)':'var(--rojo-l)'};border-left:4px solid ${todasListas?'var(--verde)':'var(--rojo)'};border-radius:var(--rad);padding:12px 14px;margin-bottom:14px">
      <div style="font-size:12px;font-weight:600;color:${todasListas?'var(--verde)':'var(--rojo)'}">
        ${todasListas ? '✅ Todas las listas registradas' : `⏳ ${pendientes.length} lista(s) pendiente(s) de registrar`}
      </div>
      ${!todasListas ? `
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
        ${pendientes.map(c => `
          <button class="btn-${todasListas?'s':'d'}" style="font-size:10px;padding:4px 10px"
            onclick="goPage('asist')">
            ${c.nombre}${c.division}
          </button>`).join('')}
      </div>` : ''}
    </div>

    ${pendResp.length ? `
    <div class="sec-lb">Pendientes de respuesta</div>
    ${pendResp.map(r => `
      <div class="card" style="padding:12px 14px;margin-bottom:8px">
        <div style="font-size:12px;font-weight:600">${r.eventos_institucionales.nombre}</div>
        <div style="font-size:10px;color:var(--txt2);margin-bottom:8px">${r.eventos_institucionales.hora||''} ${r.eventos_institucionales.lugar?'· '+r.eventos_institucionales.lugar:''}</div>
        <div style="display:flex;gap:6px">
          <button class="btn-p" style="font-size:10px" onclick="responderEvento('${r.id}','aceptada',this)">✓ Acepto</button>
          <button class="btn-d" style="font-size:10px" onclick="responderEvento('${r.id}','rechazada',this)">✗ No puedo</button>
        </div>
      </div>`).join('')}` : ''}

    <div class="sec-lb">Hoy en la institución</div>
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px">
      ${eventos.length ? eventos.map(e=>`
        <div class="ev-hoy-row" onclick="goPage('agenda')" style="border-left:3px solid var(--ambar)">
          <div class="ev-hoy-hora">${e.hora||'—'}</div>
          <div><div style="font-size:12px;font-weight:600">${e.nombre}</div>
          <div style="font-size:10px;color:var(--txt2)">${e.lugar||''}</div></div>
        </div>`).join('')
      : '<div style="font-size:11px;color:var(--txt3);text-align:center;padding:14px">Sin eventos hoy</div>'}
    </div>

    <div class="acc">
      <button class="btn-p" onclick="goPage('asist')">📋 Tomar lista</button>
      <button class="btn-s" onclick="goPage('agenda')">Agenda</button>
      <button class="btn-s" onclick="goPage('prob')">Reportar</button>
      <button class="btn-s" onclick="goPage('leg')">Legajos</button>
    </div>`;

  inyectarEstilosDash();
}