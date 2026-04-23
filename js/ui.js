// =====================================================
// UI.JS — Notificaciones + módulos en construcción
// =====================================================

// ── NOTIFICACIONES ────────────────────────────────────
function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  const abriendo = panel.style.display === 'none';
  panel.style.display = abriendo ? 'block' : 'none';
  if (abriendo) {
    cargarNotificaciones();
    const cnt = document.getElementById('notif-count');
    if (cnt) cnt.style.display = 'none';
  }
}

document.addEventListener('click', e => {
  const panel = document.getElementById('notif-panel');
  const btn   = document.querySelector('.notif-btn');
  if (panel && panel.style.display !== 'none' && btn && !panel.contains(e.target) && !btn.contains(e.target)) {
    panel.style.display = 'none';
  }
});

const _NOTIF_ICONS = {
  'problematica':       { icon: '🚨', cls: 'alerta' },
  'intervencion':       { icon: '📋', cls: 'info'   },
  'reunion':            { icon: '📅', cls: 'info'   },
  'invitacion_evento':  { icon: '📨', cls: 'info'   },
  'evento_responsable': { icon: '📌', cls: 'warn'   },
  'objetivo':           { icon: '🎯', cls: 'success' },
  'incidente_objetivo': { icon: '⚠️', cls: 'warn'   },
};

function _notifItemHTML(n) {
  const { icon, cls } = _NOTIF_ICONS[n.tipo] || { icon: '🔔', cls: 'info' };
  return `
    <div class="notif-item${n.leida ? '' : ' no-leida'}"
         onclick="abrirNotif('${n.id}','${n.referencia_tabla || ''}','${n.referencia_id || ''}')">
      ${!n.leida ? '<div class="notif-unread-dot"></div>' : ''}
      <div class="notif-dot ${cls}">${icon}</div>
      <div style="flex:1;min-width:0">
        <div class="notif-texto">${n.titulo}</div>
        ${n.descripcion ? `<div class="notif-desc">${n.descripcion}</div>` : ''}
        <span class="notif-tiempo">${tiempoDesde(n.created_at)}</span>
      </div>
    </div>`;
}

async function cargarNotificaciones() {
  const { data } = await sb
    .from('notificaciones')
    .select('*')
    .eq('usuario_id', USUARIO_ACTUAL.id)
    .order('created_at', { ascending: false })
    .limit(20);

  const todas = data || [];
  const noLeidas = todas.filter(n => !n.leida).length;
  const cnt = document.getElementById('notif-count');
  if (cnt) {
    cnt.textContent   = noLeidas;
    cnt.style.display = noLeidas > 0 ? 'inline-block' : 'none';
  }

  const lista = document.getElementById('notif-lista');
  if (!lista) return;

  if (!todas.length) {
    lista.innerHTML = '<div style="font-size:12px;color:var(--txt2);padding:20px;text-align:center">Sin notificaciones recientes</div>';
    return;
  }

  const limitadas = todas.slice(0, 8);
  const ahora     = new Date();
  const hoyISO    = ahora.toISOString().split('T')[0];
  const ayerISO   = new Date(+ahora - 86400000).toISOString().split('T')[0];

  const grupos = { 'Hoy': [], 'Ayer': [], 'Esta semana': [] };
  limitadas.forEach(n => {
    const f = n.created_at.split('T')[0];
    if      (f === hoyISO)  grupos['Hoy'].push(n);
    else if (f === ayerISO) grupos['Ayer'].push(n);
    else                    grupos['Esta semana'].push(n);
  });

  let html = '';
  for (const [label, notifs] of Object.entries(grupos)) {
    if (!notifs.length) continue;
    html += `<div class="notif-grupo-label">${label}</div>`;
    html += notifs.map(n => _notifItemHTML(n)).join('');
  }
  lista.innerHTML = html;
}

async function abrirNotif(id, tabla, referenciaId) {
  await sb.from('notificaciones').update({ leida: true }).eq('id', id);
  document.getElementById('notif-panel').style.display = 'none';
  const destino = { problematicas:'prob', reuniones:'reuniones', objetivos:'obj', eventos_institucionales:'agenda' }[tabla] || 'dash';
  goPage(destino);
  if (tabla === 'eventos_institucionales' && referenciaId) {
    setTimeout(() => { if (typeof verEvento === 'function') verEvento(referenciaId); }, 600);
  }
  cargarNotificaciones();
}

async function marcarTodasLeidas() {
  await sb.from('notificaciones').update({ leida: true }).eq('usuario_id', USUARIO_ACTUAL.id);
  document.getElementById('notif-count').style.display = 'none';
  cargarNotificaciones();
}

// ── MÓDULOS EN CONSTRUCCIÓN (Fase 2) ─────────────────

async function rAsist() {
  const c = document.getElementById('page-asist');
  c.innerHTML = `
    <div class="pg-t">Asistencia</div>
    <div class="pg-s">Módulo disponible en Fase 2</div>
    <div class="empty-state">
      ✅
      <div>El módulo de asistencia se implementa en la próxima fase.</div>
      <div style="font-size:11px;margin-top:4px">
        Mientras tanto, las problemáticas, objetivos y reuniones ya están completamente funcionales.
      </div>
    </div>`;
}

async function rAdmin() {
  const c = document.getElementById('page-admin');
  c.innerHTML = `
    <div class="pg-t">Configuración</div>
    <div class="pg-s">Datos institucionales</div>
    <div class="card">
      <div class="card-t">Institución activa</div>
      <div style="font-size:14px;font-weight:600">${INSTITUCION_ACTUAL?.nombre || '—'}</div>
      <div style="font-size:11px;color:var(--txt2);margin-top:4px">ID: ${USUARIO_ACTUAL?.institucion_id}</div>
    </div>
    <div class="card">
      <div class="card-t">Tu cuenta</div>
      <table style="width:100%;font-size:12px">
        <tr><td style="color:var(--txt2);padding:4px 0">Nombre</td><td style="font-weight:500">${USUARIO_ACTUAL?.nombre_completo}</td></tr>
        <tr><td style="color:var(--txt2);padding:4px 0">Rol</td><td>${labelRol(USUARIO_ACTUAL?.rol)}</td></tr>
        <tr><td style="color:var(--txt2);padding:4px 0">Email</td><td>${USUARIO_ACTUAL?.email}</td></tr>
      </table>
    </div>
    <div class="empty-state" style="padding:20px">
      ⚙️ <div>Gestión completa de usuarios, cursos y materias disponible en Fase 2.</div>
    </div>`;
}