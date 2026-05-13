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
    const hoy         = new Date();
    const hoyStr      = hoy.toISOString().split('T')[0];
    const anio        = hoy.getFullYear();
    const mes         = String(hoy.getMonth() + 1).padStart(2, '0');
    const inicioMes   = `${anio}-${mes}-01`;
    const finMes      = new Date(anio, hoy.getMonth() + 1, 0).toISOString().split('T')[0];
    const nivelAlumno = ALUMNO_ACTUAL.cursos?.nivel;

    // Filtro de nivel: comunicados sin nivel asignado + los del nivel del alumno
    const nivelFilter = nivelAlumno
      ? `nivel.is.null,nivel.eq.${nivelAlumno}`
      : 'nivel.is.null';

    const [asistRes, comRes, eventRes] = await Promise.all([
      sb.from('asistencia')
        .select('estado')
        .eq('alumno_id', ALUMNO_ACTUAL.id)
        .gte('fecha', inicioMes)
        .lte('fecha', finMes),

      sb.from('comunicados')
        .select('id, titulo, cuerpo, imagen_url, created_at')
        .eq('institucion_id', USUARIO_FAMILIAR.institucion_id)
        .eq('tipo', 'institucional')
        .or(nivelFilter)
        .order('created_at', { ascending: false })
        .limit(4),

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

    // Comunicados: detectar cuáles ya fueron leídos
    const comunicados = comRes.data || [];
    let leidosIds = new Set();
    if (comunicados.length) {
      const { data: lecturas } = await sb
        .from('comunicado_lecturas')
        .select('comunicado_id')
        .eq('usuario_id', USUARIO_FAMILIAR.id)
        .in('comunicado_id', comunicados.map(c => c.id));
      leidosIds = new Set((lecturas || []).map(l => l.comunicado_id));
    }

    // Próximo evento del nivel del alumno
    const proximoEvento = (eventRes.data || []).find(e => !e.nivel || e.nivel === nivelAlumno);

    el.innerHTML = `
      <div class="page-body">
        <div class="saludo">
          <p class="saludo-texto">Hola, <strong>${primerNombre(USUARIO_FAMILIAR.nombre_completo)}</strong></p>
          <p class="saludo-fecha">${fmtFecha(hoyStr)}</p>
        </div>
        ${_alumnoCard()}
        ${_asistResumen(pct, ausentes, tardanzas, total, inicioMes)}
        ${_novedadesFeed(comunicados, leidosIds)}
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

function _novedadesFeed(comunicados, leidosIds) {
  if (!comunicados.length) return `
    <div class="card">
      <div class="card-header"><span class="card-label">NOVEDADES</span></div>
      <p class="empty-msg">Sin novedades institucionales por el momento.</p>
    </div>`;

  const items = comunicados.map(c => {
    const sinLeer = !leidosIds.has(c.id);
    const excerpt = c.cuerpo
      ? (c.cuerpo.length > 110 ? c.cuerpo.slice(0, 110).trimEnd() + '…' : c.cuerpo)
      : '';
    return `
      <div class="feed-item" onclick="goPage('comunicados')">
        ${c.imagen_url ? `<img class="feed-img" src="${c.imagen_url}" alt="" loading="lazy">` : ''}
        <div class="feed-meta">
          <span class="badge badge-success">INSTITUCIONAL</span>
          <span class="feed-date">${fechaRelativa(c.created_at)}</span>
          ${sinLeer ? '<span class="feed-unread" title="Sin leer"></span>' : ''}
        </div>
        <p class="feed-title">${c.titulo}</p>
        ${excerpt ? `<p class="feed-excerpt">${excerpt}</p>` : ''}
      </div>`;
  }).join('');

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-label">NOVEDADES</span>
        <button class="card-link" onclick="event.stopPropagation(); goPage('comunicados')">Ver todos</button>
      </div>
      <div class="feed-items">${items}</div>
    </div>`;
}

function fechaRelativa(isoStr) {
  if (!isoStr) return '';
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7)  return `Hace ${diff} días`;
  return fmtFecha(isoStr.split('T')[0]);
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
