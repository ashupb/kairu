// =====================================================
// COMUNICADOS.JS — Avisos institucionales (familias)
// =====================================================

const _COM_NIVEL_LABEL = { inicial: 'Inicial', primario: 'Primario', secundario: 'Secundario' };
let _COM_DATA = [];

async function rComunicados() {
  showLoading('comunicados');
  const el = document.getElementById('page-comunicados');

  try {
    const nivelAlumno = ALUMNO_ACTUAL?.cursos?.nivel;
    const nivelFilter = nivelAlumno
      ? `nivel.is.null,nivel.eq.${nivelAlumno}`
      : 'nivel.is.null';

    // Intentar con join a comunicado_imagenes; si la tabla no existe aún, caer sin imágenes múltiples
    let data, error;
    ({ data, error } = await sb
      .from('comunicados')
      .select('id, titulo, cuerpo, imagen_url, nivel, created_at, usuarios(nombre_completo), comunicado_imagenes(id, imagen_url, orden)')
      .eq('institucion_id', USUARIO_FAMILIAR.institucion_id)
      .eq('tipo', 'institucional')
      .or(nivelFilter)
      .order('created_at', { ascending: false })
      .limit(30));

    if (error) {
      // Fallback sin join (tabla comunicado_imagenes todavía no existe en BD)
      ({ data, error } = await sb
        .from('comunicados')
        .select('id, titulo, cuerpo, imagen_url, nivel, created_at, usuarios(nombre_completo)')
        .eq('institucion_id', USUARIO_FAMILIAR.institucion_id)
        .eq('tipo', 'institucional')
        .or(nivelFilter)
        .order('created_at', { ascending: false })
        .limit(30));
    }

    if (error) throw error;

    const comunicados = (data || []).map(c => ({
      ...c,
      comunicado_imagenes: (c.comunicado_imagenes || []).sort((a, b) => a.orden - b.orden),
    }));
    _COM_DATA = comunicados;

    // Lecturas previas
    let leidosIds = new Set();
    if (comunicados.length) {
      const { data: lecturas } = await sb
        .from('comunicado_lecturas')
        .select('comunicado_id')
        .eq('usuario_id', USUARIO_FAMILIAR.id)
        .in('comunicado_id', comunicados.map(c => c.id));
      leidosIds = new Set((lecturas || []).map(l => l.comunicado_id));
    }

    el.innerHTML = `
      <div class="page-body" id="com-lista">
        <div class="page-header">
          <h1 class="page-title">Avisos</h1>
        </div>
        ${comunicados.length === 0
          ? `<div class="card"><p class="empty-msg">No hay avisos publicados aún.</p></div>`
          : comunicados.map(c => _comCard(c, leidosIds)).join('')
        }
      </div>
      <div id="com-detalle" style="display:none"></div>`;

    // Marcar no leídos como leídos (post-render, no bloquea la UI)
    const noLeidos = comunicados.filter(c => !leidosIds.has(c.id));
    if (noLeidos.length) {
      await sb.from('comunicado_lecturas').upsert(
        noLeidos.map(c => ({ comunicado_id: c.id, usuario_id: USUARIO_FAMILIAR.id })),
        { onConflict: 'comunicado_id,usuario_id' }
      );
      fetchUnreadCount();
    }

  } catch (e) {
    el.innerHTML = `
      <div class="page-body">
        <div class="alert-card alert-danger">
          <p>No se pudieron cargar los avisos. Intentá de nuevo.</p>
        </div>
      </div>`;
  }
}

// Devuelve array de URLs de imágenes, preferiendo la tabla nueva
function _comImgs(c) {
  if (c.comunicado_imagenes?.length) return c.comunicado_imagenes.map(i => i.imagen_url);
  if (c.imagen_url) return [c.imagen_url];
  return [];
}

function _comCard(c, leidosIds) {
  const sinLeer  = !leidosIds.has(c.id);
  const nivelTxt = c.nivel
    ? (_COM_NIVEL_LABEL[c.nivel] || c.nivel).toUpperCase()
    : 'TODOS LOS NIVELES';
  const autor    = c.usuarios?.nombre_completo || '';
  const thumbUrl = _comImgs(c)[0] || null;

  return `
    <div class="card com-card${sinLeer ? ' com-card--unread' : ''}" onclick="_comVerDetalle('${c.id}')">
      <div class="com-thumb">
        ${thumbUrl
          ? `<img src="${thumbUrl}" alt="" loading="lazy">`
          : `<div class="com-thumb-empty">📢</div>`}
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
function _comVerDetalle(id) {
  const c = _COM_DATA.find(x => x.id === id);
  if (!c) return;

  const imgs    = _comImgs(c);
  const nivelTxt = c.nivel
    ? (_COM_NIVEL_LABEL[c.nivel] || c.nivel).toUpperCase()
    : 'TODOS LOS NIVELES';
  const autor = c.usuarios?.nombre_completo || '';

  const carouselHtml = imgs.length ? `
    <div class="com-det-imgs">
      <div class="com-det-carousel" id="com-det-car-${id}">
        ${imgs.map((url, i) => `
          <div class="com-det-slide">
            <img src="${url}" alt="Imagen ${i + 1}" loading="lazy">
          </div>`).join('')}
      </div>
      ${imgs.length > 1 ? `
        <div class="com-det-dots" id="com-det-dots-${id}">
          ${imgs.map((_, i) => `<span class="com-det-dot${i === 0 ? ' active' : ''}" data-idx="${i}"></span>`).join('')}
        </div>` : ''}
    </div>` : '';

  const lista = document.getElementById('com-lista');
  const det   = document.getElementById('com-detalle');
  lista.style.display = 'none';
  det.style.display   = '';
  det.innerHTML = `
    <div class="page-body">
      <button class="com-det-back" onclick="_comCerrarDetalle()">← Volver</button>
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

  if (imgs.length > 1) _comInitCarousel(id);
}

function _comCerrarDetalle() {
  const det   = document.getElementById('com-detalle');
  const lista = document.getElementById('com-lista');
  if (det)   { det.style.display = 'none'; det.innerHTML = ''; }
  if (lista) lista.style.display = '';
}

function _comInitCarousel(id) {
  const carousel = document.getElementById(`com-det-car-${id}`);
  if (!carousel) return;
  const dotsWrap = document.getElementById(`com-det-dots-${id}`);
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
