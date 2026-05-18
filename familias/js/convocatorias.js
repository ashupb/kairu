// =====================================================
// CONVOCATORIAS.JS — Citas individuales para familias
// =====================================================

let _CONV_DATA = [];

async function rConvocatorias() {
  showLoading('convocatorias');
  const el       = document.getElementById('page-convocatorias');
  const alumnoId = ALUMNO_ACTUAL?.id;

  if (!alumnoId) {
    el.innerHTML = `
      <div class="page-body">
        <div class="page-header"><h1 class="page-title">Mis convocatorias</h1></div>
        <div class="card"><p class="empty-msg">No hay alumno seleccionado.</p></div>
      </div>`;
    return;
  }

  try {
    const { data, error } = await sb
      .from('eventos_institucionales')
      .select('id, nombre, fecha_inicio, hora, hora_fin, lugar, descripcion, convocados_ids, creado_por, usuarios!creado_por(nombre_completo)')
      .eq('alumno_id', alumnoId)
      .eq('es_cita_individual', true)
      .order('fecha_inicio', { ascending: false })
      .limit(30);

    if (error) throw error;
    _CONV_DATA = data || [];

    let rsvpMap = {};
    if (_CONV_DATA.length) {
      const { data: rsvps } = await sb
        .from('evento_respuestas')
        .select('evento_id, respuesta, mensaje')
        .eq('usuario_id', USUARIO_FAMILIAR.id)
        .in('evento_id', _CONV_DATA.map(e => e.id));
      (rsvps || []).forEach(r => { rsvpMap[r.evento_id] = r; });
    }

    el.innerHTML = `
      <div class="page-body">
        <div class="page-header">
          <h1 class="page-title">Mis convocatorias</h1>
          <p style="font-size:12px;color:var(--color-text-medium);margin:4px 0 0">Citas para ${ALUMNO_ACTUAL.nombre_completo}</p>
        </div>
        ${_CONV_DATA.length === 0
          ? `<div class="card"><p class="empty-msg">No hay convocatorias para este alumno.</p></div>`
          : _CONV_DATA.map(e => _convCardHtml(e, rsvpMap[e.id])).join('')
        }
      </div>`;

  } catch (_) {
    el.innerHTML = `
      <div class="page-body">
        <div class="alert-card alert-danger">
          <p>No se pudieron cargar las convocatorias. Intentá de nuevo.</p>
        </div>
      </div>`;
  }
}

function _convCardHtml(e, rsvp) {
  const estado    = rsvp?.respuesta || 'pendiente';
  const msgActual = rsvp?.mensaje   || '';

  const ESTADO_CFG = {
    pendiente: { label: 'Pendiente de respuesta', color: '#b8963e', bg: '#fdf6e8' },
    acepta:    { label: '✓ Aceptada',             color: '#1a7a4a', bg: '#e8f5ee' },
    rechaza:   { label: '✗ Rechazada',            color: '#d63b2f', bg: '#fdf0ee' },
  };
  const cfg = ESTADO_CFG[estado] || ESTADO_CFG.pendiente;

  const horaTxt = e.hora
    ? `${e.hora.slice(0,5)}${e.hora_fin ? ' — '+e.hora_fin.slice(0,5) : ''}`
    : '';

  const fechaD = e.fecha_inicio ? new Date(e.fecha_inicio + 'T12:00:00') : null;
  const fechaTxt = fechaD
    ? fechaD.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  const organizador = e.usuarios?.nombre_completo || '';
  const yaPendiente = estado === 'pendiente';

  return `
    <div class="card com-text-card" id="conv-card-${e.id}" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
        <span style="font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px;background:${cfg.bg};color:${cfg.color}">${cfg.label}</span>
        <span class="com-fecha">${fechaTxt}</span>
      </div>

      <p class="com-titulo">${e.nombre}</p>

      <div style="display:flex;flex-direction:column;gap:4px;margin:8px 0;font-size:12px;color:var(--color-text-medium)">
        ${horaTxt     ? `<span>🕐 Horario propuesto: <strong>${horaTxt}</strong></span>` : ''}
        ${e.lugar     ? `<span>📍 ${e.lugar}</span>` : ''}
        ${organizador ? `<span>👤 Convocado por: ${organizador}</span>` : ''}
      </div>

      ${e.descripcion ? `<p style="font-size:12px;color:var(--color-text-medium);line-height:1.55;margin:8px 0;padding-top:8px;border-top:1px solid var(--color-border,rgba(0,0,0,0.07))">${e.descripcion}</p>` : ''}

      ${msgActual && estado !== 'pendiente' ? `
        <div style="margin:8px 0;padding:8px;background:var(--color-surface-2,#f5f5f5);border-radius:6px;font-size:11px;color:var(--color-text-medium);font-style:italic">
          Tu mensaje: "${msgActual}"
        </div>` : ''}

      <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--color-border,rgba(0,0,0,0.07))">
        ${yaPendiente ? `
          <p style="font-size:11px;color:var(--color-text-medium);margin:0 0 8px">
            Podés aceptar o rechazar. Si necesitás otro horario, escribílo en el mensaje.
          </p>
          <textarea id="conv-msg-${e.id}" rows="2"
            style="width:100%;border:1.5px solid rgba(0,0,0,0.12);border-radius:8px;padding:8px 10px;font-size:12px;font-family:inherit;color:var(--color-dark);background:var(--color-white);resize:none;box-sizing:border-box;margin-bottom:8px;outline:none"
            placeholder="Mensaje opcional — ej: puedo el jueves a las 16hs..."></textarea>
          <div style="display:flex;gap:8px">
            <button onclick="_convResponder('${e.id}','acepta')"
              style="flex:1;padding:10px;border-radius:8px;border:none;background:var(--color-green,#229957);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">
              ✓ Acepto
            </button>
            <button onclick="_convResponder('${e.id}','rechaza')"
              style="flex:1;padding:10px;border-radius:8px;border:1.5px solid #d63b2f;background:transparent;color:#d63b2f;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">
              ✕ Rechazo
            </button>
          </div>` : `
          <button onclick="_convCambiarRespuesta('${e.id}')"
            style="font-size:11px;color:var(--color-green,#229957);background:none;border:none;cursor:pointer;padding:0;text-decoration:underline;font-family:inherit">
            Cambiar respuesta
          </button>`}
      </div>
    </div>`;
}

async function _convResponder(eventoId, respuesta) {
  const mensaje = document.getElementById(`conv-msg-${eventoId}`)?.value?.trim() || null;
  const card    = document.getElementById(`conv-card-${eventoId}`);
  card?.querySelectorAll('button').forEach(b => b.disabled = true);

  try {
    await sb.from('evento_respuestas').upsert(
      [{ evento_id: eventoId, usuario_id: USUARIO_FAMILIAR.id, respuesta, mensaje: mensaje || null }],
      { onConflict: 'evento_id,usuario_id' }
    );

    // Notificar al creador e invitados internos
    const evento = _CONV_DATA.find(e => e.id === eventoId);
    if (evento) {
      const toNotif = [...new Set([evento.creado_por, ...(evento.convocados_ids || [])])].filter(Boolean);
      if (toNotif.length) {
        const alumnoNom = ALUMNO_ACTUAL?.nombre_completo || 'el alumno';
        const verbo     = respuesta === 'acepta' ? 'aceptó' : 'rechazó';
        await sb.from('notificaciones').insert(
          toNotif.map(uid => ({
            usuario_id:       uid,
            tipo:             'rsvp_cita',
            titulo:           `Familia de ${alumnoNom} respondió`,
            descripcion:      `${verbo.charAt(0).toUpperCase()+verbo.slice(1)} la cita "${evento.nombre}"${mensaje ? '. Nota: '+mensaje : ''}`,
            referencia_id:    eventoId,
            referencia_tabla: 'eventos_institucionales',
          }))
        );
      }
    }

    rConvocatorias();
  } catch (_) {
    alert('No se pudo enviar la respuesta. Intentá de nuevo.');
    card?.querySelectorAll('button').forEach(b => b.disabled = false);
  }
}

function _convCambiarRespuesta(eventoId) {
  const card = document.getElementById(`conv-card-${eventoId}`);
  const ev   = _CONV_DATA.find(e => e.id === eventoId);
  if (card && ev) card.outerHTML = _convCardHtml(ev, null);
}
