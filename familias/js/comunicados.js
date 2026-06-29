// =====================================================
// COMUNICADOS.JS — Comunicados por curso (familias)
// =====================================================

let _COM_DATA   = [];
let _COM_LEIDOS = new Set();
let _COM_FILTRO = 'todos';

async function rComunicados() {
  showLoading('comunicados');
  const el          = document.getElementById('page-comunicados');
  const nivelAlumno = ALUMNO_ACTUAL?.cursos?.nivel;
  const cursoId     = ALUMNO_ACTUAL?.cursos?.id;
  _COM_FILTRO = 'todos';

  try {
    if (!cursoId) {
      el.innerHTML = `
        <div class="page-body">
          <div class="page-header"><h1 class="page-title">Comunicados</h1></div>
          <div class="card"><p class="empty-msg">No hay información del curso del alumno.</p></div>
        </div>`;
      return;
    }

    const nivelFilter = nivelAlumno ? `nivel.is.null,nivel.eq.${nivelAlumno}` : 'nivel.is.null';
    const cursoFilter = `curso_id.is.null,curso_id.eq.${cursoId}`;

    const { data, error } = await sb
      .from('comunicados')
      .select('id, titulo, cuerpo, created_at, nivel, curso_id, usuarios(nombre_completo), cursos(id, nombre, division, nivel)')
      .eq('institucion_id', USUARIO_FAMILIAR.institucion_id)
      .eq('tipo', 'comunicado')
      .or(nivelFilter)
      .or(cursoFilter)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;
    _COM_DATA = data || [];

    // Lecturas previas
    let leidosIds = new Set();
    if (_COM_DATA.length) {
      const { data: lecturas } = await sb
        .from('comunicado_lecturas')
        .select('comunicado_id')
        .eq('usuario_id', USUARIO_FAMILIAR.id)
        .in('comunicado_id', _COM_DATA.map(c => c.id));
      leidosIds = new Set((lecturas || []).map(l => l.comunicado_id));
    }
    _COM_LEIDOS = leidosIds;

    const nivelStr = nivelLabel(nivelAlumno) || 'Nivel';
    const cursoStr = nombreCurso(ALUMNO_ACTUAL?.cursos) || 'Curso';

    el.innerHTML = `
      <div class="page-body">
        <div class="page-header">
          <h1 class="page-title">Comunicados</h1>
        </div>
        ${_COM_DATA.length > 0 ? `
        <div class="tab-bar" id="com-filtros" style="margin-bottom:12px">
          <button class="tab-btn active" onclick="_comFiltrar('todos')">Todos</button>
          <button class="tab-btn" onclick="_comFiltrar('nivel')">Nivel · ${nivelStr}</button>
          <button class="tab-btn" onclick="_comFiltrar('curso')">Curso · ${cursoStr}</button>
        </div>` : ''}
        <div id="com-cards">
          ${_COM_DATA.length === 0
            ? `<div class="card"><p class="empty-msg">No hay comunicados aún.</p></div>`
            : _COM_DATA.map(c => _comCardText(c, leidosIds)).join('')
          }
        </div>
      </div>`;

    // Deep link: scrollear y resaltar el comunicado específico si viene de inicio
    const targetId = _DEEP_LINK_ID;
    _DEEP_LINK_ID = null;
    if (targetId) {
      setTimeout(() => {
        const card = document.getElementById('com-card-' + targetId);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
          card.classList.add('com-card--highlight');
          setTimeout(() => card.classList.remove('com-card--highlight'), 2000);
        }
      }, 50);
    }

  } catch (e) {
    el.innerHTML = `
      <div class="page-body">
        <div class="alert-card alert-danger">
          <p>No se pudieron cargar los comunicados. Intentá de nuevo.</p>
        </div>
      </div>`;
  }
}

function _comFiltrar(f) {
  _COM_FILTRO = f;
  const items = f === 'nivel'
    ? _COM_DATA.filter(c => !c.curso_id)
    : f === 'curso'
    ? _COM_DATA.filter(c => !!c.curso_id)
    : _COM_DATA;

  document.querySelectorAll('#com-filtros .tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('onclick') === `_comFiltrar('${f}')`);
  });

  const cardsEl = document.getElementById('com-cards');
  if (!cardsEl) return;
  cardsEl.innerHTML = items.length
    ? items.map(c => _comCardText(c, _COM_LEIDOS)).join('')
    : `<div class="card"><p class="empty-msg">No hay comunicados para este filtro.</p></div>`;
}

function _comCardText(c, leidosIds) {
  const sinLeer  = !leidosIds.has(c.id);
  const cur      = c.cursos;
  const cursoTxt = cur
    ? `${cur.nombre}${cur.division ? ' ' + cur.division : ''}`
    : c.nivel ? `Nivel ${nivelLabel(c.nivel)}` : 'General';
  const autor    = c.usuarios?.nombre_completo || '';

  return `
    <div class="card com-text-card${sinLeer ? ' com-card--unread' : ''}" id="com-card-${c.id}">
      <div class="com-meta" style="margin-bottom:8px">
        <span class="badge badge-com">${cursoTxt}</span>
        ${sinLeer ? `<span class="com-new-dot" id="com-dot-${c.id}"></span>` : ''}
        <span class="com-fecha">${fechaRelativa(c.created_at)}</span>
      </div>
      <p class="com-titulo">${c.titulo}</p>
      ${c.cuerpo ? `<p class="com-text-cuerpo">${c.cuerpo.replace(/\n/g, '<br>')}</p>` : ''}
      ${autor ? `<p class="com-autor" style="margin-top:10px">— ${autor}</p>` : ''}
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--color-border,rgba(0,0,0,0.07))">
        <button class="btn-visto${sinLeer ? '' : ' visto'}" id="btn-visto-${c.id}"
          onclick="_comMarcarVisto('${c.id}', this)"
          ${sinLeer ? '' : 'disabled'}>
          ${sinLeer ? '👁 Marcar como visto' : '✓ Visto'}
        </button>
      </div>
    </div>`;
}

async function _comMarcarVisto(id, btn) {
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  try {
    await sb.from('comunicado_lecturas').upsert(
      [{ comunicado_id: id, usuario_id: USUARIO_FAMILIAR.id }],
      { onConflict: 'comunicado_id,usuario_id' }
    );
    const card = document.getElementById('com-card-' + id);
    if (card) card.classList.remove('com-card--unread');
    document.getElementById('com-dot-' + id)?.remove();
    if (btn) { btn.classList.add('visto'); btn.textContent = '✓ Visto'; }
    fetchUnreadCount();
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = '👁 Marcar como visto'; }
  }
}
