// =====================================================
// DASHBOARD.JS — Panel principal por rol
// =====================================================

// NIVEL_CONFIG está declarado en agenda.js (cargado antes) y se comparte globalmente

// Lunes a domingo de la semana actual
function _semanaActual() {
  const hoy = hoyISO();
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

// ── Aviso de cierre de período programado ──────────────
// Cuenta regresiva en el inicio cuando faltan <= 15 días para la fecha de cierre
// programada de un período del nivel del usuario. Para docentes, preceptores y
// directivos de nivel. Se pinta en el placeholder #dash-aviso-cierre (cada
// dashboard de esos roles lo incluye arriba). Filtra por USUARIO_ACTUAL.nivel.
async function _renderAvisoCierre() {
  const cont = document.getElementById('dash-aviso-cierre');
  if (!cont) return;
  const nivel = USUARIO_ACTUAL?.nivel;
  if (!nivel) return;

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const lim = new Date(hoy); lim.setDate(lim.getDate() + 15);
  const hoyISO = hoy.toISOString().slice(0, 10);
  const limISO = lim.toISOString().slice(0, 10);

  const { data: periodos } = await sb.from('periodos_evaluativos')
    .select('nombre,fecha_cierre_programada')
    .eq('institucion_id', USUARIO_ACTUAL.institucion_id).eq('nivel', nivel)
    .not('fecha_cierre_programada', 'is', null)
    .gte('fecha_cierre_programada', hoyISO)
    .lte('fecha_cierre_programada', limISO)
    .order('fecha_cierre_programada');

  if (!periodos || !periodos.length) return;

  cont.innerHTML = periodos.map(p => {
    const f      = new Date(p.fecha_cierre_programada + 'T12:00:00');
    const dias   = Math.round((f - hoy) / 86400000);
    const cuenta = dias <= 0 ? 'es hoy' : dias === 1 ? 'es mañana' : `en ${dias} días`;
    const urgente = dias <= 5;
    const clr = urgente ? 'var(--rojo)' : 'var(--ambar)';
    const bg  = urgente ? 'var(--rojo-l)' : 'var(--amb-l)';
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:11px 13px;background:${bg};border-radius:var(--rad);border-left:3px solid ${clr};margin-bottom:10px">
        <div style="font-size:18px">⏳</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:${clr}">Cierre de "${_esc(p.nombre)}" ${cuenta}</div>
          <div style="font-size:11px;color:var(--txt2)">Cargá y revisá las calificaciones antes del ${f.getDate()}/${f.getMonth() + 1}.</div>
        </div>
      </div>`;
  }).join('');
}

// ── Cumpleaños del equipo ──────────────────────────────
// Recordatorio en el inicio: cumpleaños del staff de la institución de hoy y de
// los próximos 7 días, usando usuarios.fecha_nacimiento (sólo importan día y
// mes; el año se ignora). Se pinta en el placeholder #dash-cumples, que está en
// los 5 dashboards. No-op si no hay placeholder o si no hay cumpleaños en la
// ventana. No muestra la edad a propósito (dato sensible): sólo nombre y fecha.
const _CUMPLES_VENTANA_DIAS = 7;

async function _renderAvisoCumples() {
  const cont = document.getElementById('dash-cumples');
  if (!cont || !USUARIO_ACTUAL?.institucion_id) return;

  const { data } = await sb.from('usuarios')
    .select('nombre_completo, fecha_nacimiento, avatar_url, avatar_iniciales, rol')
    .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
    .not('fecha_nacimiento', 'is', null)
    .neq('rol', 'familia')
    .or('activo.is.null,activo.eq.true');

  if (!data || !data.length) return;

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  const items = data.map(u => {
    const [anio, mes, dia] = String(u.fecha_nacimiento).split('-').map(Number);
    if (!mes || !dia) return null;
    // Próxima ocurrencia: este año, o el que viene si ya pasó.
    // (Un 29/02 en año no bisiesto cae en 01/03 — se acepta.)
    let prox = new Date(hoy.getFullYear(), mes - 1, dia);
    prox.setHours(0, 0, 0, 0);
    if (prox < hoy) { prox = new Date(hoy.getFullYear() + 1, mes - 1, dia); prox.setHours(0, 0, 0, 0); }
    const dias = Math.round((prox - hoy) / 86400000);
    return { ...u, dias, dia, mes };
  }).filter(x => x && x.dias <= _CUMPLES_VENTANA_DIAS)
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 6);

  if (!items.length) return;

  cont.innerHTML = `
    <div class="card" style="padding:12px 13px;margin-bottom:14px">
      <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--txt2);margin-bottom:9px">
        🎂 Cumpleaños del equipo
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${items.map(u => {
          const esHoy = u.dias === 0;
          const ini   = (u.avatar_iniciales || generarIniciales(u.nombre_completo || '')).toUpperCase();
          const av    = u.avatar_url
            ? `<img src="${u.avatar_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`
            : ini;
          const cuando = esHoy ? 'Hoy' : u.dias === 1 ? 'Mañana' : `${u.dia}/${u.mes}`;
          return `
            <div style="display:flex;align-items:center;gap:9px">
              <div class="av av32" style="background:${esHoy ? 'var(--verde)' : 'var(--gris)'};color:#fff;overflow:hidden">${av}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:12px;font-weight:${esHoy ? '600' : '500'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(u.nombre_completo)}</div>
                <div style="font-size:10px;color:var(--txt2)">${labelRol(u.rol)}</div>
              </div>
              <span class="tag ${esHoy ? 'tg' : 'tgr'}" style="flex-shrink:0">${cuando}</span>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ── SHARED: Agenda semanal ─────────────────────────────
function renderAgendaSemana(eventosSem, sem, nivelFiltro) {
  const diasNombres = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const miId = USUARIO_ACTUAL.id;

  // Agrupar por fecha: eventos multi-día aparecen en cada día que abarcan
  const porFecha = {};
  eventosSem.forEach(e => {
    let cur = e.fecha_inicio;
    const end = e.fecha_fin || e.fecha_inicio;
    while (cur <= sem.fin && cur <= end) {
      if (cur >= sem.inicio) {
        if (!porFecha[cur]) porFecha[cur] = [];
        if (!porFecha[cur].some(x => x.id === e.id)) porFecha[cur].push(e);
      }
      if (cur >= end) break;
      const dx = new Date(cur + 'T12:00:00');
      dx.setDate(dx.getDate() + 1);
      cur = dx.toISOString().slice(0, 10);
    }
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

// ── SHARED: Panel de estado por nivel ─────────────────
function renderNivelPanel(nivel, problematicasFull) {
  const nc = NIVEL_CONFIG[nivel] || { color:'#888', bg:'#f5f5f5', label: nivel };

  // problematicasFull tiene alumno?.curso?.nivel embebido
  const probsNivel  = problematicasFull.filter(p => p.alumno?.curso?.nivel === nivel);
  const urgentes    = probsNivel.filter(p => p.urgencia === 'alta');
  const seguimiento = probsNivel.filter(p => p.urgencia === 'media');

  return `
    <div class="nivel-panel" style="border-top:3px solid ${nc.color}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:${nc.color}">${nc.label}</div>
        <button class="btn-s" style="font-size:9px;padding:3px 10px" onclick="goPage('prob')">Ir →</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
        <div class="ns"><div class="ns-v" style="color:var(--rojo)">${urgentes.length}</div><div class="ns-l">Urgentes</div></div>
        <div class="ns"><div class="ns-v" style="color:var(--ambar)">${seguimiento.length}</div><div class="ns-l">Seguimiento</div></div>
        <div class="ns"><div class="ns-v">${probsNivel.length}</div><div class="ns-l">Total</div></div>
      </div>
      ${urgentes.length ? `
        <div style="margin-top:8px;padding:7px 10px;background:var(--rojo-l);border-radius:var(--rad);font-size:11px;color:var(--rojo)">
          ⚠️ ${urgentes.length} situación${urgentes.length > 1 ? 'es' : ''} urgente${urgentes.length > 1 ? 's' : ''}
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

// ── Director: Card comparativa de estado por nivel ────
function renderNivelCardDirector(nivel, d) {
  const nc = NIVEL_CONFIG[nivel] || { color:'#888', label: nivel };
  const coberturaBaja     = d.notas && d.notas.pct < 60;
  const coberturaCritica  = d.notas && d.notas.pct < 30 && d.cierreProximo;

  let estadoTag = 'tg', estadoLbl = 'ok';
  if (d.alertaAsistencia || coberturaCritica)      { estadoTag = 'tr'; estadoLbl = 'alerta'; }
  else if (d.situaciones > 0 || coberturaBaja)     { estadoTag = 'ta'; estadoLbl = 'atención'; }

  const asistLinea = d.asistPct === null
    ? `<div style="font-size:11px;color:var(--txt3)">Asistencia — pendiente de registro</div>`
    : `<div style="font-size:11px;color:var(--txt2)">Asistencia hoy — <span style="font-weight:700;color:${d.asistPct>=85?'var(--verde)':d.asistPct>=70?'var(--ambar)':'var(--rojo)'}">${d.asistPct}%</span></div>`;

  let segundaLinea = '';
  if (nivel === 'inicial') {
    segundaLinea = d.informesAlDia
      ? `<span class="tag tg" style="font-size:9px">Informes al día</span>`
      : `<span class="tag ta" style="font-size:9px">Informes pendientes</span>`;
  } else if (d.notas) {
    const cobTag = d.notas.pct >= 80 ? 'tg' : d.notas.pct >= 30 ? 'ta' : 'tr';
    segundaLinea = `<span class="tag ${cobTag}" style="font-size:9px">Notas cuatrimestre ${d.notas.cuatri} — cobertura ${d.notas.pct}%</span>`;
  }

  return `
    <div class="card" style="border-top:3px solid ${nc.color}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:11px;font-weight:700;color:${nc.color};letter-spacing:.04em">${nc.label.toUpperCase()}</div>
        <span class="tag ${estadoTag}" style="font-size:9px">${estadoLbl}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px">
        <div class="ns"><div class="ns-v">${d.alumnos}</div><div class="ns-l">Alumnos</div></div>
        <div class="ns"><div class="ns-v">${d.docentes}</div><div class="ns-l">Docentes</div></div>
        <div class="ns"><div class="ns-v" style="color:${d.situaciones>0?'var(--rojo)':'var(--txt)'}">${d.situaciones}</div><div class="ns-l">Situaciones</div></div>
      </div>
      ${asistLinea}
      ${segundaLinea ? `<div style="margin-top:7px">${segundaLinea}</div>` : ''}
    </div>`;
}

// ── Director: Panel de alertas institucionales cruzadas ─
function renderAlertasInstitucionales(alertas) {
  if (!alertas.length) return '';
  return `
    <div style="background:var(--rojo-l);border:1px solid rgba(214,59,47,0.16);border-radius:12px;padding:14px;margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:var(--rojo);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">△ Alertas institucionales</div>
      <div style="display:flex;flex-direction:column;gap:7px">
        ${alertas.map(a => `
          <div style="border-left:3px solid ${a.clr};border-radius:0 8px 8px 0;background:var(--surf);padding:10px 12px;cursor:pointer" onclick="goPage('${a.goPage}')">
            <div style="font-size:12px;font-weight:600;color:${a.clr}">${a.titulo}</div>
            ${a.subtexto ? `<div style="font-size:11px;color:var(--txt2);margin-top:2px">${a.subtexto}</div>` : ''}
          </div>`).join('')}
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
  // Panel de un módulo: si Agenda está apagada en Apps (o el rol no la ve),
  // no se pinta. Cubre los 5 dashboards de una.
  if (typeof puedeVer === 'function' && !puedeVer('agenda')) return '';
  // Incluye eventos que empiezan hoy O que abarcan hoy (multi-día)
  let eventos = eventosSem.filter(e => e.fecha_inicio <= hoy && (e.fecha_fin || e.fecha_inicio) >= hoy);
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
  else if (esDirectivoNivel(rol))   await rDashDirectivo();
  else if (rol === 'eoe')               await rDashEOE();
  else if (rol === 'docente')           await rDashDocente();
  else if (rol === 'preceptor')         await rDashPreceptor();
  else                                  await rDashDirector();
  _renderTareasDash().catch(() => {});
  // Aviso de cierre de período (no-op si el dashboard del rol no tiene el placeholder).
  _renderAvisoCierre().catch(() => {});
  // Cumpleaños del equipo (placeholder #dash-cumples, presente en los 5 dashboards).
  _renderAvisoCumples().catch(() => {});
}

// ─── DIRECTOR GENERAL ─────────────────────────────────
async function rDashDirector() {
  showLoading('dash');
  const instId = USUARIO_ACTUAL.institucion_id;
  const miId   = USUARIO_ACTUAL.id;
  const sem    = _semanaActual();
  const hoy    = sem.hoy;
  const anio   = INSTITUCION_ACTUAL?.anio_lectivo || new Date().getFullYear();

  // Fecha de corte para intervenciones recientes (7 días) y semestre narrativo (inicial)
  const dHace7 = new Date(hoy + 'T00:00:00');
  dHace7.setDate(dHace7.getDate() - 7);
  const hace7ISO       = dHace7.toISOString().slice(0, 10);
  const semestreActual = hoy < `${anio}-07-21` ? 1 : 2;

  const [
    probRes, objRes, eventosRes, respRes, alertasRes,
    alumnosRes, docentesRes, asistHoyRes, noLectRes, cursosRes, alertasAsistRes,
    cierresRes, configRes,
  ] = await Promise.all([
    sb.from('problematicas')
      .select('id,urgencia,estado,alumno_id,alumno:alumnos(curso:cursos(nivel))')
      .eq('institucion_id', instId)
      .in('estado', ['abierta','en_seguimiento']),
    sb.from('objetivos')
      .select('id,nombre,estado,tendencia')
      .eq('institucion_id', instId)
      .not('estado', 'in', '("archivado","logrado")'),
    sb.from('eventos_institucionales')
      .select('id,nombre,hora,lugar,nivel,fecha_inicio,fecha_fin,convocados_ids,creado_por')
      .eq('institucion_id', instId)
      .lte('fecha_inicio', sem.fin)
      .or(`fecha_fin.gte.${sem.inicio},fecha_inicio.gte.${sem.inicio}`)
      .order('fecha_inicio').order('hora', { nullsFirst: true }),
    sb.from('evento_respuestas')
      .select('id,eventos_institucionales(nombre,hora,lugar)')
      .eq('usuario_id', miId).eq('respuesta', 'pendiente'),
    sb.from('alertas_problematicas')
      .select('id,problematica:problematicas(id,tipo,urgencia,alumno:alumnos(nombre,apellido))')
      .eq('usuario_id', miId).eq('leida', false)
      .order('created_at', { ascending:false }).limit(10),
    sb.from('alumnos').select('id,nombre,apellido,curso_id,cursos(nombre,division,nivel)')
      .eq('institucion_id', instId).or('activo.is.null,activo.eq.true'),
    sb.from('usuarios').select('id,nivel,rol')
      .eq('institucion_id', instId).in('rol', ['docente','preceptor']).or('activo.is.null,activo.eq.true'),
    sb.from('asistencia').select('estado,curso_id').eq('fecha', hoy).is('hora_clase', null),
    sb.from('dias_no_lectivos').select('fecha').eq('institucion_id', instId),
    sb.from('cursos').select('id,nivel').eq('institucion_id', instId),
    sb.from('alertas_asistencia')
      .select('alumno_id,tipo_alerta,total_faltas,alumnos(nombre,apellido,cursos(nombre,division,nivel))')
      .eq('institucion_id', instId)
      .order('tipo_alerta', { ascending: false }),
    sb.from('cierres_periodo').select('tipo').eq('institucion_id', instId).in('tipo', ['cuatrimestre_1','cuatrimestre_2']),
    sb.from('config_asistencia').select('nivel,nota_minima,umbral_alerta_1,umbral_alerta_2,dimensiones_informe').eq('institucion_id', instId),
  ]);

  window._diasNoLectivos = new Set((noLectRes.data || []).map(r => r.fecha));
  checkAlertasProb(instId).catch(() => {});

  const probs         = probRes.data    || [];
  const objetivos     = objRes.data     || [];
  const eventosSem    = eventosRes.data || [];
  const pendientes    = (respRes.data   || []).filter(r => r.eventos_institucionales);
  const alertas       = alertasRes.error ? [] : (alertasRes.data || []);
  const alumnosData   = alumnosRes.data  || [];
  const docentesData  = docentesRes.data || [];
  const totalAlumnos  = alumnosData.length;
  const totalDocentes = docentesData.length;
  const cursosData    = cursosRes.data || [];
  const totalCursos   = cursosData.length;
  const nivelesActivos = [...new Set(cursosData.map(c => c.nivel))];
  const alertasAsist  = alertasAsistRes.error ? [] : (alertasAsistRes.data || []);
  const configData    = configRes.data || [];

  // ── Barra de asistencia institucional (sin cambios) ──
  const asistHoy = asistHoyRes.data || [];
  const asistContador = { presente:0, ausente:0, media_falta:0, tardanza:0, justificado:0 };
  asistHoy.forEach(a => { if (asistContador[a.estado] !== undefined) asistContador[a.estado]++; });
  const pctAsist = totalAlumnos > 0
    ? Math.min(100, Math.round((asistContador.presente + asistContador.tardanza + asistContador.media_falta) / totalAlumnos * 100))
    : 0;
  const _asistClr = pctAsist >= 85 ? 'var(--verde)' : pctAsist >= 70 ? 'var(--ambar)' : 'var(--rojo)';
  const cursosConListaDir = new Set(asistHoy.map(a => a.curso_id).filter(Boolean)).size;
  const listasPendDir = esFechaHabil(hoy) ? Math.max(0, totalCursos - cursosConListaDir) : 0;
  const asistCardHTML = !esFechaHabil(hoy) ? `
    <div class="card" style="margin-bottom:14px;border-left:4px solid var(--gris)">
      <div style="font-size:12px;color:var(--txt2)">📋 Asistencia hoy — Día no lectivo</div>
    </div>` : asistHoy.length > 0 ? `
    <div class="card" style="margin-bottom:14px;border-left:4px solid ${_asistClr}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:12px;font-weight:600">📋 Asistencia hoy</div>
        <div style="font-size:16px;font-weight:700;color:${_asistClr}">${pctAsist}%</div>
      </div>
      <div style="background:var(--gris-l);border-radius:4px;height:6px;margin-bottom:10px">
        <div style="width:${pctAsist}%;background:${_asistClr};height:6px;border-radius:4px;transition:width .3s"></div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11px">
        <span style="color:var(--verde)">✅ ${asistContador.presente} presentes</span>
        <span style="color:var(--rojo)">❌ ${asistContador.ausente} ausentes</span>
        ${asistContador.media_falta+asistContador.tardanza > 0 ? `<span style="color:var(--ambar)">🕐 ${asistContador.media_falta+asistContador.tardanza} tardanzas/MF</span>` : ''}
        ${asistContador.justificado > 0 ? `<span style="color:var(--azul)">📋 ${asistContador.justificado} justificados</span>` : ''}
        ${listasPendDir > 0 ? `<span style="color:var(--ambar)">⏳ ${listasPendDir} ${listasPendDir === 1 ? 'lista pendiente' : 'listas pendientes'}</span>` : `<span style="color:var(--verde)">✓ Todas las listas tomadas</span>`}
      </div>
    </div>` : `
    <div class="card" style="margin-bottom:14px;border-left:4px solid var(--gris)">
      <div style="font-size:12px;color:var(--txt2)">📋 Asistencia hoy — Sin registros todavía${totalCursos > 0 ? ` · ${totalCursos} listas pendientes` : ''}</div>
    </div>`;

  // ── Mapas de cruce (curso→nivel, config por nivel) ──
  const cursoNivelMap = {};
  cursosData.forEach(c => { cursoNivelMap[c.id] = c.nivel; });
  const configPorNivel = {};
  configData.forEach(c => { configPorNivel[c.nivel] = c; });

  // ── Alumnos / docentes / situaciones por nivel ──
  const alumnosPorNivel = {};
  alumnosData.forEach(a => {
    const n = a.cursos?.nivel;
    if (!n) return;
    if (!alumnosPorNivel[n]) alumnosPorNivel[n] = [];
    alumnosPorNivel[n].push(a);
  });
  const docentesPorNivel = {};
  docentesData.forEach(d => {
    if (!d.nivel) return;
    docentesPorNivel[d.nivel] = (docentesPorNivel[d.nivel] || 0) + 1;
  });
  const probsPorNivel = {};
  probs.forEach(p => {
    const n = p.alumno?.curso?.nivel;
    if (!n) return;
    if (!probsPorNivel[n]) probsPorNivel[n] = [];
    probsPorNivel[n].push(p);
  });

  // ── Asistencia hoy por nivel ──
  const asistPorNivel = {};
  asistHoy.forEach(a => {
    const n = cursoNivelMap[a.curso_id];
    if (!n) return;
    if (!asistPorNivel[n]) asistPorNivel[n] = { presente:0, ausente:0, tardanza:0, media_falta:0, justificado:0 };
    if (asistPorNivel[n][a.estado] !== undefined) asistPorNivel[n][a.estado]++;
  });

  // ── Alertas de inasistencia por nivel (tabla ya precomputada) ──
  const alertasAsistPorNivel = {};
  alertasAsist.forEach(a => {
    const n = a.alumnos?.cursos?.nivel;
    if (!n) return;
    if (!alertasAsistPorNivel[n]) alertasAsistPorNivel[n] = [];
    alertasAsistPorNivel[n].push(a);
  });

  // ── Cuatrimestre institucional (mismo calendario para primario/secundario) ──
  const cuatriInfo     = _cuatrimestreInfo(hoy, cierresRes.data || [], anio);
  const cierreProximo  = cuatriInfo.restantes <= 15 && !cuatriInfo.cerrado;

  // ── WAVE 2: instancias evaluativas + asignaciones (primario/secundario) + intervenciones 7d + informes iniciales ──
  const nonInicialCursoIds = cursosData.filter(c => c.nivel !== 'inicial').map(c => c.id);
  const probsIds           = probs.map(p => p.id);
  const alumnosInicialIds  = (alumnosPorNivel.inicial || []).map(a => a.id);

  const [instanciasRes, asignRes, interv7dRes, obsInicialesRes] = await Promise.all([
    nonInicialCursoIds.length
      ? sb.from('instancias_evaluativas').select('id,curso_id,materia_id,es_recuperatorio,materias(nombre)').in('curso_id', nonInicialCursoIds)
      : Promise.resolve({ data: [] }),
    nonInicialCursoIds.length
      ? sb.from('asignaciones').select('materia_id,curso_id').in('curso_id', nonInicialCursoIds).eq('anio_lectivo', anio)
      : Promise.resolve({ data: [] }),
    probsIds.length
      ? sb.from('intervenciones').select('problematica_id').in('problematica_id', probsIds).gte('created_at', hace7ISO + 'T00:00:00')
      : Promise.resolve({ data: [] }),
    alumnosInicialIds.length
      ? sb.from('observaciones_iniciales').select('alumno_id').eq('anio_lectivo', anio).eq('semestre', semestreActual).in('alumno_id', alumnosInicialIds)
      : Promise.resolve({ data: [] }),
  ]);

  const instanciasData = instanciasRes.data || [];
  const instanciaIds   = instanciasData.filter(i => !i.es_recuperatorio).map(i => i.id);

  // ── WAVE 3: calificaciones (depende de instanciaIds) ──
  const califRes = instanciaIds.length
    ? await sb.from('calificaciones').select('nota,instancia_id,ausente,alumno_id').in('instancia_id', instanciaIds).not('nota', 'is', null)
    : { data: [] };
  const califs = (califRes.data || []).filter(c => !c.ausente);

  // ── Cobertura de notas por nivel (primario / secundario) ──
  const instNivelMap = {};
  instanciasData.forEach(i => { instNivelMap[i.id] = cursoNivelMap[i.curso_id]; });

  function _cobertura(nivel) {
    const instanciasN = instanciasData.filter(i => cursoNivelMap[i.curso_id] === nivel);
    const asignN      = (asignRes.data || []).filter(a => cursoNivelMap[a.curso_id] === nivel);
    const cursosN     = cursosData.filter(c => c.nivel === nivel);
    const califsN     = califs.filter(c => instNivelMap[c.instancia_id] === nivel);
    const stats = _califEstadoNivel(califsN, instanciasN, asignN, cursosN);
    return stats.totalCombos > 0 ? Math.round(stats.conNotas / stats.totalCombos * 100) : null;
  }
  const cobPctPrimario   = nivelesActivos.includes('primario')   ? _cobertura('primario')   : null;
  const cobPctSecundario = nivelesActivos.includes('secundario') ? _cobertura('secundario') : null;

  // ── Situaciones sin intervención reciente (7 días) por nivel ──
  const probsConInterv = new Set((interv7dRes.data || []).map(i => i.problematica_id));
  const sinIntervPorNivel = {};
  Object.keys(probsPorNivel).forEach(n => {
    sinIntervPorNivel[n] = probsPorNivel[n].filter(p => !probsConInterv.has(p.id)).length;
  });

  // ── Informes narrativos (nivel inicial) ──
  const alumnosInicialCount = (alumnosPorNivel.inicial || []).length;
  const conInformeSet = new Set((obsInicialesRes.data || []).map(o => o.alumno_id));
  const informesAlDia = alumnosInicialCount > 0 && conInformeSet.size >= alumnosInicialCount;

  // ── Cards de estado por nivel ──
  const NIVELES = ['inicial','primario','secundario'];
  const nivelCardsHTML = NIVELES.filter(n => nivelesActivos.includes(n)).map(n => {
    const alumnosN  = (alumnosPorNivel[n] || []).length;
    const docentesN = docentesPorNivel[n] || 0;
    const asistN    = asistPorNivel[n];
    const totalRegN = asistN ? Object.values(asistN).reduce((a, b) => a + b, 0) : 0;
    const asistPctN = totalRegN > 0
      ? Math.min(100, Math.round((asistN.presente + asistN.tardanza + asistN.media_falta) / alumnosN * 100))
      : null;
    let notas = null;
    if (n === 'primario')   notas = cobPctPrimario   !== null ? { pct: cobPctPrimario,   cuatri: cuatriInfo.cuatri } : null;
    if (n === 'secundario') notas = cobPctSecundario !== null ? { pct: cobPctSecundario, cuatri: cuatriInfo.cuatri } : null;

    return renderNivelCardDirector(n, {
      alumnos: alumnosN, docentes: docentesN, situaciones: (probsPorNivel[n] || []).length,
      asistPct: asistPctN, notas, cierreProximo,
      alertaAsistencia: (alertasAsistPorNivel[n] || []).length > 0,
      informesAlDia: n === 'inicial' ? informesAlDia : null,
    });
  }).join('');

  // ── Alertas institucionales cruzadas (máx. 4, por severidad) ──
  const alertasInst = [];

  // Alerta 1 — cobertura crítica de notas
  [['primario', cobPctPrimario], ['secundario', cobPctSecundario]].forEach(([n, pct]) => {
    if (pct !== null && pct < 30 && cierreProximo) {
      alertasInst.push({
        sev: 3, clr: 'var(--rojo)',
        titulo: `${NIVEL_CONFIG[n].label} — cobertura crítica de notas`,
        subtexto: `${pct}% de materias evaluadas · cierre en ${cuatriInfo.restantes} días`,
        goPage: 'notas',
      });
    }
  });

  // Alerta 2 — alumnos con inasistencias sobre el umbral (por nivel)
  NIVELES.forEach(n => {
    const lista = alertasAsistPorNivel[n];
    if (lista?.length) {
      const nombres = lista.slice(0, 2).map(a => `${a.alumnos?.apellido}, ${a.alumnos?.nombre} (${a.total_faltas} faltas)`);
      alertasInst.push({
        sev: 2, clr: 'var(--ambar)',
        titulo: `${lista.length} alerta${lista.length > 1 ? 's' : ''} de inasistencia — ${NIVEL_CONFIG[n].label}`,
        subtexto: nombres.join(' · ') + (lista.length > 2 ? ` y ${lista.length - 2} más` : ''),
        goPage: 'asist',
      });
    }
  });

  // Alerta 3 — situaciones sin intervención reciente (por nivel)
  NIVELES.forEach(n => {
    const cnt = sinIntervPorNivel[n] || 0;
    if (cnt > 0) {
      alertasInst.push({
        sev: 2, clr: 'var(--ambar)',
        titulo: `${NIVEL_CONFIG[n].label} — ${cnt} situaci${cnt > 1 ? 'ones' : 'ón'} sin seguimiento reciente`,
        subtexto: 'Sin intervención en los últimos 7 días',
        goPage: 'prob',
      });
    }
  });

  // Alerta 4 — alumno que requiere atención institucional (≥2 de 3 condiciones)
  const alumnosConProbSet   = new Set(probs.map(p => p.alumno_id).filter(Boolean));
  const alertaAsistAlumnoSet = new Set(alertasAsist.map(a => a.alumno_id));
  const nMap = {};
  califs.forEach(c => {
    if (!c.alumno_id || !c.nota) return;
    if (!nMap[c.alumno_id]) nMap[c.alumno_id] = [];
    nMap[c.alumno_id].push(c.nota);
  });
  let candidato = null, candidatoConds = 0, candidatoDetalle = [];
  alumnosData.forEach(al => {
    const notaMin = configPorNivel[al.cursos?.nivel]?.nota_minima;
    const notas   = nMap[al.id];
    let conds = 0, detalle = [];
    if (alumnosConProbSet.has(al.id))    { conds++; detalle.push('problemática activa'); }
    if (alertaAsistAlumnoSet.has(al.id)) { conds++; detalle.push('inasistencias sobre el umbral'); }
    if (notas?.length && notaMin) {
      const avg = notas.reduce((a, b) => a + b, 0) / notas.length;
      if (avg < notaMin) { conds++; detalle.push('promedio por debajo de la nota mínima'); }
    }
    if (conds >= 2 && conds > candidatoConds) {
      candidato = al; candidatoConds = conds; candidatoDetalle = detalle;
    }
  });
  if (candidato) {
    const cu = candidato.cursos;
    const nc = NIVEL_CONFIG[cu?.nivel];
    alertasInst.push({
      sev: 3, clr: 'var(--rojo)',
      titulo: `Alumno requiere atención — ${candidato.apellido}, ${candidato.nombre} (${cu?.nombre || ''}${cu?.division || ''}, ${nc?.label || cu?.nivel || ''})`,
      subtexto: candidatoDetalle.join(' · '),
      goPage: 'leg',
    });
  }

  alertasInst.sort((a, b) => b.sev - a.sev);

  const { saludo, apellido } = _saludo(USUARIO_ACTUAL.nombre_completo);

  document.getElementById('page-dash').innerHTML = `
    <div class="pg-t">${saludo}, ${apellido} 👋</div>
    <div class="pg-s" style="margin-bottom:14px">${_fechaStr()} · ${INSTITUCION_ACTUAL?.nombre || ''}</div>

    <div id="dash-cumples"></div>

    ${asistCardHTML}

    <div class="niveles-grid" style="margin-bottom:14px">
      ${nivelCardsHTML}
    </div>

    ${renderAlertasInstitucionales(alertasInst.slice(0, 4))}

    ${renderProximasActividades(eventosSem, sem.hoy, null)}
    ${renderAlertasProb(alertas)}
    ${renderPendientesRespuesta(pendientes)}
    ${renderObjetivosDirectivo(objetivos)}

    <div class="dash-cols">
      <div class="dash-col-l">
        <div id="tareas-col"></div>
        <div style="margin-top:12px;padding-top:12px;border-top:.5px solid var(--brd)">
          <div style="display:flex;gap:10px">
            <div class="ns" style="flex:1"><div class="ns-v">${totalAlumnos}</div><div class="ns-l">Alumnos activos</div></div>
            <div class="ns" style="flex:1"><div class="ns-v">${totalDocentes}</div><div class="ns-l">Docentes</div></div>
            <div class="ns" style="flex:1"><div class="ns-v" style="color:${probs.length ? 'var(--rojo)' : 'var(--txt)'}">${probs.length}</div><div class="ns-l">Situaciones</div></div>
          </div>
        </div>
      </div>
      <div class="dash-col-r">
        ${renderAgendaSemana(eventosSem, sem, null)}
      </div>
    </div>
    <div id="alertas-acad-dash" style="margin-top:4px"></div>`;

  inyectarEstilosDash();
  _cargarAlertasAcadDash(instId);
}

// ── Helpers: Estado académico del nivel (directivo_nivel) ────────────────
function _cuatrimestreInfo(hoy, cierresData, anio) {
  const c1 = (cierresData || []).some(c => c.tipo === 'cuatrimestre_1');
  const c2 = (cierresData || []).some(c => c.tipo === 'cuatrimestre_2');
  const q1s = `${anio}-03-01`, q1e = `${anio}-07-10`;
  const q2s = `${anio}-07-21`, q2e = `${anio}-11-28`;
  let cuatri, inicio, fin, cerrado;
  if (hoy < q2s && !c1) { cuatri = 1; inicio = q1s; fin = q1e; cerrado = false; }
  else if (c1 && !c2)    { cuatri = 2; inicio = q2s; fin = q2e; cerrado = false; }
  else if (c2)           { cuatri = 2; inicio = q2s; fin = q2e; cerrado = true;  }
  else                   { cuatri = 2; inicio = q2s; fin = q2e; cerrado = false; }
  const dHoy = new Date(hoy + 'T12:00:00');
  const dIni = new Date(inicio + 'T12:00:00');
  const dFin = new Date(fin + 'T12:00:00');
  const total = Math.max(1, (dFin - dIni) / 86400000);
  const elapsed = Math.min(total, Math.max(0, (dHoy - dIni) / 86400000));
  return {
    cuatri, cerrado, c1, c2,
    pct: Math.round(elapsed / total * 100),
    restantes: Math.max(0, Math.round((dFin - dHoy) / 86400000)),
  };
}

function _asistenciaMensual(asistData, anio) {
  const MESES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const meses = {};
  (asistData || []).forEach(r => {
    const [y, m] = r.fecha.split('-');
    if (parseInt(y) !== anio) return;
    const key = `${y}-${m}`;
    if (!meses[key]) meses[key] = { total: 0, inasist: 0, mes: parseInt(m) };
    meses[key].total++;
    if (r.estado === 'ausente' || r.estado === 'justificado') meses[key].inasist++;
  });
  return Object.entries(meses)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, d]) => ({ key, label: MESES[d.mes], pct: d.total > 0 ? Math.round(d.inasist / d.total * 100) : 0 }));
}

function _califEstadoNivel(califs, instancias, asignaciones, cursosNivel) {
  const instMap = {};
  (instancias || []).filter(i => !i.es_recuperatorio).forEach(i => {
    instMap[i.id] = { curso_id: i.curso_id, materia_id: i.materia_id, nombre: i.materias?.nombre || '—' };
  });
  const cursoNomMap = {};
  (cursosNivel || []).forEach(c => { cursoNomMap[c.id] = `${c.nombre}${c.division || ''}`; });
  const porMat = {}, porCurso = {};
  (califs || []).forEach(c => {
    if (!c.nota || c.ausente) return;
    const inst = instMap[c.instancia_id];
    if (!inst) return;
    if (!porMat[inst.materia_id]) porMat[inst.materia_id] = { nombre: inst.nombre, notas: [] };
    porMat[inst.materia_id].notas.push(c.nota);
    if (!porCurso[inst.curso_id]) porCurso[inst.curso_id] = { nombre: cursoNomMap[inst.curso_id] || '—', notas: [] };
    porCurso[inst.curso_id].notas.push(c.nota);
  });
  const avg = n => n.length ? +(n.reduce((a, b) => a + b, 0) / n.length).toFixed(1) : null;
  const materiasArr = Object.entries(porMat)
    .map(([id, d]) => ({ id, nombre: d.nombre, promedio: avg(d.notas) }))
    .filter(m => m.promedio !== null).sort((a, b) => a.promedio - b.promedio);
  const cursosArr = Object.entries(porCurso)
    .map(([id, d]) => ({ id, nombre: d.nombre, promedio: avg(d.notas) }))
    .filter(c => c.promedio !== null).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  const totalCombos = new Set((asignaciones || []).map(a => `${a.materia_id}_${a.curso_id}`)).size;
  const conNotas = new Set(
    (califs || []).filter(c => c.nota && !c.ausente).map(c => {
      const inst = instMap[c.instancia_id];
      return inst ? `${inst.materia_id}_${inst.curso_id}` : null;
    }).filter(Boolean)
  ).size;
  return { materiasArr, peorMateria: materiasArr[0] || null, mejorMateria: materiasArr[materiasArr.length - 1] || null, cursosArr, totalCombos, conNotas };
}

function renderEstadoAcademicoNivel(nivel, cuatriInfo, califStats, mesesAsist, notaMinima) {
  // Columna izquierda: promedio por curso + materias destacadas
  let colIzq = '';
  if (nivel !== 'inicial' && califStats && (califStats.cursosArr.length || califStats.peorMateria)) {
    const { peorMateria, mejorMateria, cursosArr } = califStats;
    const cursosOrd    = [...cursosArr].sort((a, b) => a.promedio - b.promedio);
    const idPeorCurso  = cursosOrd[0]?.id;
    const idMejorCurso = cursosOrd[cursosOrd.length - 1]?.id;

    colIzq = `
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Promedio por curso</div>
        ${cursosArr.length ? cursosArr.map(c => {
          const enRiesgo = notaMinima && c.promedio < notaMinima;
          const cerca    = notaMinima && c.promedio >= notaMinima && c.promedio < notaMinima + 1;
          const cClr     = enRiesgo ? 'var(--rojo)' : cerca ? 'var(--ambar)' : 'var(--verde)';
          const esMejor  = c.id === idMejorCurso && !enRiesgo;
          const esPeor   = c.id === idPeorCurso  && enRiesgo;
          const barW     = notaMinima ? Math.min(100, Math.round(c.promedio / 10 * 100)) : 100;
          return `
            <div style="padding:7px 0;border-bottom:1px solid var(--brd)">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                <span style="font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.nombre}</span>
                ${esMejor ? `<span style="font-size:8px;background:var(--verde-l);color:var(--verde-m);border-radius:4px;padding:1px 5px;font-weight:700">Mejor</span>` : ''}
                ${esPeor  ? `<span style="font-size:8px;background:var(--rojo-l);color:var(--rojo);border-radius:4px;padding:1px 5px;font-weight:700">Atención</span>` : ''}
                <span style="font-size:13px;font-weight:700;color:${cClr};flex-shrink:0">${c.promedio}</span>
              </div>
              <div style="background:var(--gris-l);border-radius:2px;height:3px">
                <div style="width:${barW}%;background:${cClr};height:3px;border-radius:2px"></div>
              </div>
            </div>`;
        }).join('') : `<div style="font-size:11px;color:var(--txt3);padding:8px 0">Sin datos de notas</div>`}
        ${(peorMateria || mejorMateria) ? `
        <div style="margin-top:12px;display:flex;gap:8px">
          ${peorMateria ? `
          <div style="flex:1;background:var(--rojo-l);border-radius:var(--rad);padding:8px;cursor:pointer" onclick="goPage('notas')">
            <div style="font-size:8px;color:var(--txt2);text-transform:uppercase;letter-spacing:.04em">Materia más baja</div>
            <div style="font-size:11px;font-weight:700;color:var(--rojo);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${peorMateria.nombre}</div>
            <div style="font-size:14px;font-weight:800;color:var(--rojo)">${peorMateria.promedio}</div>
          </div>` : ''}
          ${mejorMateria && mejorMateria.id !== peorMateria?.id ? `
          <div style="flex:1;background:var(--verde-l);border-radius:var(--rad);padding:8px;cursor:pointer" onclick="goPage('notas')">
            <div style="font-size:8px;color:var(--txt2);text-transform:uppercase;letter-spacing:.04em">Materia más alta</div>
            <div style="font-size:11px;font-weight:700;color:var(--verde-m);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${mejorMateria.nombre}</div>
            <div style="font-size:14px;font-weight:800;color:var(--verde)">${mejorMateria.promedio}</div>
          </div>` : ''}
        </div>` : ''}
      </div>`;
  } else {
    colIzq = `<div style="padding:20px 0;text-align:center;color:var(--txt3);font-size:11px">${nivel === 'inicial' ? 'Nivel inicial — evaluación narrativa' : 'Sin datos de calificaciones'}</div>`;
  }

  // Columna derecha: inasistencias por mes
  let colDer = '';
  if (mesesAsist.length > 0) {
    const maxPct  = Math.max(...mesesAsist.map(m => m.pct), 1);
    const peorMes = mesesAsist.reduce((a, b) => b.pct > a.pct ? b : a, mesesAsist[0]);
    colDer = `
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Inasistencias por mes</div>
        <div style="display:flex;align-items:flex-end;gap:5px;height:80px;margin-bottom:6px">
          ${mesesAsist.map(m => {
            const h      = Math.max(4, Math.round(m.pct / maxPct * 64));
            const esPeor = m.key === peorMes.key && m.pct > 0;
            const barClr = esPeor ? 'var(--rojo)' : m.pct > 12 ? 'var(--ambar)' : 'var(--azul)';
            return `
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0">
                <div style="font-size:7px;color:${barClr};font-weight:${esPeor?'700':'400'}">${m.pct}%</div>
                <div style="width:100%;height:${h}px;background:${barClr};border-radius:2px 2px 0 0;opacity:${esPeor?1:0.7}"></div>
                <div style="font-size:8px;color:${esPeor?barClr:'var(--txt3)'};font-weight:${esPeor?'700':'400'}">${m.label}</div>
              </div>`;
          }).join('')}
        </div>
        ${peorMes.pct > 0 ? `<div style="font-size:10px;color:var(--txt2);padding:7px 0;border-top:1px solid var(--brd)">Peor mes: <span style="color:var(--rojo);font-weight:600">${peorMes.label} · ${peorMes.pct}%</span></div>` : ''}
        <div style="text-align:right;margin-top:4px"><button class="btn-ghost" onclick="goPage('asist')" style="font-size:10px">Ver asistencia →</button></div>
      </div>`;
  }

  if (!colIzq && !colDer) return '';
  return `
    <div class="sec-lb" style="margin-top:20px;margin-bottom:12px">Estado académico del nivel</div>
    <div class="card" style="padding:14px;margin-bottom:14px">
      <div class="dash-acad-cols">
        <div style="padding-right:14px;border-right:1px solid var(--brd)">${colIzq}</div>
        <div style="padding-left:14px">${colDer || '<div style="padding:20px 0;text-align:center;color:var(--txt3);font-size:11px">Sin datos de asistencia</div>'}</div>
      </div>
    </div>`;
}

function renderAlertasCruzadasNivel(alertas) {
  if (!alertas.length) return '';
  return `
    <div style="margin-bottom:14px">
      <div style="font-size:10px;font-weight:700;color:var(--rojo);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">△ Alertas — requieren atención</div>
      ${alertas.map(a => `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:${a.bg};border-left:3px solid ${a.clr};border-radius:var(--rad);margin-bottom:7px;cursor:pointer" onclick="goPage('${a.goPage}')">
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;color:${a.clr}">${a.titulo}</div>
            ${a.subtexto ? `<div style="font-size:11px;color:var(--txt2);margin-top:2px">${a.subtexto}</div>` : ''}
            ${a.items?.length ? `<div style="margin-top:5px">${a.items.map(item => `<div style="font-size:10px;color:var(--txt2);line-height:1.7">· ${item}</div>`).join('')}</div>` : ''}
          </div>
          <div style="font-size:12px;color:${a.clr};flex-shrink:0;padding-top:2px">→</div>
        </div>`).join('')}
    </div>`;
}

function renderObjetivosDirectivo(objetivos) {
  if (typeof puedeVer === 'function' && !puedeVer('obj')) return '';
  const lista = (objetivos || []).filter(o => o.estado !== 'archivado' && o.estado !== 'logrado');
  if (!lista.length) return '';
  const empeorando = lista.filter(o => o.tendencia === 'empeorando');
  const ESTADO_LBL = {
    en_seguimiento: { l:'Seguimiento', c:'var(--azul)',  b:'var(--azul-l)'  },
    en_riesgo:      { l:'En riesgo',   c:'var(--rojo)',  b:'var(--rojo-l)'  },
    activo:         { l:'Activo',      c:'var(--verde)', b:'var(--verde-l)' },
    nuevo:          { l:'Nuevo',       c:'var(--txt2)',  b:'var(--gris-l)'  },
  };
  const dotClr = o => o.tendencia === 'mejorando' ? 'var(--verde)' : o.tendencia === 'empeorando' ? 'var(--rojo)' : 'var(--txt3)';
  const ei     = o => ESTADO_LBL[o.estado] || { l: o.estado || '—', c:'var(--txt2)', b:'var(--gris-l)' };
  return `
    ${empeorando.length ? `
    <div class="alr" style="margin-bottom:14px">
      <div class="alr-t">↓ ${empeorando.length} objetivo${empeorando.length>1?'s':''} empeorando${empeorando.length>1?'n':''}</div>
      <div style="font-size:11px;color:var(--txt2);margin-top:4px">${empeorando.slice(0,2).map(o=>o.nombre).join(', ')}${empeorando.length>2?' y más...':''}</div>
      <div class="acc" style="margin-top:8px"><button class="btn-d" onclick="goPage('obj')">Ver objetivos →</button></div>
    </div>` : ''}
    <div class="card" style="padding:14px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span class="sec-lb" style="margin:0">◎ Objetivos institucionales</span>
        <button class="btn-ghost" style="font-size:10px" onclick="goPage('obj')">Ver todos →</button>
      </div>
      <div style="display:flex;flex-direction:column">
        ${lista.slice(0, 6).map(o => {
          const e = ei(o);
          return `
            <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--brd);cursor:pointer" onclick="goPage('obj')">
              <span style="color:${dotClr(o)};flex-shrink:0;font-size:14px;line-height:1">●</span>
              <span style="flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.nombre}</span>
              <span style="font-size:9px;background:${e.b};color:${e.c};border-radius:4px;padding:2px 7px;font-weight:600;flex-shrink:0;white-space:nowrap">${e.l}</span>
            </div>`;
        }).join('')}
        ${lista.length > 6 ? `<div style="font-size:10px;color:var(--txt2);padding-top:6px">+ ${lista.length-6} más →</div>` : ''}
      </div>
    </div>`;
}

// ─── DIRECTIVO DE NIVEL ───────────────────────────────
async function rDashDirectivo() {
  showLoading('dash');
  const instId = USUARIO_ACTUAL.institucion_id;
  const miId   = USUARIO_ACTUAL.id;
  const nivel  = USUARIO_ACTUAL.nivel || 'secundario';
  const sem    = _semanaActual();
  const hoy    = sem.hoy;
  const anio   = INSTITUCION_ACTUAL?.anio_lectivo || new Date().getFullYear();

  const { data: _cursosNivel } = await sb.from('cursos')
    .select('id, nombre, division').eq('institucion_id', instId).eq('nivel', nivel);
  const cursoIdsNivel = (_cursosNivel || []).map(c => c.id);
  const cursosNivel   = _cursosNivel || [];

  // Fecha de corte para intervenciones recientes (7 días)
  const dHace7 = new Date(hoy + 'T00:00:00');
  dHace7.setDate(dHace7.getDate() - 7);
  const hace7ISO = dHace7.toISOString().slice(0, 10);

  const [
    probRes, objRes, eventosRes, respRes, alertasRes,
    alumnosRes, suplenciasRes, asistHoyRes,
    cierresRes, asistAnioRes, instanciasRes, asignNivelRes, configCalifRes,
    docentesActivosRes,
  ] = await Promise.all([
    // 1. Problematicas activas
    sb.from('problematicas')
      .select('id,urgencia,estado,alumno_id,alumno:alumnos(curso:cursos(nivel))')
      .eq('institucion_id', instId)
      .in('estado', ['abierta','en_seguimiento']),
    // 2. Objetivos
    sb.from('objetivos')
      .select('id,nombre,estado,tendencia')
      .eq('institucion_id', instId)
      .not('estado', 'in', '("archivado","logrado")'),
    // 3. Eventos semana
    sb.from('eventos_institucionales')
      .select('id,nombre,hora,lugar,nivel,fecha_inicio,fecha_fin,convocados_ids,creado_por')
      .eq('institucion_id', instId)
      .lte('fecha_inicio', sem.fin)
      .or(`fecha_fin.gte.${sem.inicio},fecha_inicio.gte.${sem.inicio}`)
      .order('fecha_inicio').order('hora', { nullsFirst: true }),
    // 4. Respuestas pendientes
    sb.from('evento_respuestas')
      .select('id,eventos_institucionales(nombre,hora,lugar)')
      .eq('usuario_id', miId).eq('respuesta', 'pendiente'),
    // 5. Alertas prob sin leer
    sb.from('alertas_problematicas')
      .select('id,problematica:problematicas(id,tipo,urgencia,alumno:alumnos(nombre,apellido))')
      .eq('usuario_id', miId).eq('leida', false)
      .order('created_at', { ascending:false }).limit(10),
    // 6. Alumnos del nivel (full select — necesario para alertas cruzadas)
    cursoIdsNivel.length
      ? sb.from('alumnos').select('id, nombre, apellido, curso_id')
          .in('curso_id', cursoIdsNivel).or('activo.is.null,activo.eq.true')
      : Promise.resolve({ data: [] }),
    // 7. Suplencias (en licencia) filtradas por nivel
    sb.from('usuarios').select('id', { count:'exact', head:true })
      .eq('institucion_id', instId).eq('nivel', nivel).eq('en_licencia', true),
    // 8. Asistencia hoy
    cursoIdsNivel.length
      ? sb.from('asistencia').select('estado,curso_id').in('curso_id', cursoIdsNivel).eq('fecha', hoy).is('hora_clase', null)
      : Promise.resolve({ data: [] }),
    // 9. Cierres de periodo
    sb.from('cierres_periodo').select('tipo').eq('institucion_id', instId).in('tipo', ['cuatrimestre_1','cuatrimestre_2']),
    // 10. Asistencia anual (con alumno_id para alertas cruzadas)
    cursoIdsNivel.length
      ? sb.from('asistencia').select('fecha,estado,alumno_id').in('curso_id', cursoIdsNivel).is('hora_clase', null).gte('fecha', `${anio}-01-01`).lte('fecha', hoy)
      : Promise.resolve({ data: [] }),
    // 11. Instancias evaluativas
    cursoIdsNivel.length
      ? sb.from('instancias_evaluativas').select('id,curso_id,materia_id,es_recuperatorio,materias(nombre)').in('curso_id', cursoIdsNivel)
      : Promise.resolve({ data: [] }),
    // 12. Asignaciones del nivel
    cursoIdsNivel.length
      ? sb.from('asignaciones').select('materia_id,curso_id').in('curso_id', cursoIdsNivel).eq('anio_lectivo', anio)
      : Promise.resolve({ data: [] }),
    // 13. Config calificaciones (umbral de alerta + activación del nivel)
    sb.from('config_asistencia').select('nota_minima, umbral_alerta_1, umbral_alerta_2, fecha_activacion')
      .eq('institucion_id', instId).eq('nivel', nivel).maybeSingle(),
    // 14. Docentes activos del nivel (por rol)
    sb.from('usuarios').select('id', { count:'exact', head:true })
      .eq('institucion_id', instId).eq('nivel', nivel).in('rol', ['docente','preceptor']),
  ]);

  // ── Datos base ──
  const probs              = probRes.data    || [];
  const objetivos          = objRes.data     || [];
  const eventosSem         = eventosRes.data || [];
  const pendientes         = (respRes.data   || []).filter(r => r.eventos_institucionales);
  const alertasProb        = alertasRes.error ? [] : (alertasRes.data || []);
  const alumnosData        = alumnosRes.data  || [];
  const totalAlumnos       = alumnosData.length;
  const totalSuplencias    = suplenciasRes.count    ?? 0;
  const totalDocentesActivos = docentesActivosRes.count ?? 0;
  const probsNivel         = probs.filter(p => p.alumno?.curso?.nivel === nivel);
  checkAlertasProb(instId).catch(() => {});

  // ── Asistencia hoy ──
  const asistHoyDir = asistHoyRes.data || [];
  const asistCnt    = { presente:0, ausente:0, media_falta:0, tardanza:0, justificado:0 };
  asistHoyDir.forEach(a => { if (asistCnt[a.estado] !== undefined) asistCnt[a.estado]++; });
  const pctAsistDir = totalAlumnos > 0
    ? Math.min(100, Math.round((asistCnt.presente + asistCnt.tardanza + asistCnt.media_falta) / totalAlumnos * 100))
    : 0;
  const asistClrDir     = pctAsistDir >= 85 ? 'var(--verde)' : pctAsistDir >= 70 ? 'var(--ambar)' : 'var(--rojo)';
  const cursosConLista  = new Set(asistHoyDir.map(a => a.curso_id).filter(Boolean)).size;
  const listasPend      = esFechaHabil(hoy) ? Math.max(0, cursoIdsNivel.length - cursosConLista) : 0;
  const esDiaHabil      = esFechaHabil(hoy);

  // ── Estado académico: califs + intervenciones recientes en paralelo ──
  const cierres    = cierresRes.data    || [];
  // Contar inasistencias del nivel solo desde su activación (o el 1-ene del ciclo
  // si no se activó). La query trae desde el 1-ene; acá se recorta a la activación.
  const _asistDesdeNivel = configCalifRes?.data?.fecha_activacion
    ? String(configCalifRes.data.fecha_activacion).slice(0, 10)
    : `${anio}-01-01`;
  const asistAnio  = (asistAnioRes.data || []).filter(a => a.fecha >= _asistDesdeNivel);
  const instancias = instanciasRes.data || [];
  const asignNivel = asignNivelRes.data || [];
  const notaMinima = configCalifRes?.data?.nota_minima    ?? null;
  const umbral1    = configCalifRes?.data?.umbral_alerta_1 ?? null;
  const umbral2    = configCalifRes?.data?.umbral_alerta_2 ?? null;

  const instanciaIds  = instancias.filter(i => !i.es_recuperatorio).map(i => i.id);
  const probsNivelIds = probsNivel.map(p => p.id);

  const [califRes, interv7dRes] = await Promise.all([
    instanciaIds.length && nivel !== 'inicial'
      ? sb.from('calificaciones').select('nota, instancia_id, ausente, alumno_id')
          .in('instancia_id', instanciaIds).not('nota', 'is', null)
      : Promise.resolve({ data: [] }),
    probsNivelIds.length
      ? sb.from('intervenciones').select('problematica_id')
          .in('problematica_id', probsNivelIds).gte('created_at', hace7ISO + 'T00:00:00')
      : Promise.resolve({ data: [] }),
  ]);

  const califs = (califRes.data || []).filter(c => !c.ausente);

  // Probs sin intervención en los últimos 7 días
  const probsConInterv = new Set((interv7dRes.data || []).map(i => i.problematica_id));
  const sinInterv      = probsNivel.filter(p => !probsConInterv.has(p.id)).length;

  // ── Cálculos generales ──
  const cuatriInfo = _cuatrimestreInfo(hoy, cierres, anio);
  const mesesAsist = _asistenciaMensual(asistAnio, anio);
  const califStats = nivel !== 'inicial' ? _califEstadoNivel(califs, instancias, asignNivel, cursosNivel) : null;

  const conNotas    = califStats?.conNotas    ?? 0;
  const totalCombos = califStats?.totalCombos ?? 0;
  const cobPct      = totalCombos > 0 ? Math.round(conNotas / totalCombos * 100) : 0;
  const cobClr      = cobPct >= 80 ? 'var(--verde)' : cobPct >= 50 ? 'var(--ambar)' : 'var(--rojo)';

  // ── Alertas cruzadas ──
  const alertasCruzadas = [];

  if (nivel !== 'inicial') {
    // Per-alumno asistencia
    const aMap = {};
    asistAnio.forEach(r => {
      if (!r.alumno_id) return;
      if (!aMap[r.alumno_id]) aMap[r.alumno_id] = { total:0, inasist:0 };
      aMap[r.alumno_id].total++;
      if (r.estado === 'ausente' || r.estado === 'justificado') aMap[r.alumno_id].inasist++;
    });
    // Per-alumno calificaciones
    const nMap = {};
    califs.forEach(c => {
      if (!c.alumno_id || !c.nota) return;
      if (!nMap[c.alumno_id]) nMap[c.alumno_id] = [];
      nMap[c.alumno_id].push(c.nota);
    });
    const alumnosConProbSet = new Set(probsNivel.filter(p => p.alumno_id).map(p => p.alumno_id));
    const alumnosEnRiesgo   = alumnosData.filter(al => {
      let conds = 0;
      if (alumnosConProbSet.has(al.id)) conds++;
      const ns = nMap[al.id];
      if (ns?.length && notaMinima) {
        const avg = ns.reduce((a, b) => a + b, 0) / ns.length;
        if (avg < notaMinima) conds++;
      }
      const as = aMap[al.id];
      if (as?.total && umbral1) {
        if ((as.inasist / as.total * 100) > umbral1) conds++;
      }
      return conds >= 2;
    });
    if (alumnosEnRiesgo.length) {
      const alumnosItems = alumnosEnRiesgo.slice(0, 8).map(al => {
        const c = cursosNivel.find(c => c.id === al.curso_id);
        const cn = c ? `${c.nombre}${c.division||''}` : '';
        return `${al.apellido}, ${al.nombre}${cn?' · '+cn:''}`;
      });
      if (alumnosEnRiesgo.length > 8) alumnosItems.push(`…y ${alumnosEnRiesgo.length - 8} más`);
      alertasCruzadas.push({
        clr:'var(--rojo)', bg:'var(--rojo-l)',
        titulo: `${alumnosEnRiesgo.length} alumno${alumnosEnRiesgo.length>1?'s':''} con múltiples indicadores de riesgo`,
        subtexto: null,
        items: alumnosItems,
        goPage: 'leg',
      });
    }

    // Cursos con promedio comprometido (cierre próximo)
    if (califStats?.cursosArr?.length && cuatriInfo.restantes <= 15 && notaMinima) {
      const cursosRiesgo = califStats.cursosArr.filter(c => c.promedio < notaMinima);
      if (cursosRiesgo.length) {
        alertasCruzadas.push({
          clr:'var(--ambar)', bg:'var(--amb-l)',
          titulo: `${cursosRiesgo.length} curso${cursosRiesgo.length>1?'s':''} con promedio bajo al cierre`,
          subtexto: cursosRiesgo.slice(0,2).map(c=>`${c.nombre} (${c.promedio})`).join(', ')
            + (cursosRiesgo.length>2?` y ${cursosRiesgo.length-2} más`:'')
            + ` · cierre en ${cuatriInfo.restantes} días`,
          goPage: 'notas',
        });
      }
    }

    // Cobertura de notas crítica
    if (cobPct < 30 && cuatriInfo.restantes <= 15 && totalCombos > 0) {
      alertasCruzadas.push({
        clr:'var(--rojo)', bg:'var(--rojo-l)',
        titulo: 'Cobertura de notas crítica',
        subtexto: `Solo el ${cobPct}% de materias tiene notas cargadas · cierre en ${cuatriInfo.restantes} días`,
        goPage: 'notas',
      });
    }
  }

  // Mes pico de inasistencias (últimos 2 meses)
  if (umbral2 && mesesAsist.length) {
    const mesHoy = parseInt(hoy.split('-')[1]);
    const pico = mesesAsist.find(m => {
      const mNum = parseInt(m.key.split('-')[1]);
      const diff = mesHoy >= mNum ? mesHoy - mNum : 12 - mNum + mesHoy;
      return diff <= 2 && m.pct > umbral2;
    });
    if (pico) {
      alertasCruzadas.push({
        clr:'var(--ambar)', bg:'var(--amb-l)',
        titulo: `Pico de inasistencias en ${pico.label}`,
        subtexto: `${pico.pct}% — por encima del umbral configurado (${umbral2}%)`,
        goPage: 'asist',
      });
    }
  }

  // Compartir probs activos para que tareas.js pueda detectar tareas vinculadas
  window._dashProbsActivosNivel = new Set(probsNivelIds);

  const nc = NIVEL_CONFIG[nivel] || NIVEL_CONFIG.todos;
  const { saludo, apellido } = _saludo(USUARIO_ACTUAL.nombre_completo);

  // ── 4 metric cards ──
  const card1 = `
    <div class="mc" style="cursor:pointer;border-top:3px solid ${esDiaHabil ? asistClrDir : 'var(--gris)'}" onclick="goPage('asist')">
      <div class="mc-v" style="color:${esDiaHabil ? asistClrDir : 'var(--txt3)'}">${esDiaHabil ? pctAsistDir + '%' : '—'}</div>
      <div class="mc-l">ASISTENCIA HOY</div>
      ${esDiaHabil
        ? `<div style="font-size:9px;color:var(--txt2);margin-top:4px;line-height:1.6">${asistCnt.presente} pres · ${asistCnt.ausente} aus${asistCnt.tardanza+asistCnt.media_falta?' · '+(asistCnt.tardanza+asistCnt.media_falta)+' tard':''}</div>`
        : `<div style="font-size:9px;color:var(--txt3);margin-top:4px">Día no lectivo</div>`}
      ${esDiaHabil
        ? listasPend === 0
          ? `<div style="font-size:9px;color:var(--verde-m);margin-top:2px;font-weight:600">✓ listas al día</div>`
          : `<div style="font-size:9px;color:var(--ambar);margin-top:2px">Faltan ${listasPend} de ${cursoIdsNivel.length} listas</div>`
        : ''}
      <div style="font-size:9px;color:var(--verde);margin-top:5px;font-weight:600">Ver →</div>
    </div>`;

  const card2 = nivel === 'inicial' ? `
    <div class="mc" style="cursor:pointer" onclick="goPage('informes')">
      <div class="mc-v" style="color:var(--azul)">${totalAlumnos}</div>
      <div class="mc-l">ALUMNOS</div>
      <div style="font-size:9px;color:var(--txt2);margin-top:4px">Nivel inicial</div>
      <div style="font-size:9px;color:var(--verde);margin-top:5px;font-weight:600">Ver →</div>
    </div>` : `
    <div class="mc" style="cursor:pointer;border-top:3px solid ${cobClr}" onclick="goPage('notas')">
      <div class="mc-v" style="color:${cobClr};font-size:${totalCombos>=10?'22px':'28px'}">${conNotas}/${totalCombos}</div>
      <div class="mc-l">COBERTURA DE NOTAS</div>
      <div style="font-size:9px;color:var(--txt3);margin-top:2px">mat-cursos con ≥1 nota · C${cuatriInfo.cuatri}</div>
      <div style="font-size:9px;color:${cuatriInfo.restantes<=14?'var(--rojo)':'var(--txt2)'};margin-top:2px">${cuatriInfo.cerrado?'Cuatrimestre cerrado ✓':cuatriInfo.restantes+' días para el cierre'}</div>
      <div style="font-size:9px;color:var(--verde);margin-top:5px;font-weight:600">Ver →</div>
    </div>`;

  const card3 = `
    <div class="mc" style="cursor:pointer" onclick="_adminTab='docentes';goPage('admin')">
      <div class="mc-v">${totalDocentesActivos}</div>
      <div class="mc-l">DOCENTES</div>
      <div style="font-size:9px;color:${totalSuplencias>0?'var(--ambar)':'var(--txt2)'};margin-top:4px">${totalSuplencias} suplencia${totalSuplencias!==1?'s':''}</div>
      <div style="font-size:9px;color:var(--verde);margin-top:5px;font-weight:600">Ver →</div>
    </div>`;

  const card4 = `
    <div class="mc" style="cursor:pointer;border-top:3px solid ${probsNivel.length?'var(--rojo)':'var(--verde)'}" onclick="goPage('prob')">
      <div class="mc-v" style="color:${probsNivel.length?'var(--rojo)':'var(--txt)'}">${probsNivel.length}</div>
      <div class="mc-l">SITUACIONES</div>
      <div style="font-size:9px;color:${sinInterv>0?'var(--ambar)':'var(--txt2)'};margin-top:4px">${sinInterv} sin interv. reciente</div>
      <div style="font-size:9px;color:var(--verde);margin-top:5px;font-weight:600">Ver →</div>
    </div>`;

  document.getElementById('page-dash').innerHTML = `
    <div class="pg-t">${saludo}, ${apellido} 👋</div>
    <div class="pg-s" style="margin-bottom:16px">${_fechaStr()} · <span style="color:${nc.color};font-weight:600">${nc.label}</span></div>

    <div id="dash-aviso-cierre"></div>
    <div id="dash-cumples"></div>

    <div class="metrics m4" style="margin-bottom:16px">
      ${card1}${card2}${card3}${card4}
    </div>

    ${renderAlertasCruzadasNivel(alertasCruzadas.slice(0, 4))}
    ${renderProximasActividades(eventosSem, hoy, nivel)}
    ${renderAlertasProb(alertasProb)}
    ${renderPendientesRespuesta(pendientes)}

    ${renderEstadoAcademicoNivel(nivel, cuatriInfo, califStats, mesesAsist, notaMinima)}

    ${renderObjetivosDirectivo(objetivos)}

    <div class="dash-cols">
      <div class="dash-col-l" id="tareas-col"></div>
      <div class="dash-col-r">
        ${renderAgendaSemana(eventosSem, sem, nivel)}
      </div>
    </div>
    <div id="alertas-acad-dash" style="margin-top:4px"></div>`;

  inyectarEstilosDash();
  _cargarAlertasAcadDash(instId);
}

// ─── EOE ─────────────────────────────────────────────
async function rDashEOE() {
  showLoading('dash');
  const instId = USUARIO_ACTUAL.institucion_id;
  const miId   = USUARIO_ACTUAL.id;
  const sem    = _semanaActual();
  const hoy    = sem.hoy;

  const [casosRes, alertasAsistRes, eventosProxRes, actividadesRes, derivEOERes] = await Promise.all([
    sb.from('problematicas')
      .select('id,tipo,urgencia,estado,created_at,alumno_id,alumno:alumnos(id,nombre,apellido,curso:cursos(nombre,division,nivel))')
      .eq('institucion_id', instId)
      .in('estado', ['abierta','en_seguimiento'])
      .is('problematica_madre_id', null),
    sb.from('alertas_asistencia')
      .select('alumno_id,tipo_alerta,total_faltas,alumnos(nombre,apellido,cursos(nombre,division,nivel))')
      .eq('institucion_id', instId)
      .order('tipo_alerta', { ascending: false }),
    sb.from('eventos_institucionales')
      .select('id,nombre,hora,fecha_inicio,lugar,nivel,convocados_ids,convocatoria_grupos')
      .eq('institucion_id', instId)
      .gte('fecha_inicio', hoy)
      .order('fecha_inicio').order('hora', { nullsFirst: true })
      .limit(10),
    sb.from('reuniones')
      .select('*, prob:problematicas(descripcion), obj:objetivos(nombre)')
      .eq('institucion_id', instId)
      .not('tipo_actividad', 'is', null)
      .order('fecha', { ascending: false })
      .limit(50),
    sb.from('intervenciones')
      .select('id,descripcion,created_at,problematica_id,prob:problematicas(id,tipo,descripcion,modalidad,institucion_id,alumno:alumnos(nombre,apellido,curso:cursos(nombre,division,nivel)))')
      .eq('tipo', 'derivacion_eoe')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const casos       = casosRes.data        || [];
  const alertasAsist= alertasAsistRes.data || [];
  const actividades = actividadesRes.data  || [];
  const derivEOE    = (derivEOERes.data    || []).filter(d => d.prob?.institucion_id === instId);

  // Última intervención por caso
  const casosIds = casos.map(p => p.id);
  let lastIntervMap = {};
  if (casosIds.length) {
    const { data: lastInts } = await sb.from('intervenciones')
      .select('problematica_id,created_at')
      .in('problematica_id', casosIds)
      .order('created_at', { ascending: false });
    (lastInts || []).forEach(iv => {
      if (!lastIntervMap[iv.problematica_id]) lastIntervMap[iv.problematica_id] = iv.created_at;
    });
  }

  // Alumnos con problematica activa (para excluirlos de "en riesgo sin seguimiento")
  const alumnosConProb = new Set(casos.map(p => p.alumno_id).filter(Boolean));

  // Alumnos en riesgo sin problematica activa
  const enRiesgoSinProb = alertasAsist.filter(a => !alumnosConProb.has(a.alumno_id));

  // Próximas actividades del EOE
  const eventosEOE = (eventosProxRes.data || []).filter(e =>
    (e.convocados_ids || []).includes(miId) ||
    (e.convocatoria_grupos || []).includes('eoe')
  ).slice(0, 5);

  const { saludo, apellido } = _saludo(USUARIO_ACTUAL.nombre_completo);

  // ── Sección 1: Casos urgentes (alta) por nivel ──
  const casosOrdenados = [...casos].sort((a, b) => {
    const dA = lastIntervMap[a.id] ? new Date(lastIntervMap[a.id]) : new Date(a.created_at);
    const dB = lastIntervMap[b.id] ? new Date(lastIntervMap[b.id]) : new Date(b.created_at);
    return dA - dB;
  });

  const casosUrgentes = casosOrdenados.filter(p => p.urgencia === 'alta');
  const _NIVELES_ORD  = ['inicial', 'primario', 'secundario', 'terciario'];
  const porNivel      = {};
  casosUrgentes.forEach(p => {
    const nv = p.alumno?.curso?.nivel || 'otro';
    if (!porNivel[nv]) porNivel[nv] = [];
    porNivel[nv].push(p);
  });
  const nivelesConCasos = _NIVELES_ORD.filter(n => porNivel[n]);

  const casosHTML = casosUrgentes.length
    ? nivelesConCasos.map(nivel => {
        const nc = NIVEL_CONFIG[nivel] || { color: 'var(--rojo)', label: nivel };
        return `
          <div style="margin-bottom:10px">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:${nc.color};letter-spacing:.5px;margin-bottom:4px">${nc.label}</div>
            ${porNivel[nivel].map(p => {
              const al   = p.alumno;
              const cu   = al?.curso;
              const nom  = al ? `${al.apellido}, ${al.nombre}` : '—';
              const cur  = cu ? `${cu.nombre}${cu.division || ''}` : '—';
              const base = lastIntervMap[p.id] ? new Date(lastIntervMap[p.id]) : new Date(p.created_at);
              const dias = Math.floor((Date.now() - base.getTime()) / 86400000);
              const alerta = dias > 14;
              return `
                <div class="card" style="padding:8px 12px;margin-bottom:4px;border-left:3px solid ${alerta ? 'var(--rojo)' : 'var(--brd)'}">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                    <div style="flex:1;min-width:0">
                      <div style="font-size:11px;font-weight:600">${nom}</div>
                      <div style="font-size:10px;color:var(--txt2)">${cur}</div>
                    </div>
                    <button class="btn-ghost" style="font-size:10px;padding:2px 6px;flex-shrink:0" onclick="EX='pr-${p.id}';goPage('prob')">Ver →</button>
                  </div>
                  ${dias > 0 ? `<div style="font-size:10px;color:${alerta ? 'var(--rojo)' : dias > 7 ? 'var(--ambar)' : 'var(--txt3)'};margin-top:3px">${dias}d sin intervención</div>` : ''}
                </div>`;
            }).join('')}
          </div>`;
      }).join('')
    : '<div style="font-size:11px;color:var(--txt2);padding:8px 0">Sin casos urgentes activos.</div>';

  // ── Sección 2: En riesgo sin problematica ──
  const riesgoHTML = enRiesgoSinProb.length ? enRiesgoSinProb.slice(0, 6).map(a => {
    const al  = a.alumnos;
    const cu  = al?.cursos;
    const nom = al ? `${al.apellido}, ${al.nombre}` : '—';
    const cur = cu ? `${cu.nombre}${cu.division || ''} · ${cu.nivel}` : '—';
    const clr = a.tipo_alerta >= 3 ? 'var(--rojo)' : 'var(--ambar)';
    return `
      <div class="card" style="padding:10px 14px;margin-bottom:6px;display:flex;align-items:center;gap:10px;border-left:3px solid ${clr}">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600">${nom}</div>
          <div style="font-size:10px;color:var(--txt2)">${cur} · ${a.total_faltas} faltas</div>
        </div>
        <button class="btn-s" style="font-size:10px;padding:4px 8px;flex-shrink:0" onclick="goPage('prob')">+ Caso</button>
      </div>`;
  }).join('') + (enRiesgoSinProb.length > 6 ? `<div style="font-size:10px;color:var(--verde);margin-top:4px">+ ${enRiesgoSinProb.length - 6} más</div>` : '')
  : '<div style="font-size:11px;color:var(--verde);padding:10px 0">✅ Sin alumnos en riesgo sin seguimiento.</div>';

  // ── Sección 2b: Derivados internamente al EOE ──
  const derivEOEHTML = derivEOE.length
    ? derivEOE.slice(0, 5).map(d => {
        const al  = d.prob?.alumno;
        const probId = d.prob?.id || '';
        const nom = al
          ? `${al.apellido}, ${al.nombre}`
          : d.prob?.descripcion
            ? d.prob.descripcion.slice(0, 60) + (d.prob.descripcion.length > 60 ? '…' : '')
            : `Caso ${d.prob?.modalidad === 'grupal' ? 'grupal' : d.prob?.modalidad === 'curso' ? 'por curso' : ''} · ${labelTipo(d.prob?.tipo)}`;
        const cu  = al?.curso;
        const cur = cu ? `${cu.nombre}${cu.division || ''} · ${cu.nivel}` : (d.prob?.modalidad !== 'individual' ? 'Grupal / Curso' : '');
        const dias = Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000);
        return `
          <div class="card" style="padding:8px 12px;margin-bottom:4px;border-left:3px solid var(--azul);cursor:pointer"
               onclick="EX='pr-${probId}';goPage('prob')">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
              <div style="flex:1;min-width:0">
                <div style="font-size:11px;font-weight:600">${nom}</div>
                ${cur ? `<div style="font-size:10px;color:var(--txt2)">${cur}</div>` : ''}
              </div>
              <span style="color:var(--azul);font-size:14px;flex-shrink:0">›</span>
            </div>
            ${d.descripcion ? `<div style="font-size:10px;color:var(--txt2);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.descripcion}</div>` : ''}
            <div style="font-size:10px;color:var(--txt3);margin-top:2px">${dias === 0 ? 'Hoy' : `Hace ${dias}d`}</div>
          </div>`;
      }).join('')
      + (derivEOE.length > 5 ? `<div style="font-size:10px;color:var(--azul);margin-top:4px;cursor:pointer" onclick="goPage('prob')">+ ${derivEOE.length - 5} más →</div>` : '')
    : '<div style="font-size:11px;color:var(--verde);padding:8px 0">✅ Sin derivaciones pendientes de atención.</div>';

  // ── Sección 3: Próximas actividades (agenda institucional) ──
  const actHTML = eventosEOE.length ? eventosEOE.map(e => {
    const nc = NIVEL_CONFIG[e.nivel] || NIVEL_CONFIG.todos;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--brd);cursor:pointer" onclick="goPage('agenda')">
        <div style="width:3px;height:32px;background:${nc.color};border-radius:2px;flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.nombre}</div>
          <div style="font-size:10px;color:var(--txt2)">${formatFechaLatam(e.fecha_inicio)}${e.hora ? ' · ' + e.hora.slice(0,5) : ''}${e.lugar ? ' · ' + e.lugar : ''}</div>
        </div>
      </div>`;
  }).join('')
  : '<div style="font-size:11px;color:var(--txt2);padding:8px 0">Sin actividades próximas.</div>';

  // ── Actividades EOE: hoy y próximas ──
  const hoyActs  = actividades.filter(a => a.fecha === hoy).sort((a, b) => (a.hora||'').localeCompare(b.hora||''));
  const proxActs = actividades.filter(a => a.fecha > hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const pasadasCount = actividades.filter(a => a.fecha < hoy).length;

  const actHoyHTML = hoyActs.length
    ? hoyActs.map(a => _renderActCard(a, hoy)).join('')
    : '<div style="font-size:11px;color:var(--txt2);padding:6px 0">Sin actividades para hoy.</div>';

  const actProxHTML = proxActs.length
    ? proxActs.slice(0, 5).map(a => _renderActCard(a, hoy)).join('')
      + (proxActs.length > 5 ? `<div style="font-size:10px;color:var(--verde);margin-top:4px">+ ${proxActs.length - 5} más → <span style="cursor:pointer;text-decoration:underline" onclick="goPage('eoe')">Ver todas</span></div>` : '')
    : '<div style="font-size:11px;color:var(--txt2);padding:6px 0">Sin actividades próximas.</div>';

  document.getElementById('page-dash').innerHTML = `
    <div class="pg-t">${saludo}, ${apellido} 👋</div>
    <div class="pg-s" style="margin-bottom:14px">${_fechaStr()} · Orientación Escolar</div>

    <div id="dash-cumples"></div>

    <div class="metrics m3" style="margin-bottom:14px">
      <div class="mc" style="cursor:pointer" onclick="goPage('prob')">
        <div class="mc-v" style="color:var(--rojo)">${casosUrgentes.length}</div>
        <div class="mc-l">URGENTES</div>
      </div>
      <div class="mc" style="cursor:pointer" onclick="goPage('prob')">
        <div class="mc-v" style="color:var(--ambar)">${casos.length}</div>
        <div class="mc-l">ACTIVOS</div>
      </div>
      <div class="mc" style="cursor:pointer" onclick="document.getElementById('deriv-eoe-sec')?.scrollIntoView({behavior:'smooth'})">
        <div class="mc-v" style="color:var(--azul)">${derivEOE.length}</div>
        <div class="mc-l">DERIVACIONES</div>
      </div>
    </div>

    <div class="dash-cols">
      <div class="dash-col-l">

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div class="sec-lb" style="margin:0">Casos urgentes</div>
          <button class="btn-ghost" onclick="goPage('prob')" style="font-size:11px">Ver todos →</button>
        </div>
        ${casosHTML}

        <div id="deriv-eoe-sec" style="display:flex;justify-content:space-between;align-items:center;margin:14px 0 8px">
          <div class="sec-lb" style="margin:0">Derivaciones recibidas</div>
        </div>
        ${derivEOEHTML}

        <div style="display:flex;justify-content:space-between;align-items:center;margin:14px 0 8px">
          <div class="sec-lb" style="margin:0">En riesgo sin seguimiento</div>
        </div>
        ${riesgoHTML}

        <div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--brd)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div class="sec-lb" style="margin:0">Actividades · Hoy</div>
            <button class="btn-p" style="font-size:11px" onclick="_abrirFormActividad()">+ Nueva</button>
          </div>
          ${actHoyHTML}

          <div style="display:flex;justify-content:space-between;align-items:center;margin:12px 0 8px">
            <div class="sec-lb" style="margin:0">Próximas</div>
          </div>
          ${actProxHTML}

          ${pasadasCount > 0 ? `
          <div class="card" style="margin-top:10px;padding:10px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center" onclick="goPage('eoe')">
            <div>
              <div style="font-size:11px;font-weight:600">Actividades anteriores</div>
              <div style="font-size:10px;color:var(--txt2)">${pasadasCount} actividades realizadas</div>
            </div>
            <span style="font-size:16px;color:var(--txt3)">›</span>
          </div>` : ''}
        </div>

      </div>
      <div class="dash-col-r">
        <div class="card" style="padding:14px">
          <div class="sec-lb" style="margin:0 0 10px">Próximos eventos</div>
          ${actHTML}
          <div style="margin-top:8px">
            <button class="btn-ghost" onclick="goPage('agenda')" style="font-size:11px">Ver agenda →</button>
          </div>
        </div>
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
  const [asigsRes, eventosRes, respRes, noLectRes] = await Promise.all([
    sb.from('asignaciones')
      .select('curso_id,cursos(id,nombre,division,nivel)')
      .eq('docente_id', miId)
      .eq('anio_lectivo', INSTITUCION_ACTUAL?.anio_lectivo || new Date().getFullYear()),
    sb.from('eventos_institucionales')
      .select('id,nombre,hora,lugar,nivel,fecha_inicio,fecha_fin,convocados_ids,convocatoria_grupos,creado_por')
      .eq('institucion_id', instId)
      .lte('fecha_inicio', sem.fin)
      .or(`fecha_fin.gte.${sem.inicio},fecha_inicio.gte.${sem.inicio}`)
      .order('fecha_inicio').order('hora', { nullsFirst: true }),
    sb.from('evento_respuestas')
      .select('id,eventos_institucionales(nombre,hora,lugar)')
      .eq('usuario_id', miId).eq('respuesta', 'pendiente'),
    sb.from('dias_no_lectivos').select('fecha').eq('institucion_id', instId),
  ]);

  window._diasNoLectivos = new Set((noLectRes.data || []).map(r => r.fecha));

  const eventosSem = (eventosRes.data || []).filter(_eventoEsParaMi);
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
  const hoyHabil = esFechaHabil(sem.hoy);

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
        const listaHecha = cursosConLista.has(cur.id) || !hoyHabil;
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

  const listasPendCount = hoyHabil ? cursos.filter(c => !cursosConLista.has(c.id)).length : 0;
  const totalSituaciones = Object.values(probsByCurso).reduce((s, a) => s + a.length, 0);
  const listaColor = listasPendCount ? 'var(--rojo)' : 'var(--verde)';

  document.getElementById('page-dash').innerHTML = `
    <div class="pg-t">${saludo}, ${apellido} 👋</div>
    <div class="pg-s" style="margin-bottom:14px">${_fechaStr()}</div>

    <div id="dash-aviso-cierre"></div>
    <div id="dash-cumples"></div>

    <div class="metrics m3" style="margin-bottom:14px">
      <div class="mc" style="cursor:pointer" onclick="goPage('asist')"><div class="mc-v" style="color:${listaColor}">${listasPendCount}</div><div class="mc-l">LISTAS PENDIENTES</div><div style="font-size:9px;color:var(--verde);margin-top:6px;font-weight:600">Ir →</div></div>
      <div class="mc" style="cursor:pointer" onclick="goPage('prob')"><div class="mc-v" style="color:var(--ambar)">${totalSituaciones}</div><div class="mc-l">SITUACIONES</div><div style="font-size:9px;color:var(--verde);margin-top:6px;font-weight:600">Ir →</div></div>
      <div class="mc" style="cursor:pointer" onclick="goPage('asist')"><div class="mc-v">${cursos.length}</div><div class="mc-l">MIS CURSOS</div><div style="font-size:9px;color:var(--verde);margin-top:6px;font-weight:600">Ir →</div></div>
    </div>

    ${renderProximasActividades(eventosSem, sem.hoy, null)}
    ${renderPendientesRespuesta(pendientes)}

    <div class="dash-cols">
      <div class="dash-col-l" id="tareas-col"></div>
      <div class="dash-col-r">
        ${renderAgendaSemana(eventosSem, sem, null)}
      </div>
    </div>

    <div class="sec-lb" style="margin-top:14px">Mis cursos</div>
    ${cursosHTML}
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

  const [cursosRes, probRes, eventosRes, respRes, noLectRes] = await Promise.all([
    cursosQuery,
    sb.from('problematicas')
      .select('id,urgencia,alumno:alumnos(curso:cursos(nivel))')
      .eq('institucion_id', instId)
      .in('estado', ['abierta','en_seguimiento']),
    sb.from('eventos_institucionales')
      .select('id,nombre,hora,lugar,nivel,fecha_inicio,fecha_fin,convocados_ids,convocatoria_grupos,creado_por')
      .eq('institucion_id', instId)
      .lte('fecha_inicio', sem.fin)
      .or(`fecha_fin.gte.${sem.inicio},fecha_inicio.gte.${sem.inicio}`)
      .order('fecha_inicio').order('hora', { nullsFirst: true }),
    sb.from('evento_respuestas')
      .select('id,eventos_institucionales(nombre,hora,lugar)')
      .eq('usuario_id', miId).eq('respuesta', 'pendiente'),
    sb.from('dias_no_lectivos').select('fecha').eq('institucion_id', instId),
  ]);

  window._diasNoLectivos = new Set((noLectRes.data || []).map(r => r.fecha));

  const cursos     = cursosRes.data   || [];
  const probs      = probRes.data     || [];
  const eventosSem = (eventosRes.data || []).filter(_eventoEsParaMi);
  const pendResp   = (respRes.data    || []).filter(r => r.eventos_institucionales);
  const cursoIdsList = cursos.map(c => c.id);

  // Calcular hoy/ayer y si son días hábiles
  const ayerDate = new Date(sem.hoy + 'T12:00:00');
  ayerDate.setDate(ayerDate.getDate() - 1);
  const ayer = ayerDate.toISOString().split('T')[0];
  const hoyHabil  = esFechaHabil(sem.hoy);
  const ayerHabil = esFechaHabil(ayer);

  // Asistencia hoy + ayer + alertas + cierres pendientes (requiere cursos)
  let asistHoy = [], asistAyer = [], alertasAlumnos = [], totalAlumnos = 0, cierresPendCount = 0;
  if (cursoIdsList.length) {
    const queries = [
      sb.from('asistencia').select('curso_id,estado')
        .in('curso_id', cursoIdsList).eq('fecha', sem.hoy).is('hora_clase', null),
      sb.from('alumnos').select('id')
        .in('curso_id', cursoIdsList).eq('activo', true),
      sb.from('cierres_materia_cuatrimestre').select('id', { count: 'exact', head: true })
        .in('curso_id', cursoIdsList).not('cerrado_at', 'is', null).is('validado_at', null),
    ];
    if (ayerHabil) {
      queries.push(sb.from('asistencia').select('curso_id')
        .in('curso_id', cursoIdsList).eq('fecha', ayer).is('hora_clase', null));
    }
    const results = await Promise.all(queries);
    asistHoy = results[0].data || [];
    const alumnoIds = (results[1].data || []).map(a => a.id);
    totalAlumnos = alumnoIds.length;
    cierresPendCount = results[2].count ?? 0;
    if (ayerHabil) asistAyer = results[3]?.data || [];
    if (alumnoIds.length) {
      const { data: alertasData } = await sb.from('alertas_asistencia')
        .select('alumno_id,tipo_alerta,total_faltas,alumnos(nombre,apellido,cursos(nombre,division))')
        .in('alumno_id', alumnoIds)
        .order('tipo_alerta', { ascending: false })
        .limit(8);
      alertasAlumnos = alertasData || [];
    }
  }

  const cursosConListaHoy  = new Set((asistHoy  || []).map(a => a.curso_id));
  const cursosConListaAyer = new Set((asistAyer || []).map(a => a.curso_id));
  const pendientesHoy  = hoyHabil ? cursos.filter(c => !cursosConListaHoy.has(c.id)) : [];
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
        <div class="card" style="padding:10px 14px;margin-bottom:6px;border-left:3px solid ${color};display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="irAsistAlumno('${a.alumno_id}')">
          <div>
            <div style="font-size:12px;font-weight:600">${al?.apellido}, ${al?.nombre}</div>
            <div style="font-size:10px;color:var(--txt2)">${cu?.nombre}${cu?.division || ''} · ${a.total_faltas} inasistencias</div>
          </div>
          <span class="tag ${a.tipo_alerta >= 3 ? 'tr' : 'ta'}" style="font-size:9px">${a.tipo_alerta >= 3 ? '🔴 Crítico' : '⚠️ Aviso'}</span>
        </div>`;
    }).join('')}` : '';

  const probsNivel     = probs.filter(p => p.alumno?.curso?.nivel === nivel);
  const presentes      = asistHoy.filter(r => ['presente','tardanza','media_falta'].includes(r.estado)).length;
  const asistPct       = totalAlumnos ? Math.round(presentes / totalAlumnos * 100) : 0;
  const asistColor     = asistPct >= 85 ? 'var(--verde)' : asistPct >= 70 ? 'var(--ambar)' : 'var(--rojo)';
  const pendColor      = pendientesHoy.length ? 'var(--rojo)' : 'var(--verde)';
  const urgentesNivel  = probsNivel.filter(p => p.urgencia === 'alta').length;

  document.getElementById('page-dash').innerHTML = `
    <div class="pg-t">${saludo}, ${apellido} 👋</div>
    <div class="pg-s" style="margin-bottom:14px">${_fechaStr()} · <span style="color:${nc.color};font-weight:600">${nc.label}</span></div>

    <div id="dash-aviso-cierre"></div>
    <div id="dash-cumples"></div>

    <div class="metrics m4" style="margin-bottom:14px">
      <div class="mc" style="cursor:pointer" onclick="goPage('asist')"><div class="mc-v" style="color:${asistColor}">${asistPct}%</div><div class="mc-l">ASISTENCIA HOY</div><div style="font-size:9px;color:var(--verde);margin-top:6px;font-weight:600">Ir →</div></div>
      <div class="mc" style="cursor:pointer" onclick="goPage('asist')"><div class="mc-v" style="color:${pendColor}">${pendientesHoy.length}</div><div class="mc-l">LISTAS PENDIENTES</div><div style="font-size:9px;color:var(--verde);margin-top:6px;font-weight:600">Ir →</div></div>
      <div class="mc" style="cursor:pointer" onclick="goPage('prob')"><div class="mc-v" style="color:var(--rojo)">${urgentesNivel}</div><div class="mc-l">URGENTES</div><div style="font-size:9px;color:var(--verde);margin-top:6px;font-weight:600">Ir →</div></div>
      <div class="mc" style="cursor:pointer" onclick="goPage('notas')"><div class="mc-v" style="color:${cierresPendCount > 0 ? 'var(--ambar)' : 'var(--txt3)'}">${cierresPendCount}</div><div class="mc-l">PARA VALIDAR</div><div style="font-size:9px;color:var(--verde);margin-top:6px;font-weight:600">Ir →</div></div>
    </div>

    ${cierresPendCount > 0 ? `
    <div style="background:var(--amb-l);border-left:4px solid var(--ambar);border-radius:var(--rad);padding:12px 14px;margin-bottom:14px;cursor:pointer;display:flex;align-items:center;justify-content:space-between"
      onclick="goPage('notas')">
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--ambar)">⏳ Cuatrimestres pendientes de validación</div>
        <div style="font-size:11px;color:var(--txt2);margin-top:2px">${cierresPendCount} materia${cierresPendCount !== 1 ? 's' : ''} cerrada${cierresPendCount !== 1 ? 's' : ''} por docentes — requiere tu validación</div>
      </div>
      <span style="font-size:13px;font-weight:700;color:var(--ambar);flex-shrink:0;margin-left:12px">→</span>
    </div>` : ''}

    ${renderProximasActividades(eventosSem, sem.hoy, nivel)}
    ${listasHTML}

    <div class="dash-cols">
      <div class="dash-col-l" id="tareas-col"></div>
      <div class="dash-col-r">
        ${renderAgendaSemana(eventosSem, sem, nivel)}
      </div>
    </div>

    <div class="sec-lb" style="margin-top:14px">Estado del nivel</div>
    ${renderNivelPanel(nivel, probs)}
    ${alertasHTML}
    <div class="acc" style="margin-top:10px">
      <button class="btn-p" onclick="goPage('asist')">📋 Tomar lista</button>
      <button class="btn-s" onclick="goPage('leg')">▤ Resumen</button>
      <button class="btn-s" onclick="goPage('prob')">△ Reportar</button>
    </div>

    ${renderPendientesRespuesta(pendResp)}
    <div id="alertas-acad-dash" style="margin-top:4px"></div>`;

  inyectarEstilosDash();
  _cargarAlertasAcadDash(instId);
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

// ═══════════════════════════════════════════════════════
// ALERTAS ACADÉMICAS EN DASHBOARD (v15 — Res. 1650/2024)
// ═══════════════════════════════════════════════════════

async function _cargarAlertasAcadDash(instId) {
  const sec = document.getElementById('alertas-acad-dash');
  if (!sec) return;

  const { data, error } = await sb.from('alertas_academicas')
    .select('id,alumno_id,tipo,materias_ids,ciclo_lectivo,cuatrimestre,alumnos(id,nombre,apellido)')
    .eq('institucion_id', instId)
    .eq('resuelta', false)
    .not('tipo', 'is', null)
    .order('tipo').limit(50);

  if (error || !data?.length) {
    sec.innerHTML = '';
    return;
  }

  sec.innerHTML = renderAlertasAcademicas(data);
}

function renderAlertasAcademicas(alertas) {
  if (!alertas?.length) return '';

  const TIPO_INFO = {
    riesgo_1:             { label: 'En seguimiento (1–2 mat.)',  color: 'var(--ambar)', tag: 'ta' },
    riesgo_2:             { label: 'Riesgo académico (3–4 mat.)', color: 'var(--rojo)',  tag: 'tr' },
    promocion_acompanada: { label: 'Promoción acompañada',        color: 'var(--ambar)', tag: 'ta' },
    edt_requerido:        { label: 'Requiere EDT (5+ mat.)',       color: 'var(--rojo)',  tag: 'tr' },
    resuelta:             { label: 'Resuelta',                     color: 'var(--verde)', tag: 'tg' },
  };

  const porTipo = {};
  alertas.forEach(a => {
    if (!porTipo[a.tipo]) porTipo[a.tipo] = [];
    porTipo[a.tipo].push(a);
  });

  const orden = ['edt_requerido','riesgo_2','promocion_acompanada','riesgo_1'];

  const html = orden.filter(t => porTipo[t]?.length).map(tipo => {
    const info  = TIPO_INFO[tipo] || { label: tipo, color: 'var(--txt2)', tag: 'td' };
    const lista = porTipo[tipo];
    return `
      <div style="margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;letter-spacing:.06em;color:${info.color};text-transform:uppercase;margin-bottom:6px">
          ${info.label} (${lista.length})
        </div>
        <div class="card" style="padding:0;overflow:hidden">
          ${lista.map(a => {
            const al  = a.alumnos;
            const nom = al ? `${al.apellido}, ${al.nombre}` : '—';
            const n   = a.materias_ids?.length || 0;
            return `
              <div style="display:flex;align-items:center;gap:12px;padding:9px 14px;border-bottom:1px solid var(--brd);cursor:pointer"
                onclick="_irLegajoDesdeAlerta('${a.alumno_id}')">
                <div style="flex:1">
                  <div style="font-size:12px;font-weight:500">${nom}</div>
                  <div style="font-size:10px;color:var(--txt2)">
                    ${n} mat. · Ciclo ${a.ciclo_lectivo || '—'}${a.cuatrimestre ? ` · C${a.cuatrimestre}` : ''}
                  </div>
                </div>
                <span style="color:var(--verde);font-size:14px">→</span>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');

  if (!html) return '';
  return `
    <div class="sec-lb" style="margin-top:18px">Alertas académicas activas</div>
    ${html}
    <div style="font-size:10px;color:var(--txt2);margin-bottom:14px">
      Generadas al cerrar cuatrimestre. Se resuelven desde Calificaciones → Cierre anual.
    </div>`;
}

async function _irLegajoDesdeAlerta(alumnoId) {
  if (!alumnoId) return;
  window._pendingLegAlumnoId = alumnoId;
  goPage('leg');
  setTimeout(async () => {
    if (window._pendingLegAlumnoId && window._legAlumnosCache?.length) {
      const alumno = window._legAlumnosCache.find(a => a.id === window._pendingLegAlumnoId);
      if (alumno) {
        window._pendingLegAlumnoId = null;
        await abrirLegajoAlumno(alumnoId);
      }
    }
  }, 800);
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

    /* Cards de estado por nivel (director general) */
    .niveles-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    @media(max-width:768px){.niveles-grid{grid-template-columns:1fr}}

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

    /* Estado académico del nivel — 2 columnas */
    .dash-acad-cols{display:grid;grid-template-columns:1fr 1fr;gap:0;align-items:start}
    @media(max-width:640px){
      .dash-acad-cols{grid-template-columns:1fr}
      .dash-acad-cols>div+div{border-right:none!important;border-left:none!important;padding-left:0!important;padding-right:0!important;padding-top:14px;border-top:1px solid var(--brd)}
    }
  `;
  document.head.appendChild(st);
}
