// =====================================================
// COMUNICADOS.JS — Comunicados por curso + novedades (familias)
// =====================================================

const _FAM_NIVEL_LABEL = { inicial: 'Inicial', primario: 'Primario', secundario: 'Secundario' };

let _COM_DATA = [];

async function rComunicados() {
  showLoading('comunicados');
  const el = document.getElementById('page-comunicados');

  const cursoId     = ALUMNO_ACTUAL?.cursos?.id;
  const nivelAlumno = ALUMNO_ACTUAL?.cursos?.nivel;

  try {
    if (!cursoId) {
      el.innerHTML = `
        <div class="page-body">
          <div class="page-header"><h1 class="page-title">Comunicados</h1></div>
          <div class="card"><p class="empty-msg">No hay información del curso del alumno.</p></div>
        </div>`;
      return;
    }

    // Fetch comunicados (por curso) y novedades (por nivel del alumno) en paralelo
    const [comRes, novRes] = await Promise.all([
      sb.from('comunicados')
        .select('id, titulo, cuerpo, tipo, created_at, usuarios(nombre_completo), cursos(id, nombre, division, nivel)')
        .eq('institucion_id', USUARIO_FAMILIAR.institucion_id)
        .eq('tipo', 'comunicado')
        .eq('curso_id', cursoId)
        .order('created_at', { ascending: false })
        .limit(30),
      sb.from('comunicados')
        .select('id, titulo, cuerpo, tipo, nivel, curso_id, created_at, usuarios(nombre_completo), comunicado_imagenes(id, imagen_url, orden)')
        .eq('institucion_id', USUARIO_FAMILIAR.institucion_id)
        .eq('tipo', 'novedad')
        .or(`nivel.is.null,nivel.eq.${nivelAlumno}`)
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    if (comRes.error) throw comRes.error;

    const comunicados = comRes.data || [];

    // Filtrar novedades: nivel-wide (curso_id null) o dirigidas específicamente a este curso
    const novedades = (novRes.data || [])
      .filter(n => n.curso_id === null || n.curso_id === cursoId)
      .map(n => ({
        ...n,
        comunicado_imagenes: (n.comunicado_imagenes || []).sort((a, b) => a.orden - b.orden),
      }));

    // Merge y ordenar por fecha descendente
    _COM_DATA = [...comunicados, ...novedades].sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    );

    // Lecturas previas (solo para comunicados)
    let leidosIds = new Set();
    const comIds = comunicados.map(c => c.id);
    if (comIds.length) {
      const { data: lecturas } = await sb
        .from('comunicado_lecturas')
        .select('comunicado_id')
        .eq('usuario_id', USUARIO_FAMILIAR.id)
        .in('comunicado_id', comIds);
      leidosIds = new Set((lecturas || []).map(l => l.comunicado_id));
    }

    el.innerHTML = `
      <div class="page-body">
        <div class="page-header">
          <h1 class="page-title">Comunicados</h1>
        </div>
        ${_COM_DATA.length === 0
          ? `<div class="card"><p class="empty-msg">No hay comunicados del curso aún.</p></div>`
          : _COM_DATA.map(c =>
              c.tipo === 'novedad'
                ? _novCardFamilias(c)
                : _comCardText(c, leidosIds)
            ).join('')
        }
      </div>`;

    // Marcar comunicados como leídos → actualiza campana
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
          <p>No se pudieron cargar los comunicados. Intentá de nuevo.</p>
        </div>
      </div>`;
  }
}

function _comCardText(c, leidosIds) {
  const sinLeer  = !leidosIds.has(c.id);
  const cur      = c.cursos;
  const cursoTxt = cur ? `${cur.nombre}${cur.division ? ' ' + cur.division : ''}` : 'Comunicado';
  const autor    = c.usuarios?.nombre_completo || '';

  return `
    <div class="card com-text-card${sinLeer ? ' com-card--unread' : ''}">
      <div class="com-meta" style="margin-bottom:8px">
        <span class="badge badge-com">${cursoTxt}</span>
        ${sinLeer ? '<span class="com-new-dot"></span>' : ''}
        <span class="com-fecha">${fechaRelativa(c.created_at)}</span>
      </div>
      <p class="com-titulo">${c.titulo}</p>
      ${c.cuerpo ? `<p class="com-text-cuerpo">${c.cuerpo.replace(/\n/g, '<br>')}</p>` : ''}
      ${autor ? `<p class="com-autor" style="margin-top:10px">— ${autor}</p>` : ''}
    </div>`;
}

function _novCardFamilias(nov) {
  const imgs     = (nov.comunicado_imagenes || []).map(i => i.imagen_url);
  const autor    = nov.usuarios?.nombre_completo || '';
  const etiqueta = nov.nivel ? (_FAM_NIVEL_LABEL[nov.nivel] || nov.nivel) : 'Institución';

  let imgHtml = '';
  if (imgs.length === 1) {
    imgHtml = `<img src="${imgs[0]}" alt="" loading="lazy" style="width:100%;max-height:300px;object-fit:contain;display:block;background:var(--color-bg-secondary,#f5f5f5)">`;
  } else if (imgs.length > 1) {
    const id = nov.id;
    imgHtml = `
      <div style="position:relative">
        <div id="nov-car-${id}" style="display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-ms-overflow-style:none">
          ${imgs.map(url => `
            <div style="min-width:100%;scroll-snap-align:start">
              <img src="${url}" alt="" loading="lazy" style="width:100%;max-height:300px;object-fit:contain;display:block;background:var(--color-bg-secondary,#f5f5f5)">
            </div>`).join('')}
        </div>
        <button onclick="_novCarGoFam('${id}',-1,event)" style="position:absolute;top:50%;left:8px;transform:translateY(-50%);background:rgba(0,0,0,0.45);border:none;color:#fff;border-radius:50%;width:32px;height:32px;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center">‹</button>
        <button onclick="_novCarGoFam('${id}',1,event)" style="position:absolute;top:50%;right:8px;transform:translateY(-50%);background:rgba(0,0,0,0.45);border:none;color:#fff;border-radius:50%;width:32px;height:32px;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center">›</button>
      </div>`;
  }

  return `
    <div class="card com-text-card" style="padding:0;overflow:hidden">
      ${imgHtml}
      <div style="padding:14px 16px">
        <div class="com-meta" style="margin-bottom:8px">
          <span class="badge badge-nov">${etiqueta}</span>
          <span class="com-fecha">${fechaRelativa(nov.created_at)}</span>
        </div>
        <p class="com-titulo">${nov.titulo}</p>
        ${nov.cuerpo ? `<p class="com-text-cuerpo">${nov.cuerpo.replace(/\n/g, '<br>')}</p>` : ''}
        ${autor ? `<p class="com-autor" style="margin-top:10px">— ${autor}</p>` : ''}
      </div>
    </div>`;
}

function _novCarGoFam(id, dir, ev) {
  if (ev) ev.stopPropagation();
  const car = document.getElementById(`nov-car-${id}`);
  if (!car) return;
  car.scrollBy({ left: dir * car.offsetWidth, behavior: 'smooth' });
}
