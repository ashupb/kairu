// =====================================================
// MENSAJES.JS — Canal directo familia ↔ institución
// =====================================================

let _MSG_DATA = [];

const _MSG_ROL_LABEL = {
  director_general: 'Director/a',
  directivo_nivel:  'Directivo/a',
  preceptor:        'Preceptor/a',
  docente:          'Docente',
  eoe:              'EOE',
};

async function rMensajes() {
  showLoading('mensajes');
  const el = document.getElementById('page-mensajes');

  if (!ALUMNO_ACTUAL) {
    el.innerHTML = `
      <div class="page-body">
        <div class="alert-card alert-warning">
          <p>No tenés alumnos vinculados. Contactá a la institución para configurar tu acceso.</p>
        </div>
      </div>`;
    return;
  }

  try {
    const { data, error } = await sb
      .from('mensajes_familia')
      .select('id, enviado_por_id, enviado_por_tipo, parent_id, cuerpo, leido_familia, leido_institucion, requiere_respuesta, created_at, remitente:enviado_por_id(nombre_completo, rol)')
      .eq('alumno_id', ALUMNO_ACTUAL.id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    _MSG_DATA = data || [];

    const precId     = ALUMNO_ACTUAL.cursos?.preceptor_id;
    const precNombre = ALUMNO_ACTUAL.cursos?.preceptor?.nombre_completo;

    el.innerHTML = `
      <div class="page-body">
        <div class="page-header">
          <h1 class="page-title">Mensajes</h1>
        </div>
        <p class="empty-msg" style="text-align:left;padding:0 0 4px">
          Canal formal de comunicación con la institución sobre ${ALUMNO_ACTUAL.nombre_completo}.
        </p>
        <div class="card">
          <div class="msg-thread" id="msg-thread">
            ${_renderMsgThread()}
          </div>
        </div>
        <div class="card" id="msg-nuevo-wrap">
          ${precId
            ? `<button class="btn-visto" id="msg-nuevo-btn" onclick="_msgAbrirNuevo()">+ Nuevo mensaje</button>
               <div id="msg-nuevo-form"></div>`
            : `<p class="empty-msg">Tu curso todavía no tiene un preceptor asignado. Contactá a la institución directamente.</p>`}
        </div>
      </div>`;

    const thread = document.getElementById('msg-thread');
    if (thread) thread.scrollTop = thread.scrollHeight;

  } catch (e) {
    el.innerHTML = `
      <div class="page-body">
        <div class="alert-card alert-danger">
          <p>No se pudieron cargar los mensajes. Intentá de nuevo.</p>
        </div>
      </div>`;
  }
}

function _renderMsgThread() {
  if (!_MSG_DATA.length) return '<p class="empty-msg">Todavía no hay mensajes con la institución.</p>';
  const roots = _MSG_DATA.filter(m => !m.parent_id);
  const childMap = {};
  _MSG_DATA.filter(m => m.parent_id).forEach(m => {
    if (!childMap[m.parent_id]) childMap[m.parent_id] = [];
    childMap[m.parent_id].push(m);
  });
  return roots.map(m => {
    const replies = childMap[m.id] || [];
    const repliesHtml = replies.length
      ? `<div class="msg-replies">${replies.map(_msgBubbleFam).join('')}</div>`
      : '';
    return _msgBubbleFam(m) + repliesHtml;
  }).join('');
}

function _msgBubbleFam(m) {
  const esInst = m.enviado_por_tipo === 'institucion';
  const fecha  = fechaRelativa(m.created_at);

  if (esInst) {
    const autor   = m.remitente?.nombre_completo || 'Institución';
    const rolLbl  = _MSG_ROL_LABEL[m.remitente?.rol] || '';
    return `
      <div class="msg-bubble msg-bubble--inst" id="msg-bubble-${m.id}">
        <div class="msg-meta">
          <span class="msg-autor">${_escMsg(autor)}${rolLbl ? ' · ' + rolLbl : ''}</span>
          <span class="msg-fecha">${fecha}</span>
        </div>
        <p class="msg-cuerpo">${_escMsg(m.cuerpo).replace(/\n/g, '<br>')}</p>
        ${m.requiere_respuesta ? '<span class="badge badge-warning" style="margin-top:6px">Requiere tu respuesta</span>' : ''}
        <div class="msg-acciones">
          ${m.requiere_respuesta
            ? `<button class="msg-btn" onclick="_msgResponder('${m.id}')">↩ Responder</button>`
            : ''}
          ${m.leido_familia
            ? '<span class="msg-visto-lbl">✓ Marcado como leído</span>'
            : `<button class="msg-btn msg-btn--ghost" onclick="_msgMarcarLeido('${m.id}', this)">👁 Marcar como leído</button>`}
        </div>
        <div id="msg-reply-${m.id}"></div>
      </div>`;
  }

  return `
    <div class="msg-bubble msg-bubble--fam">
      <div class="msg-meta">
        <span class="msg-autor">Vos</span>
        <span class="msg-fecha">${fecha}</span>
      </div>
      <p class="msg-cuerpo">${_escMsg(m.cuerpo).replace(/\n/g, '<br>')}</p>
      <div class="msg-estado">${m.leido_institucion ? 'Leído por la institución' : 'Enviado'}</div>
    </div>`;
}

// ── Responder a un mensaje puntual (va dirigido a quien lo envió) ──
function _msgResponder(mensajeId) {
  const wrap = document.getElementById('msg-reply-' + mensajeId);
  if (!wrap) return;
  if (wrap.innerHTML) { wrap.innerHTML = ''; return; }

  const orig  = _MSG_DATA.find(m => m.id === mensajeId);
  const autor = orig?.remitente?.nombre_completo || 'Institución';

  wrap.innerHTML = `
    <div class="msg-form">
      <p class="msg-form-to">Respondiendo a: <strong>${_escMsg(autor)}</strong></p>
      <textarea id="msg-reply-txt-${mensajeId}" rows="2" placeholder="Escribí tu respuesta..."></textarea>
      <div class="msg-form-actions">
        <button class="btn-primary" style="padding:8px 16px;font-size:12px" onclick="_msgEnviarRespuesta('${mensajeId}')">Enviar</button>
        <button class="msg-btn msg-btn--ghost" onclick="document.getElementById('msg-reply-${mensajeId}').innerHTML=''">Cancelar</button>
      </div>
    </div>`;
}

async function _msgEnviarRespuesta(mensajeId) {
  const orig = _MSG_DATA.find(m => m.id === mensajeId);
  if (!orig) return;
  const ta = document.getElementById('msg-reply-txt-' + mensajeId);
  const cuerpo = ta?.value.trim();
  if (!cuerpo) return;

  const { error } = await sb.from('mensajes_familia').insert({
    institucion_id:   USUARIO_FAMILIAR.institucion_id,
    alumno_id:        ALUMNO_ACTUAL.id,
    enviado_por_id:   null,
    enviado_por_tipo: 'familia',
    destinatario_id:  orig.enviado_por_id,
    parent_id:        mensajeId,
    cuerpo,
  });
  if (error) { alert('No se pudo enviar el mensaje. Intentá de nuevo.'); return; }

  if (!orig.leido_familia) {
    await sb.from('mensajes_familia')
      .update({ leido_familia: true, leido_familia_en: new Date().toISOString() })
      .eq('id', mensajeId);
  }

  await rMensajes();
  fetchMsgUnreadCount();
}

// ── Marcar como leído sin responder (acuse de recibo) ──────────────
async function _msgMarcarLeido(mensajeId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  const { error } = await sb.from('mensajes_familia')
    .update({ leido_familia: true, leido_familia_en: new Date().toISOString() })
    .eq('id', mensajeId);

  if (error) {
    if (btn) { btn.disabled = false; btn.textContent = '👁 Marcar como leído'; }
    return;
  }
  if (btn) btn.outerHTML = '<span class="msg-visto-lbl">✓ Marcado como leído</span>';
  fetchMsgUnreadCount();
}

// ── Nuevo mensaje (siempre dirigido al preceptor del curso) ────────
function _msgAbrirNuevo() {
  const wrap = document.getElementById('msg-nuevo-form');
  if (!wrap) return;
  if (wrap.innerHTML) { wrap.innerHTML = ''; return; }

  const precNombre = ALUMNO_ACTUAL.cursos?.preceptor?.nombre_completo || 'Preceptor/a del curso';

  wrap.innerHTML = `
    <div class="msg-form" style="margin-top:10px">
      <p class="msg-form-to">Enviando a: <strong>Preceptor/a — ${_escMsg(precNombre)}</strong></p>
      <textarea id="msg-nuevo-txt" rows="3" placeholder="Escribí tu mensaje..."></textarea>
      <div class="msg-form-actions">
        <button class="btn-primary" style="padding:8px 16px;font-size:12px" onclick="_msgEnviarNuevo()">Enviar</button>
        <button class="msg-btn msg-btn--ghost" onclick="document.getElementById('msg-nuevo-form').innerHTML=''">Cancelar</button>
      </div>
    </div>`;
}

async function _msgEnviarNuevo() {
  const ta = document.getElementById('msg-nuevo-txt');
  const cuerpo = ta?.value.trim();
  if (!cuerpo) return;

  const precId = ALUMNO_ACTUAL.cursos?.preceptor_id;
  if (!precId) { alert('Tu curso no tiene un preceptor asignado.'); return; }

  const { error } = await sb.from('mensajes_familia').insert({
    institucion_id:   USUARIO_FAMILIAR.institucion_id,
    alumno_id:        ALUMNO_ACTUAL.id,
    enviado_por_id:   null,
    enviado_por_tipo: 'familia',
    destinatario_id:  precId,
    cuerpo,
  });
  if (error) { alert('No se pudo enviar el mensaje. Intentá de nuevo.'); return; }

  await rMensajes();
}

// ── Badge de no leídos (nav) ────────────────────────────────────────
async function fetchMsgUnreadCount() {
  if (!USUARIO_FAMILIAR || !ALUMNO_ACTUAL) return;
  try {
    const { data } = await sb.from('mensajes_familia')
      .select('id')
      .eq('alumno_id', ALUMNO_ACTUAL.id)
      .eq('enviado_por_tipo', 'institucion')
      .eq('leido_familia', false);
    MSG_UNREAD_COUNT = (data || []).length;
    renderSidebarNav();
    updateSidebarActive(CUR_PAGE);
  } catch (_) {}
}

function _escMsg(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
