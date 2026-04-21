// =====================================================
// AGENDA.JS — Calendario institucional v3
// =====================================================

let AGENDA_SEMANA_INICIO = _lunesDeHoy();
let AGENDA_DIA_SEL       = new Date().toISOString().split('T')[0];
let AGENDA_NIVEL         = 'todos';
let TIPOS_EVENTO         = [];
let USUARIOS_INST        = [];
let _agendaEventosSem    = [];

function _lunesDeHoy() {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().split('T')[0];
}

function _lunesDe(iso) {
  const d = new Date(iso + 'T12:00:00');
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().split('T')[0];
}

function _addDias(iso, dias) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
}

const NIVEL_CONFIG = {
  inicial:    { color: '#1a7a4a', bg: '#e8f5ee', label: '🌱 Inicial' },
  primario:   { color: '#1a5276', bg: '#eaf2fb', label: '📚 Primario' },
  secundario: { color: '#6c3483', bg: '#f5eef8', label: '🎓 Secundario' },
  todos:      { color: '#b8963e', bg: '#fdf6e8', label: '🏫 Toda la institución' },
};

const GRUPOS_CONV = [
  { id: 'equipo_directivo', label: 'Equipo Directivo' },
  { id: 'director_general', label: 'Director/a General' },
  { id: 'docentes',         label: 'Docentes' },
  { id: 'alumnos',          label: 'Alumnos' },
  { id: 'familias',         label: 'Familias' },
  { id: 'comunidad',        label: 'Comunidad educativa' },
];

const MESES_NOMBRES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                       'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_NOMBRES  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

const HORAS_OPTS = (() => {
  const opts = [];
  for (let h = 7; h <= 22; h++) {
    opts.push(`${String(h).padStart(2,'0')}:00`);
    if (h < 22) opts.push(`${String(h).padStart(2,'0')}:30`);
  }
  return opts;
})();

// ─── RENDER PRINCIPAL ─────────────────────────────────
async function rAgenda() {
  const c = document.getElementById('page-agenda');
  showLoading('agenda');

  const instId = USUARIO_ACTUAL.institucion_id;
  const rol    = USUARIO_ACTUAL.rol;

  const [tiposRes, usuariosRes] = await Promise.all([
    sb.from('tipos_evento').select('*').eq('institucion_id', instId).eq('activo', true).order('nombre'),
    sb.from('usuarios').select('id, nombre_completo, rol, nivel, avatar_iniciales').eq('institucion_id', instId).order('nombre_completo'),
  ]);
  TIPOS_EVENTO  = tiposRes.data  || [];
  USUARIOS_INST = usuariosRes.data || [];

  const sabado = _addDias(AGENDA_SEMANA_INICIO, 5);
  const { data: eventos } = await sb
    .from('eventos_institucionales')
    .select('*, usuarios(nombre_completo)')
    .eq('institucion_id', instId)
    .gte('fecha_inicio', AGENDA_SEMANA_INICIO)
    .lte('fecha_inicio', sabado)
    .order('hora', { nullsFirst: false })
    .order('nombre');

  _agendaEventosSem = (eventos || []).filter(e => {
    if (AGENDA_NIVEL === 'todos') return true;
    if (!e.nivel || e.nivel === 'todos') return true;
    return e.nivel.split(',').map(n => n.trim()).includes(AGENDA_NIVEL);
  });

  if (AGENDA_DIA_SEL < AGENDA_SEMANA_INICIO || AGENDA_DIA_SEL > sabado) {
    AGENDA_DIA_SEL = AGENDA_SEMANA_INICIO;
  }

  const puedeCrear = ['director_general','directivo_nivel','preceptor'].includes(rol);
  const hoy = new Date().toISOString().split('T')[0];

  const dLunes  = new Date(AGENDA_SEMANA_INICIO + 'T12:00:00');
  const dSabado = new Date(sabado + 'T12:00:00');
  let tituloSem;
  if (dLunes.getMonth() === dSabado.getMonth()) {
    tituloSem = `${dLunes.getDate()} al ${dSabado.getDate()} de ${MESES_NOMBRES[dSabado.getMonth()].toLowerCase()}, ${dSabado.getFullYear()}`;
  } else if (dLunes.getFullYear() === dSabado.getFullYear()) {
    tituloSem = `${dLunes.getDate()} de ${MESES_NOMBRES[dLunes.getMonth()].toLowerCase()} al ${dSabado.getDate()} de ${MESES_NOMBRES[dSabado.getMonth()].toLowerCase()}, ${dSabado.getFullYear()}`;
  } else {
    tituloSem = `${formatFechaLatam(AGENDA_SEMANA_INICIO)} al ${formatFechaLatam(sabado)}`;
  }

  const DIAS_TABS = ['Lun','Mar','Mié','Jue','Vie','Sáb'];
  const tabsDiaHTML = DIAS_TABS.map((lbl, i) => {
    const iso  = _addDias(AGENDA_SEMANA_INICIO, i);
    const d    = new Date(iso + 'T12:00:00');
    const esSel = iso === AGENDA_DIA_SEL;
    const esHoy = iso === hoy;
    const tieneEvs = _agendaEventosSem.some(e => e.fecha_inicio === iso);
    return `<button class="dia-tab${esSel ? ' on' : ''}${esHoy ? ' hoy' : ''}" onclick="selDia('${iso}')">
      <span class="dia-lbl">${lbl}</span>
      <span class="dia-num">${d.getDate()}</span>
      ${tieneEvs ? '<span class="dia-dot"></span>' : ''}
    </button>`;
  }).join('');

  const filtroTabsHTML = (rol === 'director_general' || rol === 'directivo_nivel') ? `
    <div class="nivel-tabs-ag" style="margin-bottom:14px">
      ${Object.entries(NIVEL_CONFIG).map(([k,v]) => `
        <button class="nivel-tab-ag ${AGENDA_NIVEL===k?'on':''}"
          style="${AGENDA_NIVEL===k?`background:${v.color};color:#fff;border-color:${v.color}`:''}"
          onclick="setAgendaNivel('${k}')">${v.label}
        </button>`).join('')}
    </div>` : '';

  c.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div>
        <div class="pg-t">Agenda institucional</div>
        <div class="pg-s">Semana del ${tituloSem}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <button class="semana-nav-btn" onclick="cambiarSemana(-1)" title="Semana anterior">◀</button>
        <button class="btn-s" style="font-size:11px;padding:6px 12px" onclick="irHoy()">Hoy</button>
        <button class="semana-nav-btn" onclick="cambiarSemana(1)" title="Semana siguiente">▶</button>
        ${puedeCrear ? `<button class="btn-p" style="font-size:11px" onclick="abrirFormEvento()">+ Nuevo</button>` : ''}
      </div>
    </div>
    ${filtroTabsHTML}
    <div class="dia-tabs">${tabsDiaHTML}</div>
    <div id="form-evento"></div>
    <div id="detalle-evento"></div>
    <div id="agenda-lista-dia"></div>`;

  _renderEventosDia(_agendaEventosSem.filter(e => e.fecha_inicio === AGENDA_DIA_SEL));
  inyectarEstilosAgenda();
}

// ─── LISTA DE EVENTOS DEL DÍA ─────────────────────────
function _renderEventosDia(eventos) {
  const c = document.getElementById('agenda-lista-dia');
  if (!c) return;

  if (!eventos.length) {
    c.innerHTML = `<div class="empty-state" style="padding:28px 0">
      <span style="font-size:28px">📭</span>
      <div>Sin eventos este día</div>
    </div>`;
    return;
  }

  c.innerHTML = eventos.map(e => {
    const nc   = NIVEL_CONFIG[e.nivel] || NIVEL_CONFIG.todos;
    const tipo = TIPOS_EVENTO.find(t => t.id === e.tipo_id);
    return `<div class="agenda-item" onclick="verEvento('${e.id}')">
      <div class="agenda-hora">${e.hora ? e.hora.slice(0,5) : '—'}</div>
      <div class="agenda-barra" style="background:${nc.color}"></div>
      <div class="agenda-info">
        <div class="agenda-titulo">${e.nombre}</div>
        <div class="agenda-meta">
          ${tipo ? `<span>${tipo.nombre}</span>` : ''}
          ${e.lugar ? `<span>📍 ${e.lugar}</span>` : ''}
          <span style="color:${nc.color}">${nc.label}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

function selDia(iso) {
  AGENDA_DIA_SEL = iso;
  document.querySelectorAll('.dia-tab').forEach(btn => {
    const esSel = btn.getAttribute('onclick')?.includes(`'${iso}'`);
    btn.classList.toggle('on', !!esSel);
  });
  _renderEventosDia(_agendaEventosSem.filter(e => e.fecha_inicio === iso));
}

// ─── VER DETALLE ──────────────────────────────────────
async function verEvento(id) {
  const { data: e } = await sb.from('eventos_institucionales')
    .select('*, usuarios(nombre_completo)').eq('id', id).single();
  if (!e) return;

  const nc   = NIVEL_CONFIG[e.nivel] || NIVEL_CONFIG.todos;
  const tipo = TIPOS_EVENTO.find(t => t.id === e.tipo_id);

  const convGrupos = (e.convocatoria_grupos || [])
    .map(g => GRUPOS_CONV.find(x => x.id === g)?.label).filter(Boolean);

  const convPersonas = (e.convocados_ids || [])
    .map(uid => USUARIOS_INST.find(u => u.id === uid)?.nombre_completo).filter(Boolean);

  const responsables = (e.responsables_ids || [])
    .map(uid => USUARIOS_INST.find(u => u.id === uid)?.nombre_completo).filter(Boolean);

  const puedeEditar = ['director_general','directivo_nivel','preceptor'].includes(USUARIO_ACTUAL.rol) || e.creado_por === USUARIO_ACTUAL.id;

  document.getElementById('detalle-evento').innerHTML = `
    <div class="card" style="border-left:4px solid ${nc.color};margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="flex:1">
          <div style="font-size:15px;font-weight:700;margin-bottom:6px">${e.nombre}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
            <span style="font-size:10px;padding:2px 10px;border-radius:20px;background:${nc.bg};color:${nc.color};border:1px solid ${nc.color}40">${nc.label}</span>
            ${tipo ? `<span class="tag tgr">${tipo.nombre}</span>` : ''}
          </div>
        </div>
        <button onclick="document.getElementById('detalle-evento').innerHTML=''"
          style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--txt2);margin-left:8px">×</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <div class="sec-lb" style="margin:0 0 2px">Fecha</div>
          <div style="font-size:12px">
            ${formatFechaLatam(e.fecha_inicio)}
            ${e.fecha_fin && e.fecha_fin !== e.fecha_inicio ? ' → '+formatFechaLatam(e.fecha_fin) : ''}
            ${e.hora ? ' · '+e.hora : ''}
          </div>
        </div>
        <div>
          <div class="sec-lb" style="margin:0 0 2px">Lugar</div>
          <div style="font-size:12px">${e.lugar || '—'}</div>
        </div>
        ${convGrupos.length ? `
        <div>
          <div class="sec-lb" style="margin:0 0 2px">Convocatoria</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            ${convGrupos.map(g => `<span class="tag tgr">${g}</span>`).join('')}
          </div>
        </div>` : ''}
        ${responsables.length ? `
        <div>
          <div class="sec-lb" style="margin:0 0 2px">Responsable(s)</div>
          <div style="font-size:12px">${responsables.join(', ')}</div>
        </div>` : ''}
        ${convPersonas.length ? `
        <div style="grid-column:1/-1">
          <div class="sec-lb" style="margin:0 0 4px">Convocados</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            ${convPersonas.map(n => `<span class="tag tp">${n.split(',')[0]}</span>`).join('')}
          </div>
        </div>` : ''}
      </div>

      ${e.descripcion ? `<div style="margin-top:10px;font-size:11px;color:var(--txt2);line-height:1.6;border-top:1px solid var(--brd);padding-top:10px">${e.descripcion}</div>` : ''}

      ${puedeEditar ? `
      <div class="acc" style="margin-top:12px">
        <button class="btn-s" style="font-size:10px" onclick="editarEvento('${e.id}')">✏️ Editar</button>
        <button class="btn-d" style="font-size:10px" onclick="eliminarEvento('${e.id}')">Eliminar</button>
      </div>` : ''}
    </div>`;
}

async function eliminarEvento(id) {
  if (!confirm('¿Eliminás este evento?')) return;
  await sb.from('eventos_institucionales').delete().eq('id', id);
  document.getElementById('detalle-evento').innerHTML = '';
  rAgenda();
}

async function editarEvento(id) {
  const { data: e } = await sb.from('eventos_institucionales').select('*').eq('id', id).single();
  if (!e) return;
  document.getElementById('detalle-evento').innerHTML = '';
  abrirFormEvento(e);
}

// ─── FORMULARIO ───────────────────────────────────────
function abrirFormEvento(eventoExistente = null) {
  const rol        = USUARIO_ACTUAL?.rol;
  const esDirector = rol === 'director_general';
  const esEdicion  = !!eventoExistente;
  const e          = eventoExistente || {};

  const nivelesDisp = esDirector
    ? ['todos','inicial','primario','secundario']
    : [USUARIO_ACTUAL.nivel || 'todos'];

  document.getElementById('form-evento').innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;margin-bottom:14px">
        ${esEdicion ? '✏️ Editar evento' : 'Nuevo evento'}
      </div>

      <div class="form-grid-2-ag">

        <div style="grid-column:1/-1">
          <div class="sec-lb">Nombre del evento *</div>
          <input type="text" id="ev-nombre" placeholder="Ej: Día del Maestro" value="${e.nombre || ''}">
        </div>

        <div>
          <div class="sec-lb">Tipo de evento</div>
          <select id="ev-tipo" class="sel-estilizado">
            <option value="">— Seleccioná —</option>
            ${TIPOS_EVENTO.map(t => `<option value="${t.id}" ${e.tipo_id===t.id?'selected':''}>${t.nombre}</option>`).join('')}
          </select>
          ${esDirector ? `<div style="font-size:10px;color:var(--verde);margin-top:4px;cursor:pointer" onclick="abrirNuevoTipo()">+ Agregar tipo</div>` : ''}
          <div id="form-nuevo-tipo"></div>
        </div>

        <div>
          <div class="sec-lb">Nivel</div>
          ${esDirector ? (() => {
            const selNiveles = (e.nivel||'todos').split(',').map(n=>n.trim());
            const todos = selNiveles.includes('todos');
            return `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">
              ${['todos','inicial','primario','secundario'].map(n => `
                <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
                  <input type="checkbox" class="ev-nivel-chk" value="${n}" ${(todos&&n==='todos')||selNiveles.includes(n)?'checked':''}>
                  ${NIVEL_CONFIG[n]?.label || 'Todos'}
                </label>`).join('')}
            </div>`;
          })() : `<select id="ev-nivel" class="sel-estilizado">
            ${nivelesDisp.map(n => `<option value="${n}" ${(e.nivel||'todos')===n?'selected':''}>${NIVEL_CONFIG[n]?.label||n}</option>`).join('')}
          </select>`}
        </div>

        <div>
          <div class="sec-lb">Fecha inicio *</div>
          <input type="date" id="ev-fecha-ini" class="input-fecha" value="${e.fecha_inicio||''}">
        </div>

        <div>
          <div class="sec-lb">Fecha fin (si dura varios días)</div>
          <input type="date" id="ev-fecha-fin" class="input-fecha" value="${e.fecha_fin||''}">
        </div>

        <div>
          <div class="sec-lb">Hora</div>
          <select id="ev-hora" class="sel-estilizado">
            <option value="">— Sin hora —</option>
            ${HORAS_OPTS.map(h => `<option value="${h}" ${e.hora===h?'selected':''}>${h}</option>`).join('')}
          </select>
        </div>

        <div>
          <div class="sec-lb">Lugar</div>
          <input type="text" id="ev-lugar" placeholder="Ej: Salón de actos" value="${e.lugar||''}">
        </div>

        <div style="grid-column:1/-1">
          <div class="sec-lb">Convocatoria — grupos</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button type="button" class="chip" onclick="toggleTodosGrupos(this)">Todos</button>
            ${GRUPOS_CONV.map(g => `
              <button type="button" class="chip ${(e.convocatoria_grupos||[]).includes(g.id)?'on':''}"
                data-grupo="${g.id}" onclick="this.classList.toggle('on')">${g.label}
              </button>`).join('')}
          </div>
        </div>

        <div style="grid-column:1/-1">
          <div class="sec-lb">Personas convocadas</div>
          <div class="usr-search-wrap">
            <input type="text" class="usr-search-inp" id="busq-conv"
              placeholder="🔍 Buscar persona..."
              oninput="filtrarDropdown('conv')"
              onfocus="showDrop('conv')"
              autocomplete="off">
            <div id="drop-conv" class="usr-dropdown" style="display:none">
              ${renderDropdownOpts('conv', e.convocados_ids||[])}
            </div>
          </div>
          <div id="chips-conv" class="chips-sel">
            ${(e.convocados_ids||[]).map(uid => chipUsuario(uid,'conv')).join('')}
          </div>
        </div>

        <div style="grid-column:1/-1">
          <div class="sec-lb">Responsable(s)</div>
          <div class="usr-search-wrap">
            <input type="text" class="usr-search-inp" id="busq-resp"
              placeholder="🔍 Buscar responsable..."
              oninput="filtrarDropdown('resp')"
              onfocus="showDrop('resp')"
              autocomplete="off">
            <div id="drop-resp" class="usr-dropdown" style="display:none">
              ${renderDropdownOpts('resp', e.responsables_ids||[])}
            </div>
          </div>
          <div id="chips-resp" class="chips-sel">
            ${(e.responsables_ids||[]).map(uid => chipUsuario(uid,'resp')).join('')}
          </div>
        </div>

        <div style="grid-column:1/-1">
          <div class="sec-lb">Descripción</div>
          <textarea id="ev-desc" rows="2" placeholder="Detalles adicionales...">${e.descripcion||''}</textarea>
        </div>

      </div>

      <div class="acc" style="margin-top:14px">
        <button class="btn-p" onclick="guardarEvento('${esEdicion?e.id:''}')">
          ${esEdicion ? 'Guardar cambios' : 'Crear evento'}
        </button>
        <button class="btn-s" onclick="document.getElementById('form-evento').innerHTML=''">Cancelar</button>
      </div>
    </div>`;

  document.addEventListener('click', cerrarDropdowns);
}

// ─── DROPDOWNS DE USUARIOS ────────────────────────────
function renderDropdownOpts(tipo, seleccionados) {
  return USUARIOS_INST.map(u => `
    <div class="usr-opt ${seleccionados.includes(u.id)?'sel':''}"
      onclick="agregarUsuario('${tipo}','${u.id}')"
      data-nombre="${u.nombre_completo.toLowerCase()}"
      data-uid="${u.id}">
      <span class="chip-av-sm">${u.avatar_iniciales||u.nombre_completo[0]}</span>
      ${u.nombre_completo}
      <span style="font-size:9px;color:var(--txt3);margin-left:auto">${labelRol(u.rol)}</span>
    </div>`).join('');
}

function showDrop(tipo) {
  document.getElementById(`drop-${tipo}`).style.display = 'block';
}

function cerrarDropdowns(e) {
  ['conv','resp'].forEach(t => {
    const drop = document.getElementById(`drop-${t}`);
    const inp  = document.getElementById(`busq-${t}`);
    if (drop && inp && !drop.contains(e.target) && e.target !== inp) {
      drop.style.display = 'none';
    }
  });
}

function filtrarDropdown(tipo) {
  const q    = document.getElementById(`busq-${tipo}`)?.value?.toLowerCase() || '';
  const drop = document.getElementById(`drop-${tipo}`);
  if (!drop) return;
  drop.style.display = 'block';
  drop.querySelectorAll('.usr-opt').forEach(el => {
    el.style.display = el.dataset.nombre?.includes(q) ? 'flex' : 'none';
  });
}

function agregarUsuario(tipo, uid) {
  const chips = document.getElementById(`chips-${tipo}`);
  if (!chips || chips.querySelector(`[data-uid="${uid}"]`)) {
    document.getElementById(`drop-${tipo}`).style.display = 'none';
    return;
  }
  chips.insertAdjacentHTML('beforeend', chipUsuario(uid, tipo));
  const opt = document.querySelector(`#drop-${tipo} [data-uid="${uid}"]`);
  if (opt) opt.classList.add('sel');
  // Cerrar y limpiar inmediatamente
  const inp = document.getElementById(`busq-${tipo}`);
  if (inp) inp.value = '';
  document.getElementById(`drop-${tipo}`).style.display = 'none';
  document.querySelectorAll(`#drop-${tipo} .usr-opt`).forEach(el => el.style.display = 'flex');
}

function chipUsuario(uid, tipo) {
  const u = USUARIOS_INST.find(x => x.id === uid);
  if (!u) return '';
  return `<span class="chip-sel" data-uid="${uid}">
    <span class="chip-av-sm">${u.avatar_iniciales||u.nombre_completo[0]}</span>
    ${u.nombre_completo.split(',')[0]}
    <span onclick="quitarUsuario('${tipo}','${uid}')" style="cursor:pointer;margin-left:4px;opacity:.6">×</span>
  </span>`;
}

function quitarUsuario(tipo, uid) {
  document.getElementById(`chips-${tipo}`)?.querySelector(`[data-uid="${uid}"]`)?.remove();
  const opt = document.querySelector(`#drop-${tipo} [data-uid="${uid}"]`);
  if (opt) opt.classList.remove('sel');
}

function toggleTodosGrupos(btn) {
  const activo = btn.classList.toggle('on');
  document.querySelectorAll('[data-grupo]').forEach(b =>
    activo ? b.classList.add('on') : b.classList.remove('on')
  );
}

function abrirNuevoTipo() {
  document.getElementById('form-nuevo-tipo').innerHTML = `
    <div style="display:flex;gap:6px;margin-top:6px">
      <input type="text" id="nuevo-tipo-nombre" placeholder="Nombre del tipo" style="flex:1">
      <button class="btn-p" style="font-size:10px" onclick="guardarNuevoTipo()">Agregar</button>
    </div>`;
}

async function guardarNuevoTipo() {
  const nombre = document.getElementById('nuevo-tipo-nombre')?.value?.trim();
  if (!nombre) return;
  const { data } = await sb.from('tipos_evento').insert({
    institucion_id: USUARIO_ACTUAL.institucion_id,
    nombre, es_base: false, activo: true,
  }).select().single();
  if (data) {
    TIPOS_EVENTO.push(data);
    const sel = document.getElementById('ev-tipo');
    if (sel) {
      const opt = document.createElement('option');
      opt.value = data.id; opt.textContent = data.nombre; opt.selected = true;
      sel.appendChild(opt);
    }
    document.getElementById('form-nuevo-tipo').innerHTML =
      `<div style="font-size:10px;color:var(--verde);margin-top:3px">✓ "${nombre}" agregado</div>`;
  }
}

// ─── GUARDAR EVENTO ───────────────────────────────────
async function guardarEvento(eventoId) {
  eventoId = eventoId || '';

  const nombre   = document.getElementById('ev-nombre')?.value?.trim();
  const fechaIni = document.getElementById('ev-fecha-ini')?.value;

  if (!nombre)   { alert('El nombre es obligatorio.'); return; }
  if (!fechaIni) { alert('La fecha de inicio es obligatoria.'); return; }

  // Normalizar fecha a YYYY-MM-DD (algunos navegadores devuelven MM/DD/YYYY)
  let fechaNorm = fechaIni;
  if (fechaIni.includes('/')) {
    const partes = fechaIni.split('/');
    fechaNorm = `${partes[2]}-${partes[0].padStart(2,'0')}-${partes[1].padStart(2,'0')}`;
  }

  const fechaFinRaw = document.getElementById('ev-fecha-fin')?.value || '';
  let fechaFin = fechaFinRaw || null;
  if (fechaFinRaw && fechaFinRaw.includes('/')) {
    const partes = fechaFinRaw.split('/');
    fechaFin = `${partes[2]}-${partes[0].padStart(2,'0')}-${partes[1].padStart(2,'0')}`;
  }

  const hora         = document.getElementById('ev-hora')?.value || null;
  const grupos       = Array.from(document.querySelectorAll('[data-grupo].on')).map(b => b.dataset.grupo);
  const convocados   = Array.from(document.getElementById('chips-conv')?.querySelectorAll('[data-uid]')||[]).map(b => b.dataset.uid);
  const responsables = Array.from(document.getElementById('chips-resp')?.querySelectorAll('[data-uid]')||[]).map(b => b.dataset.uid);

  const nivelChks = [...document.querySelectorAll('.ev-nivel-chk:checked')].map(c => c.value);
  const nivelVal  = nivelChks.length
    ? (nivelChks.includes('todos') ? 'todos' : nivelChks.join(','))
    : (document.getElementById('ev-nivel')?.value || 'todos');

  const payload = {
    nombre,
    tipo_id:             document.getElementById('ev-tipo')?.value || null,
    nivel:               nivelVal,
    fecha_inicio:        fechaNorm,
    fecha_fin:           fechaFin,
    hora:                hora || null,
    lugar:               document.getElementById('ev-lugar')?.value || null,
    descripcion:         document.getElementById('ev-desc')?.value || null,
    convocatoria_grupos: grupos,
    convocados_ids:      convocados,
    responsables_ids:    responsables,
  };

  let error, data;

  if (eventoId) {
    ({ error } = await sb.from('eventos_institucionales').update(payload).eq('id', eventoId));
  } else {
    ({ data, error } = await sb.from('eventos_institucionales').insert({
      ...payload,
      institucion_id: USUARIO_ACTUAL.institucion_id,
      creado_por:     USUARIO_ACTUAL.id,
    }).select().single());

    if (!error && data) {
      if (convocados.length) {
        await sb.from('evento_respuestas').insert(
          convocados.map(uid => ({
            evento_id:  data.id,
            usuario_id: uid,
            respuesta:  'pendiente',
          }))
        );
      }
      // Notificar a convocados Y responsables
      const fechaStr = data.fecha_inicio ? (() => {
        const d = new Date(data.fecha_inicio + 'T12:00:00');
        return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
      })() : '';
      const toNotif = [...new Set([...convocados, ...responsables])];
      if (toNotif.length) {
        await sb.from('notificaciones').insert(
          toNotif.map(uid => ({
            usuario_id:       uid,
            tipo:             convocados.includes(uid) ? 'invitacion_evento' : 'evento_responsable',
            titulo:           `${convocados.includes(uid) ? 'Invitación' : 'Evento asignado'}: ${nombre}`,
            descripcion:      `${fechaStr}${data.hora ? ' · ' + data.hora.slice(0,5) : ''}${data.lugar ? ' · ' + data.lugar : ''}${convocados.includes(uid) ? ' — Confirmá tu asistencia.' : ''}`,
            referencia_id:    data.id,
            referencia_tabla: 'eventos_institucionales',
          }))
        );
      }
    }
  }

  if (error) { alert('Error al guardar: ' + error.message); return; }

  document.getElementById('form-evento').innerHTML = '';
  AGENDA_SEMANA_INICIO = _lunesDe(fechaNorm);
  AGENDA_DIA_SEL = fechaNorm;
  rAgenda();
}

// ─── NAVEGACIÓN ───────────────────────────────────────
function cambiarSemana(delta) {
  AGENDA_SEMANA_INICIO = _addDias(AGENDA_SEMANA_INICIO, delta * 7);
  rAgenda();
}

function irHoy() {
  AGENDA_SEMANA_INICIO = _lunesDeHoy();
  AGENDA_DIA_SEL = new Date().toISOString().split('T')[0];
  rAgenda();
}

function setAgendaNivel(n) {
  AGENDA_NIVEL = n;
  rAgenda();
}

// ─── UTILIDADES ───────────────────────────────────────
function isoFecha(a, m, d) {
  return `${a}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function formatFechaLatam(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─── ESTILOS ──────────────────────────────────────────
function inyectarEstilosAgenda() {
  if (document.getElementById('agenda-styles')) return;
  const st = document.createElement('style');
  st.id = 'agenda-styles';
  st.textContent = `
    .nivel-tabs-ag{display:flex;gap:6px;flex-wrap:wrap;}
    .nivel-tab-ag{padding:6px 14px;border-radius:20px;border:1px solid var(--brd);cursor:pointer;font-size:11px;background:var(--surf2);color:var(--txt2);font-family:inherit;transition:all .15s;}
    .nivel-tab-ag:hover{opacity:.85;}

    .semana-nav-btn{width:32px;height:32px;border:1px solid var(--brd);border-radius:8px;background:var(--surf);cursor:pointer;font-size:12px;color:var(--txt2);display:inline-flex;align-items:center;justify-content:center;transition:background .12s;}
    .semana-nav-btn:hover{background:var(--surf2);}

    .dia-tabs{display:flex;gap:6px;margin-bottom:16px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:2px;}
    .dia-tabs::-webkit-scrollbar{display:none;}
    .dia-tab{flex:1;min-width:52px;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 6px 10px;border:1px solid var(--brd);border-radius:var(--rad);background:var(--surf);cursor:pointer;transition:all .15s;position:relative;font-family:inherit;}
    .dia-tab:hover{background:var(--surf2);}
    .dia-tab.on{background:var(--verde);border-color:var(--verde);color:#fff;}
    .dia-tab.hoy:not(.on){border-color:var(--verde);}
    .dia-lbl{font-family:'DM Mono',monospace;font-size:9px;font-weight:500;text-transform:uppercase;letter-spacing:0.06em;color:var(--txt3);}
    .dia-tab.on .dia-lbl{color:rgba(255,255,255,0.75);}
    .dia-tab.hoy:not(.on) .dia-lbl{color:var(--verde);}
    .dia-num{font-size:17px;font-weight:700;line-height:1;color:var(--txt);}
    .dia-tab.on .dia-num{color:#fff;}
    .dia-dot{width:5px;height:5px;border-radius:50%;background:var(--verde);position:absolute;bottom:5px;}
    .dia-tab.on .dia-dot{background:rgba(255,255,255,0.7);}

    .agenda-item{display:grid;grid-template-columns:52px 4px 1fr;gap:0 12px;align-items:stretch;padding:12px 14px;margin-bottom:6px;background:var(--surf);border-radius:var(--rad);border:1px solid var(--brd);cursor:pointer;transition:background .1s;}
    .agenda-item:hover{background:var(--surf2);}
    .agenda-hora{font-family:'DM Mono',monospace;font-size:12px;font-weight:500;color:var(--txt2);padding-top:3px;text-align:right;}
    .agenda-barra{border-radius:2px;align-self:stretch;min-height:36px;}
    .agenda-info{display:flex;flex-direction:column;gap:4px;}
    .agenda-titulo{font-size:13px;font-weight:600;color:var(--txt);line-height:1.3;}
    .agenda-meta{display:flex;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--txt2);}

    .form-grid-2-ag{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
    @media(max-width:600px){.form-grid-2-ag{grid-template-columns:1fr;}}

    .sel-estilizado{width:100%;border:1px solid var(--brd);border-radius:var(--rad);padding:9px 12px;background:var(--surf);color:var(--txt);font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%235d6d7e' d='M6 8L1 3h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;}
    .sel-estilizado:focus{outline:none;border-color:var(--verde);}
    .input-fecha{width:100%;border:1px solid var(--brd);border-radius:var(--rad);padding:9px 12px;background:var(--surf);color:var(--txt);font-family:'DM Sans',sans-serif;font-size:12px;}
    .input-fecha:focus{outline:none;border-color:var(--verde);}

    .usr-search-wrap{position:relative;}
    .usr-search-inp{width:100%;border:1px solid var(--brd);border-radius:var(--rad);padding:9px 12px;background:var(--surf);color:var(--txt);font-family:'DM Sans',sans-serif;font-size:12px;}
    .usr-search-inp:focus{outline:none;border-color:var(--verde);}
    .usr-dropdown{position:absolute;z-index:100;background:var(--surf);border:1px solid var(--brd);border-radius:var(--rad);box-shadow:0 4px 16px rgba(0,0,0,.12);max-height:200px;overflow-y:auto;width:100%;top:calc(100% + 4px);left:0;}
    .usr-opt{display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;font-size:11px;transition:background .1s;}
    .usr-opt:hover{background:var(--surf2);}
    .usr-opt.sel{background:var(--verde-l);color:var(--verde);}

    .chips-sel{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px;min-height:24px;}
    .chip-sel{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;background:var(--azul-l);color:var(--azul);font-size:11px;border:1px solid var(--azul);}
    .chip-av-sm{width:16px;height:16px;border-radius:50%;background:var(--verde);color:#fff;font-size:8px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
  `;
  document.head.appendChild(st);
}

async function verAgendaCursos() {
  const c      = document.getElementById('page-agenda');
  const instId = USUARIO_ACTUAL.institucion_id;
  const rol    = USUARIO_ACTUAL.rol;
  const miId   = USUARIO_ACTUAL.id;
  const hoy    = new Date().toISOString().split('T')[0];

  // Filtrar cursos según rol
  let cursos = [];
  if (rol === 'director_general' || rol === 'directivo_nivel') {
    const { data } = await sb.from('cursos').select('*')
      .eq('institucion_id', instId).order('nivel').order('nombre');
    cursos = data || [];
    if (rol === 'directivo_nivel') cursos = cursos.filter(cu => cu.nivel === USUARIO_ACTUAL.nivel);
  } else if (rol === 'docente') {
    const { data } = await sb.from('docente_cursos')
      .select('cursos(id,nombre,division,nivel)').eq('usuario_id', miId).eq('activo', true);
    cursos = [...new Map((data||[]).map(a => [a.cursos.id, a.cursos])).values()];
  } else if (rol === 'preceptor') {
    const nivel = USUARIO_ACTUAL.nivel || 'secundario';
    const { data } = await sb.from('cursos').select('*')
      .eq('institucion_id', instId).eq('nivel', nivel).order('nombre');
    cursos = data || [];
  }

  // Obtener próximos eventos de todos los cursos
  const cursoIds = cursos.map(cu => cu.id);
  let eventos = [];
  if (cursoIds.length) {
    const { data } = await sb.from('calendario_curso').select('*, cursos(nombre,division,nivel), materias(nombre)')
      .in('curso_id', cursoIds)
      .gte('fecha', hoy)
      .order('fecha').order('hora', { nullsFirst: false })
      .limit(50);
    eventos = data || [];
  }

  const colores = { inicial:'#1a7a4a', primario:'#1a5276', secundario:'#6c3483' };

  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <button onclick="rAgenda()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--txt2)">←</button>
      <div>
        <div class="pg-t">Calendario por curso</div>
        <div class="pg-s">Próximas actividades y evaluaciones</div>
      </div>
    </div>

    ${!eventos.length ? '<div class="empty-state">Sin actividades programadas en los próximos días</div>' :
      eventos.map(e => {
        const cu     = e.cursos;
        const color  = colores[cu?.nivel] || 'var(--verde)';
        const tipos  = { evaluacion:'📝', tp:'📋', salida:'🚌', acto:'🎭', otro:'📌' };
        return `
          <div class="card" style="padding:12px 14px;margin-bottom:8px;border-left:3px solid ${color}">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div>
                <div style="font-size:12px;font-weight:600">${tipos[e.tipo]||'📌'} ${e.titulo}</div>
                <div style="font-size:10px;color:var(--txt2);margin-top:2px">
                  ${cu?.nombre}${cu?.division} ${e.materias ? '· '+e.materias.nombre : ''}
                </div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-size:12px;font-weight:600;color:${color}">${formatFechaLatam(e.fecha)}</div>
                ${e.hora ? `<div style="font-size:10px;color:var(--txt2)">${e.hora}</div>` : ''}
              </div>
            </div>
            ${e.descripcion ? `<div style="font-size:10px;color:var(--txt2);margin-top:6px;border-top:1px solid var(--brd);padding-top:6px">${e.descripcion}</div>` : ''}
          </div>`;
      }).join('')}

    ${(rol === 'docente' || rol === 'preceptor') ? `
    <button class="btn-p" style="width:100%;margin-top:10px" onclick="agregarEventoCurso()">
      + Agregar evento al calendario
    </button>` : ''}`;
}

async function agregarEventoCurso() {
  const instId = USUARIO_ACTUAL.institucion_id;
  const miId   = USUARIO_ACTUAL.id;
  const rol    = USUARIO_ACTUAL.rol;
  const hoy    = new Date().toISOString().split('T')[0];

  let cursos = [];
  if (rol === 'docente') {
    const { data } = await sb.from('docente_cursos')
      .select('cursos(id,nombre,division,nivel)').eq('usuario_id', miId).eq('activo', true);
    cursos = [...new Map((data||[]).map(a => [a.cursos.id, a.cursos])).values()];
  } else {
    const nivel = USUARIO_ACTUAL.nivel || 'secundario';
    const { data } = await sb.from('cursos').select('*')
      .eq('institucion_id', instId).eq('nivel', nivel).order('nombre');
    cursos = data || [];
  }

  const modal = document.createElement('div');
  modal.id = 'modal-evento-curso';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px`;
  modal.innerHTML = `
    <div style="background:var(--surf);border-radius:var(--rad-lg);padding:20px;width:100%;max-width:420px">
      <div style="font-size:14px;font-weight:700;margin-bottom:14px">Agregar evento al calendario</div>

      <div class="sec-lb">Curso</div>
      <select id="ev-curso-curso" class="sel-estilizado" style="margin-bottom:10px">
        ${cursos.map(cu => `<option value="${cu.id}">${cu.nombre}${cu.division} · ${cu.nivel}</option>`).join('')}
      </select>

      <div class="sec-lb">Título</div>
      <input type="text" id="ev-curso-titulo" placeholder="Ej: Evaluación Unidad 2" style="margin-bottom:10px">

      <div class="sec-lb">Tipo</div>
      <select id="ev-curso-tipo" class="sel-estilizado" style="margin-bottom:10px">
        <option value="evaluacion">📝 Evaluación</option>
        <option value="tp">📋 Trabajo Práctico</option>
        <option value="salida">🚌 Salida</option>
        <option value="acto">🎭 Acto</option>
        <option value="otro">📌 Otro</option>
      </select>

      <div class="sec-lb">Fecha</div>
      <input type="date" id="ev-curso-fecha" class="input-fecha" value="${hoy}" style="margin-bottom:10px">

      <div class="sec-lb">Hora (opcional)</div>
      <select id="ev-curso-hora" class="sel-estilizado" style="margin-bottom:10px">
        <option value="">— Sin hora —</option>
        ${HORAS_OPTS.map(h => `<option value="${h}">${h}</option>`).join('')}
      </select>

      <div class="sec-lb">Descripción (opcional)</div>
      <textarea id="ev-curso-desc" rows="2" style="margin-bottom:14px"></textarea>

      <div class="acc">
        <button class="btn-p" onclick="guardarEventoCurso()">Guardar</button>
        <button class="btn-s" onclick="document.getElementById('modal-evento-curso').remove()">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function guardarEventoCurso() {
  const cursoId = document.getElementById('ev-curso-curso')?.value;
  const titulo  = document.getElementById('ev-curso-titulo')?.value?.trim();
  const tipo    = document.getElementById('ev-curso-tipo')?.value;
  const fecha   = document.getElementById('ev-curso-fecha')?.value;
  const hora    = document.getElementById('ev-curso-hora')?.value || null;
  const desc    = document.getElementById('ev-curso-desc')?.value || null;

  if (!titulo) { alert('El título es obligatorio.'); return; }
  if (!fecha)  { alert('La fecha es obligatoria.'); return; }

  await sb.from('calendario_curso').insert({
    institucion_id: USUARIO_ACTUAL.institucion_id,
    curso_id:       cursoId,
    creado_por:     USUARIO_ACTUAL.id,
    titulo, tipo, fecha, hora, descripcion: desc,
  });

  document.getElementById('modal-evento-curso')?.remove();
  verAgendaCursos();
}