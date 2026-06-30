// =====================================================
// MENSAJES_INTERNA.JS — Hub de mensajes familia ↔ institución
// =====================================================

let _MSGFAM_CURSOS  = [];
let _MSGFAM_ALUMNOS = [];
let _MSGFAM_RESUMEN = {};    // { alumno_id: { last, unread } }
let _MSGFAM_F_CURSO = '';
let _MSGFAM_F_NOMBRE = '';

async function rMsgFam() {
  showLoading('msgfam');
  const el = document.getElementById('page-msgfam');
  if (!el) return;

  try {
    _MSGFAM_CURSOS = await _mfiGetCursos();
    const cursoIds = _MSGFAM_CURSOS.map(c => c.id);

    if (!cursoIds.length) {
      el.innerHTML = `<div class="page-inner"><div class="empty-state">No tenés cursos asignados.</div></div>`;
      return;
    }

    const { data: alumnos } = await sb.from('alumnos')
      .select('id, nombre, apellido, curso_id')
      .in('curso_id', cursoIds)
      .eq('activo', true)
      .order('apellido');
    _MSGFAM_ALUMNOS = alumnos || [];

    const alumnoIds = _MSGFAM_ALUMNOS.map(a => a.id);
    let msgRows = [];
    if (alumnoIds.length) {
      const { data } = await sb.from('mensajes_familia')
        .select('alumno_id, enviado_por_tipo, cuerpo, leido_institucion, created_at')
        .in('alumno_id', alumnoIds)
        .order('created_at', { ascending: false });
      msgRows = data || [];
    }

    // Agrupar: last message + unread count por alumno
    _MSGFAM_RESUMEN = {};
    msgRows.forEach(m => {
      if (!_MSGFAM_RESUMEN[m.alumno_id]) _MSGFAM_RESUMEN[m.alumno_id] = { last: m, unread: 0 };
      if (m.enviado_por_tipo === 'familia' && !m.leido_institucion) _MSGFAM_RESUMEN[m.alumno_id].unread++;
    });

    _MSGFAM_F_CURSO  = '';
    _MSGFAM_F_NOMBRE = '';
    _mfiRender(el);

  } catch (e) {
    el.innerHTML = `<div class="page-inner"><div class="card"><p class="empty-state">Error al cargar mensajes. Intentá de nuevo.</p></div></div>`;
  }
}

async function _mfiGetCursos() {
  const rol  = USUARIO_ACTUAL.rol;
  const inst = USUARIO_ACTUAL.institucion_id;
  const base = sb.from('cursos').select('id,nombre,division,nivel,anio').eq('activo', true);

  if (['director_general', 'eoe'].includes(rol)) {
    const { data } = await base.eq('institucion_id', inst).order('nivel').order('anio');
    return data || [];
  }
  if (rol === 'directivo_nivel') {
    const { data } = await base.eq('institucion_id', inst).eq('nivel', USUARIO_ACTUAL.nivel).order('anio');
    return data || [];
  }
  if (rol === 'preceptor') {
    const { data } = await base.eq('institucion_id', inst).eq('preceptor_id', USUARIO_ACTUAL.id);
    return data || [];
  }
  if (rol === 'docente') {
    const { data: asigs } = await sb.from('asignaciones')
      .select('curso_id').eq('docente_id', USUARIO_ACTUAL.id).eq('anio_lectivo', new Date().getFullYear());
    const ids = [...new Set((asigs || []).map(a => a.curso_id))];
    if (!ids.length) return [];
    const { data } = await base.in('id', ids);
    return data || [];
  }
  return [];
}

function _mfiRender(el) {
  const opts = _MSGFAM_CURSOS.map(c =>
    `<option value="${c.id}" ${_MSGFAM_F_CURSO === c.id ? 'selected' : ''}>${_mfiNombreCurso(c)}</option>`
  ).join('');

  let lista = _MSGFAM_ALUMNOS;
  if (_MSGFAM_F_CURSO)  lista = lista.filter(a => a.curso_id === _MSGFAM_F_CURSO);
  if (_MSGFAM_F_NOMBRE) {
    const q = _MSGFAM_F_NOMBRE.toLowerCase();
    lista = lista.filter(a => (a.nombre + ' ' + a.apellido).toLowerCase().includes(q));
  }

  const conMsgs = lista.filter(a => _MSGFAM_RESUMEN[a.id]);
  const totalUnread = Object.values(_MSGFAM_RESUMEN).reduce((s, t) => s + t.unread, 0);

  conMsgs.sort((a, b) => {
    const ua = _MSGFAM_RESUMEN[a.id]?.unread || 0, ub = _MSGFAM_RESUMEN[b.id]?.unread || 0;
    if (ua !== ub) return ub - ua;
    return new Date(_MSGFAM_RESUMEN[b.id]?.last?.created_at || 0) - new Date(_MSGFAM_RESUMEN[a.id]?.last?.created_at || 0);
  });

  el.innerHTML = `
    <div class="page-inner">
      <div class="page-hdr-row" style="margin-bottom:14px">
        <span class="section-title">Mensajes con familias</span>
        ${totalUnread > 0 ? `<span class="tag ta">${totalUnread} sin leer</span>` : ''}
      </div>
      <div class="mfi-filtros">
        <select class="inp-base" onchange="_mfiSetFiltroC(this.value)">
          <option value="">Todos los cursos</option>${opts}
        </select>
        <input class="inp-base" type="text" placeholder="Apellido o nombre…"
               value="${_esc(_MSGFAM_F_NOMBRE)}"
               oninput="_mfiSetFiltroN(this.value)">
      </div>
      ${conMsgs.length
        ? conMsgs.map(_mfiRowAlumno).join('')
        : `<div class="card" style="margin-top:12px">
             <p class="empty-state">
               ${_MSGFAM_F_CURSO || _MSGFAM_F_NOMBRE
                 ? 'No hay mensajes que coincidan con los filtros.'
                 : 'No hay mensajes de familias todavía.'}
             </p>
           </div>`}
    </div>`;
}

function _mfiRowAlumno(a) {
  const t      = _MSGFAM_RESUMEN[a.id];
  const curso  = _MSGFAM_CURSOS.find(c => c.id === a.curso_id);
  const cStr   = curso ? _mfiNombreCurso(curso) : '';
  const preview = t?.last ? _esc(t.last.cuerpo).substring(0, 72) + (t.last.cuerpo.length > 72 ? '…' : '') : '';
  const esFam  = t?.last?.enviado_por_tipo === 'familia';
  const ini    = (a.apellido[0] || '?').toUpperCase();

  return `
    <div class="card mfi-row" id="mfi-row-${a.id}">
      <div class="mfi-row-header" onclick="_mfiToggle('${a.id}','${_esc(a.nombre + ' ' + a.apellido)}')">
        <div class="mfi-av">${ini}</div>
        <div class="mfi-info">
          <div class="mfi-nombre">
            ${_esc(a.apellido + ', ' + a.nombre)}
            ${t?.unread ? `<span class="tag ta" style="font-size:9px;margin-left:6px">${t.unread} nuevo${t.unread > 1 ? 's' : ''}</span>` : ''}
          </div>
          <div class="mfi-meta">${_esc(cStr)}${t?.last ? ' · ' + _mfiRelativo(t.last.created_at) : ''}</div>
          ${preview ? `<div class="mfi-preview">${esFam ? '↑ ' : '↓ '}${preview}</div>` : ''}
        </div>
        <span class="mfi-chev">▼</span>
      </div>
      <div id="mfi-hilo-${a.id}" style="display:none"></div>
    </div>`;
}

async function _mfiToggle(alumnoId, nombre) {
  const wrap = document.getElementById('mfi-hilo-' + alumnoId);
  const chev = document.querySelector('#mfi-row-' + alumnoId + ' .mfi-chev');
  if (!wrap) return;

  // Cerrar otros
  document.querySelectorAll('[id^="mfi-hilo-"]').forEach(div => {
    if (div.id !== 'mfi-hilo-' + alumnoId && div.style.display !== 'none') {
      div.style.display = 'none';
      const otherId = div.id.replace('mfi-hilo-', '');
      const oc = document.querySelector('#mfi-row-' + otherId + ' .mfi-chev');
      if (oc) oc.textContent = '▼';
    }
  });

  if (wrap.style.display === 'block') {
    wrap.style.display = 'none';
    if (chev) chev.textContent = '▼';
    return;
  }

  wrap.style.display = 'block';
  if (chev) chev.textContent = '▲';
  wrap.innerHTML = '<div style="padding:14px;text-align:center;font-size:12px;color:var(--txt2)">Cargando…</div>';
  await _mfiCargarHilo(alumnoId, nombre, wrap);
}

async function _mfiCargarHilo(alumnoId, nombre, wrap) {
  const { data: msgs, error } = await sb.from('mensajes_familia')
    .select('id,enviado_por_id,enviado_por_tipo,parent_id,cuerpo,leido_familia,leido_institucion,requiere_respuesta,created_at,remitente:enviado_por_id(nombre_completo)')
    .eq('alumno_id', alumnoId)
    .order('created_at', { ascending: true });

  if (error) {
    wrap.innerHTML = '<p style="font-size:12px;color:var(--txt2);padding:14px">Error al cargar el hilo.</p>';
    return;
  }

  // Marcar como leídos del lado institución
  const sinLeer = (msgs || []).filter(m => m.enviado_por_tipo === 'familia' && !m.leido_institucion);
  if (sinLeer.length) {
    await sb.from('mensajes_familia')
      .update({ leido_institucion: true, leido_institucion_en: new Date().toISOString() })
      .in('id', sinLeer.map(m => m.id));
    sinLeer.forEach(m => { m.leido_institucion = true; });
    if (_MSGFAM_RESUMEN[alumnoId]) _MSGFAM_RESUMEN[alumnoId].unread = 0;
    fetchMsgFamUnread();
  }

  const canSend = ['preceptor','docente','eoe','director_general','directivo_nivel','admin'].includes(USUARIO_ACTUAL.rol);
  const threadHtml = _renderMsgFamThread(msgs || []);

  wrap.innerHTML = `
    <div style="border-top:1px solid var(--brd);padding:12px 14px">
      <div class="msgfam-thread" style="max-height:360px;overflow-y:auto" id="mfi-inner-${alumnoId}">${threadHtml}</div>
      ${canSend ? `
      <div style="margin-top:12px;border-top:1px solid var(--brd);padding-top:10px">
        <textarea id="mfi-txt-${alumnoId}" rows="2"
          placeholder="Escribir a la familia de ${_esc(nombre)}…"
          style="margin-bottom:8px"></textarea>
        <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--txt2);margin-bottom:8px">
          <input type="checkbox" id="mfi-req-${alumnoId}"> Requiere respuesta
        </label>
        <div style="display:flex;gap:10px;align-items:center">
          <button class="btn-p" style="font-size:11px"
            onclick="_mfiEnviar('${alumnoId}','${_esc(nombre)}')">Enviar</button>
          <button class="btn-s" style="font-size:11px"
            onclick="goPage('leg')">Ver legajo →</button>
        </div>
      </div>` : ''}
    </div>`;

  const inner = document.getElementById('mfi-inner-' + alumnoId);
  if (inner) inner.scrollTop = inner.scrollHeight;
}

async function _mfiEnviar(alumnoId, nombre) {
  const ta     = document.getElementById('mfi-txt-' + alumnoId);
  const cuerpo = ta?.value.trim();
  if (!cuerpo) { alert('Escribí un mensaje antes de enviar.'); return; }
  const requiere = document.getElementById('mfi-req-' + alumnoId)?.checked || false;

  const { error } = await sb.from('mensajes_familia').insert({
    institucion_id:     USUARIO_ACTUAL.institucion_id,
    alumno_id:          alumnoId,
    enviado_por_id:     USUARIO_ACTUAL.id,
    enviado_por_tipo:   'institucion',
    destinatario_id:    null,
    cuerpo,
    requiere_respuesta: requiere,
  });

  if (error) { alert('Error al enviar: ' + error.message); return; }

  const wrap = document.getElementById('mfi-hilo-' + alumnoId);
  if (wrap) await _mfiCargarHilo(alumnoId, nombre, wrap);
}

function _mfiSetFiltroC(val) {
  _MSGFAM_F_CURSO = val;
  _mfiRender(document.getElementById('page-msgfam'));
}

function _mfiSetFiltroN(val) {
  _MSGFAM_F_NOMBRE = val;
  _mfiRender(document.getElementById('page-msgfam'));
}

function _mfiNombreCurso(c) {
  const nv = { inicial: 'Inicial', primario: 'Primario', secundario: 'Secundario' };
  return `${c.nombre}${c.division ? ' ' + c.division : ''} · ${nv[c.nivel] || c.nivel}`;
}

function _mfiRelativo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso);
  if (diff < 60000)    return 'Ahora';
  if (diff < 3600000)  return Math.floor(diff / 60000) + ' min';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' h';
  if (diff < 604800000) return Math.floor(diff / 86400000) + ' d';
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

// ── Badge: mensajes de familia no leídos ──────────────────────────
async function fetchMsgFamUnread() {
  if (!USUARIO_ACTUAL) return;
  try {
    const rol = USUARIO_ACTUAL.rol;
    let q = sb.from('mensajes_familia')
      .select('id', { count: 'exact', head: true })
      .eq('enviado_por_tipo', 'familia')
      .eq('leido_institucion', false);

    if (!['director_general', 'directivo_nivel', 'eoe'].includes(rol)) {
      q = q.eq('destinatario_id', USUARIO_ACTUAL.id);
    }

    const { count } = await q;
    MSG_FAM_UNREAD = count || 0;
    renderNav();
  } catch (_) {}
}

// ── Abrir hilo desde notificación ─────────────────────────────────
async function _mfiAbrirDesdeNotif(mensajeId) {
  const { data } = await sb.from('mensajes_familia').select('alumno_id').eq('id', mensajeId).single();
  if (data?.alumno_id) {
    const a = _MSGFAM_ALUMNOS.find(x => x.id === data.alumno_id);
    if (a) _mfiToggle(a.id, a.nombre + ' ' + a.apellido);
  }
}
