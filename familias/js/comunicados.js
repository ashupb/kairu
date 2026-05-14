// =====================================================
// COMUNICADOS.JS — Avisos institucionales (familias)
// =====================================================

const _COM_NIVEL_LABEL = { inicial: 'Inicial', primario: 'Primario', secundario: 'Secundario' };

async function rComunicados() {
  showLoading('comunicados');
  const el = document.getElementById('page-comunicados');

  try {
    const nivelAlumno = ALUMNO_ACTUAL?.cursos?.nivel;
    const nivelFilter = nivelAlumno
      ? `nivel.is.null,nivel.eq.${nivelAlumno}`
      : 'nivel.is.null';

    const { data, error } = await sb
      .from('comunicados')
      .select('id, titulo, cuerpo, imagen_url, nivel, created_at, usuarios(nombre_completo)')
      .eq('institucion_id', USUARIO_FAMILIAR.institucion_id)
      .eq('tipo', 'institucional')
      .or(nivelFilter)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    const comunicados = data || [];

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
      <div class="page-body">
        <div class="page-header">
          <h1 class="page-title">Avisos</h1>
        </div>
        ${comunicados.length === 0
          ? `<div class="card"><p class="empty-msg">No hay avisos publicados aún.</p></div>`
          : comunicados.map(c => _comCard(c, leidosIds)).join('')
        }
      </div>`;

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

function _comCard(c, leidosIds) {
  const sinLeer  = !leidosIds.has(c.id);
  const nivelTxt = c.nivel
    ? (_COM_NIVEL_LABEL[c.nivel] || c.nivel).toUpperCase()
    : 'TODOS LOS NIVELES';
  const autor = c.usuarios?.nombre_completo || '';

  return `
    <div class="card com-card${sinLeer ? ' com-card--unread' : ''}">
      ${c.imagen_url ? `<img class="com-img" src="${c.imagen_url}" alt="" loading="lazy">` : ''}
      <div class="com-body">
        <div class="com-meta">
          <span class="badge badge-success">${nivelTxt}</span>
          ${sinLeer ? '<span class="com-new-dot"></span>' : ''}
          <span class="com-fecha">${fechaRelativa(c.created_at)}</span>
        </div>
        <p class="com-titulo">${c.titulo}</p>
        ${c.cuerpo ? `<p class="com-cuerpo">${c.cuerpo}</p>` : ''}
        ${autor ? `<p class="com-autor">— ${autor}</p>` : ''}
      </div>
    </div>`;
}
