// =====================================================
// AVISOS.JS — Comunicación interna (Novedades + Comunicados)
// =====================================================

let _AVISOS_DATA    = [];   // novedades
let _COM_INT_DATA   = [];   // comunicados por curso
let _COM_INT_CURSOS = [];   // cursos disponibles para selector
let _AVISOS_TAB     = 'novedades';
let _AVISOS_FILTRO_NOV = '';  // '' = todos, 'inicial', 'primario', 'secundario'
let _AVISOS_FILTRO_COM = '';  // '' = todos, 'inicial', 'primario', 'secundario'
const _AV_NIVEL_LABEL = { inicial: 'Inicial', primario: 'Primario', secundario: 'Secundario' };

async function rAvisos() {
  const el = document.getElementById('page-avisos');
  if (!el) return;
  showLoading('avisos');
  const perms = _avisosPermisos();

  try {
    // Fetch novedades, comunicados y cursos en paralelo
    const [novRes, comRes, curRes] = await Promise.all([
      sb.from('comunicados')
        .select('id, titulo, cuerpo, nivel, imagen_url, created_at, usuarios(nombre_completo), comunicado_imagenes(id, imagen_url, orden)')
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
      sb.from('cursos')
        .select('id, nombre, division, nivel')
        .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
        .order('nivel').order('nombre'),
    ]);

    // Si el join de comunicado_imagenes falla (tabla no existe aún), reintentar sin join
    let novedades = novRes.data || [];
    if (novRes.error) {
      const { data: nov2 } = await sb
        .from('comunicados')
        .select('id, titulo, cuerpo, nivel, imagen_url, created_at, usuarios(nombre_completo)')
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
    _AVISOS_TAB     = 'novedades';

    el.innerHTML = `
      <div style="max-width:860px;margin:0 auto;padding:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px">
          <h2 style="font-size:18px;font-weight:700;color:var(--txt)">Comunicación interna</h2>
          ${perms.crear ? `<button class="btn-p" id="av-btn-nuevo" onclick="_avisosAbrirForm()">+ Nuevo</button>` : ''}
        </div>

        <div style="display:flex;border-bottom:1.5px solid var(--brd);margin-bottom:16px">
          <button id="av-tab-novedades" onclick="_avisosTab('novedades')" style="${_tabStyle(true)}">Novedades</button>
          <button id="av-tab-comunicados" onclick="_avisosTab('comunicados')" style="${_tabStyle(false)}">Comunicados</button>
        </div>

        <div id="av-form-wrap"></div>

        <div id="av-pane-novedades">
          ${_avisosNovPaneHtml(novedades, perms)}
        </div>
        <div id="av-pane-comunicados" style="display:none">
          ${_avisosComPaneHtml(_COM_INT_DATA, perms)}
        </div>
      </div>`;

  } catch (e) {
    el.innerHTML = `<div style="padding:60px;text-align:center;color:var(--txt3)">No se pudo cargar la comunicación. Intentá de nuevo.</div>`;
  }
}

// ── Tabs ──────────────────────────────────────────────
function _tabStyle(active) {
  if (active) {
    return `flex:1;padding:10px 6px;font-size:13px;font-weight:700;border:none;background:rgba(34,153,87,0.09);cursor:pointer;border-bottom:2.5px solid var(--green);color:var(--green);margin-bottom:-1.5px;border-radius:6px 6px 0 0;transition:color .15s,border-color .15s,background .15s`;
  }
  return `flex:1;padding:10px 6px;font-size:13px;font-weight:500;border:none;background:transparent;cursor:pointer;border-bottom:2px solid transparent;color:var(--txt2);margin-bottom:-1.5px;border-radius:6px 6px 0 0;transition:color .15s,border-color .15s,background .15s`;
}

function _avisosTab(tab) {
  _AVISOS_TAB = tab;
  document.getElementById('av-pane-novedades').style.display  = tab === 'novedades'  ? '' : 'none';
  document.getElementById('av-pane-comunicados').style.display = tab === 'comunicados' ? '' : 'none';
  document.getElementById('av-tab-novedades').style.cssText   = _tabStyle(tab === 'novedades');
  document.getElementById('av-tab-comunicados').style.cssText = _tabStyle(tab === 'comunicados');
  const formWrap = document.getElementById('av-form-wrap');
  if (formWrap) formWrap.innerHTML = '';
}

// ── Filtro pills ──────────────────────────────────────
function _avFiltroStyle(active) {
  return active
    ? `padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;border:none;background:var(--green);color:#fff;cursor:pointer;transition:background .15s`
    : `padding:4px 14px;border-radius:20px;font-size:12px;font-weight:500;border:1.5px solid var(--brd);background:var(--bg2,#f5f5f5);color:var(--txt2);cursor:pointer;transition:background .15s`;
}

function _avisosNovPaneHtml(todos, perms) {
  const filtrada = _AVISOS_FILTRO_NOV ? todos.filter(c => c.nivel === _AVISOS_FILTRO_NOV) : todos;
  const nivelesPresentes = ['inicial', 'primario', 'secundario'].filter(n => todos.some(c => c.nivel === n));
  const filtroHtml = todos.length > 0 && nivelesPresentes.length > 0 ? `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
      <button class="av-fn" data-val="" onclick="_avNovFiltrar('')" style="${_avFiltroStyle(_AVISOS_FILTRO_NOV === '')}">Todos los niveles</button>
      ${nivelesPresentes.map(n => `
        <button class="av-fn" data-val="${n}" onclick="_avNovFiltrar('${n}')" style="${_avFiltroStyle(_AVISOS_FILTRO_NOV === n)}">${_AV_NIVEL_LABEL[n]}</button>
      `).join('')}
    </div>` : '';
  return `${filtroHtml}<div id="av-nov-lista">${_avisosNovListaHtml(filtrada, perms)}</div>`;
}

function _avisosComPaneHtml(todos, perms) {
  const filtrada = _AVISOS_FILTRO_COM ? todos.filter(c => c.cursos?.nivel === _AVISOS_FILTRO_COM) : todos;
  const nivelesPresentes = ['inicial', 'primario', 'secundario'].filter(n => todos.some(c => c.cursos?.nivel === n));
  const filtroHtml = todos.length > 0 && nivelesPresentes.length > 1 ? `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
      <button class="av-fc" data-val="" onclick="_avComFiltrar('')" style="${_avFiltroStyle(_AVISOS_FILTRO_COM === '')}">Todos</button>
      ${nivelesPresentes.map(n => `
        <button class="av-fc" data-val="${n}" onclick="_avComFiltrar('${n}')" style="${_avFiltroStyle(_AVISOS_FILTRO_COM === n)}">${_AV_NIVEL_LABEL[n]}</button>
      `).join('')}
    </div>` : '';
  return `${filtroHtml}<div id="av-com-lista">${_avisosComListaHtml(filtrada, perms)}</div>`;
}

function _avNovFiltrar(nivel) {
  _AVISOS_FILTRO_NOV = nivel;
  const perms = _avisosPermisos();
  const lista = nivel ? _AVISOS_DATA.filter(c => c.nivel === nivel) : _AVISOS_DATA;
  const listaEl = document.getElementById('av-nov-lista');
  if (listaEl) listaEl.innerHTML = _avisosNovListaHtml(lista, perms);
  document.querySelectorAll('.av-fn').forEach(b => {
    b.style.cssText = _avFiltroStyle(b.dataset.val === nivel);
  });
}

function _avComFiltrar(nivel) {
  _AVISOS_FILTRO_COM = nivel;
  const perms = _avisosPermisos();
  const lista = nivel ? _COM_INT_DATA.filter(c => c.cursos?.nivel === nivel) : _COM_INT_DATA;
  const listaEl = document.getElementById('av-com-lista');
  if (listaEl) listaEl.innerHTML = _avisosComListaHtml(lista, perms);
  document.querySelectorAll('.av-fc').forEach(b => {
    b.style.cssText = _avFiltroStyle(b.dataset.val === nivel);
  });
}

// ── Permisos ──────────────────────────────────────────
function _avisosPermisos() {
  const rol = USUARIO_ACTUAL?.rol;
  return { crear: ['director_general', 'directivo_nivel', 'preceptor'].includes(rol) };
}

// ── Abrir formulario (decide tipo según tab activo) ───
function _avisosAbrirForm() {
  const wrap = document.getElementById('av-form-wrap');
  if (!wrap) return;
  if (wrap.innerHTML) { wrap.innerHTML = ''; return; }
  if (_AVISOS_TAB === 'comunicados') _avisosFormComunicado();
  else _avisosFormNovedad();
}

// ── Form: nueva / editar novedad ──────────────────────
function _avisosFormNovedad(editData = null) {
  const wrap = document.getElementById('av-form-wrap');
  if (!wrap) return;
  const c = editData;
  const isEdit = !!c;

  const imgsActualesHtml = isEdit ? _avisosEditImgsHtml(c) : '';

  const nivelesDisp = _COM_INT_CURSOS.length
    ? [...new Set(_COM_INT_CURSOS.map(cu => cu.nivel))].filter(Boolean)
    : ['inicial', 'primario', 'secundario'];

  wrap.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-t">${isEdit ? 'Editar novedad' : 'Nueva novedad'}</div>
      <div style="margin-bottom:12px">
        <label style="font-size:11px;font-weight:600;color:var(--txt2);display:block;margin-bottom:5px;letter-spacing:.05em">NIVELES DESTINATARIOS</label>
        <div style="display:flex;gap:10px;flex-wrap:wrap;padding:10px;border:1px solid var(--brd);border-radius:var(--rad)">
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
            <input type="checkbox" id="av-niv-todos" onchange="_avNivTodosChange(this)"
              ${!c?.nivel ? 'checked' : ''}>
            Todos los niveles
          </label>
          ${['inicial','primario','secundario'].map(n => `
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
            <input type="checkbox" class="av-niv-spec" value="${n}" onchange="_avNivSpecChange()"
              ${c?.nivel === n ? 'checked' : ''}>
            ${_AV_NIVEL_LABEL[n]}
          </label>`).join('')}
        </div>
        <p style="font-size:11px;color:var(--txt3);margin-top:5px">Si marcás niveles específicos, se publica una novedad por nivel seleccionado.</p>
      </div>
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
  const c = editData;
  const isEdit = !!c;

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
    // Agrupar cursos por nivel para nuevo comunicado
    const porNivel = {};
    _COM_INT_CURSOS.forEach(cu => {
      const n = cu.nivel || '_';
      if (!porNivel[n]) porNivel[n] = [];
      porNivel[n].push(cu);
    });
    const checkboxHtml = Object.entries(porNivel).map(([nivel, cursos]) => `
      <div style="margin-bottom:8px">
        <div style="font-size:11px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${_AV_NIVEL_LABEL[nivel] || nivel}</div>
        ${cursos.map(cu => `
          <label style="display:flex;align-items:center;gap:8px;padding:5px 2px;cursor:pointer;border-radius:4px">
            <input type="checkbox" class="av-com-curso" value="${cu.id}">
            <span style="font-size:13px">${cu.nombre}${cu.division ? ' ' + cu.division : ''}</span>
          </label>`).join('')}
      </div>`).join('');
    destinatariosHtml = `
      <div style="margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
          <label style="font-size:11px;font-weight:600;color:var(--txt2);letter-spacing:.05em">CURSOS DESTINATARIOS *</label>
          <span>
            <button type="button" onclick="_avComSelAll(true)" style="font-size:11px;color:var(--green);border:none;background:none;cursor:pointer;padding:0">Seleccionar todos</button>
            <span style="color:var(--txt3);margin:0 4px">·</span>
            <button type="button" onclick="_avComSelAll(false)" style="font-size:11px;color:var(--txt2);border:none;background:none;cursor:pointer;padding:0">Ninguno</button>
          </span>
        </div>
        <div style="max-height:180px;overflow-y:auto;border:1px solid var(--brd);border-radius:var(--rad);padding:10px">
          ${checkboxHtml || '<p style="font-size:13px;color:var(--txt3)">No hay cursos disponibles.</p>'}
        </div>
      </div>`;
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

function _avComSelAll(check) {
  document.querySelectorAll('.av-com-curso').forEach(cb => { cb.checked = check; });
}

// ── Helpers interacción de checkboxes de nivel ────────
function _avNivTodosChange(cb) {
  if (cb.checked) {
    document.querySelectorAll('.av-niv-spec').forEach(c => { c.checked = false; });
  }
}

function _avNivSpecChange() {
  const anySpec = Array.from(document.querySelectorAll('.av-niv-spec')).some(c => c.checked);
  const todos = document.getElementById('av-niv-todos');
  if (todos) todos.checked = !anySpec;
}

// Devuelve array de niveles seleccionados. [] o ['todos'] = null. Múltiples = array de strings.
function _avGetNivelesSeleccionados() {
  const todos = document.getElementById('av-niv-todos');
  if (todos?.checked) return [null]; // null = todos los niveles
  const specs = Array.from(document.querySelectorAll('.av-niv-spec'))
    .filter(c => c.checked)
    .map(c => c.value);
  return specs.length ? specs : [null]; // si nada marcado, trata como todos
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
  const btn    = document.getElementById('av-btn-pub');
  const titulo = document.getElementById('av-titulo')?.value.trim();
  const cuerpo = document.getElementById('av-cuerpo')?.value.trim() || null;
  const niveles = _avGetNivelesSeleccionados(); // array de valores (null o strings)
  const files  = Array.from(document.getElementById('av-imagen')?.files || []);

  if (!titulo) { alert('El título es obligatorio.'); return; }
  btn.disabled = true; btn.textContent = 'Publicando…';

  try {
    // Comprimir imágenes una sola vez
    const blobs = [];
    for (let i = 0; i < files.length; i++) {
      try { blobs.push(await _avisosComprimir(files[i])); } catch (_) {}
    }

    // Insertar una novedad por cada nivel seleccionado
    for (const nivel of niveles) {
      const { data: inserted, error } = await sb
        .from('comunicados')
        .insert({ institucion_id: USUARIO_ACTUAL.institucion_id, autor_id: USUARIO_ACTUAL.id, tipo: 'novedad', nivel, titulo, cuerpo, requiere_firma: false })
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

    await rAvisos();
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

  // Soporte multi-curso (nuevos checkboxes) y fallback a select único (edición)
  const cursoIds = Array.from(document.querySelectorAll('.av-com-curso:checked')).map(cb => cb.value);
  const cursoIdSingle = document.getElementById('av-curso')?.value;
  const ids = cursoIds.length ? cursoIds : (cursoIdSingle ? [cursoIdSingle] : []);

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
    await rAvisos();
    _avisosTab('comunicados');
  } catch (e) {
    alert('No se pudo enviar. Intentá de nuevo.');
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar comunicado'; }
  }
}

// ── Editar novedad ────────────────────────────────────
function _avisosEditarNovedad(id) {
  const c = _AVISOS_DATA.find(x => x.id === id);
  if (!c) return;
  _avisosTab('novedades');
  _avisosFormNovedad(c);
  document.getElementById('av-form-wrap')?.scrollIntoView({ behavior: 'smooth' });
}

// ── Editar comunicado ─────────────────────────────────
function _avisosEditarComunicado(id) {
  const c = _COM_INT_DATA.find(x => x.id === id);
  if (!c) return;
  _avisosTab('comunicados');
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

    await rAvisos();
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
    await rAvisos();
    _avisosTab('comunicados');
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
    await rAvisos();
  } catch (e) {
    alert('No se pudo eliminar. Intentá de nuevo.');
  }
}

// ── Eliminar comunicado completo ──────────────────────
async function _avisosEliminarComunicado(id) {
  if (!confirm('¿Eliminar este comunicado? Esta acción no se puede deshacer.')) return;
  try {
    const { error } = await sb.from('comunicados').delete().eq('id', id);
    if (error) throw error;
    await rAvisos();
    _avisosTab('comunicados');
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

  return lista.map(c => {
    const cur      = c.cursos;
    const cursoTxt = cur ? `${cur.nombre}${cur.division ? ' ' + cur.division : ''}` : '';
    const nivelTxt = cur ? (_AV_NIVEL_LABEL[cur.nivel] || cur.nivel) : '';
    const fecha    = _avisosFechaLabel(c.created_at);
    const autor    = c.usuarios?.nombre_completo || '';

    return `
      <div class="card" style="padding:14px 16px;margin-bottom:10px" id="av-card-${c.id}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          ${cursoTxt ? `<span class="tag tp">${cursoTxt}</span>` : ''}
          ${nivelTxt ? `<span class="tag tgr">${nivelTxt}</span>` : ''}
          <span style="font-size:11px;color:var(--txt3)">${fecha}</span>
          ${autor ? `<span style="font-size:11px;color:var(--txt3);margin-left:auto">${autor}</span>` : ''}
        </div>
        <div style="font-size:14px;font-weight:700;color:var(--txt);margin-bottom:6px;line-height:1.3">${c.titulo}</div>
        ${c.cuerpo ? `<div style="font-size:12px;color:var(--txt2);line-height:1.55;white-space:pre-line">${c.cuerpo}</div>` : ''}
        ${perms.crear ? `
          <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--brd);display:flex;gap:8px">
            <button class="btn-s" style="font-size:12px" onclick="_avisosEditarComunicado('${c.id}')">✎ Editar</button>
            <button class="btn-s" style="font-size:12px;color:#d63b2f;border-color:#d63b2f" onclick="_avisosEliminarComunicado('${c.id}')">✕ Eliminar</button>
          </div>` : ''}
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
