// =====================================================
// INICIO.JS — Dashboard familiar (Kairú Familias)
// =====================================================

let _INICIO_NOVEDADES  = [];
let _INICIO_COMUNICADOS = [];
let _INICIO_FEED_TAB   = 'novedades';

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
    const cursoId     = ALUMNO_ACTUAL.cursos?.id;

    const nivelFilter = nivelAlumno
      ? `nivel.is.null,nivel.eq.${nivelAlumno}`
      : 'nivel.is.null';

    const [asistRes, novRes, comRes, eventRes] = await Promise.all([
      sb.from('asistencia')
        .select('estado')
        .eq('alumno_id', ALUMNO_ACTUAL.id)
        .gte('fecha', inicioMes)
        .lte('fecha', finMes),

      // Novedades institucionales (tipo='novedad', filtro por nivel)
      (async () => {
        let res = await sb.from('comunicados')
          .select('id, titulo, cuerpo, imagen_url, created_at, comunicado_imagenes(id, imagen_url, orden)')
          .eq('institucion_id', USUARIO_FAMILIAR.institucion_id)
          .eq('tipo', 'novedad')
          .or(nivelFilter)
          .order('created_at', { ascending: false })
          .limit(4);
        if (res.error) {
          res = await sb.from('comunicados')
            .select('id, titulo, cuerpo, imagen_url, created_at')
            .eq('institucion_id', USUARIO_FAMILIAR.institucion_id)
            .eq('tipo', 'novedad')
            .or(nivelFilter)
            .order('created_at', { ascending: false })
            .limit(4);
        }
        // Fallback final: sin filtro de nivel (por si la columna nivel tiene algún problema)
        if (res.error) {
          res = await sb.from('comunicados')
            .select('id, titulo, cuerpo, imagen_url, created_at')
            .eq('institucion_id', USUARIO_FAMILIAR.institucion_id)
            .eq('tipo', 'novedad')
            .order('created_at', { ascending: false })
            .limit(4);
        }
        return res;
      })(),

      // Comunicados del curso (tipo='comunicado', filtro por curso_id)
      cursoId
        ? sb.from('comunicados')
            .select('id, titulo, cuerpo, created_at, usuarios(nombre_completo)')
            .eq('institucion_id', USUARIO_FAMILIAR.institucion_id)
            .eq('tipo', 'comunicado')
            .eq('curso_id', cursoId)
            .order('created_at', { ascending: false })
            .limit(4)
        : Promise.resolve({ data: [] }),

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

    // Normalizar imágenes en novedades
    _INICIO_NOVEDADES = (novRes.data || []).map(c => ({
      ...c,
      comunicado_imagenes: (c.comunicado_imagenes || []).sort((a, b) => a.orden - b.orden),
    }));
    _INICIO_COMUNICADOS = comRes.data || [];

    // Lecturas previas para novedades (dot visual)
    let leidosNovIds = new Set();
    if (_INICIO_NOVEDADES.length) {
      const { data: lecturas } = await sb
        .from('comunicado_lecturas')
        .select('comunicado_id')
        .eq('usuario_id', USUARIO_FAMILIAR.id)
        .in('comunicado_id', _INICIO_NOVEDADES.map(c => c.id));
      leidosNovIds = new Set((lecturas || []).map(l => l.comunicado_id));
    }

    // Lecturas previas para comunicados
    let leidosComIds = new Set();
    if (_INICIO_COMUNICADOS.length) {
      const { data: lecturas } = await sb
        .from('comunicado_lecturas')
        .select('comunicado_id')
        .eq('usuario_id', USUARIO_FAMILIAR.id)
        .in('comunicado_id', _INICIO_COMUNICADOS.map(c => c.id));
      leidosComIds = new Set((lecturas || []).map(l => l.comunicado_id));
    }

    // Próximo evento del nivel del alumno
    const proximoEvento = (eventRes.data || []).find(e => !e.nivel || e.nivel === nivelAlumno);

    _INICIO_FEED_TAB = 'novedades';

    el.innerHTML = `
      <div class="page-body">
        <div class="saludo">
          <p class="saludo-texto">Hola, <strong>${primerNombre(USUARIO_FAMILIAR.nombre_completo)}</strong></p>
          <p class="saludo-fecha">${fmtFecha(hoyStr)}</p>
        </div>
        ${_alumnoCard()}
        ${_asistResumen(pct, ausentes, tardanzas, total, inicioMes)}
        ${_feedSection(_INICIO_NOVEDADES, leidosNovIds, _INICIO_COMUNICADOS, leidosComIds)}
        ${_eventoSnippet(proximoEvento)}
      </div>`;

    _feedInitCarousels(_INICIO_NOVEDADES);

  } catch (e) {
    el.innerHTML = `
      <div class="page-body">
        <div class="alert-card alert-danger">
          <p>No se pudo cargar la información. Intentá de nuevo.</p>
        </div>
      </div>`;
  }
}

// ── Tab del feed ──────────────────────────────────────────────────
function _feedTab(tab) {
  _INICIO_FEED_TAB = tab;
  const tabNov = document.getElementById('inicio-tab-nov');
  const tabCom = document.getElementById('inicio-tab-com');
  const btnNov = document.getElementById('inicio-btn-nov');
  const btnCom = document.getElementById('inicio-btn-com');
  if (tabNov) tabNov.style.display = tab === 'novedades' ? '' : 'none';
  if (tabCom) tabCom.style.display = tab === 'comunicados' ? '' : 'none';
  if (btnNov) btnNov.classList.toggle('active', tab === 'novedades');
  if (btnCom) btnCom.classList.toggle('active', tab === 'comunicados');
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

function _feedSection(novedades, leidosNovIds, comunicados, leidosComIds) {
  const hayNov = novedades.length > 0;
  const hayCom = comunicados.length > 0;
  const comNoLeidos = comunicados.filter(c => !leidosComIds.has(c.id)).length;

  const novItems = hayNov
    ? novedades.map(c => _feedItemNovedad(c, leidosNovIds)).join('')
    : `<p class="empty-msg">No hay novedades recientes.</p>`;

  const comItems = hayCom
    ? comunicados.map(c => _feedItemComunicado(c, leidosComIds)).join('')
    : `<p class="empty-msg">No hay comunicados del curso.</p>`;

  return `
    <div class="card">
      <div class="tab-bar">
        <button id="inicio-btn-nov" class="tab-btn active" onclick="_feedTab('novedades')">Novedades</button>
        <button id="inicio-btn-com" class="tab-btn" onclick="_feedTab('comunicados')">Comunicados${comNoLeidos > 0 ? `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#d63b2f;margin-left:5px;vertical-align:middle"></span>` : ''}</button>
      </div>
      <div id="inicio-tab-nov">
        <div class="feed-items">${novItems}</div>
        ${hayNov ? `<button class="card-link" style="margin-top:10px;display:block;text-align:left" onclick="goPage('novedades')">Ver todas las novedades →</button>` : ''}
      </div>
      <div id="inicio-tab-com" style="display:none">
        <div class="feed-items">${comItems}</div>
        ${hayCom ? `<button class="card-link" style="margin-top:10px;display:block;text-align:left" onclick="goPage('comunicados')">Ver todos los comunicados →</button>` : ''}
      </div>
    </div>`;
}

function _comImgsInicio(c) {
  if (c.comunicado_imagenes?.length) return c.comunicado_imagenes.map(i => i.imagen_url);
  if (c.imagen_url) return [c.imagen_url];
  return [];
}

function _feedItemNovedad(c, leidosIds) {
  const sinLeer = !leidosIds.has(c.id);
  const imgs    = _comImgsInicio(c);
  const excerpt = c.cuerpo
    ? (c.cuerpo.length > 110 ? c.cuerpo.slice(0, 110).trimEnd() + '…' : c.cuerpo)
    : '';

  let imgHtml = '';
  if (imgs.length === 1) {
    imgHtml = `<img class="feed-img" src="${imgs[0]}" alt="" loading="lazy">`;
  } else if (imgs.length > 1) {
    imgHtml = `
      <div class="feed-car-wrap" onclick="event.stopPropagation()">
        <div class="feed-car" id="feed-car-${c.id}">
          ${imgs.map(url => `<div class="feed-car-slide"><img src="${url}" alt="" loading="lazy"></div>`).join('')}
        </div>
        <button class="feed-car-btn feed-car-btn--prev" onclick="_feedCarGo('${c.id}',-1,event)">&#8249;</button>
        <button class="feed-car-btn feed-car-btn--next" onclick="_feedCarGo('${c.id}',1,event)">&#8250;</button>
        <div class="feed-car-dots" id="feed-dots-${c.id}">
          ${imgs.map((_, i) => `<span class="feed-car-dot${i === 0 ? ' active' : ''}"></span>`).join('')}
        </div>
      </div>`;
  }

  return `
    <div class="feed-item" onclick="goPage('novedades')">
      ${imgHtml}
      <div class="feed-meta">
        <span class="badge badge-success">NOVEDAD</span>
        <span class="feed-date">${fechaRelativa(c.created_at)}</span>
        ${sinLeer ? '<span class="feed-unread"></span>' : ''}
      </div>
      <p class="feed-title">${c.titulo}</p>
      ${excerpt ? `<p class="feed-excerpt">${excerpt}</p>` : ''}
    </div>`;
}

function _feedItemComunicado(c, leidosIds) {
  const sinLeer = !leidosIds.has(c.id);
  const autor   = c.usuarios?.nombre_completo || '';
  const excerpt = c.cuerpo
    ? (c.cuerpo.length > 110 ? c.cuerpo.slice(0, 110).trimEnd() + '…' : c.cuerpo)
    : '';

  return `
    <div class="feed-item" onclick="goPage('comunicados')">
      <div class="feed-meta">
        <span class="badge badge-com">COMUNICADO</span>
        <span class="feed-date">${fechaRelativa(c.created_at)}</span>
        ${sinLeer ? '<span class="feed-unread"></span>' : ''}
      </div>
      <p class="feed-title">${c.titulo}</p>
      ${excerpt ? `<p class="feed-excerpt">${excerpt}</p>` : ''}
      ${autor ? `<p class="feed-excerpt" style="margin-top:3px">— ${autor}</p>` : ''}
    </div>`;
}

function _feedCarGo(id, dir, ev) {
  if (ev) ev.stopPropagation();
  const car = document.getElementById(`feed-car-${id}`);
  const dotsWrap = document.getElementById(`feed-dots-${id}`);
  if (!car) return;
  const slides = car.querySelectorAll('.feed-car-slide');
  const current = Math.round(car.scrollLeft / car.offsetWidth);
  const next = Math.max(0, Math.min(slides.length - 1, current + dir));
  car.scrollTo({ left: car.offsetWidth * next, behavior: 'smooth' });
  if (dotsWrap) {
    dotsWrap.querySelectorAll('.feed-car-dot').forEach((d, i) => d.classList.toggle('active', i === next));
  }
}

function _feedInitCarousels(novedades) {
  novedades.forEach(c => {
    if (_comImgsInicio(c).length <= 1) return;
    const car = document.getElementById(`feed-car-${c.id}`);
    const dotsWrap = document.getElementById(`feed-dots-${c.id}`);
    if (!car || !dotsWrap) return;
    const dots = dotsWrap.querySelectorAll('.feed-car-dot');
    car.addEventListener('scroll', () => {
      const idx = Math.round(car.scrollLeft / car.offsetWidth);
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    }, { passive: true });
  });
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
