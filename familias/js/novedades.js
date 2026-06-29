// =====================================================
// NOVEDADES.JS — Novedades institucionales (familias)
// =====================================================

const _NOV_NIVEL_LABEL = { inicial: 'Inicial', primario: 'Primario', secundario: 'Secundario' };
let _NOV_DATA   = [];
let _NOV_LEIDOS = new Set();
let _NOV_FILTRO = 'todos';

async function rNovedades() {
  showLoading('novedades');
  const el = document.getElementById('page-novedades');

  try {
    const nivelAlumno = ALUMNO_ACTUAL?.cursos?.nivel;
    const cursoId     = ALUMNO_ACTUAL?.cursos?.id;
    const nivelFilter = nivelAlumno ? `nivel.is.null,nivel.eq.${nivelAlumno}` : 'nivel.is.null';
    const cursoFilter = cursoId ? `curso_id.is.null,curso_id.eq.${cursoId}` : 'curso_id.is.null';

    let data, error;
    ({ data, error } = await sb
      .from('comunicados')
      .select('id, titulo, cuerpo, imagen_url, nivel, curso_id, created_at, usuarios(nombre_completo), comunicado_imagenes(id, imagen_url, orden)')
      .eq('institucion_id', USUARIO_FAMILIAR.institucion_id)
      .eq('tipo', 'novedad')
      .or(nivelFilter)
      .or(cursoFilter)
      .order('created_at', { ascending: false })
      .limit(30));

    if (error) {
      ({ data, error } = await sb
        .from('comunicados')
        .select('id, titulo, cuerpo, imagen_url, nivel, curso_id, created_at, usuarios(nombre_completo)')
        .eq('institucion_id', USUARIO_FAMILIAR.institucion_id)
        .eq('tipo', 'novedad')
        .or(nivelFilter)
        .or(cursoFilter)
        .order('created_at', { ascending: false })
        .limit(30));
    }

    if (error) throw error;

    const novedades = (data || []).map(c => ({
      ...c,
      comunicado_imagenes: (c.comunicado_imagenes || []).sort((a, b) => a.orden - b.orden),
    }));
    _NOV_DATA   = novedades;
    _NOV_FILTRO = 'todos';

    // Lecturas previas (dot visual; novedades no afectan la campana)
    let leidosIds = new Set();
    if (novedades.length) {
      const { data: lecturas } = await sb
        .from('comunicado_lecturas')
        .select('comunicado_id')
        .eq('usuario_id', USUARIO_FAMILIAR.id)
        .in('comunicado_id', novedades.map(c => c.id));
      leidosIds = new Set((lecturas || []).map(l => l.comunicado_id));
    }
    _NOV_LEIDOS = leidosIds;

    const nivelStr = nivelLabel(nivelAlumno) || 'Nivel';
    const cursoStr = nombreCurso(ALUMNO_ACTUAL?.cursos) || 'Curso';

    el.innerHTML = `
      <div class="page-body" id="nov-lista">
        <div class="page-header">
          <h1 class="page-title">Novedades</h1>
        </div>
        ${novedades.length > 0 ? `
        <div class="tab-bar" id="nov-filtros" style="margin-bottom:12px">
          <button class="tab-btn active" onclick="_novFiltrar('todos')">Todos</button>
          <button class="tab-btn" onclick="_novFiltrar('nivel')">Nivel · ${nivelStr}</button>
          <button class="tab-btn" onclick="_novFiltrar('curso')">Curso · ${cursoStr}</button>
        </div>` : ''}
        <div id="nov-cards">
          ${novedades.length === 0
            ? `<div class="card"><p class="empty-msg">No hay novedades publicadas aún.</p></div>`
            : novedades.map(c => _novCard(c, leidosIds)).join('')
          }
        </div>
      </div>
      <div id="nov-detalle" style="display:none"></div>`;

    _novInitThumbCarousels(novedades);

    // Marcar no leídas como leídas (sin campana)
    const noLeidas = novedades.filter(c => !leidosIds.has(c.id));
    if (noLeidas.length) {
      await sb.from('comunicado_lecturas').upsert(
        noLeidas.map(c => ({ comunicado_id: c.id, usuario_id: USUARIO_FAMILIAR.id })),
        { onConflict: 'comunicado_id,usuario_id' }
      );
    }

    // Deep link: abrir detalle del ítem específico si viene de inicio
    const targetId = _DEEP_LINK_ID;
    _DEEP_LINK_ID = null;
    if (targetId) setTimeout(() => _novVerDetalle(targetId), 50);

  } catch (e) {
    el.innerHTML = `
      <div class="page-body">
        <div class="alert-card alert-danger">
          <p>No se pudieron cargar las novedades. Intentá de nuevo.</p>
        </div>
      </div>`;
  }
}

function _novImgs(c) {
  if (c.comunicado_imagenes?.length) return c.comunicado_imagenes.map(i => i.imagen_url);
  if (c.imagen_url) return [c.imagen_url];
  return [];
}

function _novCard(c, leidosIds) {
  const sinLeer  = !leidosIds.has(c.id);
  const nivelTxt = c.nivel
    ? (_NOV_NIVEL_LABEL[c.nivel] || c.nivel).toUpperCase()
    : 'TODOS LOS NIVELES';
  const autor = c.usuarios?.nombre_completo || '';
  const imgs  = _novImgs(c);

  let thumbHtml;
  if (imgs.length === 0) {
    thumbHtml = `<div class="com-thumb-empty">📢</div>`;
  } else if (imgs.length === 1) {
    thumbHtml = `<img src="${imgs[0]}" alt="" loading="lazy">`;
  } else {
    thumbHtml = `
      <div class="com-thumb-car" id="nov-tc-${c.id}">
        ${imgs.map(url => `<img src="${url}" alt="" loading="lazy">`).join('')}
      </div>
      <div class="com-thumb-dots" id="nov-td-${c.id}">
        ${imgs.map((_, i) => `<span class="com-thumb-dot${i === 0 ? ' active' : ''}"></span>`).join('')}
      </div>`;
  }

  return `
    <div class="card com-card${sinLeer ? ' com-card--unread' : ''}" onclick="_novVerDetalle('${c.id}')">
      <div class="com-thumb">
        ${thumbHtml}
      </div>
      <div class="com-body">
        <div class="com-meta">
          <span class="badge badge-success">${nivelTxt}</span>
          ${sinLeer ? '<span class="com-new-dot"></span>' : ''}
          <span class="com-fecha">${fechaRelativa(c.created_at)}</span>
        </div>
        <p class="com-titulo">${c.titulo}</p>
        ${c.cuerpo ? `<p class="com-excerpt">${c.cuerpo}</p>` : ''}
        ${autor ? `<p class="com-autor">— ${autor}</p>` : ''}
      </div>
    </div>`;
}

// ── Vista detalle ────────────────────────────────────────────────
function _novVerDetalle(id) {
  const c = _NOV_DATA.find(x => x.id === id);
  if (!c) return;

  const imgs    = _novImgs(c);
  const nivelTxt = c.nivel
    ? (_NOV_NIVEL_LABEL[c.nivel] || c.nivel).toUpperCase()
    : 'TODOS LOS NIVELES';
  const autor = c.usuarios?.nombre_completo || '';

  const carouselHtml = imgs.length ? `
    <div class="com-det-imgs">
      <div class="com-det-carousel" id="nov-det-car-${id}">
        ${imgs.map((url, i) => `
          <div class="com-det-slide">
            <img src="${url}" alt="Imagen ${i + 1}" loading="lazy">
          </div>`).join('')}
      </div>
      ${imgs.length > 1 ? `
        <div class="com-det-dots" id="nov-det-dots-${id}">
          ${imgs.map((_, i) => `<span class="com-det-dot${i === 0 ? ' active' : ''}" data-idx="${i}"></span>`).join('')}
        </div>` : ''}
    </div>` : '';

  const lista = document.getElementById('nov-lista');
  const det   = document.getElementById('nov-detalle');
  lista.style.display = 'none';
  det.style.display   = '';
  det.innerHTML = `
    <div class="page-body">
      <button class="com-det-back" onclick="_novCerrarDetalle()">← Volver</button>
      ${carouselHtml}
      <div class="card com-det-body">
        <div class="com-meta" style="margin-bottom:10px">
          <span class="badge badge-success">${nivelTxt}</span>
          <span class="com-fecha">${fechaRelativa(c.created_at)}</span>
        </div>
        <h2 class="com-det-titulo">${c.titulo}</h2>
        ${c.cuerpo ? `<p class="com-det-cuerpo">${c.cuerpo.replace(/\n/g, '<br>')}</p>` : ''}
        ${autor ? `<p class="com-autor" style="margin-top:16px">— ${autor}</p>` : ''}
      </div>
    </div>`;

  if (imgs.length > 1) _novInitCarousel(id);
}

function _novCerrarDetalle() {
  const det   = document.getElementById('nov-detalle');
  const lista = document.getElementById('nov-lista');
  if (det)   { det.style.display = 'none'; det.innerHTML = ''; }
  if (lista) lista.style.display = '';
}

function _novInitThumbCarousels(novedades) {
  novedades.forEach(c => {
    if (_novImgs(c).length <= 1) return;
    const car  = document.getElementById(`nov-tc-${c.id}`);
    const wrap = document.getElementById(`nov-td-${c.id}`);
    if (!car || !wrap) return;
    const dots = wrap.querySelectorAll('.com-thumb-dot');
    car.addEventListener('scroll', () => {
      const idx = Math.round(car.scrollLeft / car.offsetWidth);
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    }, { passive: true });
  });
}

function _novFiltrar(f) {
  _NOV_FILTRO = f;
  const items = f === 'nivel'
    ? _NOV_DATA.filter(c => !c.curso_id)
    : f === 'curso'
    ? _NOV_DATA.filter(c => !!c.curso_id)
    : _NOV_DATA;

  document.querySelectorAll('#nov-filtros .tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('onclick') === `_novFiltrar('${f}')`);
  });

  const cardsEl = document.getElementById('nov-cards');
  if (!cardsEl) return;
  cardsEl.innerHTML = items.length
    ? items.map(c => _novCard(c, _NOV_LEIDOS)).join('')
    : `<div class="card"><p class="empty-msg">No hay novedades para este filtro.</p></div>`;

  _novInitThumbCarousels(items);
}

function _novInitCarousel(id) {
  const carousel = document.getElementById(`nov-det-car-${id}`);
  if (!carousel) return;
  const dotsWrap = document.getElementById(`nov-det-dots-${id}`);
  const dots = dotsWrap ? dotsWrap.querySelectorAll('.com-det-dot') : [];
  let current = 0;

  function goTo(idx) {
    current = idx;
    carousel.scrollTo({ left: carousel.offsetWidth * idx, behavior: 'smooth' });
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  }

  dots.forEach(dot => dot.addEventListener('click', () => goTo(+dot.dataset.idx)));

  carousel.addEventListener('scroll', () => {
    const idx = Math.round(carousel.scrollLeft / carousel.offsetWidth);
    if (idx !== current) {
      current = idx;
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    }
  }, { passive: true });
}
