async function rInicio() {
  showLoading('inicio');
  const el = document.getElementById('page-inicio');

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
    const hoy       = new Date();
    const hoyStr    = hoy.toISOString().split('T')[0];
    const anio      = hoy.getFullYear();
    const mes       = String(hoy.getMonth() + 1).padStart(2, '0');
    const inicioMes = `${anio}-${mes}-01`;
    const finMes    = new Date(anio, hoy.getMonth() + 1, 0).toISOString().split('T')[0];

    const [asistRes, comRes, eventRes] = await Promise.all([
      sb.from('asistencia')
        .select('estado')
        .eq('alumno_id', ALUMNO_ACTUAL.id)
        .gte('fecha', inicioMes)
        .lte('fecha', finMes),

      sb.from('comunicados')
        .select('id, titulo, tipo, created_at, requiere_firma')
        .eq('institucion_id', USUARIO_FAMILIAR.institucion_id)
        .order('created_at', { ascending: false })
        .limit(30),

      sb.from('eventos_institucionales')
        .select('id, titulo, nivel, fecha_inicio, tipo')
        .eq('institucion_id', USUARIO_FAMILIAR.institucion_id)
        .gte('fecha_inicio', hoyStr)
        .order('fecha_inicio', { ascending: true })
        .limit(5),
    ]);

    // Asistencia del mes
    const asist     = asistRes.data || [];
    const total     = asist.length;
    const presentes = asist.filter(a => ['presente', 'tardanza', 'media_falta'].includes(a.estado)).length;
    const ausentes  = asist.filter(a => a.estado === 'ausente').length;
    const tardanzas = asist.filter(a => a.estado === 'tardanza').length;
    const pct       = total > 0 ? Math.round(presentes / total * 100) : null;

    // Comunicados sin leer
    const todos  = comRes.data || [];
    const comIds = todos.map(c => c.id);
    let leidosIds = new Set();

    if (comIds.length) {
      const { data: lecturas } = await sb
        .from('comunicado_lecturas')
        .select('comunicado_id')
        .eq('usuario_id', USUARIO_FAMILIAR.id)
        .in('comunicado_id', comIds);
      leidosIds = new Set((lecturas || []).map(l => l.comunicado_id));
    }
    const sinLeer = todos.filter(c => !leidosIds.has(c.id)).slice(0, 3);

    // Próximo evento del nivel del alumno
    const nivelAlumno   = ALUMNO_ACTUAL.cursos?.nivel;
    const proximoEvento = (eventRes.data || []).find(e => !e.nivel || e.nivel === nivelAlumno);

    el.innerHTML = `
      <div class="page-body">
        <div class="saludo">
          <p class="saludo-texto">Hola, <strong>${primerNombre(USUARIO_FAMILIAR.nombre_completo)}</strong></p>
          <p class="saludo-fecha">${fmtFecha(hoyStr)}</p>
        </div>
        ${_alumnoCard()}
        ${_asistResumen(pct, ausentes, tardanzas, total, inicioMes)}
        ${_comunicadosSnippet(sinLeer)}
        ${_eventoSnippet(proximoEvento)}
      </div>`;

  } catch (e) {
    el.innerHTML = `
      <div class="page-body">
        <div class="alert-card alert-danger">
          <p>No se pudo cargar la información. Intentá de nuevo.</p>
        </div>
      </div>`;
  }
}

// ── Sub-renders ───────────────────────────────────────────────────

function _alumnoCard() {
  if (!ALUMNO_ACTUAL) return '';
  const c = ALUMNO_ACTUAL.cursos;
  return `
    <div class="alumno-card">
      <div class="alumno-avatar">${_iniciales(ALUMNO_ACTUAL.nombre_completo)}</div>
      <div class="alumno-info">
        <p class="alumno-nombre">${ALUMNO_ACTUAL.nombre_completo}</p>
        <p class="alumno-curso">${nombreCurso(c)} · ${nivelLabel(c?.nivel)}</p>
        ${ALUMNO_ACTUAL.dni ? `<p class="alumno-dni">DNI ${ALUMNO_ACTUAL.dni}</p>` : ''}
      </div>
    </div>`;
}

function _asistResumen(pct, ausentes, tardanzas, total, inicioMes) {
  const color = pct === null ? '' : pct >= 85 ? 'success' : pct >= 75 ? 'warning' : 'danger';
  return `
    <div class="card">
      <div class="card-header">
        <span class="card-label">ASISTENCIA</span>
        <span class="card-sublabel">${fmtMes(inicioMes)}</span>
      </div>
      ${total === 0
        ? `<p class="empty-msg">Sin registros este mes.</p>`
        : `<div class="asist-grid">
            <div class="asist-stat ${color ? 'asist-stat--' + color : ''}">
              <span class="asist-num">${pct}%</span>
              <span class="asist-label">Asistencia</span>
            </div>
            <div class="asist-stat">
              <span class="asist-num">${ausentes}</span>
              <span class="asist-label">Ausencias</span>
            </div>
            <div class="asist-stat">
              <span class="asist-num">${tardanzas}</span>
              <span class="asist-label">Tardanzas</span>
            </div>
          </div>`
      }
    </div>`;
}

function _comunicadosSnippet(sinLeer) {
  if (!sinLeer.length) {
    return `
      <div class="card">
        <div class="card-header">
          <span class="card-label">COMUNICADOS</span>
        </div>
        <p class="empty-msg">Todo al día. Sin comunicados pendientes.</p>
      </div>`;
  }
  return `
    <div class="card">
      <div class="card-header">
        <span class="card-label">COMUNICADOS SIN LEER</span>
        <button class="card-link" onclick="goPage('comunicados')">Ver todos</button>
      </div>
      <div class="list-items">
        ${sinLeer.map(c => `
          <div class="list-item" onclick="goPage('comunicados')">
            <div class="list-dot ${c.tipo === 'institucional' ? 'dot-green' : 'dot-amber'}"></div>
            <div class="list-item-body">
              <p class="list-item-title">${c.titulo}</p>
              <p class="list-item-meta">
                ${c.tipo === 'institucional' ? 'Institucional' : 'Aula'} ·
                ${fmtFecha(c.created_at?.split('T')[0])}
              </p>
            </div>
            ${c.requiere_firma ? `<span class="badge badge-warning">Firma</span>` : ''}
          </div>
        `).join('')}
      </div>
    </div>`;
}

function _eventoSnippet(evento) {
  if (!evento) return '';
  const d = new Date(evento.fecha_inicio + 'T00:00:00');
  return `
    <div class="card" onclick="goPage('agenda')" style="cursor:pointer">
      <div class="card-header">
        <span class="card-label">PRÓXIMO EVENTO</span>
        <button class="card-link">Ver agenda</button>
      </div>
      <div class="evento-preview">
        <div class="evento-fecha-box">
          <span class="evento-dia">${d.getDate()}</span>
          <span class="evento-mes">${d.toLocaleDateString('es-AR', { month: 'short' })}</span>
        </div>
        <div class="evento-info">
          <p class="evento-titulo">${evento.titulo}</p>
          ${evento.tipo ? `<p class="evento-tipo">${evento.tipo}</p>` : ''}
        </div>
      </div>
    </div>`;
}

// ── Utils ─────────────────────────────────────────────────────────
function primerNombre(n) { return n ? n.split(' ')[0] : ''; }
function _iniciales(n)   { return n ? n.split(' ').slice(0,2).map(p => p[0]).join('').toUpperCase() : '?'; }
