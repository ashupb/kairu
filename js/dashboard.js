// =====================================================
// DASHBOARD.JS — Panel principal por rol
// =====================================================

// NIVEL_CONFIG está declarado en agenda.js (cargado antes) y se comparte globalmente

// Lunes a domingo de la semana actual
function _semanaActual() {
  const hoy = new Date().toISOString().split('T')[0];
  const d   = new Date(hoy + 'T12:00:00');
  const dow = d.getDay();
  const diff = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - diff);
  const inicio = d.toISOString().slice(0, 10);
  d.setDate(d.getDate() + 6);
  const fin = d.toISOString().slice(0, 10);
  return { inicio, fin, hoy };
}

function _saludo(nombreCompleto) {
  const h   = new Date().getHours();
  const sal = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  const apellido = (nombreCompleto || '').split(',')[0].trim();
  return { saludo: sal, apellido };
}

function _fechaStr() {
  return new Date().toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' });
}

// ── SHARED: Agenda semanal ─────────────────────────────
function renderAgendaSemana(eventosSem, sem, nivelFiltro) {
  const diasNombres = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const miId = USUARIO_ACTUAL.id;

  const porFecha = {};
  eventosSem.forEach(e => {
    const f = e.fecha_inicio;
    if (!porFecha[f]) porFecha[f] = [];
    porFecha[f].push(e);
  });

  const base = new Date(sem.inicio + 'T12:00:00');
  let html = '';

  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const esHoy   = dateStr === sem.hoy;
    let evsDia    = porFecha[dateStr] || [];

    if (nivelFiltro && nivelFiltro !== 'todos') {
      evsDia = evsDia.filter(e => !e.nivel || e.nivel === nivelFiltro || e.nivel === 'todos');
    }

    if (i >= 5 && !evsDia.length) continue; // finde vacío → omitir

    html += `
      <div class="ags-dia ${esHoy ? 'ags-hoy' : ''}">
        <div class="ags-dia-head">
          <span class="ags-dname">${diasNombres[i]}</span>
          <span class="ags-dnum ${esHoy ? 'hoy' : ''}">${d.getDate()}</span>
        </div>
        ${evsDia.length
          ? evsDia.map(e => {
              const nc  = NIVEL_CONFIG[e.nivel] || NIVEL_CONFIG.todos;
              const esConv = (e.convocados_ids || []).includes(miId);
              const esCre  = e.creado_por === miId;
              return `
                <div class="ags-ev" style="border-left-color:${nc.color}" onclick="goPage('agenda')">
                  ${e.hora ? `<span class="ags-hora">${e.hora.slice(0,5)}</span>` : ''}
                  <span class="ags-nom">${e.nombre}</span>
                  ${esCre ? '<span class="ags-tag" style="color:var(--verde)">Org.</span>' : esConv ? '<span class="ags-tag" style="color:var(--azul)">Conv.</span>' : ''}
                </div>`;
            }).join('')
          : `<span class="ags-vacio">—</span>`}
      </div>`;
  }

  return `
    <div class="card" style="padding:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div class="sec-lb" style="margin:0">Agenda de la semana</div>
        <button class="btn-ghost" onclick="goPage('agenda')">Ver todo →</button>
      </div>
      <div class="ags-semana">
        ${html || '<div style="text-align:center;padding:16px;font-size:11px;color:var(--txt3)">Sin eventos esta semana</div>'}
      </div>
    </div>`;
}

// ── SHARED: Strip de objetivos ─────────────────────────
function renderObjetivosStrip(objetivos) {
  const lista = (objetivos || []).filter(o => o.estado !== 'archivado' && o.estado !== 'logrado');
  if (!lista.length) return '';

  const activos    = lista.filter(o => o.estado === 'activo').length;
  const enRiesgo   = lista.filter(o => o.estado === 'en_riesgo').length;
  const empeorando = lista.filter(o => o.tendencia === 'empeorando');
  const problemas  = lista.filter(o => o.estado === 'en_riesgo' || o.tendencia === 'empeorando');

  return `
    ${empeorando.length ? `
    <div class="alr" style="margin-bottom:14px">
      <div class="alr-t">↓ ${empeorando.length} objetivo${empeorando.length>1?'s':''} empeorando${empeorando.length>1?'n':''}</div>
      <div style="font-size:11px;color:var(--txt2);margin-top:4px">${empeorando.slice(0,2).map(o=>o.nombre).join(', ')}${empeorando.length>2?' y más...':''}</div>
      <div class="acc" style="margin-top:8px"><button class="btn-d" onclick="goPage('obj')">Ver objetivos →</button></div>
    </div>` : ''}
    <div class="card obj-strip" onclick="goPage('obj')" style="cursor:pointer;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:12px;font-weight:600">◎ Objetivos institucionales</span>
        <button class="btn-s" style="font-size:10px" onclick="event.stopPropagation();goPage('obj')">Ver todos →</button>
      </div>
      <div class="obj-barra">
        <div style="flex:${activos||0.1};background:var(--verde);border-radius:4px 0 0 4px"></div>
        <div style="flex:${enRiesgo||0};background:var(--rojo);border-radius:0 4px 4px 0"></div>
      </div>
      <div style="display:flex;gap:14px;font-size:10px;margin-top:6px;flex-wrap:wrap">
        <span style="color:var(--verde)">● ${activos} activo${activos!==1?'s':''}</span>
        ${enRiesgo ? `<span style="color:var(--rojo)">● ${enRiesgo} en riesgo</span>` : ''}
        ${empeorando.length ? `<span style="color:var(--rojo)">↓ ${empeorando.length} empeorando</span>` : ''}
      </div>
      ${problemas.length ? `
        <div style="margin-top:10px;border-top:1px solid var(--brd);padding-top:8px;display:flex;flex-direction:column;gap:5px">
          ${problemas.slice(0,3).map(o => `
            <div style="display:flex;align-items:center;gap:8px;font-size:11px">
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.nombre}</span>
              <span class="tag ${o.estado==='en_riesgo'?'tr':'ta'}" style="font-size:9px;flex-shrink:0">${o.estado==='en_riesgo'?'En riesgo':'Empeorando'}</span>
            </div>`).join('')}
          ${problemas.length > 3 ? `<div style="font-size:10px;color:var(--verde);text-align:right">+ ${problemas.length-3} más →</div>` : ''}
        </div>` : ''}
    </div>`;
}

// ── SHARED: Panel de estado por nivel ─────────────────
function renderNivelPanel(nivel, problematicasFull) {
  const nc = NIVEL_CONFIG[nivel] || { color:'#888', bg:'#f5f5f5', label: nivel };

  // problematicasFull tiene alumno?.curso?.nivel embebido
  const probsNivel  = problematicasFull.filter(p => p.alumno?.curso?.nivel === nivel);
  const urgentes    = probsNivel.filter(p => p.urgencia === 'alta');
  const seguimiento = probsNivel.filter(p => p.urgencia === 'media');

  return `
    <div class="nivel-panel" style="border-top:3px solid ${nc.color}">
      <div style="font-size:12px;font-weight:700;color:${nc.color};margin-bottom:10px">${nc.label}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
        <div class="ns"><div class="ns-v" style="color:var(--rojo)">${urgentes.length}</div><div class="ns-l">Urgentes</div></div>
        <div class="ns"><div class="ns-v" style="color:var(--ambar)">${seguimiento.length}</div><div class="ns-l">Seguimiento</div></div>
        <div class="ns"><div class="ns-v">${probsNivel.length}</div><div class="ns-l">Total</div></div>
      </div>
      ${urgentes.length ? `
        <div style="margin-top:8px;padding:7px 10px;background:var(--rojo-l);border-radius:var(--rad);font-size:11px;color:var(--rojo);display:flex;justify-content:space-between;align-items:center">
          <span>⚠️ ${urgentes.length} situación${urgentes.length > 1 ? 'es' : ''} urgente${urgentes.length > 1 ? 's' : ''}</span>
          <button class="btn-d" style="font-size:9px;padding:3px 8px" onclick="goPage('prob')">Ver →</button>
        </div>` : ''}
    </div>`;
}

// ── SHARED: Alertas problemáticas HTML ────────────────
function renderAlertasProb(alertasProb) {
  if (!alertasProb.length) return '';
  return `
    <div class="alr" style="margin-bottom:14px;border-left-color:var(--rojo)">
      <div class="alr-t" style="display:flex;justify-content:space-between;align-items:center">
        <span>△ ${alertasProb.length} alerta${alertasProb.length > 1 ? 's' : ''} sin leer</span>
        <button class="btn-d" style="font-size:9px;padding:3px 8px" onclick="marcarAlertasProbLeidas()">Marcar leídas</button>
      </div>
      <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">
        ${alertasProb.slice(0, 4).map(a => {
          const p   = a.problematica;
          const nom = p?.alumno ? `${p.alumno.apellido}, ${p.alumno.nombre}` : '—';
          return `<div style="display:flex;align-items:center;gap:8px;font-size:11px;cursor:pointer" onclick="goPage('prob')">
            <span class="tag ${p?.urgencia === 'alta' ? 'tr' : p?.urgencia === 'media' ? 'ta' : 'tg'}" style="font-size:9px">Urg. ${p?.urgencia || '—'}</span>
            <span>${nom} · ${labelTipo(p?.tipo)}</span>
          </div>`;
        }).join('')}
        ${alertasProb.length > 4 ? `<div style="font-size:10px;color:var(--rojo);cursor:pointer" onclick="goPage('prob')">+ ${alertasProb.length - 4} más →</div>` : ''}
      </div>
    </div>`;
}

// ── SHARED: Pendientes de respuesta HTML ──────────────
function renderPendientesRespuesta(pendientes) {
  if (!pendientes.length) return '';
  return `
    <div class="sec-lb">Eventos pendientes de respuesta</div>
    ${pendientes.map(r => {
      const e = r.eventos_institucionales;
      return `
        <div class="card" style="padding:12px 14px;margin-bottom:8px">
          <div style="font-size:12px;font-weight:600;margin-bottom:4px">${e.nombre}</div>
          <div style="font-size:10px;color:var(--txt2);margin-bottom:8px">${e.hora || ''} ${e.lugar ? '· ' + e.lugar : ''}</div>
          <div style="display:flex;gap:6px">
            <button class="btn-p" style="font-size:10px;padding:5px 12px" onclick="responderEvento('${r.id}','aceptada',this)">✓ Acepto</button>
            <button class="btn-d" style="font-size:10px;padding:5px 12px" onclick="responderEvento('${r.id}','rechazada',this)">✗ No puedo</button>
          </div>
        </div>`;
    }).join('')}`;
}

// ── SHARED: Próximas actividades hoy ──────────────────
function renderProximasActividades(eventosSem, hoy, nivelFiltro) {
  let eventos = eventosSem.filter(e => e.fecha_inicio === hoy);
  if (nivelFiltro && nivelFiltro !== 'todos') {
    eventos = eventos.filter(e =>
      !e.nivel || e.nivel === 'todos' ||
      (e.nivel || '').split(',').map(n => n.trim()).includes(nivelFiltro)
    );
  }
  if (!eventos.length) return '';
  return `
    <div class="card" style="margin-bottom:14px;padding:0;overflow:hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--brd)">
        <span style="font-size:12px;font-weight:700">Próximas actividades</span>
        <button class="btn-ghost" onclick="goPage('agenda')" style="font-size:11px;font-weight:600;letter-spacing:0.04em">VER AGENDA →</button>
      </div>
      ${eventos.map(e => {
        const nc = NIVEL_CONFIG[e.nivel] || NIVEL_CONFIG.todos;
        return `
          <div style="display:flex;align-items:stretch;cursor:pointer;border-bottom:1px solid var(--brd);transition:background .1s"
               onmouseover="this.style.background='var(--surf2)'" onmouseout="this.style.background=''"
               onclick="goPage('agenda')">
            <div style="width:4px;background:${nc.color};flex-shrink:0"></div>
            <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;flex:1;min-width:0">
              <span style="font-family:'DM Mono',monospace;font-size:11px;font-weight:600;color:var(--verde);min-width:38px;flex-shrink:0">
                ${e.hora ? e.hora.slice(0,5) : '—'}
              </span>
              <div style="flex:1;min-width:0">
                <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.nombre}</div>
                ${e.lugar ? `<div style="font-size:10px;color:var(--txt2)">${e.lugar}</div>` : ''}
              </div>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

// ── ROUTER ────────────────────────────────────────────
async function rDash() {
  const rol = USUARIO_ACTUAL?.rol;
  if      (rol === 'director_general')  await rDashDirector();
  else if (rol === 'directivo_nivel')   await rDashDirectivo();
  else if (rol === 'eoe')               await rDashEOE();
  else if (rol === 'docente')           await rDashDocente();
  else if (rol === 'preceptor')         await rDashPreceptor();
  else                                  await rDashDirector();
}

// ─── DIRECTOR GENERAL ─────────────────────────────────
async function rDashDirector() {
  showLoading('dash');
  const instId = USUARIO_ACTUAL.institucion_id;
  const miId   = USUARIO_ACTUAL.id;
  const sem    = _semanaActual();

  const [probRes, objRes, eventosRes, respRes, alertasRes, alumnosRes, docentesRes] = await Promise.all([
    sb.from('problematicas')
      .select('id,urgencia,alumno:alumnos(curso:cursos(nivel))')
      .eq('institucion_id', instId)
      .in('estado', ['abierta','en_seguimiento']),
    sb.from('objetivos')
      .select('id,nombre,estado,tendencia')
      .eq('institucion_id', instId)
      .not('estado', 'in', '("archivado","logrado")'),
    sb.from('eventos_institucionales')
      .select('id,nombre,hora,lugar,nivel,fecha_inicio,convocados_ids,creado_por')
      .eq('institucion_id', instId)
      .gte('fecha_inicio', sem.inicio)
      .lte('fecha_inicio', sem.fin)
      .order('fecha_inicio').order('hora', { nullsFirst: true }),
    sb.from('evento_respuestas')
      .select('id,eventos_institucionales(nombre,hora,lugar)')
      .eq('usuario_id', miId).eq('respuesta', 'pendiente'),
    sb.from('alertas_problematicas')
      .select('id,problematica:problematicas(id,tipo,urgencia,alumno:alumnos(nombre,apellido))')
      .eq('usuario_id', miId).eq('leida', false)
      .order('created_at', { ascending:false }).limit(10),
    sb.from('alumnos').select('id', { count:'exact', head:true })
      .eq('institucion_id', instId).or('activo.is.null,activo.eq.true'),
    sb.from('usuarios').select('id', { count:'exact', head:true })
      .eq('institucion_id', instId).eq('rol', 'docente').or('activo.is.null,activo.eq.true'),
  ]);

  const probs         = probRes.data    || [];
  const objetivos     = objRes.data     || [];
  const eventosSem    = eventosRes.data || [];
  const pendientes    = (respRes.data   || []).filter(r => r.eventos_institucionales);
  const alertas       = alertasRes.error ? [] : (alertasRes.data || []);
  const totalAlumnos  = alumnosRes.count  ?? 0;
  const totalDocentes = docentesRes.count ?? 0;

  const { saludo, apellido } = _saludo(USUARIO_ACTUAL.nombre_completo);

  const nivelesPanel = ['inicial','primario','secundario']
    .map(n => renderNivelPanel(n, probs)).join('');

  document.getElementById('page-dash').innerHTML = `
    <div class="pg-t">${saludo}, ${apellido} 👋</div>
    <div class="pg-s" style="margin-bottom:14px">${_fechaStr()} · ${INSTITUCION_ACTUAL?.nombre || ''}</div>

    <div class="metrics m4" style="margin-bottom:14px">
      <div class="mc"><div class="mc-v">${totalAlumnos}</div><div class="mc-l">ALUMNOS ACTIVOS</div></div>
      <div class="mc"><div class="mc-v">${totalDocentes}</div><div class="mc-l">DOCENTES</div></div>
      <div class="mc"><div class="mc-v" style="color:var(--rojo)">${probs.length}</div><div class="mc-l">SITUACIONES</div></div>
      <div class="mc"><div class="mc-v" style="color:var(--ambar)">${alertas.length}</div><div class="mc-l">ALERTAS</div></div>
    </div>

    ${renderProximasActividades(eventosSem, sem.hoy, null)}
    ${renderAlertasProb(alertas)}
    ${renderPendientesRespuesta(pendientes)}
    ${renderObjetivosStrip(objetivos)}

    <div class="dash-cols">
      <div class="dash-col-l">
        <div class="sec-lb">Estado por nivel</div>
        ${nivelesPanel}
        <div class="acc" style="margin-top:4px">
          <button class="btn-s" style="font-size:11px" onclick="goPage('prob')">△ Problemáticas</button>
          <button class="btn-s" style="font-size:11px" onclick="goPage('leg')">▤ Resumen estudiante</button>
        </div>
      </div>
      <div class="dash-col-r">
        ${renderAgendaSemana(eventosSem, sem, null)}
      </div>
    </div>`;

  inyectarEstilosDash();
}

// ─── DIRECTIVO DE NIVEL ───────────────────────────────
async function rDashDirectivo() {
  showLoading('dash');
  const instId = USUARIO_ACTUAL.institucion_id;
  const miId   = USUARIO_ACTUAL.id;
  const nivel  = USUARIO_ACTUAL.nivel || 'secundario';
  const sem    = _semanaActual();

  const [probRes, objRes, eventosRes, respRes, alertasRes, alumnosRes, docentesRes] = await Promise.all([
    sb.from('problematicas')
      .select('id,urgencia,alumno:alumnos(curso:cursos(nivel))')
      .eq('institucion_id', instId)
      .in('estado', ['abierta','en_seguimiento']),
    sb.from('objetivos')
      .select('id,nombre,estado,tendencia')
      .eq('institucion_id', instId)
      .not('estado', 'in', '("archivado","logrado")'),
    sb.from('eventos_institucionales')
      .select('id,nombre,hora,lugar,nivel,fecha_inicio,convocados_ids,creado_por')
      .eq('institucion_id', instId)
      .gte('fecha_inicio', sem.inicio)
      .lte('fecha_inicio', sem.fin)
      .order('fecha_inicio').order('hora', { nullsFirst: true }),
    sb.from('evento_respuestas')
      .select('id,eventos_institucionales(nombre,hora,lugar)')
      .eq('usuario_id', miId).eq('respuesta', 'pendiente'),
    sb.from('alertas_problematicas')
      .select('id,problematica:problematicas(id,tipo,urgencia,alumno:alumnos(nombre,apellido))')
      .eq('usuario_id', miId).eq('leida', false)
      .order('created_at', { ascending:false }).limit(10),
    sb.from('alumnos').select('id', { count:'exact', head:true })
      .eq('institucion_id', instId).or('activo.is.null,activo.eq.true'),
    sb.from('usuarios').select('id', { count:'exact', head:true })
      .eq('institucion_id', instId).eq('rol', 'docente').or('activo.is.null,activo.eq.true'),
  ]);

  const probs         = probRes.data    || [];
  const objetivos     = objRes.data     || [];
  const eventosSem    = eventosRes.data || [];
  const pendientes    = (respRes.data   || []).filter(r => r.eventos_institucionales);
  const alertas       = alertasRes.error ? [] : (alertasRes.data || []);
  const totalAlumnos  = alumnosRes.count  ?? 0;
  const totalDocentes = docentesRes.count ?? 0;
  const probsNivel    = probs.filter(p => p.alumno?.curso?.nivel === nivel);

  const nc = NIVEL_CONFIG[nivel] || NIVEL_CONFIG.todos;
  const { saludo, apellido } = _saludo(USUARIO_ACTUAL.nombre_completo);

  document.getElementById('page-dash').innerHTML = `
    <div class="pg-t">${saludo}, ${apellido} 👋</div>
    <div class="pg-s" style="margin-bottom:14px">${_fechaStr()} · <span style="color:${nc.color};font-weight:600">${nc.label}</span></div>

    <div class="metrics m4" style="margin-bottom:14px">
      <div class="mc"><div class="mc-v">${totalAlumnos}</div><div class="mc-l">ALUMNOS ACTIVOS</div></div>
      <div class="mc"><div class="mc-v">${totalDocentes}</div><div class="mc-l">DOCENTES</div></div>
      <div class="mc"><div class="mc-v" style="color:var(--rojo)">${probsNivel.length}</div><div class="mc-l">SITUACIONES</div></div>
      <div class="mc"><div class="mc-v" style="color:var(--ambar)">${alertas.length}</div><div class="mc-l">ALERTAS</div></div>
    </div>

    ${renderProximasActividades(eventosSem, sem.hoy, nivel)}
    ${renderAlertasProb(alertas)}
    ${renderPendientesRespuesta(pendientes)}
    ${renderObjetivosStrip(objetivos)}

    <div class="dash-cols">
      <div class="dash-col-l">
        <div class="sec-lb">Estado del nivel</div>
        ${renderNivelPanel(nivel, probs)}
        <div class="acc" style="margin-top:4px">
          <button class="btn-s" style="font-size:11px" onclick="goPage('prob')">△ Problemáticas</button>
          <button class="btn-s" style="font-size:11px" onclick="goPage('leg')">▤ Resumen estudiante</button>
        </div>
      </div>
      <div class="dash-col-r">
        ${renderAgendaSemana(eventosSem, sem, nivel)}
      </div>
    </div>`;

  inyectarEstilosDash();
}

// ─── EOE ─────────────────────────────────────────────
async function rDashEOE() {
  showLoading('dash');
  const instId = USUARIO_ACTUAL.institucion_id;
  const miId   = USUARIO_ACTUAL.id;
  const sem    = _semanaActual();

  const [casosRes, objRes, eventosRes, respRes, alertasRes] = await Promise.all([
    sb.from('problematicas')
      .select('id,tipo,urgencia,alumno:alumnos(nombre,apellido)')
      .eq('institucion_id', instId)
      .in('estado', ['abierta','en_seguimiento'])
      .in('tipo', ['emocional','familiar','salud']),
    sb.from('objetivos')
      .select('id,nombre,estado,tendencia')
      .eq('institucion_id', instId)
      .not('estado', 'in', '("archivado","logrado")'),
    sb.from('eventos_institucionales')
      .select('id,nombre,hora,lugar,nivel,fecha_inicio,convocados_ids,creado_por')
      .eq('institucion_id', instId)
      .gte('fecha_inicio', sem.inicio)
      .lte('fecha_inicio', sem.fin)
      .order('fecha_inicio').order('hora', { nullsFirst: true }),
    sb.from('evento_respuestas')
      .select('id,eventos_institucionales(nombre,hora,lugar)')
      .eq('usuario_id', miId).eq('respuesta', 'pendiente'),
    sb.from('alertas_problematicas')
      .select('id,problematica:problematicas(id,tipo,urgencia,alumno:alumnos(nombre,apellido))')
      .eq('usuario_id', miId).eq('leida', false)
      .order('created_at', { ascending:false }).limit(10),
  ]);

  const casos      = casosRes.data   || [];
  const objetivos  = objRes.data     || [];
  const eventosSem = eventosRes.data || [];
  const pendientes = (respRes.data   || []).filter(r => r.eventos_institucionales);
  const alertas    = alertasRes.error ? [] : (alertasRes.data || []);
  const urgentes   = casos.filter(p => p.urgencia === 'alta');

  const { saludo, apellido } = _saludo(USUARIO_ACTUAL.nombre_completo);

  document.getElementById('page-dash').innerHTML = `
    <div class="pg-t">${saludo}, ${apellido} 👋</div>
    <div class="pg-s" style="margin-bottom:14px">${_fechaStr()} · Orientación escolar</div>

    ${renderAlertasProb(alertas)}
    ${urgentes.length ? `
      <div class="alr" style="margin-bottom:14px">
        <div class="alr-t">⚠️ ${urgentes.length} caso${urgentes.length > 1 ? 's' : ''} urgente${urgentes.length > 1 ? 's' : ''}</div>
        <div class="acc"><button class="btn-d" onclick="goPage('eoe')">Ver casos →</button></div>
      </div>` : ''}
    ${renderObjetivosStrip(objetivos)}

    ${renderPendientesRespuesta(pendientes)}

    <div class="dash-cols">
      <div class="dash-col-l">
        <div class="sec-lb">Mis casos EOE</div>
        <div class="metrics m2" style="margin-bottom:12px">
          <div class="mc"><div class="mc-v" style="color:var(--rojo)">${urgentes.length}</div><div class="mc-l">Urgentes</div></div>
          <div class="mc"><div class="mc-v" style="color:var(--ambar)">${casos.length - urgentes.length}</div><div class="mc-l">Seguimiento</div></div>
        </div>
        <div class="acc">
          <button class="btn-p" onclick="goPage('eoe')">✦ Ver mis casos</button>
          <button class="btn-s" onclick="goPage('leg')">▤ Resumen</button>
          <button class="btn-s" onclick="goPage('prob')">△ Situaciones</button>
        </div>
      </div>
      <div class="dash-col-r">
        ${renderAgendaSemana(eventosSem, sem, null)}
      </div>
    </div>`;

  inyectarEstilosDash();
}

// ─── DOCENTE ─────────────────────────────────────────
async function rDashDocente() {
  showLoading('dash');
  const miId   = USUARIO_ACTUAL.id;
  const instId = USUARIO_ACTUAL.institucion_id;
  const sem    = _semanaActual();

  // Paso 1: asignaciones + eventos + pendientes (paralelo)
  const [asigsRes, eventosRes, respRes] = await Promise.all([
    sb.from('docente_cursos')
      .select('curso_id,cursos(id,nombre,division,nivel)')
      .eq('usuario_id', miId)
      .eq('activo', true),
    sb.from('eventos_institucionales')
      .select('id,nombre,hora,lugar,nivel,fecha_inicio,convocados_ids,creado_por')
      .eq('institucion_id', instId)
      .gte('fecha_inicio', sem.inicio)
      .lte('fecha_inicio', sem.fin)
      .order('fecha_inicio').order('hora', { nullsFirst: true }),
    sb.from('evento_respuestas')
      .select('id,eventos_institucionales(nombre,hora,lugar)')
      .eq('usuario_id', miId).eq('respuesta', 'pendiente'),
  ]);

  const eventosSem = eventosRes.data || [];
  const pendientes = (respRes.data   || []).filter(r => r.eventos_institucionales);

  // Cursos únicos asignados
  const cursosMap = {};
  (asigsRes.data || []).forEach(a => {
    if (a.cursos && !cursosMap[a.curso_id]) cursosMap[a.curso_id] = a.cursos;
  });
  const cursos   = Object.values(cursosMap);
  const cursoIds = cursos.map(c => c.id);

  // Paso 2: alumnos + asistencia hoy (paralelo, requiere cursoIds)
  let alumnoData = [], asistHoy = [];
  if (cursoIds.length) {
    const [alRes, asistRes] = await Promise.all([
      sb.from('alumnos').select('id,curso_id').in('curso_id', cursoIds).eq('activo', true),
      sb.from('asistencia').select('curso_id').in('curso_id', cursoIds).eq('fecha', sem.hoy).is('hora_clase', null),
    ]);
    alumnoData = alRes.data   || [];
    asistHoy   = asistRes.data || [];
  }

  // Paso 3: problematicas por curso (requiere alumnoIds)
  const alumnoToCurso = {};
  const probsByCurso  = {};
  alumnoData.forEach(a => { alumnoToCurso[a.id] = a.curso_id; });

  const alumnoIds = alumnoData.map(a => a.id);
  if (alumnoIds.length) {
    const { data: pds } = await sb.from('problematicas')
      .select('alumno_id,urgencia')
      .in('alumno_id', alumnoIds)
      .in('estado', ['abierta','en_seguimiento']);
    (pds || []).forEach(p => {
      const cId = alumnoToCurso[p.alumno_id];
      if (cId) {
        if (!probsByCurso[cId]) probsByCurso[cId] = [];
        probsByCurso[cId].push(p);
      }
    });
  }

  const alumnosByCurso = {};
  alumnoData.forEach(a => {
    if (!alumnosByCurso[a.curso_id]) alumnosByCurso[a.curso_id] = 0;
    alumnosByCurso[a.curso_id]++;
  });

  const cursosConLista = new Set((asistHoy || []).map(a => a.curso_id));

  // Actividades de esta semana donde el docente es responsable/convocado
  const eventosPropios = eventosSem.filter(e =>
    e.creado_por === miId || (e.convocados_ids || []).includes(miId)
  );

  const { saludo, apellido } = _saludo(USUARIO_ACTUAL.nombre_completo);

  // Cards de cursos
  const cursosHTML = cursos.length
    ? cursos.map(cur => {
        const nc         = NIVEL_CONFIG[cur.nivel] || NIVEL_CONFIG.todos;
        const cntAl      = alumnosByCurso[cur.id]  || 0;
        const prbs       = probsByCurso[cur.id]    || [];
        const listaHecha = cursosConLista.has(cur.id);
        const urgentes   = prbs.filter(p => p.urgencia === 'alta').length;
        return `
          <div class="doc-curso-card" style="border-top:3px solid ${nc.color}">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
              <div>
                <div style="font-size:15px;font-weight:700;color:${nc.color}">${cur.nombre}${cur.division || ''}</div>
                <div style="font-size:10px;color:var(--txt2)">${nc.label}</div>
              </div>
              <span class="tag ${listaHecha ? 'tg' : 'ta'}" style="font-size:9px;flex-shrink:0">
                ${listaHecha ? '✓ Lista OK' : '⏳ Pendiente'}
              </span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px">
              <div class="ns"><div class="ns-v">${cntAl}</div><div class="ns-l">Alumnos</div></div>
              <div class="ns"><div class="ns-v" style="color:${urgentes ? 'var(--rojo)' : 'var(--verde)'}">${urgentes}</div><div class="ns-l">Urgentes</div></div>
              <div class="ns"><div class="ns-v" style="color:var(--ambar)">${prbs.length}</div><div class="ns-l">Situaciones</div></div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${!listaHecha ? `<button class="btn-p" style="font-size:10px" onclick="goPage('asist')">📋 Tomar lista</button>` : ''}
              <button class="btn-s" style="font-size:10px" onclick="goPage('notas')">≡ Notas</button>
              ${prbs.length ? `<button class="btn-s" style="font-size:10px" onclick="goPage('prob')">△ Situaciones</button>` : ''}
            </div>
          </div>`;
      }).join('')
    : `<div class="empty-state" style="padding:20px">Sin cursos asignados.<br><span style="font-size:11px;color:var(--txt2)">Contactá a Dirección para que te asignen cursos.</span></div>`;

  // Actividades propias de la semana
  const actividadesHTML = eventosPropios.length ? `
    <div class="sec-lb" style="margin-top:16px">Mis actividades esta semana</div>
    <div class="card" style="padding:0;overflow:hidden">
      ${eventosPropios.map(e => {
        const nc    = NIVEL_CONFIG[e.nivel] || NIVEL_CONFIG.todos;
        const esCre = e.creado_por === miId;
        return `
          <div class="ev-hoy-row" onclick="goPage('agenda')" style="border-left:3px solid ${nc.color}">
            <div style="min-width:60px">
              <div style="font-size:10px;color:var(--txt3)">${formatFechaLatam(e.fecha_inicio)}</div>
              <div style="font-size:11px;font-weight:700;color:var(--verde)">${e.hora ? e.hora.slice(0,5) : '—'}</div>
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600">${e.nombre}</div>
              ${e.lugar ? `<div style="font-size:10px;color:var(--txt2)">${e.lugar}</div>` : ''}
            </div>
            <span class="tag ${esCre ? 'tg' : 'tp'}" style="font-size:9px;flex-shrink:0">${esCre ? 'Organizador' : 'Convocado'}</span>
          </div>`;
      }).join('')}
    </div>` : '';

  const listasPendCount = cursos.filter(c => !cursosConLista.has(c.id)).length;
  const totalSituaciones = Object.values(probsByCurso).reduce((s, a) => s + a.length, 0);
  const listaColor = listasPendCount ? 'var(--rojo)' : 'var(--verde)';

  document.getElementById('page-dash').innerHTML = `
    <div class="pg-t">${saludo}, ${apellido} 👋</div>
    <div class="pg-s" style="margin-bottom:14px">${_fechaStr()}</div>

    <div class="metrics m3" style="margin-bottom:14px">
      <div class="mc"><div class="mc-v" style="color:${listaColor}">${listasPendCount}</div><div class="mc-l">LISTAS PENDIENTES</div></div>
      <div class="mc"><div class="mc-v" style="color:var(--ambar)">${totalSituaciones}</div><div class="mc-l">SITUACIONES</div></div>
      <div class="mc"><div class="mc-v">${cursos.length}</div><div class="mc-l">MIS CURSOS</div></div>
    </div>

    ${renderProximasActividades(eventosSem, sem.hoy, null)}
    ${renderPendientesRespuesta(pendientes)}

    <div class="dash-cols">
      <div class="dash-col-l">
        <div class="sec-lb">Mis cursos</div>
        ${cursosHTML}
      </div>
      <div class="dash-col-r">
        ${renderAgendaSemana(eventosSem, sem, null)}
      </div>
    </div>

    ${actividadesHTML}`;

  inyectarEstilosDash();
}

// ─── PRECEPTOR ───────────────────────────────────────
async function rDashPreceptor() {
  showLoading('dash');
  const miId   = USUARIO_ACTUAL.id;
  const instId = USUARIO_ACTUAL.institucion_id;
  const nivel  = USUARIO_ACTUAL.nivel || 'secundario';
  const sem    = _semanaActual();

  // Cursos del preceptor (por nivel o asignación explícita)
  const cursosIds = USUARIO_ACTUAL.cursos_ids;
  let cursosQuery = sb.from('cursos').select('*')
    .eq('institucion_id', instId).eq('nivel', nivel).order('nombre');
  if (cursosIds?.length) cursosQuery = cursosQuery.in('id', cursosIds);

  const [cursosRes, probRes, eventosRes, respRes] = await Promise.all([
    cursosQuery,
    sb.from('problematicas')
      .select('id,urgencia,alumno:alumnos(curso:cursos(nivel))')
      .eq('institucion_id', instId)
      .in('estado', ['abierta','en_seguimiento']),
    sb.from('eventos_institucionales')
      .select('id,nombre,hora,lugar,nivel,fecha_inicio,convocados_ids,creado_por')
      .eq('institucion_id', instId)
      .gte('fecha_inicio', sem.inicio)
      .lte('fecha_inicio', sem.fin)
      .order('fecha_inicio').order('hora', { nullsFirst: true }),
    sb.from('evento_respuestas')
      .select('id,eventos_institucionales(nombre,hora,lugar)')
      .eq('usuario_id', miId).eq('respuesta', 'pendiente'),
  ]);

  const cursos     = cursosRes.data   || [];
  const probs      = probRes.data     || [];
  const eventosSem = eventosRes.data  || [];
  const pendResp   = (respRes.data    || []).filter(r => r.eventos_institucionales);
  const cursoIdsList = cursos.map(c => c.id);

  // Calcular ayer y si fue día hábil
  const ayerDate = new Date(sem.hoy + 'T12:00:00');
  ayerDate.setDate(ayerDate.getDate() - 1);
  const ayer = ayerDate.toISOString().split('T')[0];
  const diaAyer = ayerDate.getDay();
  const ayerHabil = diaAyer >= 1 && diaAyer <= 5;

  // Asistencia hoy + ayer + alertas (requiere cursos)
  let asistHoy = [], asistAyer = [], alertasAlumnos = [];
  if (cursoIdsList.length) {
    const queries = [
      sb.from('asistencia').select('curso_id')
        .in('curso_id', cursoIdsList).eq('fecha', sem.hoy).is('hora_clase', null),
      sb.from('alumnos').select('id')
        .in('curso_id', cursoIdsList).eq('activo', true),
    ];
    if (ayerHabil) {
      queries.push(sb.from('asistencia').select('curso_id')
        .in('curso_id', cursoIdsList).eq('fecha', ayer).is('hora_clase', null));
    }
    const results = await Promise.all(queries);
    asistHoy = results[0].data || [];
    const alumnoIds = (results[1].data || []).map(a => a.id);
    if (ayerHabil) asistAyer = results[2]?.data || [];
    if (alumnoIds.length) {
      const { data: alertasData } = await sb.from('alertas_asistencia')
        .select('tipo_alerta,total_faltas,alumnos(nombre,apellido,cursos(nombre,division))')
        .in('alumno_id', alumnoIds)
        .order('tipo_alerta', { ascending: false })
        .limit(8);
      alertasAlumnos = alertasData || [];
    }
  }

  const cursosConListaHoy  = new Set((asistHoy  || []).map(a => a.curso_id));
  const cursosConListaAyer = new Set((asistAyer || []).map(a => a.curso_id));
  const pendientesHoy  = cursos.filter(c => !cursosConListaHoy.has(c.id));
  const pendientesAyer = ayerHabil ? cursos.filter(c => !cursosConListaAyer.has(c.id)) : [];
  const todasListas    = pendientesHoy.length === 0 && pendientesAyer.length === 0 && cursos.length > 0;
  const nc             = NIVEL_CONFIG[nivel] || NIVEL_CONFIG.todos;
  const { saludo, apellido } = _saludo(USUARIO_ACTUAL.nombre_completo);

  // Formatear fecha corta dd/mm
  const fmtCorta = iso => {
    const d = new Date(iso + 'T12:00:00');
    return `${d.getDate()}/${d.getMonth()+1}`;
  };
  const DIAS_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const diaLabel = iso => {
    const d = new Date(iso + 'T12:00:00');
    return `${DIAS_ES[d.getDay()]} ${fmtCorta(iso)}`;
  };

  // Banner listas
  const diasPendientes = [];
  if (pendientesAyer.length) diasPendientes.push({ fecha: ayer, cursos: pendientesAyer });
  if (pendientesHoy.length)  diasPendientes.push({ fecha: sem.hoy, cursos: pendientesHoy });

  const listasHTML = `
    <div style="background:${todasListas ? 'var(--verde-l)' : 'var(--rojo-l)'};border-left:4px solid ${todasListas ? 'var(--verde)' : 'var(--rojo)'};border-radius:var(--rad);padding:12px 14px;margin-bottom:14px">
      <div style="font-size:12px;font-weight:600;color:${todasListas ? 'var(--verde)' : 'var(--rojo)'}">
        ${todasListas
          ? '✅ Todas las listas registradas'
          : `⏳ Días con listas incompletas`}
      </div>
      ${!todasListas ? diasPendientes.map(dp => `
        <div style="margin-top:8px">
          <div style="font-size:10px;font-weight:600;color:var(--txt2);margin-bottom:4px">${diaLabel(dp.fecha)}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${dp.cursos.map(c => `
              <button class="btn-d" style="font-size:10px;padding:4px 10px" onclick="goPage('asist')">
                ${c.nombre}${c.division || ''}
              </button>`).join('')}
          </div>
        </div>`).join('') : ''}
    </div>`;

  // Alertas asistencia
  const alertasHTML = alertasAlumnos.length ? `
    <div class="sec-lb" style="margin-top:4px">⚠️ Alertas de asistencia</div>
    ${alertasAlumnos.map(a => {
      const al    = a.alumnos;
      const cu    = al?.cursos;
      const color = a.tipo_alerta >= 3 ? 'var(--rojo)' : 'var(--ambar)';
      return `
        <div class="card" style="padding:10px 14px;margin-bottom:6px;border-left:3px solid ${color};display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="goPage('asist')">
          <div>
            <div style="font-size:12px;font-weight:600">${al?.apellido}, ${al?.nombre}</div>
            <div style="font-size:10px;color:var(--txt2)">${cu?.nombre}${cu?.division || ''} · ${a.total_faltas} inasistencias</div>
          </div>
          <span class="tag ${a.tipo_alerta >= 3 ? 'tr' : 'ta'}" style="font-size:9px">${a.tipo_alerta >= 3 ? '🔴 Crítico' : '⚠️ Aviso'}</span>
        </div>`;
    }).join('')}` : '';

  const probsNivel     = probs.filter(p => p.alumno?.curso?.nivel === nivel);
  const listasOK       = cursosConListaHoy.size;
  const listasTotal    = cursos.length;
  const asistPct       = listasTotal ? Math.round(listasOK / listasTotal * 100) : 0;
  const asistColor     = asistPct >= 100 ? 'var(--verde)' : asistPct > 0 ? 'var(--ambar)' : 'var(--rojo)';
  const pendColor      = pendientesHoy.length ? 'var(--rojo)' : 'var(--verde)';
  const urgentesNivel  = probsNivel.filter(p => p.urgencia === 'alta').length;

  document.getElementById('page-dash').innerHTML = `
    <div class="pg-t">${saludo}, ${apellido} 👋</div>
    <div class="pg-s" style="margin-bottom:14px">${_fechaStr()} · <span style="color:${nc.color};font-weight:600">${nc.label}</span></div>

    <div class="metrics m4" style="margin-bottom:14px">
      <div class="mc"><div class="mc-v" style="color:${asistColor}">${asistPct}%</div><div class="mc-l">ASISTENCIA HOY</div></div>
      <div class="mc"><div class="mc-v" style="color:${pendColor}">${pendientesHoy.length}</div><div class="mc-l">LISTAS PENDIENTES</div></div>
      <div class="mc"><div class="mc-v" style="color:var(--rojo)">${urgentesNivel}</div><div class="mc-l">URGENTES</div></div>
      <div class="mc"><div class="mc-v" style="color:var(--ambar)">${alertasAlumnos.length}</div><div class="mc-l">ALERTAS ASIST.</div></div>
    </div>

    ${renderProximasActividades(eventosSem, sem.hoy, nivel)}
    ${listasHTML}

    <div class="dash-cols">
      <div class="dash-col-l">
        <div class="sec-lb">Estado del nivel</div>
        ${renderNivelPanel(nivel, probs)}
        ${alertasHTML}
        <div class="acc" style="margin-top:10px">
          <button class="btn-p" onclick="goPage('asist')">📋 Tomar lista</button>
          <button class="btn-s" onclick="goPage('leg')">▤ Resumen</button>
          <button class="btn-s" onclick="goPage('prob')">△ Reportar</button>
        </div>
      </div>
      <div class="dash-col-r">
        ${renderAgendaSemana(eventosSem, sem, nivel)}
      </div>
    </div>

    ${renderPendientesRespuesta(pendResp)}`;

  inyectarEstilosDash();
}

// ─── ACCIONES ─────────────────────────────────────────
async function responderEvento(respuestaId, respuesta, btn) {
  btn.disabled = true;
  await sb.from('evento_respuestas').update({ respuesta }).eq('id', respuestaId);
  rDash();
}

// Stub mantenido por compatibilidad (ya no se usa con tabs)
function setNivel(nivel) { NIVEL_ACTIVO = nivel; rDash(); }
let NIVEL_ACTIVO = 'todos';

async function marcarAlertasProbLeidas() {
  await sb.from('alertas_problematicas')
    .update({ leida: true })
    .eq('usuario_id', USUARIO_ACTUAL.id)
    .eq('leida', false);
  rDash();
}
async function marcarAlertaProbLeida(alertaId) {
  await sb.from('alertas_problematicas').update({ leida: true }).eq('id', alertaId);
  rDash();
}

// ─── ESTILOS ──────────────────────────────────────────
function inyectarEstilosDash() {
  if (document.getElementById('dash-styles')) return;
  const st = document.createElement('style');
  st.id = 'dash-styles';
  st.textContent = `
    /* Layout dos columnas */
    .dash-cols{display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start;margin-top:4px}
    @media(max-width:860px){.dash-cols{grid-template-columns:1fr}}
    @media(max-width:860px){.dash-col-r{order:-1}}

    /* Paneles de nivel */
    .nivel-panel{background:var(--surf);border:1px solid var(--brd);border-radius:var(--rad-lg);padding:14px;margin-bottom:10px}
    .ns{background:var(--surf2);border-radius:var(--rad);padding:8px;text-align:center}
    .ns-v{font-size:20px;font-weight:700;font-family:'DM Sans',sans-serif}
    .ns-l{font-size:10px;color:var(--txt2);margin-top:2px}

    /* Agenda semanal */
    .ags-semana{display:flex;flex-direction:column;gap:0}
    .ags-dia{padding:6px 4px;border-bottom:1px solid var(--brd)}
    .ags-dia:last-child{border-bottom:none}
    .ags-hoy{background:var(--surf2);border-radius:var(--rad);padding:6px 8px}
    .ags-dia-head{display:flex;align-items:center;gap:8px;margin-bottom:3px}
    .ags-dname{font-size:11px;font-weight:700;color:var(--txt2);width:28px}
    .ags-dnum{font-size:12px;font-weight:600;color:var(--txt);width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:50%}
    .ags-dnum.hoy{background:var(--verde);color:#fff}
    .ags-ev{display:flex;align-items:baseline;gap:5px;padding:3px 0 3px 6px;border-left:3px solid var(--brd);margin-bottom:2px;cursor:pointer;border-radius:0 4px 4px 0;transition:background .1s}
    .ags-ev:hover{background:var(--surf2)}
    .ags-hora{font-size:10px;color:var(--txt3);min-width:30px;flex-shrink:0}
    .ags-nom{font-size:11px;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
    .ags-tag{font-size:9px;color:var(--txt3);flex-shrink:0}
    .ags-vacio{font-size:10px;color:var(--txt3);padding-left:6px}

    /* Strip de objetivos */
    .obj-barra{height:8px;display:flex;border-radius:4px;overflow:hidden;background:var(--brd);margin:6px 0}

    /* Cards de cursos docente */
    .doc-curso-card{background:var(--surf);border:1px solid var(--brd);border-radius:var(--rad-lg);padding:14px;margin-bottom:10px}

    /* Fila evento */
    .ev-hoy-row{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--brd);cursor:pointer;transition:background .1s}
    .ev-hoy-row:last-child{border-bottom:none}
    .ev-hoy-row:hover{background:var(--surf2)}

    /* Botón ghost (enlace sin borde) */
    .btn-ghost{background:none;border:none;cursor:pointer;color:var(--verde);font-size:12px;font-weight:500;padding:3px 8px;border-radius:6px;font-family:'DM Sans',sans-serif;transition:background .12s}
    .btn-ghost:hover{background:var(--verde-l)}
  `;
  document.head.appendChild(st);
}
