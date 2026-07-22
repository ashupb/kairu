// =====================================================
// TAREAS.JS — Tareas personales por usuario
// =====================================================

function _escT(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function _inyectarEstilosTareas() {
  if (document.getElementById('tareas-styles')) return;
  const st = document.createElement('style');
  st.id = 'tareas-styles';
  st.textContent = `
    .tarea-item { transition: opacity .28s, transform .28s; }
    .tarea-item.completando { opacity:0; transform:translateX(10px); }
    .tarea-circle {
      width:18px;height:18px;border-radius:50%;border:2px solid var(--brd);
      background:none;cursor:pointer;flex-shrink:0;margin-top:2px;
      transition:border-color .15s,background .15s;
      display:flex;align-items:center;justify-content:center;
    }
    .tarea-circle:hover { border-color:var(--verde);background:var(--verde-l); }
    .tarea-menu-btn {
      background:none;border:none;cursor:pointer;text-align:left;
      padding:7px 14px;font-size:12px;width:100%;color:var(--txt1);
      font-family:inherit;transition:background .1s;
    }
    .tarea-menu-btn:hover { background:var(--surf2); }
    .tarea-menu-btn.danger { color:var(--rojo); }
    .tarea-alumno-sugg {
      position:absolute;left:0;right:0;top:100%;
      background:var(--surf);border:1px solid var(--brd);border-top:none;
      border-radius:0 0 var(--rad) var(--rad);
      max-height:180px;overflow-y:auto;z-index:50;
    }
    .tarea-alumno-opt {
      padding:8px 12px;font-size:12px;cursor:pointer;border-bottom:1px solid var(--brd);
    }
    .tarea-alumno-opt:last-child { border-bottom:none; }
    .tarea-alumno-opt:hover { background:var(--surf2); }
  `;
  document.head.appendChild(st);
}

// ── PANEL EN DASHBOARD ────────────────────────────────

async function _renderTareasDash() {
  // Módulo apagado en Apps (o no visible para el rol) → no se pinta el panel.
  if (typeof puedeVer === 'function' && !puedeVer('tareas')) return;
  _inyectarEstilosTareas();

  // Directivo/Director tienen #tareas-col en el dash-col-l; otros roles usan contenedor flotante
  let cont = document.getElementById('tareas-col');
  if (!cont) {
    const pg = document.getElementById('page-dash');
    if (!pg) return;
    cont = document.getElementById('tareas-dash');
    if (!cont) {
      cont = document.createElement('div');
      cont.id = 'tareas-dash';
      cont.style.marginBottom = '14px';
      pg.appendChild(cont);
    }
  }

  cont.innerHTML = '<div style="height:40px;display:flex;align-items:center;padding-left:4px"><div class="spinner" style="width:16px;height:16px;border-width:2px"></div></div>';

  const hoy = hoyISO();
  const hoyD = new Date(hoy + 'T12:00:00');
  const diffL = hoyD.getDay() === 0 ? 6 : hoyD.getDay() - 1;
  const lunesD = new Date(hoyD);
  lunesD.setDate(hoyD.getDate() - diffL);
  const lunesISO = lunesD.toISOString().slice(0, 10);

  const [pendRes, compRes] = await Promise.all([
    sb.from('tareas_usuario').select('*').eq('usuario_id', USUARIO_ACTUAL.id).eq('estado', 'pendiente').order('fecha_vencimiento', { ascending: true, nullsFirst: false }),
    sb.from('tareas_usuario').select('*').eq('usuario_id', USUARIO_ACTUAL.id).eq('estado', 'completada').gte('actualizado_en', lunesISO + 'T00:00:00').order('actualizado_en', { ascending: false }),
  ]);

  cont.innerHTML = _renderTareasPanelHTML(pendRes.data || [], compRes.data || [], hoy);
}

function _renderTareasPanelHTML(tareas, completadas, hoy) {
  const atrasadas = tareas.filter(t => t.fecha_vencimiento && t.fecha_vencimiento < hoy);
  const deHoy     = tareas.filter(t => t.fecha_vencimiento === hoy);
  const proximas  = tareas.filter(t => t.fecha_vencimiento && t.fecha_vencimiento > hoy);
  const sinFecha  = tareas.filter(t => !t.fecha_vencimiento);

  let itemsHTML = '';

  if (atrasadas.length) {
    itemsHTML += `<div style="padding:6px 14px 4px;background:var(--rojo-l);border-bottom:1px solid var(--brd)">
      <span style="font-size:10px;font-weight:700;color:var(--rojo);text-transform:uppercase;letter-spacing:.06em">⚠ ${atrasadas.length} atrasada${atrasadas.length > 1 ? 's' : ''}</span>
    </div>`;
    itemsHTML += atrasadas.map(t => _renderTareaItem(t, hoy, 'atrasada')).join('');
  }
  if (deHoy.length) {
    itemsHTML += `<div style="padding:6px 14px 4px;border-bottom:1px solid var(--brd)">
      <span style="font-size:10px;font-weight:700;color:var(--verde);text-transform:uppercase;letter-spacing:.06em">HOY</span>
    </div>`;
    itemsHTML += deHoy.map(t => _renderTareaItem(t, hoy, 'hoy')).join('');
  }
  if (proximas.length) {
    itemsHTML += proximas.slice(0, 5).map(t => _renderTareaItem(t, hoy, 'proxima')).join('');
  }
  if (sinFecha.length) {
    itemsHTML += sinFecha.map(t => _renderTareaItem(t, hoy, 'sin_fecha')).join('');
  }

  if (completadas?.length) {
    itemsHTML += `
      <div style="padding:6px 14px 4px;border-top:2px solid var(--brd);background:var(--surf2)">
        <span style="font-size:10px;font-weight:700;color:var(--verde);text-transform:uppercase;letter-spacing:.06em">✓ Completadas esta semana</span>
      </div>
      ${completadas.map(t => _renderTareaItemCompletada(t)).join('')}`;
  }

  const badge = tareas.length
    ? `<span style="background:var(--rojo);color:#fff;border-radius:999px;font-size:9px;font-weight:700;padding:1px 7px;margin-left:6px;vertical-align:middle">${tareas.length}</span>`
    : '';

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div class="sec-lb" style="margin:0">Mis tareas${badge}</div>
      <button class="btn-ghost" onclick="_toggleFormNuevaTarea()">+ Nueva tarea</button>
    </div>
    <div id="form-nueva-tarea" style="display:none;margin-bottom:10px"></div>
    <div class="card" style="padding:0;overflow:hidden">
      ${itemsHTML || `<div style="padding:18px 14px;text-align:center;font-size:12px;color:var(--txt3)">Sin tareas pendientes 🎉</div>`}
    </div>
    ${proximas.length > 5 ? `<div style="text-align:right;margin-top:6px"><button class="btn-ghost" onclick="goPage('tareas')">Ver todas (${proximas.length - 5} más) →</button></div>` : ''}
  `;
}

function _renderTareaItem(t, hoy, grupo) {
  const borderColor = grupo === 'atrasada' ? 'var(--rojo)' : grupo === 'hoy' ? 'var(--verde)' : 'transparent';
  const diasAtraso  = grupo === 'atrasada' && t.fecha_vencimiento
    ? Math.max(1, Math.floor((new Date(hoy + 'T12:00:00') - new Date(t.fecha_vencimiento + 'T12:00:00')) / 86400000)) : 0;
  const fechaLabel  = !t.fecha_vencimiento ? ''
    : grupo === 'hoy' ? 'HOY'
    : grupo === 'atrasada' ? `hace ${diasAtraso} día${diasAtraso > 1 ? 's' : ''}`
    : formatFechaCorta(t.fecha_vencimiento);
  const fechaColor  = grupo === 'atrasada' ? 'var(--rojo)' : grupo === 'hoy' ? 'var(--verde)' : 'var(--txt3)';
  const fechaWeight = grupo === 'proxima' || grupo === 'sin_fecha' ? '400' : '600';

  return `
    <div class="tarea-item" id="tarea-item-${t.id}" style="display:flex;flex-direction:column;border-bottom:1px solid var(--brd);border-left:3px solid ${borderColor}">
      <div style="display:flex;align-items:flex-start;gap:8px;padding:10px 14px">
        <span style="font-size:14px;flex-shrink:0;margin-top:1px;opacity:.45;line-height:1.4">📌</span>
        <div style="flex:1;min-width:0">
          <div class="tarea-texto" style="font-size:12px;font-weight:500;line-height:1.4;color:var(--txt1)">${_escT(t.texto)}</div>
          ${t.contexto_label ? `<div style="font-size:10px;color:var(--txt2);margin-top:2px">📎 ${_escT(t.contexto_label)}</div>` : ''}
          ${fechaLabel ? `<div style="font-size:10px;color:${fechaColor};margin-top:2px;font-weight:${fechaWeight}">${fechaLabel}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;margin-top:1px">
          <button class="tarea-circle" onclick="_completarTarea('${t.id}')" title="Marcar como completada"></button>
          <button onclick="_toggleMenuTarea('${t.id}')"
            style="background:none;border:none;cursor:pointer;padding:2px 4px;font-size:18px;color:var(--txt3);border-radius:4px;line-height:1"
            title="Opciones">⋯</button>
        </div>
      </div>
      <div id="tarea-menu-${t.id}" style="display:none;border-top:1px solid var(--brd);background:var(--surf2);padding:4px 0">
        <button class="tarea-menu-btn" onclick="_editarTarea('${t.id}')">Editar</button>
        <button class="tarea-menu-btn" onclick="_moverFechaTarea('${t.id}','${t.fecha_vencimiento || ''}')">Cambiar fecha</button>
        <button class="tarea-menu-btn" onclick="_agregarObsTask('${t.id}')">Observación</button>
        <button class="tarea-menu-btn danger" onclick="_eliminarTarea('${t.id}')">Eliminar</button>
      </div>
      <div id="tarea-edit-form-${t.id}" style="display:none;padding:8px 14px 12px;border-top:1px solid var(--brd)"></div>
      <div id="tarea-fecha-form-${t.id}" style="display:none;padding:8px 14px 12px;border-top:1px solid var(--brd)"></div>
      <div id="tarea-obs-form-${t.id}" style="display:none;padding:8px 14px 12px;border-top:1px solid var(--brd)"></div>
    </div>`;
}

function _renderTareaItemCompletada(t) {
  return `
    <div class="tarea-item" id="tarea-item-${t.id}"
      style="display:flex;align-items:flex-start;gap:8px;padding:10px 14px;border-bottom:1px solid var(--brd);border-left:3px solid var(--verde);opacity:.65">
      <span style="color:var(--verde);font-size:15px;flex-shrink:0;margin-top:1px;font-weight:700;line-height:1.4">✓</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:500;line-height:1.4;color:var(--txt3);text-decoration:line-through">${_escT(t.texto)}</div>
        ${t.contexto_label ? `<div style="font-size:10px;color:var(--txt3);margin-top:2px">📎 ${_escT(t.contexto_label)}</div>` : ''}
      </div>
      <button onclick="_descompletarTarea('${t.id}')"
        style="font-size:10px;color:var(--txt3);background:none;border:1px solid var(--brd);border-radius:4px;padding:2px 7px;cursor:pointer;flex-shrink:0;font-family:inherit;line-height:1.6"
        title="Marcar como pendiente">Deshacer</button>
    </div>`;
}

async function _descompletarTarea(id) {
  await sb.from('tareas_usuario').update({ estado: 'pendiente', actualizado_en: new Date().toISOString() }).eq('id', id);
  mostrarToast('Tarea marcada como pendiente.', 'ok');
  _renderTareasDash().catch(() => {});
}

function _toggleMenuTarea(id) {
  const menu = document.getElementById(`tarea-menu-${id}`);
  if (!menu) return;
  const isOpen = menu.style.display !== 'none';
  document.querySelectorAll('[id^="tarea-menu-"]').forEach(m => { m.style.display = 'none'; });
  if (!isOpen) menu.style.display = '';
}

async function _completarTarea(id) {
  const btn = document.querySelector(`#tarea-item-${id} .tarea-circle`);
  if (btn) { btn.style.background = 'var(--verde)'; btn.style.borderColor = 'var(--verde)'; btn.innerHTML = '<span style="color:#fff;font-size:10px;font-weight:700">✓</span>'; }
  await sb.from('tareas_usuario').update({ estado: 'completada', actualizado_en: new Date().toISOString() }).eq('id', id);
  mostrarToast('Tarea completada ✓', 'ok');
  _renderTareasDash().catch(() => {});
}

async function _eliminarTarea(id) {
  if (!confirm('¿Eliminar esta tarea? No se puede deshacer.')) return;
  await sb.from('tareas_usuario').delete().eq('id', id);
  mostrarToast('Tarea eliminada.', 'ok');
  _renderTareasDash().catch(() => {});
}

function _cerrarFormsInline(id) {
  ['tarea-edit-form','tarea-fecha-form','tarea-obs-form'].forEach(pfx => {
    const el = document.getElementById(`${pfx}-${id}`);
    if (el) el.style.display = 'none';
  });
  const menu = document.getElementById(`tarea-menu-${id}`);
  if (menu) menu.style.display = 'none';
}

function _editarTarea(id) {
  const item = document.getElementById(`tarea-item-${id}`);
  const textoEl = item?.querySelector('.tarea-texto');
  const textoActual = textoEl?.textContent?.trim() || '';
  _cerrarFormsInline(id);
  const cont = document.getElementById(`tarea-edit-form-${id}`);
  if (!cont) return;
  cont.style.display = '';
  cont.innerHTML = `
    <input type="text" id="tarea-edit-inp-${id}" class="inp" value="${_escT(textoActual)}" style="width:100%;margin-bottom:6px;font-size:13px">
    <div style="display:flex;gap:6px">
      <button class="btn-p" style="font-size:11px" onclick="_guardarEdicionTarea('${id}')">Guardar</button>
      <button class="btn-s" style="font-size:11px" onclick="document.getElementById('tarea-edit-form-${id}').style.display='none'">Cancelar</button>
    </div>`;
  document.getElementById(`tarea-edit-inp-${id}`)?.focus();
  document.getElementById(`tarea-edit-inp-${id}`)?.select();
}

async function _guardarEdicionTarea(id) {
  const texto = document.getElementById(`tarea-edit-inp-${id}`)?.value?.trim();
  if (!texto) { mostrarToast('El texto no puede estar vacío.', 'error'); return; }
  const { error } = await sb.from('tareas_usuario').update({ texto, actualizado_en: new Date().toISOString() }).eq('id', id);
  if (error) { mostrarToast('Error al guardar.', 'error'); return; }
  mostrarToast('Tarea actualizada.', 'ok');
  _renderTareasDash().catch(() => {});
}

function _moverFechaTarea(id, fechaActual) {
  _cerrarFormsInline(id);
  const cont = document.getElementById(`tarea-fecha-form-${id}`);
  if (!cont) return;
  cont.style.display = '';
  cont.innerHTML = `
    <div style="font-size:11px;font-weight:600;color:var(--txt2);margin-bottom:6px">Cambiar fecha de vencimiento</div>
    <input type="date" id="tarea-fecha-inp-${id}" class="inp" value="${fechaActual || hoyISO()}" style="width:auto;margin-bottom:8px">
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn-p" style="font-size:11px" onclick="_guardarFechaTarea('${id}',false)">Guardar</button>
      ${fechaActual ? `<button class="btn-s" style="font-size:11px" onclick="_guardarFechaTarea('${id}',true)">Sin fecha</button>` : ''}
      <button class="btn-s" style="font-size:11px" onclick="document.getElementById('tarea-fecha-form-${id}').style.display='none'">Cancelar</button>
    </div>`;
}

async function _guardarFechaTarea(id, limpiar) {
  const fecha = limpiar ? null : (document.getElementById(`tarea-fecha-inp-${id}`)?.value || null);
  const { error } = await sb.from('tareas_usuario').update({ fecha_vencimiento: fecha, actualizado_en: new Date().toISOString() }).eq('id', id);
  if (error) { mostrarToast('Error al guardar.', 'error'); return; }
  mostrarToast('Fecha actualizada.', 'ok');
  _renderTareasDash().catch(() => {});
}

function _agregarObsTask(id) {
  _cerrarFormsInline(id);
  const cont = document.getElementById(`tarea-obs-form-${id}`);
  if (!cont) return;
  cont.style.display = '';
  cont.innerHTML = `
    <textarea id="tarea-obs-ta-${id}" class="inp" rows="3" style="width:100%;margin-bottom:6px;font-size:13px;resize:vertical" placeholder="Observación..."></textarea>
    <div style="display:flex;gap:6px">
      <button class="btn-p" style="font-size:11px" onclick="_guardarObsTarea('${id}')">Guardar</button>
      <button class="btn-s" style="font-size:11px" onclick="document.getElementById('tarea-obs-form-${id}').style.display='none'">Cancelar</button>
    </div>`;
  // Pre-cargar observación actual desde la BD en background
  sb.from('tareas_usuario').select('observacion').eq('id', id).single().then(({ data }) => {
    const ta = document.getElementById(`tarea-obs-ta-${id}`);
    if (ta && data?.observacion) ta.value = data.observacion;
    ta?.focus();
  });
}

async function _guardarObsTarea(id) {
  const obs = document.getElementById(`tarea-obs-ta-${id}`)?.value?.trim() || null;
  const { error } = await sb.from('tareas_usuario').update({ observacion: obs, actualizado_en: new Date().toISOString() }).eq('id', id);
  if (error) { mostrarToast('Error al guardar.', 'error'); return; }
  mostrarToast('Observación guardada.', 'ok');
  _renderTareasDash().catch(() => {});
}

// ── FORM NUEVA TAREA (dashboard) ──────────────────────

function _toggleFormNuevaTarea() {
  const cont = document.getElementById('form-nueva-tarea');
  if (!cont) return;
  const isHidden = cont.style.display === 'none';
  if (isHidden) {
    cont.style.display = '';
    cont.innerHTML = _htmlFormNuevaTarea();
    document.getElementById('nueva-tarea-texto')?.focus();
  } else {
    cont.style.display = 'none';
    cont.innerHTML = '';
    window._tareaAlumnosCache = null;
  }
}

function _htmlFormNuevaTarea() {
  return `
    <div class="card" style="padding:14px;border:1px solid var(--verde);box-shadow:0 0 0 3px var(--verde-l)">
      <div style="font-size:11px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Nueva tarea</div>
      <input type="text" id="nueva-tarea-texto" class="inp" placeholder="¿Qué tenés que hacer?" style="width:100%;margin-bottom:8px;font-size:13px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div>
          <div style="font-size:10px;font-weight:600;color:var(--txt2);margin-bottom:3px;text-transform:uppercase">Fecha</div>
          <input type="date" id="nueva-tarea-fecha" class="inp" value="${hoyISO()}" style="width:100%">
        </div>
        <div>
          <div style="font-size:10px;font-weight:600;color:var(--txt2);margin-bottom:3px;text-transform:uppercase">Vincular a</div>
          <select id="nueva-tarea-ctx" class="inp" style="width:100%" onchange="_onCtxTipoChange(this.value)">
            <option value="general">Sin vínculo</option>
            <option value="alumno">Alumno</option>
            <option value="problematica">Problemática</option>
          </select>
        </div>
      </div>
      <div id="nueva-tarea-ctx-cont" style="margin-bottom:8px;display:none"></div>
      <textarea id="nueva-tarea-obs" class="inp" placeholder="Observación (opcional)" rows="2" style="width:100%;resize:vertical;margin-bottom:10px;font-size:13px"></textarea>
      <div style="display:flex;gap:6px;justify-content:flex-end">
        <button class="btn-s" onclick="_toggleFormNuevaTarea()">Cancelar</button>
        <button class="btn-p" onclick="_guardarNuevaTarea()">Guardar tarea</button>
      </div>
    </div>`;
}

async function _onCtxTipoChange(tipo) {
  const cont = document.getElementById('nueva-tarea-ctx-cont');
  if (!cont) return;
  if (tipo === 'general') { cont.style.display = 'none'; cont.innerHTML = ''; return; }
  cont.style.display = '';
  if (tipo === 'alumno') {
    cont.innerHTML = `
      <div style="font-size:10px;font-weight:600;color:var(--txt2);margin-bottom:3px;text-transform:uppercase">Alumno</div>
      <div style="position:relative">
        <input type="text" id="tarea-alumno-q" class="inp" placeholder="Buscar por apellido..." style="width:100%" oninput="_buscarAlumnosTask(this.value)">
        <div id="tarea-alumno-sugg" class="tarea-alumno-sugg" style="display:none"></div>
      </div>
      <input type="hidden" id="tarea-alumno-id">
      <div id="tarea-alumno-sel" style="font-size:11px;color:var(--verde);margin-top:4px;display:none"></div>`;
  } else if (tipo === 'problematica') {
    cont.innerHTML = `<div style="font-size:11px;color:var(--txt2)">Cargando...</div>`;
    const { data: probs } = await sb.from('problematicas')
      .select('id, alumno:alumnos(nombre,apellido), descripcion')
      .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
      .in('estado', ['abierta','en_seguimiento'])
      .order('created_at', { ascending: false }).limit(40);
    const opts = (probs || []).map(p => {
      const nom = p.alumno ? `${p.alumno.apellido}, ${p.alumno.nombre}` : (p.descripcion?.slice(0,40) || 'Sin detalle');
      return `<option value="${p.id}" data-label="${_escT(nom)}">${_escT(nom)}</option>`;
    }).join('');
    cont.innerHTML = `
      <div style="font-size:10px;font-weight:600;color:var(--txt2);margin-bottom:3px;text-transform:uppercase">Problemática</div>
      <select id="tarea-prob-sel" class="inp" style="width:100%">
        <option value="">— Seleccioná una —</option>${opts}
      </select>`;
  }
}

async function _buscarAlumnosTask(q) {
  const sugg = document.getElementById('tarea-alumno-sugg');
  if (!sugg) return;
  const query = (q || '').trim();
  if (query.length < 2) { sugg.style.display = 'none'; return; }

  if (!window._tareaAlumnosCache) {
    const { data } = await sb.from('alumnos')
      .select('id, nombre, apellido, cursos(nombre, division)')
      .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
      .eq('activo', true)
      .order('apellido').limit(300);
    window._tareaAlumnosCache = data || [];
  }

  const ql = query.toLowerCase();
  const matches = window._tareaAlumnosCache
    .filter(a => `${a.apellido} ${a.nombre}`.toLowerCase().includes(ql))
    .slice(0, 8);

  if (!matches.length) { sugg.style.display = 'none'; return; }
  sugg.style.display = '';
  sugg.innerHTML = matches.map(a => {
    const cur = a.cursos ? `${a.cursos.nombre}${a.cursos.division ? ' ' + a.cursos.division : ''}` : '';
    const label = `${a.apellido}, ${a.nombre}${cur ? ' · ' + cur : ''}`;
    return `<div class="tarea-alumno-opt" onclick="_selAlumnoTask('${a.id}','${_escT(label)}')">${_escT(label)}</div>`;
  }).join('');
}

function _selAlumnoTask(id, labelEsc) {
  const label = labelEsc.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
  const hiddenId = document.getElementById('tarea-alumno-id');
  const sugg     = document.getElementById('tarea-alumno-sugg');
  const qInp     = document.getElementById('tarea-alumno-q');
  const selDiv   = document.getElementById('tarea-alumno-sel');
  if (hiddenId) hiddenId.value   = id;
  if (qInp)    qInp.value       = label;
  if (sugg)    sugg.style.display = 'none';
  if (selDiv)  { selDiv.style.display = ''; selDiv.textContent = '✓ ' + label; }
}

async function _guardarNuevaTarea() {
  const texto = document.getElementById('nueva-tarea-texto')?.value?.trim();
  if (!texto) { mostrarToast('Escribí una descripción para la tarea.', 'error'); return; }

  const fecha   = document.getElementById('nueva-tarea-fecha')?.value || null;
  const obs     = document.getElementById('nueva-tarea-obs')?.value?.trim() || null;
  const ctxTipo = document.getElementById('nueva-tarea-ctx')?.value || 'general';

  let contexto_tipo  = ctxTipo === 'general' ? null : ctxTipo;
  let contexto_id    = null;
  let contexto_label = null;

  if (ctxTipo === 'alumno') {
    contexto_id = document.getElementById('tarea-alumno-id')?.value || null;
    contexto_label = document.getElementById('tarea-alumno-q')?.value?.trim() || null;
    if (!contexto_id) { mostrarToast('Seleccioná un alumno de la lista.', 'error'); return; }
  } else if (ctxTipo === 'problematica') {
    const sel = document.getElementById('tarea-prob-sel');
    contexto_id = sel?.value || null;
    contexto_label = sel?.selectedOptions[0]?.text || null;
    if (!contexto_id) { mostrarToast('Seleccioná una problemática.', 'error'); return; }
  }

  const btn = document.querySelector('#form-nueva-tarea .btn-p');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  const { error } = await sb.from('tareas_usuario').insert({
    usuario_id: USUARIO_ACTUAL.id,
    institucion_id: USUARIO_ACTUAL.institucion_id,
    texto,
    fecha_vencimiento: fecha || null,
    observacion: obs,
    contexto_tipo,
    contexto_id,
    contexto_label,
    estado: 'pendiente',
  });

  if (error) {
    mostrarToast('Error al guardar. Intentá de nuevo.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar tarea'; }
    return;
  }

  window._tareaAlumnosCache = null;
  mostrarToast('Tarea guardada.', 'ok');
  const formCont = document.getElementById('form-nueva-tarea');
  if (formCont) { formCont.style.display = 'none'; formCont.innerHTML = ''; }
  _renderTareasDash().catch(() => {});
}

// ── TAREA DESDE PROBLEMÁTICA ──────────────────────────

function _crearTareaDesdeProb(probId) {
  const cont = document.getElementById(`tarea-prob-form-${probId}`);
  if (!cont) return;
  const isHidden = cont.style.display === 'none' || cont.style.display === '';
  if (cont.innerHTML && !isHidden) { cont.innerHTML = ''; return; }

  const probLabel = (window._probLabelsForTareas || {})[probId] || 'Situación problemática';
  const manana = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })();

  cont.innerHTML = `
    <div style="background:var(--surf2);border-radius:var(--rad);padding:12px;border:1px solid var(--brd);margin-top:8px">
      <div style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Crear tarea relacionada</div>
      <div style="font-size:11px;color:var(--txt2);margin-bottom:6px">📎 ${_escT(probLabel)}</div>
      <input type="text" id="tp-texto-${probId}" class="inp" placeholder="Descripción de la tarea..." style="width:100%;margin-bottom:6px;font-size:12px">
      <input type="date" id="tp-fecha-${probId}" class="inp" value="${manana}" style="width:auto;margin-bottom:8px">
      <div style="display:flex;gap:6px">
        <button class="btn-p" style="font-size:11px" onclick="_guardarTareaDesdeProb('${probId}')">Guardar</button>
        <button class="btn-s" style="font-size:11px" onclick="document.getElementById('tarea-prob-form-${probId}').innerHTML=''">Cancelar</button>
      </div>
    </div>`;
  document.getElementById(`tp-texto-${probId}`)?.focus();
}

async function _guardarTareaDesdeProb(probId) {
  const texto = document.getElementById(`tp-texto-${probId}`)?.value?.trim();
  if (!texto) { mostrarToast('Escribí una descripción.', 'error'); return; }
  const fecha     = document.getElementById(`tp-fecha-${probId}`)?.value || null;
  const probLabel = (window._probLabelsForTareas || {})[probId] || 'Situación problemática';

  const { error } = await sb.from('tareas_usuario').insert({
    usuario_id:      USUARIO_ACTUAL.id,
    institucion_id:  USUARIO_ACTUAL.institucion_id,
    texto,
    fecha_vencimiento: fecha || null,
    contexto_tipo:   'problematica',
    contexto_id:     probId,
    contexto_label:  probLabel,
    estado:          'pendiente',
  });

  if (error) { mostrarToast('Error al guardar.', 'error'); return; }
  mostrarToast('Tarea guardada.', 'ok');
  const cont = document.getElementById(`tarea-prob-form-${probId}`);
  if (cont) cont.innerHTML = '';
}

// ── TAREA RÁPIDA DESDE AGENDA ─────────────────────────

function _mostrarFormTareaAgenda() {
  const cont = document.getElementById('tarea-agenda-form');
  if (!cont) return;
  const isOpen = cont.style.display !== 'none' && cont.innerHTML;
  if (isOpen) { cont.style.display = 'none'; cont.innerHTML = ''; return; }

  const fechaDef = (typeof AGENDA_DIA_SEL !== 'undefined' && AGENDA_DIA_SEL) || hoyISO();
  cont.style.display = '';
  cont.innerHTML = `
    <div class="card" style="padding:14px;border:1px solid var(--verde);box-shadow:0 0 0 3px var(--verde-l);margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Tarea rápida</div>
      <input type="text" id="tarea-ag-texto" class="inp" placeholder="¿Qué tenés que hacer?" style="width:100%;margin-bottom:6px;font-size:13px">
      <input type="date" id="tarea-ag-fecha" class="inp" value="${fechaDef}" style="width:auto;margin-bottom:10px">
      <div style="display:flex;gap:6px;justify-content:flex-end">
        <button class="btn-s" onclick="document.getElementById('tarea-agenda-form').style.display='none';document.getElementById('tarea-agenda-form').innerHTML=''">Cancelar</button>
        <button class="btn-p" onclick="_guardarTareaAgenda()">Guardar</button>
      </div>
    </div>`;
  document.getElementById('tarea-ag-texto')?.focus();
}

async function _guardarTareaAgenda() {
  const texto = document.getElementById('tarea-ag-texto')?.value?.trim();
  if (!texto) { mostrarToast('Escribí una descripción.', 'error'); return; }
  const fecha = document.getElementById('tarea-ag-fecha')?.value || hoyISO();

  const { error } = await sb.from('tareas_usuario').insert({
    usuario_id:      USUARIO_ACTUAL.id,
    institucion_id:  USUARIO_ACTUAL.institucion_id,
    texto,
    fecha_vencimiento: fecha,
    estado:          'pendiente',
  });

  if (error) { mostrarToast('Error al guardar.', 'error'); return; }
  mostrarToast('Tarea guardada.', 'ok');
  const cont = document.getElementById('tarea-agenda-form');
  if (cont) { cont.style.display = 'none'; cont.innerHTML = ''; }
}

// ── PÁGINA COMPLETA (placeholder) ────────────────────

async function rTareas() {
  const pg = document.getElementById('page-tareas');
  if (!pg) return;
  _inyectarEstilosTareas();

  showLoading('tareas');
  const hoy = hoyISO();
  const { data: tareas } = await sb
    .from('tareas_usuario')
    .select('*')
    .eq('usuario_id', USUARIO_ACTUAL.id)
    .eq('estado', 'pendiente')
    .order('fecha_vencimiento', { ascending: true, nullsFirst: false });

  pg.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div class="pg-t" style="margin:0">Mis tareas</div>
      <button class="btn-p" style="font-size:12px" onclick="_toggleFormNuevaTareaPg()">+ Nueva tarea</button>
    </div>
    <div id="form-nueva-tarea-pg" style="display:none;margin-bottom:14px"></div>
    <div id="tareas-pg-lista">
      ${_renderTareasPanelHTML(tareas || [], hoy).replace('id="form-nueva-tarea"','id="form-nueva-tarea-dummy"')}
    </div>`;
}

function _toggleFormNuevaTareaPg() {
  const cont = document.getElementById('form-nueva-tarea-pg');
  if (!cont) return;
  const isHidden = cont.style.display === 'none';
  if (isHidden) {
    cont.style.display = '';
    cont.innerHTML = _htmlFormNuevaTarea().replace('id="form-nueva-tarea"','id="form-nueva-tarea-pg-inner"')
      .replace("_toggleFormNuevaTarea()","_toggleFormNuevaTareaPg()")
      .replace("_guardarNuevaTarea()","_guardarNuevaTareaPg()");
    cont.querySelector('input')?.focus();
  } else {
    cont.style.display = 'none';
    cont.innerHTML = '';
  }
}

async function _guardarNuevaTareaPg() {
  await _guardarNuevaTarea();
  rTareas();
}
