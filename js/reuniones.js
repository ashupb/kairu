// =====================================================
// REUNIONES.JS
// =====================================================

async function rReuniones() {
  showLoading('reuniones');
  try {
    const hoy = hoyISO();
    const { data: reuniones, error } = await sb
      .from('reuniones')
      .select(`
        *,
        creado_por_usuario:usuarios!reuniones_creado_por_fkey(nombre_completo),
        invitados:reunion_invitados(usuario_id, estado, usuario:usuarios(nombre_completo))
      `)
      .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
      .gte('fecha', hoy)
      .order('fecha');

    if (error) throw error;

    const canCreate = ['directivo','admin','preceptor','eoe'].includes(USUARIO_ACTUAL.rol);

    const c = document.getElementById('page-reuniones');
    c.innerHTML = `
      <div class="pg-t">Reuniones y actividades</div>
      <div class="pg-s">Convocatorias · ${INSTITUCION_ACTUAL?.nombre || ''}</div>
      ${canCreate ? `
        <div class="acc" style="margin-bottom:14px">
          <button class="btn-p" onclick="mostrarFormReu()">+ Nueva reunión</button>
        </div>` : ''}
      <div id="form-reu"></div>
      ${!reuniones?.length
        ? '<div class="empty-state">📅<br>No hay reuniones próximas agendadas.</div>'
        : reuniones.map(r => renderReuCard(r)).join('')}`;

  } catch (e) { showError('reuniones', 'Error: ' + e.message); }
}

function renderReuCard(r) {
  const fecha   = new Date(r.fecha + 'T12:00:00');
  const dia     = fecha.toLocaleDateString('es-AR', { day:'2-digit' });
  const mes     = fecha.toLocaleDateString('es-AR', { month:'short' }).toUpperCase();
  const miInv   = r.invitados?.find(i => i.usuario_id === USUARIO_ACTUAL.id);
  const miEst   = miInv?.estado || null;
  const estCls  = { aceptada:'re-aceptada', rechazada:'re-rechazada', pendiente:'re-pendiente' }[miEst] || '';
  const estLabel = { aceptada:'✓ Aceptaste', rechazada:'✗ No podés', pendiente:'Pendiente de confirmación' }[miEst] || '';

  return `
    <div class="reunion-card">
      <div class="reunion-header">
        <div class="reunion-fecha">
          <div class="reunion-dia-num">${dia}</div>
          <div class="reunion-mes">${mes}</div>
        </div>
        <div class="reunion-info">
          <div class="reunion-titulo">${r.titulo}</div>
          <div class="reunion-sub">${r.hora || ''} ${r.lugar ? '· ' + r.lugar : ''} · Convoca: ${r.creado_por_usuario?.nombre_completo || '—'}</div>
          ${r.descripcion ? `<div class="reunion-sub" style="margin-top:3px">${r.descripcion}</div>` : ''}
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">
            ${(r.invitados || []).map(i => `<span class="tag tgr">${i.usuario?.nombre_completo?.split(',')[0] || '—'}</span>`).join('')}
          </div>
          ${miEst ? `<span class="reunion-estado ${estCls}" style="margin-top:6px">${estLabel}</span>` : ''}
        </div>
      </div>
      ${miEst === 'pendiente' ? `
        <div class="reunion-acciones">
          <button class="btn-aceptar" onclick="responderReu('${r.id}','aceptada')">✓ Aceptar</button>
          <button class="btn-rechazar" onclick="responderReu('${r.id}','rechazada')">✗ No puedo</button>
        </div>` : ''}
    </div>`;
}

async function responderReu(reuId, estado) {
  const { error } = await sb
    .from('reunion_invitados')
    .upsert({ reunion_id: reuId, usuario_id: USUARIO_ACTUAL.id, estado },
             { onConflict: 'reunion_id,usuario_id' });
  if (error) { alert('Error: ' + error.message); return; }
  await rReuniones();
}

function mostrarFormReu() {
  const fc = document.getElementById('form-reu');
  if (fc.innerHTML) { fc.innerHTML = ''; return; }
  fc.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div style="font-size:14px;font-weight:600;margin-bottom:14px">Nueva reunión</div>
      <div class="sec-lb">Título</div>
      <input type="text" id="reu-titulo" placeholder="Ej: Reunión de equipo docente" style="margin-bottom:8px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div><div class="sec-lb">Fecha</div>
          <input type="date" id="reu-fecha" style="width:100%;border:1px solid var(--brd);border-radius:var(--rad);padding:8px;background:var(--surf);color:var(--txt)">
        </div>
        <div><div class="sec-lb">Hora</div>
          <input type="time" id="reu-hora" style="width:100%;border:1px solid var(--brd);border-radius:var(--rad);padding:8px;background:var(--surf);color:var(--txt)">
        </div>
      </div>
      <div class="sec-lb">Lugar</div>
      <input type="text" id="reu-lugar" placeholder="Sala de reuniones" style="margin-bottom:8px">
      <div class="sec-lb">Descripción</div>
      <textarea id="reu-desc" rows="2" placeholder="Tema de la reunión..."></textarea>
      <div class="acc" style="margin-top:14px">
        <button class="btn-p" onclick="guardarReu()">Crear y notificar</button>
        <button class="btn-s" onclick="document.getElementById('form-reu').innerHTML=''">Cancelar</button>
      </div>
    </div>`;
}

async function guardarReu() {
  const titulo = document.getElementById('reu-titulo')?.value.trim();
  const fecha  = document.getElementById('reu-fecha')?.value;
  const hora   = document.getElementById('reu-hora')?.value;
  const lugar  = document.getElementById('reu-lugar')?.value.trim();
  const desc   = document.getElementById('reu-desc')?.value.trim();

  if (!titulo || !fecha) { alert('El título y la fecha son obligatorios.'); return; }

  const { data: nueva, error } = await sb.from('reuniones').insert({
    institucion_id: USUARIO_ACTUAL.institucion_id,
    creado_por: USUARIO_ACTUAL.id,
    titulo, fecha,
    hora:   hora  || null,
    lugar:  lugar || null,
    descripcion: desc || null,
  }).select().single();

  if (error) { alert('Error al crear: ' + error.message); return; }

  // Invitar y notificar a todos los usuarios de la institución
  const { data: todos } = await sb
    .from('usuarios')
    .select('id')
    .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
    .eq('activo', true)
    .neq('id', USUARIO_ACTUAL.id);

  if (todos?.length) {
    await Promise.all([
      sb.from('reunion_invitados').insert(
        todos.map(u => ({ reunion_id: nueva.id, usuario_id: u.id, estado: 'pendiente' }))
      ),
      sb.from('notificaciones').insert(
        todos.map(u => ({
          usuario_id:       u.id,
          tipo:             'nueva_reunion',
          titulo:           `Nueva reunión: ${titulo}`,
          descripcion:      `${formatFecha(fecha)} ${hora || ''} ${lugar ? '· ' + lugar : ''}`,
          referencia_id:    nueva.id,
          referencia_tabla: 'reuniones',
        }))
      ),
    ]);
  }

  document.getElementById('form-reu').innerHTML = '';
  await rReuniones();
  cargarNotificaciones();
}