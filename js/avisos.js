// =====================================================
// AVISOS.JS — Comunicación interna (Novedades + Comunicados)
// =====================================================

let _AVISOS_DATA    = [];   // novedades
let _COM_INT_DATA   = [];   // comunicados por curso
let _COM_INT_CURSOS = [];   // cursos disponibles para selector
let _COM_INT_VISTOS = {};   // { comunicado_id: count } de lecturas confirmadas
let _AVISOS_FILTRO_NOV_NIVEL = '';
let _AVISOS_FILTRO_NOV_CURSO = '';
let _AVISOS_FILTRO_COM_NIVEL = '';
let _AVISOS_FILTRO_COM_CURSO = '';
const _AV_NIVEL_LABEL = { inicial: 'Inicial', primario: 'Primario', secundario: 'Secundario' };

// ── Carga datos compartidos (novedades + comunicados + cursos) ─────
async function _avisosCargarDatos() {
  const esDir    = USUARIO_ACTUAL?.rol === 'director_general';
  const nivelFil = esDir ? null : (USUARIO_ACTUAL?.nivel || null);

  // Cursos: director ve todos; los demás solo su nivel
  let cursosQ = sb.from('cursos')
    .select('id, nombre, division, nivel')
    .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
    .order('nivel').order('nombre');
  if (nivelFil) cursosQ = cursosQ.eq('nivel', nivelFil);

  const [novRes, comRes, curRes] = await Promise.all([
    sb.from('comunicados')
      .select('id, titulo, cuerpo, nivel, curso_id, imagen_url, created_at, usuarios(nombre_completo), comunicado_imagenes(id, imagen_url, orden)')
      .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
      .eq('tipo', 'novedad')
      .order('created_at', { ascending: false })
      .limit(40),
    sb.from('comunicados')
      .select('id, titulo, cuerpo, curso_id, created_at, usuarios(nombre_completo), cursos(id, nombre, division, nivel)')
      .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
      .eq('tipo', 'comunicado')
      .order('created_at', { ascending: false })
      .limit(40),
    cursosQ,
  ]);

  let novedades = novRes.data || [];
  if (novRes.error) {
    const { data: nov2 } = await sb
      .from('comunicados')
      .select('id, titulo, cuerpo, nivel, curso_id, imagen_url, created_at, usuarios(nombre_completo)')
      .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
      .eq('tipo', 'novedad')
      .order('created_at', { ascending: false })
      .limit(40);
    novedades = nov2 || [];
  } else {
    novedades = novedades.map(c => ({
      ...c,
      comunicado_imagenes: (c.comunicado_imagenes || []).sort((a, b) => a.orden - b.orden),
    }));
  }

  _AVISOS_DATA    = novedades;
  _COM_INT_DATA   = comRes.data || [];
  _COM_INT_CURSOS = curRes.data || [];

  _COM_INT_VISTOS = {};
  const comIds = _COM_INT_DATA.map(c => c.id);
  if (comIds.length) {
    const { data: lecturasData } = await sb
      .from('comunicado_lecturas')
      .select('comunicado_id')
      .in('comunicado_id', comIds);
    (lecturasData || []).forEach(l => {
      _COM_INT_VISTOS[l.comunicado_id] = (_COM_INT_VISTOS[l.comunicado_id] || 0) + 1;
    });
  }
}

// ── Página Novedades ──────────────────────────────────
async function rNovedades() {
  const el = document.getElementById('page-novedades');
  if (!el) return;
  showLoading('novedades');
  const perms = _avisosPermisos();
  _AVISOS_FILTRO_NOV_NIVEL = USUARIO_ACTUAL?.rol === 'director_general' ? '' : (USUARIO_ACTUAL?.nivel || '');
  _AVISOS_FILTRO_NOV_CURSO = '';
  try {
    await _avisosCargarDatos();
    el.innerHTML = `
      <div style="max-width:860px;margin:0 auto;padding:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px">
          <h2 style="font-size:18px;font-weight:700;color:var(--txt)">Novedades</h2>
          ${perms.crear ? `<button class="btn-p" id="av-btn-nuevo" onclick="_avisosFormNovedad()">+ Nueva novedad</button>` : ''}
        </div>
        <div id="av-form-wrap"></div>
        <div id="av-nov-pane">${_avisosNovPaneHtml(_AVISOS_DATA, perms)}</div>
      </div>`;
  } catch(e) {
    el.innerHTML = `<div style="padding:60px;text-align:center;color:var(--txt3)">No se pudo cargar las novedades. Intentá de nuevo.</div>`;
  }
}

// ── Página Comunicados ────────────────────────────────
async function rComunicados() {
  const el = document.getElementById('page-comunicados');
  if (!el) return;
  showLoading('comunicados');
  const perms = _avisosPermisos();
  _AVISOS_FILTRO_COM_NIVEL = USUARIO_ACTUAL?.rol === 'director_general' ? '' : (USUARIO_ACTUAL?.nivel || '');
  _AVISOS_FILTRO_COM_CURSO = '';
  try {
    await _avisosCargarDatos();
    el.innerHTML = `
      <div style="max-width:860px;margin:0 auto;padding:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px">
          <h2 style="font-size:18px;font-weight:700;color:var(--txt)">Comunicados</h2>
          ${perms.crear ? `<button class="btn-p" id="av-btn-nuevo" onclick="_avisosFormComunicado()">+ Nuevo comunicado</button>` : ''}
        </div>
        <div id="av-form-wrap"></div>
        <div id="av-com-pane">${_avisosComPaneHtml(_COM_INT_DATA, perms)}</div>
      </div>`;
  } catch(e) {
    el.innerHTML = `<div style="padding:60px;text-align:center;color:var(--txt3)">No se pudo cargar los comunicados. Intentá de nuevo.</div>`;
  }
}

// ── Filtro pills ──────────────────────────────────────
function _avFiltroStyle(active) {
  return active
    ? `padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;border:none;background:var(--green);color:#fff;cursor:pointer;transition:background .15s`
    : `padding:4px 14px;border-radius:20px;font-size:12px;font-weight:500;border:1.5px solid var(--brd);background:var(--bg2,#f5f5f5);color:var(--txt2);cursor:pointer;transition:background .15s`;
}

// ── Panel HTML — Novedades ────────────────────────────
function _avisosNovPaneHtml(todos, perms) {
  const esDir = USUARIO_ACTUAL?.rol === 'director_general';
  const nivelesDisp = ['inicial', 'primario', 'secundario'].filter(n => _COM_INT_CURSOS.some(c => c.nivel === n));
  const filtroNivelHtml = esDir && nivelesDisp.length > 0 ? `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
      <button class="av-fn" data-val="" onclick="_avNovFiltrar('')" style="${_avFiltroStyle(_AVISOS_FILTRO_NOV_NIVEL === '')}">Todos los niveles</button>
      ${nivelesDisp.map(n => `
        <button class="av-fn" data-val="${n}" onclick="_avNovFiltrar('${n}')" style="${_avFiltroStyle(_AVISOS_FILTRO_NOV_NIVEL === n)}">${_AV_NIVEL_LABEL[n]}</button>
      `).join('')}
    </div>` : '';

  const cursosDropdown = (esDir && _AVISOS_FILTRO_NOV_NIVEL)
    ? _COM_INT_CURSOS.filter(c => c.nivel === _AVISOS_FILTRO_NOV_NIVEL)
    : _COM_INT_CURSOS;
  const cursoOpts = cursosDropdown.map(c => {
    const sufijo = (!esDir || !_AVISOS_FILTRO_NOV_NIVEL) ? ` — ${_AV_NIVEL_LABEL[c.nivel] || c.nivel}` : '';
    return `<option value="${c.id}" ${_AVISOS_FILTRO_NOV_CURSO === c.id ? 'selected' : ''}>${c.nombre}${c.division ? ' ' + c.division : ''}${sufijo}</option>`;
  }).join('');
  const filtroCursoHtml = cursosDropdown.length ? `
    <div style="margin-bottom:14px">
      <select class="inp-base" style="max-width:280px" onchange="_avNovFiltrarCurso(this.value)">
        <option value="">Todos los cursos</option>${cursoOpts}
      </select>
    </div>` : '';

  const filtrada = _avAplicarFiltrosNov(todos);
  return `${filtroNivelHtml}${filtroCursoHtml}<div id="av-nov-lista">${_avisosNovListaHtml(filtrada, perms)}</div>`;
}

// ── Panel HTML — Comunicados ──────────────────────────
function _avisosComPaneHtml(todos, perms) {
  const esDir = USUARIO_ACTUAL?.rol === 'director_general';
  const nivelesDisp = ['inicial', 'primario', 'secundario'].filter(n => _COM_INT_CURSOS.some(c => c.nivel === n));
  const filtroNivelHtml = esDir && nivelesDisp.length > 0 ? `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
      <button class="av-fc" data-val="" onclick="_avComFiltrar('')" style="${_avFiltroStyle(_AVISOS_FILTRO_COM_NIVEL === '')}">Todos</button>
      ${nivelesDisp.map(n => `
        <button class="av-fc" data-val="${n}" onclick="_avComFiltrar('${n}')" style="${_avFiltroStyle(_AVISOS_FILTRO_COM_NIVEL === n)}">${_AV_NIVEL_LABEL[n]}</button>
      `).join('')}
    </div>` : '';

  const cursosDropdown = (esDir && _AVISOS_FILTRO_COM_NIVEL)
    ? _COM_INT_CURSOS.filter(c => c.nivel === _AVISOS_FILTRO_COM_NIVEL)
    : _COM_INT_CURSOS;
  const cursoOpts = cursosDropdown.map(c => {
    const sufijo = (!esDir || !_AVISOS_FILTRO_COM_NIVEL) ? ` — ${_AV_NIVEL_LABEL[c.nivel] || c.nivel}` : '';
    return `<option value="${c.id}" ${_AVISOS_FILTRO_COM_CURSO === c.id ? 'selected' : ''}>${c.nombre}${c.division ? ' ' + c.division : ''}${sufijo}</option>`;
  }).join('');
  const filtroCursoHtml = cursosDropdown.length ? `
    <div style="margin-bottom:14px">
      <select class="inp-base" style="max-width:280px" onchange="_avComFiltrarCurso(this.value)">
        <option value="">Todos los cursos</option>${cursoOpts}
      </select>
    </div>` : '';

  const filtrada = _avAplicarFiltrosCom(todos);
  return `${filtroNivelHtml}${filtroCursoHtml}<div id="av-com-lista">${_avisosComListaHtml(filtrada, perms)}</div>`;
}

// ── Aplicar filtros ───────────────────────────────────
function _avAplicarFiltrosNov(todos) {
  let lista = todos;
  if (_AVISOS_FILTRO_NOV_NIVEL) lista = lista.filter(c => c.nivel === _AVISOS_FILTRO_NOV_NIVEL);
  if (_AVISOS_FILTRO_NOV_CURSO) {
    const curso = _COM_INT_CURSOS.find(c => c.id === _AVISOS_FILTRO_NOV_CURSO);
    lista = lista.filter(n =>
      n.curso_id === _AVISOS_FILTRO_NOV_CURSO ||
      (!n.curso_id && (n.nivel === null || n.nivel === (curso?.nivel || '')))
    );
  }
  return lista;
}

function _avAplicarFiltrosCom(todos) {
  let lista = todos;
  if (_AVISOS_FILTRO_COM_NIVEL) lista = lista.filter(c => c.cursos?.nivel === _AVISOS_FILTRO_COM_NIVEL);
  if (_AVISOS_FILTRO_COM_CURSO) lista = lista.filter(c => c.curso_id === _AVISOS_FILTRO_COM_CURSO);
  return lista;
}

// ── Filtrar novedades ─────────────────────────────────
function _avNovFiltrar(nivel) {
  _AVISOS_FILTRO_NOV_NIVEL = nivel;
  _AVISOS_FILTRO_NOV_CURSO = '';
  const pane = document.getElementById('av-nov-pane');
  if (pane) pane.innerHTML = _avisosNovPaneHtml(_AVISOS_DATA, _avisosPermisos());
}

function _avNovFiltrarCurso(cursoId) {
  _AVISOS_FILTRO_NOV_CURSO = cursoId;
  const perms = _avisosPermisos();
  const listaEl = document.getElementById('av-nov-lista');
  if (listaEl) listaEl.innerHTML = _avisosNovListaHtml(_avAplicarFiltrosNov(_AVISOS_DATA), perms);
}

// ── Filtrar comunicados ───────────────────────────────
function _avComFiltrar(nivel) {
  _AVISOS_FILTRO_COM_NIVEL = nivel;
  _AVISOS_FILTRO_COM_CURSO = '';
  const pane = document.getElementById('av-com-pane');
  if (pane) pane.innerHTML = _avisosComPaneHtml(_COM_INT_DATA, _avisosPermisos());
}

function _avComFiltrarCurso(cursoId) {
  _AVISOS_FILTRO_COM_CURSO = cursoId;
  const perms = _avisosPermisos();
  const listaEl = document.getElementById('av-com-lista');
  if (listaEl) listaEl.innerHTML = _avisosComListaHtml(_avAplicarFiltrosCom(_COM_INT_DATA), perms);
}

// ── Permisos ──────────────────────────────────────────
function _avisosPermisos() {
  const rol = USUARIO_ACTUAL?.rol;
  return { crear: ['director_general', 'directivo_nivel', 'preceptor'].includes(rol) };
}

// ── Form: nueva / editar novedad ──────────────────────
function _avisosFormNovedad(editData = null) {
  const wrap = document.getElementById('av-form-wrap');
  if (!wrap) return;
  if (!editData && wrap.innerHTML) { wrap.innerHTML = ''; return; }
  const c = editData;
  const isEdit = !!c;

  const imgsActualesHtml = isEdit ? _avisosEditImgsHtml(c) : '';

  // En edición: selector de nivel simple. En nuevo: selector nivel→curso de dos pasos.
  const destinatariosHtml = isEdit ? `
    <div style="margin-bottom:12px">
      <label style="font-size:11px;font-weight:600;color:var(--txt2);display:block;margin-bottom:5px;letter-spacing:.05em">NIVEL DESTINATARIO</label>
      <div style="display:flex;gap:10px;flex-wrap:wrap;padding:10px;border:1px solid var(--brd);border-radius:var(--rad)">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
          <input type="checkbox" id="av-niv-todos" onchange="_avNivTodosChange(this)" ${!c?.nivel ? 'checked' : ''}>
          Todos los niveles
        </label>
        ${['inicial','primario','secundario'].map(n => `
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
            <input type="checkbox" class="av-niv-spec" value="${n}" onchange="_avNivSpecChange()" ${c?.nivel === n ? 'checked' : ''}>
            ${_AV_NIVEL_LABEL[n]}
          </label>`).join('')}
      </div>
    </div>` : _avDestinoSelectorHtml();

  wrap.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-t">${isEdit ? 'Editar novedad' : 'Nueva novedad'}</div>
      ${destinatariosHtml}
      <div style="margin-bottom:12px">
        <label style="font-size:11px;font-weight:600;color:var(--txt2);display:block;margin-bottom:5px;letter-spacing:.05em">TÍTULO *</label>
        <input type="text" id="av-titulo" value="${c?.titulo||''}" placeholder="Título de la novedad" maxlength="120">
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:11px;font-weight:600;color:var(--txt2);display:block;margin-bottom:5px;letter-spacing:.05em">MENSAJE</label>
        <textarea id="av-cuerpo" rows="3" placeholder="Descripción opcional..." style="resize:vertical">${c?.cuerpo||''}</textarea>
      </div>
      ${imgsActualesHtml}
      <div style="margin-bottom:16px">
        <label style="font-size:11px;font-weight:600;color:var(--txt2);display:block;margin-bottom:5px;letter-spacing:.05em">${isEdit ? 'AGREGAR IMÁGENES' : 'IMÁGENES (opcional — podés seleccionar varias)'}</label>
        <input type="file" id="av-imagen" accept="image/*" multiple onchange="_avisosPreview(this)" style="font-size:12px;width:100%;padding:0">
        <div id="av-preview-wrap" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"></div>
      </div>
      <div class="acc">
        <button class="btn-p" id="av-btn-pub" onclick="${isEdit ? `_avisosGuardarEdicion('${c.id}')` : '_avisosGuardar()'}">
          ${isEdit ? 'Guardar cambios' : 'Publicar novedad'}
        </button>
        <button class="btn-s" onclick="document.getElementById('av-form-wrap').innerHTML=''">Cancelar</button>
      </div>
    </div>`;

  document.getElementById('av-titulo')?.focus();
}

function _avisosEditImgsHtml(c) {
  const imgs = c.comunicado_imagenes?.length
    ? c.comunicado_imagenes
    : (c.imagen_url ? [{ id: null, imagen_url: c.imagen_url }] : []);
  if (!imgs.length) return '';
  return `
    <div style="margin-bottom:12px">
      <label style="font-size:11px;font-weight:600;color:var(--txt2);display:block;margin-bottom:5px;letter-spacing:.05em">IMÁGENES ACTUALES</label>
      <div id="av-e-imgs-list-${c.id}" style="display:flex;flex-wrap:wrap;gap:8px">
        ${imgs.map(img => img.id ? `
          <div id="av-img-${img.id}" style="position:relative">
            <img src="${img.imagen_url}" alt="" style="width:80px;height:80px;object-fit:cover;border-radius:var(--rad);display:block">
            <button onclick="_avisosEliminarImagen('${img.id}','${img.imagen_url}','${c.id}')"
              style="position:absolute;top:2px;right:2px;background:#d63b2f;border:none;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0">✕</button>
          </div>` : `
          <img src="${img.imagen_url}" alt="" style="width:80px;height:80px;object-fit:cover;border-radius:var(--rad)">`
        ).join('')}
      </div>
    </div>`;
}

// ── Form: nuevo / editar comunicado de curso ──────────
function _avisosFormComunicado(editData = null) {
  const wrap = document.getElementById('av-form-wrap');
  if (!wrap) return;
  if (!editData && wrap.innerHTML) { wrap.innerHTML = ''; return; }
  const c = editData;
  const isEdit = !!c;

  // En edición: selector simple. En nuevo: selector nivel→curso de dos pasos.
  let destinatariosHtml;
  if (isEdit) {
    const cursosOpts = _COM_INT_CURSOS.map(cu => {
      const nombre = `${cu.nombre}${cu.division ? ' ' + cu.division : ''} (${_AV_NIVEL_LABEL[cu.nivel] || cu.nivel})`;
      return `<option value="${cu.id}" ${c?.curso_id === cu.id ? 'selected' : ''}>${nombre}</option>`;
    }).join('');
    destinatariosHtml = `
      <div style="margin-bottom:12px">
        <label style="font-size:11px;font-weight:600;color:var(--txt2);display:block;margin-bottom:5px;letter-spacing:.05em">CURSO DESTINATARIO *</label>
        <select id="av-curso">
          <option value="">Seleccioná un curso…</option>
          ${cursosOpts}
        </select>
      </div>`;
  } else {
    destinatariosHtml = _avDestinoSelectorHtml();
  }

  wrap.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-t">${isEdit ? 'Editar comunicado' : 'Nuevo comunicado'}</div>
      ${destinatariosHtml}
      <div style="margin-bottom:12px">
        <label style="font-size:11px;font-weight:600;color:var(--txt2);display:block;margin-bottom:5px;letter-spacing:.05em">TÍTULO *</label>
        <input type="text" id="av-titulo" value="${c?.titulo||''}" placeholder="Asunto del comunicado" maxlength="120">
      </div>
      <div style="margin-bottom:16px">
        <label style="font-size:11px;font-weight:600;color:var(--txt2);display:block;margin-bottom:5px;letter-spacing:.05em">MENSAJE *</label>
        <textarea id="av-cuerpo" rows="5" placeholder="Escribí el comunicado para las familias del curso..." style="resize:vertical">${c?.cuerpo||''}</textarea>
      </div>
      <div class="acc">
        <button class="btn-p" id="av-btn-pub" onclick="${isEdit ? `_avisosGuardarComunicadoEdicion('${c.id}')` : '_avisosGuardarComunicado()'}">
          ${isEdit ? 'Guardar cambios' : 'Enviar comunicado'}
        </button>
        <button class="btn-s" onclick="document.getElementById('av-form-wrap').innerHTML=''">Cancelar</button>
      </div>
    </div>`;

  document.getElementById('av-titulo')?.focus();
}

// ── Helpers interacción de checkboxes de nivel ────────
function _avNivTodosChange(cb) {
  if (cb.checked) {
    document.querySelectorAll('.av-niv-spec').forEach(c => { c.checked = false; });
  }
  const sec = document.getElementById('av-cursos-sec');
  if (sec) sec.style.display = 'none';
}

function _avNivSpecChange() {
  const anySpec = Array.from(document.querySelectorAll('.av-niv-spec')).some(c => c.checked);
  const todos = document.getElementById('av-niv-todos');
  if (todos) todos.checked = !anySpec;
  const sec = document.getElementById('av-cursos-sec');
  if (sec) {
    sec.style.display = anySpec ? '' : 'none';
    if (anySpec) _avActualizarCursosSec();
  }
}

// Devuelve array de niveles seleccionados (para edición de novedades)
function _avGetNivelesSeleccionados() {
  const todos = document.getElementById('av-niv-todos');
  if (todos?.checked) return [null];
  const specs = Array.from(document.querySelectorAll('.av-niv-spec'))
    .filter(c => c.checked).map(c => c.value);
  return specs.length ? specs : [null];
}

// ── Selector nivel→curso (formulario nuevo) ───────────
function _avDestinoSelectorHtml() {
  const nivelesDisp = [...new Set(_COM_INT_CURSOS.map(c => c.nivel))].filter(Boolean)
    .sort((a, b) => ['inicial','primario','secundario'].indexOf(a) - ['inicial','primario','secundario'].indexOf(b));

  return `
    <div style="margin-bottom:12px">
      <label style="font-size:11px;font-weight:600;color:var(--txt2);display:block;margin-bottom:5px;letter-spacing:.05em">NIVEL DESTINATARIO *</label>
      <div style="display:flex;gap:10px;flex-wrap:wrap;padding:10px;border:1px solid var(--brd);border-radius:var(--rad)">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
          <input type="checkbox" id="av-niv-todos" onchange="_avNivTodosChange(this)" checked>
          Todos los niveles
        </label>
        ${nivelesDisp.map(n => `
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
            <input type="checkbox" class="av-niv-spec" value="${n}" onchange="_avNivSpecChange()">
            ${_AV_NIVEL_LABEL[n] || n}
          </label>`).join('')}
      </div>
    </div>
    <div id="av-cursos-sec" style="display:none;margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
        <label style="font-size:11px;font-weight:600;color:var(--txt2);letter-spacing:.05em">CURSOS DESTINATARIOS</label>
        <span>
          <button type="button" onclick="_avCursosSelAll(true)" style="font-size:11px;color:var(--green);border:none;background:none;cursor:pointer;padding:0">Todos</button>
          <span style="color:var(--txt3);margin:0 4px">·</span>
          <button type="button" onclick="_avCursosSelAll(false)" style="font-size:11px;color:var(--txt2);border:none;background:none;cursor:pointer;padding:0">Ninguno</button>
        </span>
      </div>
      <div id="av-cursos-lista" style="max-height:220px;overflow-y:auto;border:1px solid var(--brd);border-radius:var(--rad);padding:10px">
      </div>
    </div>`;
}

function _avActualizarCursosSec() {
  const nivelesSelec = Array.from(document.querySelectorAll('.av-niv-spec:checked')).map(c => c.value);
  const lista = document.getElementById('av-cursos-lista');
  if (!lista) return;

  const cursosFiltrados = _COM_INT_CURSOS.filter(c => nivelesSelec.includes(c.nivel));
  if (!cursosFiltrados.length) {
    lista.innerHTML = '<p style="font-size:13px;color:var(--txt3)">No hay cursos para los niveles seleccionados.</p>';
    return;
  }

  const porNivel = {};
  cursosFiltrados.forEach(c => {
    if (!porNivel[c.nivel]) porNivel[c.nivel] = [];
    porNivel[c.nivel].push(c);
  });

  lista.innerHTML = Object.entries(porNivel).map(([nivel, cursos]) => `
    <div style="margin-bottom:10px">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:4px">
        <input type="checkbox" class="av-niv-todos-cursos" data-nivel="${nivel}" checked
          onchange="_avTodosNivCursosChange('${nivel}', this)">
        <span style="font-size:11px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.05em">Todos los cursos de ${_AV_NIVEL_LABEL[nivel]}</span>
      </label>
      <div style="padding-left:16px">
        ${cursos.map(cu => `
          <label style="display:flex;align-items:center;gap:8px;padding:3px 2px;cursor:pointer;border-radius:4px">
            <input type="checkbox" class="av-com-curso" value="${cu.id}" data-nivel="${nivel}" checked
              onchange="_avCursoChkChange('${nivel}')">
            <span style="font-size:13px">${cu.nombre}${cu.division ? ' ' + cu.division : ''}</span>
          </label>`).join('')}
      </div>
    </div>`).join('');
}

function _avTodosNivCursosChange(nivel, cb) {
  document.querySelectorAll(`.av-com-curso[data-nivel="${nivel}"]`).forEach(c => { c.checked = cb.checked; });
}

function _avCursoChkChange(nivel) {
  const todos = document.querySelector(`.av-niv-todos-cursos[data-nivel="${nivel}"]`);
  if (!todos) return;
  const all     = document.querySelectorAll(`.av-com-curso[data-nivel="${nivel}"]`);
  const checked = document.querySelectorAll(`.av-com-curso[data-nivel="${nivel}"]:checked`);
  todos.checked       = all.length > 0 && all.length === checked.length;
  todos.indeterminate = checked.length > 0 && checked.length < all.length;
}

function _avCursosSelAll(check) {
  document.querySelectorAll('.av-com-curso').forEach(cb => { cb.checked = check; });
  document.querySelectorAll('.av-niv-todos-cursos').forEach(cb => { cb.checked = check; cb.indeterminate = false; });
}

function _avGetDestinosNovedad() {
  const todosNiv = document.getElementById('av-niv-todos');
  if (todosNiv?.checked) return [{ nivel: null, cursoId: null }];

  const resultados = [];
  const nivelesSelec = Array.from(document.querySelectorAll('.av-niv-spec:checked')).map(c => c.value);

  for (const nivel of nivelesSelec) {
    const todosNivCursos = document.querySelector(`.av-niv-todos-cursos[data-nivel="${nivel}"]`);
    if (todosNivCursos?.checked) {
      resultados.push({ nivel, cursoId: null });
    } else {
      const cursosChecked = Array.from(document.querySelectorAll(`.av-com-curso[data-nivel="${nivel}"]:checked`));
      if (cursosChecked.length === 0) {
        resultados.push({ nivel, cursoId: null });
      } else {
        cursosChecked.forEach(cb => resultados.push({ nivel, cursoId: cb.value }));
      }
    }
  }

  return resultados.length ? resultados : [{ nivel: null, cursoId: null }];
}

function _avGetDestinosCursoIds() {
  const todosNiv = document.getElementById('av-niv-todos');
  if (todosNiv?.checked) return _COM_INT_CURSOS.map(c => c.id);

  const resultados = [];
  const nivelesSelec = Array.from(document.querySelectorAll('.av-niv-spec:checked')).map(c => c.value);

  for (const nivel of nivelesSelec) {
    const todosNivCursos = document.querySelector(`.av-niv-todos-cursos[data-nivel="${nivel}"]`);
    if (todosNivCursos?.checked) {
      _COM_INT_CURSOS.filter(c => c.nivel === nivel).forEach(c => resultados.push(c.id));
    } else {
      Array.from(document.querySelectorAll(`.av-com-curso[data-nivel="${nivel}"]:checked`))
        .forEach(cb => resultados.push(cb.value));
    }
  }

  return resultados;
}

// ── Preview imágenes ──────────────────────────────────
function _avisosPreview(input) {
  const wrap = document.getElementById('av-preview-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  Array.from(input.files || []).forEach(file => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:var(--rad)';
    wrap.appendChild(img);
  });
}

// ── Guardar nueva novedad ─────────────────────────────
async function _avisosGuardar() {
  const btn      = document.getElementById('av-btn-pub');
  const titulo   = document.getElementById('av-titulo')?.value.trim();
  const cuerpo   = document.getElementById('av-cuerpo')?.value.trim() || null;
  const destinos = _avGetDestinosNovedad(); // [{nivel, cursoId}]
  const files    = Array.from(document.getElementById('av-imagen')?.files || []);

  if (!titulo) { alert('El título es obligatorio.'); return; }
  btn.disabled = true; btn.textContent = 'Publicando…';

  try {
    const blobs = [];
    for (const file of files) {
      try { blobs.push(await _avisosComprimir(file)); } catch (_) {}
    }

    for (const { nivel, cursoId } of destinos) {
      const { data: inserted, error } = await sb
        .from('comunicados')
        .insert({ institucion_id: USUARIO_ACTUAL.institucion_id, autor_id: USUARIO_ACTUAL.id, tipo: 'novedad', nivel: nivel || null, curso_id: cursoId || null, titulo, cuerpo, requiere_firma: false })
        .select('id').single();
      if (error) throw error;

      for (let i = 0; i < blobs.length; i++) {
        try {
          const path = `${USUARIO_ACTUAL.institucion_id}/${Date.now()}_${nivel||'todos'}_${i}.jpg`;
          const { error: storErr } = await sb.storage.from('comunicados').upload(path, blobs[i], { contentType: 'image/jpeg' });
          if (storErr) continue;
          const { data: urlData } = sb.storage.from('comunicados').getPublicUrl(path);
          await sb.from('comunicado_imagenes').insert({ comunicado_id: inserted.id, imagen_url: urlData.publicUrl, orden: i });
        } catch (_) {}
      }
    }

    await rNovedades();
  } catch (e) {
    alert('No se pudo publicar. Intentá de nuevo.');
    if (btn) { btn.disabled = false; btn.textContent = 'Publicar novedad'; }
  }
}

// ── Guardar nuevo comunicado de curso ─────────────────
async function _avisosGuardarComunicado() {
  const btn    = document.getElementById('av-btn-pub');
  const titulo = document.getElementById('av-titulo')?.value.trim();
  const cuerpo = document.getElementById('av-cuerpo')?.value.trim();

  // Nuevo: usa selector nivel→curso. Edición: fallback a select único.
  const idsPorSelector = _avGetDestinosCursoIds();
  const cursoIdSingle  = document.getElementById('av-curso')?.value;
  const ids = idsPorSelector.length ? idsPorSelector : (cursoIdSingle ? [cursoIdSingle] : []);

  if (!ids.length)         { alert('Seleccioná al menos un curso destinatario.'); return; }
  if (!titulo || !cuerpo)  { alert('El título y el mensaje son obligatorios.'); return; }

  btn.disabled = true; btn.textContent = 'Enviando…';

  try {
    const inserts = ids.map(cursoId => ({
      institucion_id: USUARIO_ACTUAL.institucion_id,
      autor_id: USUARIO_ACTUAL.id,
      tipo: 'comunicado',
      curso_id: cursoId,
      titulo,
      cuerpo,
      requiere_firma: false,
    }));
    const { error } = await sb.from('comunicados').insert(inserts);
    if (error) throw error;
    await rComunicados();
  } catch (e) {
    alert('No se pudo enviar. Intentá de nuevo.');
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar comunicado'; }
  }
}

// ── Editar novedad ────────────────────────────────────
function _avisosEditarNovedad(id) {
  const c = _AVISOS_DATA.find(x => x.id === id);
  if (!c) return;
  _avisosFormNovedad(c);
  document.getElementById('av-form-wrap')?.scrollIntoView({ behavior: 'smooth' });
}

// ── Editar comunicado ─────────────────────────────────
function _avisosEditarComunicado(id) {
  const c = _COM_INT_DATA.find(x => x.id === id);
  if (!c) return;
  _avisosFormComunicado(c);
  document.getElementById('av-form-wrap')?.scrollIntoView({ behavior: 'smooth' });
}

// ── Guardar edición de novedad ────────────────────────
async function _avisosGuardarEdicion(id) {
  const btn    = document.getElementById('av-btn-pub');
  const titulo = document.getElementById('av-titulo')?.value.trim();
  const cuerpo = document.getElementById('av-cuerpo')?.value.trim() || null;
  // En edición: solo se actualiza el primer nivel seleccionado (no crea múltiples)
  const nivelesSelec = _avGetNivelesSeleccionados();
  const nivel = nivelesSelec[0] ?? null;
  const files  = Array.from(document.getElementById('av-imagen')?.files || []);

  if (!titulo) { alert('El título es obligatorio.'); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  try {
    const { error } = await sb.from('comunicados').update({ titulo, cuerpo, nivel: nivel || null }).eq('id', id);
    if (error) throw error;

    const c = _AVISOS_DATA.find(x => x.id === id);
    const baseOrden = c?.comunicado_imagenes?.length || 0;
    for (let i = 0; i < files.length; i++) {
      try {
        const blob = await _avisosComprimir(files[i]);
        const path = `${USUARIO_ACTUAL.institucion_id}/${Date.now()}_${i}.jpg`;
        const { error: storErr } = await sb.storage.from('comunicados').upload(path, blob, { contentType: 'image/jpeg' });
        if (storErr) continue;
        const { data: urlData } = sb.storage.from('comunicados').getPublicUrl(path);
        await sb.from('comunicado_imagenes').insert({ comunicado_id: id, imagen_url: urlData.publicUrl, orden: baseOrden + i });
      } catch (_) {}
    }

    await rNovedades();
  } catch (e) {
    alert('No se pudo guardar. Intentá de nuevo.');
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar cambios'; }
  }
}

// ── Guardar edición de comunicado ─────────────────────
async function _avisosGuardarComunicadoEdicion(id) {
  const btn     = document.getElementById('av-btn-pub');
  const cursoId = document.getElementById('av-curso')?.value;
  const titulo  = document.getElementById('av-titulo')?.value.trim();
  const cuerpo  = document.getElementById('av-cuerpo')?.value.trim();

  if (!cursoId)           { alert('Seleccioná un curso destinatario.'); return; }
  if (!titulo || !cuerpo) { alert('El título y el mensaje son obligatorios.'); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  try {
    const { error } = await sb.from('comunicados').update({ titulo, cuerpo, curso_id: cursoId }).eq('id', id);
    if (error) throw error;
    await rComunicados();
  } catch (e) {
    alert('No se pudo guardar. Intentá de nuevo.');
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar cambios'; }
  }
}

// ── Eliminar imagen individual ────────────────────────
async function _avisosEliminarImagen(imagenId, imagenUrl, comunicadoId) {
  const { error } = await sb.from('comunicado_imagenes').delete().eq('id', imagenId);
  if (error) { alert('No se pudo eliminar la imagen.'); return; }
  const match = imagenUrl.match(/\/comunicados\/(.+)$/);
  if (match) await sb.storage.from('comunicados').remove([match[1]]).catch(() => {});
  document.getElementById(`av-img-${imagenId}`)?.remove();
  const c = _AVISOS_DATA.find(x => x.id === comunicadoId);
  if (c) c.comunicado_imagenes = c.comunicado_imagenes.filter(i => i.id !== imagenId);
}

// ── Eliminar novedad completa ─────────────────────────
async function _avisosEliminar(id) {
  if (!confirm('¿Eliminar esta novedad? Esta acción no se puede deshacer.')) return;
  const c = _AVISOS_DATA.find(x => x.id === id);
  try {
    const { error } = await sb.from('comunicados').delete().eq('id', id);
    if (error) throw error;
    const paths = [];
    (c?.comunicado_imagenes || []).forEach(img => {
      const m = img.imagen_url.match(/\/comunicados\/(.+)$/);
      if (m) paths.push(m[1]);
    });
    if (c?.imagen_url) {
      const m = c.imagen_url.match(/\/comunicados\/(.+)$/);
      if (m) paths.push(m[1]);
    }
    if (paths.length) await sb.storage.from('comunicados').remove(paths).catch(() => {});
    await rNovedades();
  } catch (e) {
    alert('No se pudo eliminar. Intentá de nuevo.');
  }
}

// ── Eliminar comunicado completo ──────────────────────
async function _avisosEliminarComunicado(id) {
  return _avisosEliminarComunicadoGrupo([id]);
}

async function _avisosEliminarComunicadoGrupo(ids) {
  const msg = ids.length > 1
    ? `¿Eliminar este comunicado (enviado a ${ids.length} cursos)? Esta acción no se puede deshacer.`
    : '¿Eliminar este comunicado? Esta acción no se puede deshacer.';
  if (!confirm(msg)) return;
  try {
    const { error } = await sb.from('comunicados').delete().in('id', ids);
    if (error) throw error;
    await rComunicados();
  } catch (e) {
    alert('No se pudo eliminar. Intentá de nuevo.');
  }
}

// ── Lista HTML: novedades ─────────────────────────────
function _avisosNovListaHtml(lista, perms) {
  if (!lista.length) return `
    <div style="text-align:center;padding:60px 20px;color:var(--txt3)">
      <div style="font-size:36px;margin-bottom:10px">📢</div>
      <div style="font-size:14px">No hay novedades publicadas aún.</div>
    </div>`;

  return lista.map(c => {
    const nivelTxt   = c.nivel ? (_AV_NIVEL_LABEL[c.nivel] || c.nivel) : 'Todos los niveles';
    const nivelClass = c.nivel ? 'tp' : 'tgr';
    const fecha      = _avisosFechaLabel(c.created_at);
    const autor      = c.usuarios?.nombre_completo || '';
    const imgs       = c.comunicado_imagenes?.length
      ? c.comunicado_imagenes.map(i => i.imagen_url)
      : (c.imagen_url ? [c.imagen_url] : []);

    let imgHtml = '';
    if (imgs.length === 1) {
      imgHtml = `<img src="${imgs[0]}" alt="" loading="lazy" style="width:100%;max-height:340px;object-fit:contain;display:block;background:var(--bg2,#f5f5f5)">`;
    } else if (imgs.length > 1) {
      imgHtml = `
        <div style="position:relative">
          <div id="avc-${c.id}" style="display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-ms-overflow-style:none">
            ${imgs.map(url => `
              <div style="min-width:100%;scroll-snap-align:start">
                <img src="${url}" alt="" loading="lazy" style="width:100%;max-height:340px;object-fit:contain;display:block;background:var(--bg2,#f5f5f5)">
              </div>`).join('')}
          </div>
          <button onclick="_avCarGo('${c.id}',-1,event)" style="position:absolute;top:50%;left:8px;transform:translateY(-50%);background:rgba(0,0,0,0.45);border:none;color:#fff;border-radius:50%;width:32px;height:32px;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2">‹</button>
          <button onclick="_avCarGo('${c.id}',1,event)" style="position:absolute;top:50%;right:8px;transform:translateY(-50%);background:rgba(0,0,0,0.45);border:none;color:#fff;border-radius:50%;width:32px;height:32px;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2">›</button>
          <div id="avc-dots-${c.id}" style="position:absolute;bottom:8px;left:0;right:0;display:flex;justify-content:center;gap:5px;pointer-events:none">
            ${imgs.map((_, i) => `<span style="width:6px;height:6px;border-radius:50%;background:${i===0?'#fff':'rgba(255,255,255,0.45)'}"></span>`).join('')}
          </div>
        </div>`;
    }

    return `
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px" id="av-card-${c.id}">
        ${imgHtml}
        <div style="padding:14px 16px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
            <span class="tag ${nivelClass}">${nivelTxt}</span>
            <span style="font-size:11px;color:var(--txt3)">${fecha}</span>
            ${autor ? `<span style="font-size:11px;color:var(--txt3);margin-left:auto">${autor}</span>` : ''}
          </div>
          <div style="font-size:14px;font-weight:700;color:var(--txt);margin-bottom:5px;line-height:1.3">${c.titulo}</div>
          ${c.cuerpo ? `<div style="font-size:12px;color:var(--txt2);line-height:1.5">${c.cuerpo}</div>` : ''}
        </div>
        ${perms.crear ? `
          <div style="padding:10px 16px 12px;border-top:1px solid var(--brd);display:flex;gap:8px">
            <button class="btn-s" style="font-size:12px" onclick="_avisosEditarNovedad('${c.id}')">✎ Editar</button>
            <button class="btn-s" style="font-size:12px;color:#d63b2f;border-color:#d63b2f" onclick="_avisosEliminar('${c.id}')">✕ Eliminar</button>
          </div>` : ''}
      </div>`;
  }).join('');
}

// ── Navegación carousel (flechas) ────────────────────
function _avCarGo(id, dir, ev) {
  if (ev) ev.stopPropagation();
  const car = document.getElementById(`avc-${id}`);
  if (!car) return;
  car.scrollBy({ left: dir * car.offsetWidth, behavior: 'smooth' });
  setTimeout(() => {
    const idx = Math.round(car.scrollLeft / car.offsetWidth);
    const dotsEl = document.getElementById(`avc-dots-${id}`);
    if (dotsEl) Array.from(dotsEl.children).forEach((d, i) => {
      d.style.background = i === idx ? '#fff' : 'rgba(255,255,255,0.45)';
    });
  }, 350);
}

// ── Lista HTML: comunicados ───────────────────────────
function _avisosComListaHtml(lista, perms) {
  if (!lista.length) return `
    <div style="text-align:center;padding:60px 20px;color:var(--txt3)">
      <div style="font-size:36px;margin-bottom:10px">✉️</div>
      <div style="font-size:14px">No hay comunicados enviados aún.</div>
    </div>`;

  // Agrupar por mismo envío: mismo título + cuerpo + timestamp (los inserts batch comparten created_at exacto)
  const groups = [];
  const seen   = {};
  lista.forEach(c => {
    const key = `${c.titulo}||${c.cuerpo || ''}||${c.created_at}`;
    if (!seen[key]) {
      seen[key] = { key, items: [] };
      groups.push(seen[key]);
    }
    seen[key].items.push(c);
  });

  return groups.map(group => {
    const rep    = group.items[0];
    const fecha  = _avisosFechaLabel(rep.created_at);
    const autor  = rep.usuarios?.nombre_completo || '';
    const isSingle = group.items.length === 1;

    // Badge de nivel (del primer ítem; todos son del mismo nivel en un envío normal)
    const nivelTxt = rep.cursos ? (_AV_NIVEL_LABEL[rep.cursos.nivel] || rep.cursos.nivel) : '';

    // Badges de todos los cursos del grupo
    const cursosHtml = group.items
      .filter(c => c.cursos)
      .map(c => {
        const cur = c.cursos;
        return `<span class="tag tp">${cur.nombre}${cur.division ? ' ' + cur.division : ''}</span>`;
      }).join('');

    // Sumar vistos de todos los rows del grupo
    const vistos    = group.items.reduce((sum, c) => sum + (_COM_INT_VISTOS[c.id] || 0), 0);
    const vistosTxt = vistos === 0 ? 'Sin confirmaciones' : `${vistos} visto${vistos !== 1 ? 's' : ''}`;

    const allIds = group.items.map(c => `'${c.id}'`).join(',');

    return `
      <div class="card" style="padding:14px 16px;margin-bottom:10px" id="av-card-${rep.id}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          ${nivelTxt ? `<span class="tag tgr">${nivelTxt}</span>` : ''}
          ${cursosHtml}
          <span style="font-size:11px;color:var(--txt3)">${fecha}</span>
          ${autor ? `<span style="font-size:11px;color:var(--txt3);margin-left:auto">${autor}</span>` : ''}
        </div>
        <div style="font-size:14px;font-weight:700;color:var(--txt);margin-bottom:6px;line-height:1.3">${rep.titulo}</div>
        ${rep.cuerpo ? `<div style="font-size:12px;color:var(--txt2);line-height:1.55;white-space:pre-line">${rep.cuerpo}</div>` : ''}
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--brd);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:11px;color:${vistos > 0 ? 'var(--green)' : 'var(--txt3)'}">👁 ${vistosTxt}</span>
          ${perms.crear ? `
            <span style="margin-left:auto;display:flex;gap:8px">
              ${isSingle ? `<button class="btn-s" style="font-size:12px" onclick="_avisosEditarComunicado('${rep.id}')">✎ Editar</button>` : ''}
              <button class="btn-s" style="font-size:12px;color:#d63b2f;border-color:#d63b2f" onclick="_avisosEliminarComunicadoGrupo([${allIds}])">✕ Eliminar</button>
            </span>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ── Compresión de imagen (Canvas, sin dependencias) ───
async function _avisosComprimir(file, maxPx = 1200, q = 0.78) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        const r = Math.min(maxPx / width, maxPx / height);
        width  = Math.round(width  * r);
        height = Math.round(height * r);
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(resolve, 'image/jpeg', q);
    };
    img.src = url;
  });
}

// ── Fecha label ───────────────────────────────────────
function _avisosFechaLabel(isoStr) {
  if (!isoStr) return '';
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7)  return `Hace ${diff} días`;
  const d = new Date(isoStr);
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
}
