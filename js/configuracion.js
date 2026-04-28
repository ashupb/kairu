// =====================================================
// CONFIGURACION.JS — Módulo de administración institucional
// =====================================================

// ─── ESTADO LOCAL ────────────────────────────────────
let _adminTab       = null;
let _adminCursos    = [];
let _adminUsuarios  = [];
let _adminMaterias  = [];
let _configExtraOk  = null; // detecta si la columna config_extra existe

async function _detectarConfigExtra() {
  if (_configExtraOk !== null) return _configExtraOk;
  const { error } = await sb.from('usuarios').select('config_extra').limit(1);
  _configExtraOk = !error || !error.message?.includes('column');
  return _configExtraOk;
}

// ─── CONSTANTES ──────────────────────────────────────
const NIVEL_COLORS_ADM = {
  inicial:    '#1a7a4a',
  primario:   '#1a5276',
  secundario: '#6c3483',
};

const NIVEL_LABELS_ADM = {
  inicial:    'Inicial',
  primario:   'Primario',
  secundario: 'Secundario',
};

const ROL_LABELS_ADM = {
  director_general: 'Director General',
  directivo_nivel:  'Directivo de Nivel',
  docente:          'Docente',
  preceptor:        'Preceptor',
  eoe:              'EOE',
};

const ROL_BADGE_ADM = {
  director_general: 'tg',
  directivo_nivel:  'tp',
  docente:          'td',
  preceptor:        'ta',
  eoe:              'tr',
};

// ─── TABS POR ROL ─────────────────────────────────────
// Tab IDs disponibles para asignación manual por director_general
const CONFIG_TABS_TODOS = [
  { id: 'institucion',  label: 'Institución' },
  { id: 'usuarios',     label: 'Usuarios' },
  { id: 'cursos',       label: 'Cursos' },
  { id: 'alumnos',      label: 'Alumnos' },
  { id: 'materias',     label: 'Materias' },
  { id: 'asignaciones', label: 'Asignaciones' },
  { id: 'parametros',   label: 'Parámetros' },
];

function _adminTabs() {
  const r      = USUARIO_ACTUAL?.rol;
  const extras = USUARIO_ACTUAL?.config_extra?.tabs || [];

  const rolBase = [
    { id: 'institucion',  label: 'Institución',     roles: ['director_general'] },
    { id: 'usuarios',     label: 'Usuarios',         roles: ['director_general', 'directivo_nivel'] },
    { id: 'cursos',       label: 'Cursos',           roles: ['director_general', 'directivo_nivel', 'preceptor'] },
    { id: 'alumnos',      label: 'Alumnos',          roles: ['director_general', 'directivo_nivel', 'preceptor'] },
    { id: 'materias',     label: 'Materias',         roles: ['director_general', 'directivo_nivel'] },
    { id: 'asignaciones', label: 'Asignaciones',     roles: ['director_general', 'directivo_nivel'] },
    { id: 'parametros',   label: 'Parámetros',       roles: ['director_general', 'directivo_nivel'] },
  ];

  const resultado = rolBase.filter(t => t.roles.includes(r));
  // Agregar tabs extra (asignados por director_general) que no estén ya incluidos
  extras.forEach(tabId => {
    const def = CONFIG_TABS_TODOS.find(t => t.id === tabId);
    if (def && !resultado.find(t => t.id === tabId)) resultado.push(def);
  });
  return resultado;
}

// ─── RENDER PRINCIPAL ─────────────────────────────────
async function rAdmin() {
  showLoading('admin');
  inyectarEstilosAdmin();
  await _detectarConfigExtra();

  const tabs = _adminTabs();
  if (!tabs.length) {
    document.getElementById('page-admin').innerHTML =
      `<div class="pg-t">Configuración</div><div class="empty-state">Sin permisos para esta sección</div>`;
    return;
  }

  if (!_adminTab || !tabs.find(t => t.id === _adminTab)) {
    _adminTab = tabs[0].id;
  }

  _renderAdminShell(tabs);
  await _renderAdminSection(_adminTab);
}

function _renderAdminShell(tabs) {
  const c = document.getElementById('page-admin');
  const isMobile = window.innerWidth < 700;

  const tabsHtml = isMobile
    ? `<select class="adm-tab-sel" onchange="_switchAdminTab(this.value)">
        ${tabs.map(t => `<option value="${t.id}" ${t.id === _adminTab ? 'selected' : ''}>${t.label}</option>`).join('')}
       </select>`
    : `<div class="adm-tabs-bar">
        ${tabs.map(t => `<button class="adm-tab${t.id === _adminTab ? ' on' : ''}" onclick="_switchAdminTab('${t.id}')">${t.label}</button>`).join('')}
       </div>`;

  c.innerHTML = `
    <div class="pg-t">Configuración</div>
    <div class="pg-s">${INSTITUCION_ACTUAL?.nombre || ''}</div>
    ${tabsHtml}
    <div id="adm-section-content"></div>`;
}

async function _switchAdminTab(tabId) {
  _adminTab = tabId;
  document.querySelectorAll('.adm-tab').forEach(b => {
    const tab = _adminTabs().find(t => t.label === b.textContent);
    if (tab) b.classList.toggle('on', tab.id === tabId);
  });
  const sel = document.querySelector('.adm-tab-sel');
  if (sel) sel.value = tabId;
  const content = document.getElementById('adm-section-content');
  if (content) content.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  await _renderAdminSection(tabId);
}

async function _renderAdminSection(tabId) {
  const fns = {
    institucion:  _renderInstitucion,
    usuarios:     _renderUsuarios,
    cursos:       _renderCursos,
    alumnos:      _renderAlumnos,
    materias:     _renderMaterias,
    asignaciones: _renderAsignaciones,
    parametros:   _renderParametros,
  };
  if (fns[tabId]) await fns[tabId]();
}

// ══════════════════════════════════════════════════════
// SECCIÓN: INSTITUCIÓN
// ══════════════════════════════════════════════════════
async function _renderInstitucion() {
  const sec = document.getElementById('adm-section-content');
  sec.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  const [instRes, orientsRes] = await Promise.all([
    sb.from('instituciones').select('*').eq('id', USUARIO_ACTUAL.institucion_id).single(),
    sb.from('orientaciones').select('*').eq('activo', true).order('nombre'),
  ]);

  const { data: inst, error } = instRes;
  if (error) { _admError(sec, error.message); return; }
  const orients = orientsRes.data || [];
  const nivelSecOn = inst['nivel_secundario'] !== false;

  sec.innerHTML = `
    <div class="card">
      <div class="card-t">Datos de la institución</div>

      <div class="adm-form-row">
        <label class="adm-label">Nombre de la institución</label>
        <input type="text" id="adm-inst-nombre" value="${_esc(inst.nombre)}" placeholder="Nombre completo">
      </div>
      <div class="adm-form-row">
        <label class="adm-label">Dirección</label>
        <input type="text" id="adm-inst-dir" value="${_esc(inst.direccion)}" placeholder="Dirección postal">
      </div>
      <div class="adm-form-row">
        <label class="adm-label">Teléfono institucional</label>
        <input type="text" id="adm-inst-tel" value="${_esc(inst.telefono)}" placeholder="(011) 4xxx-xxxx">
      </div>
      <div class="adm-form-row">
        <label class="adm-label">Email institucional</label>
        <input type="email" id="adm-inst-email" value="${_esc(inst.email_institucional)}" placeholder="contacto@escuela.edu.ar">
      </div>
      <div class="adm-form-row">
        <label class="adm-label">Año lectivo vigente</label>
        <input type="number" id="adm-inst-anio" value="${inst.anio_lectivo || new Date().getFullYear()}" min="2020" max="2050" style="max-width:120px">
      </div>
      <div class="adm-form-row">
        <label class="adm-label">Niveles activos</label>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${['inicial', 'primario', 'secundario'].map(n => `
            <div class="toggle-row-ui" style="flex:1;min-width:130px">
              <span style="font-size:12px;font-weight:500;color:${NIVEL_COLORS_ADM[n]}">${NIVEL_LABELS_ADM[n]}</span>
              <div class="tog${inst['nivel_' + n] !== false ? ' on' : ''}" id="tog-nivel-${n}" onclick="_togNivel('${n}')">
                <div class="tog-thumb"></div>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <div class="acc" style="margin-top:16px">
        <button class="btn-p" id="adm-inst-guardar-btn" onclick="_guardarInstitucion()">Guardar cambios</button>
      </div>
    </div>

    <div class="card" id="adm-orientaciones-card" style="display:${nivelSecOn ? '' : 'none'}">
      <div class="card-t" style="color:${NIVEL_COLORS_ADM.secundario}">Orientaciones (Secundario)</div>
      <div style="font-size:11px;color:var(--txt2);margin-bottom:10px">Configurá las orientaciones que ofrece tu institución. Se usan al crear cursos de 4°, 5° y 6°.</div>
      <div id="lista-orientaciones">
        ${_renderListaOrientaciones(orients)}
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <input type="text" id="new-orientacion" placeholder="Ej: Economía y Administración" style="flex:1">
        <button class="btn-s" onclick="_agregarOrientacion()">Agregar</button>
      </div>
    </div>`;
}

function _togAdm(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('on');
}

function _togNivel(n) {
  _togAdm('tog-nivel-' + n);
  if (n === 'secundario') {
    const on   = document.getElementById('tog-nivel-secundario')?.classList.contains('on');
    const card = document.getElementById('adm-orientaciones-card');
    if (card) card.style.display = on ? '' : 'none';
  }
}

function _renderListaOrientaciones(lista) {
  if (!lista.length) return '<div style="color:var(--txt2);font-size:11px;padding:6px 0">Sin orientaciones definidas</div>';
  return lista.map(o => `
    <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--brd)">
      <div style="flex:1;font-size:12px;font-weight:500">${_esc(o.nombre)}</div>
      <button onclick="_eliminarOrientacion('${o.id}')"
        style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--txt3);padding:0 2px;line-height:1" title="Desactivar">×</button>
    </div>`).join('');
}

async function _agregarOrientacion() {
  const inp    = document.getElementById('new-orientacion');
  const nombre = inp?.value?.trim();
  if (!nombre) return;
  const { error } = await sb.from('orientaciones').insert([{ nombre, activo: true }]);
  if (error) { alert('Error: ' + error.message); return; }
  inp.value = '';
  const { data } = await sb.from('orientaciones').select('*').eq('activo', true).order('nombre');
  const lista = document.getElementById('lista-orientaciones');
  if (lista) lista.innerHTML = _renderListaOrientaciones(data || []);
}

async function _eliminarOrientacion(id) {
  if (!confirm('¿Desactivar esta orientación?')) return;
  const { error } = await sb.from('orientaciones').update({ activo: false }).eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  const { data } = await sb.from('orientaciones').select('*').eq('activo', true).order('nombre');
  const lista = document.getElementById('lista-orientaciones');
  if (lista) lista.innerHTML = _renderListaOrientaciones(data || []);
}

async function _guardarInstitucion() {
  const nombre              = document.getElementById('adm-inst-nombre')?.value?.trim();
  const direccion           = document.getElementById('adm-inst-dir')?.value?.trim();
  const telefono            = document.getElementById('adm-inst-tel')?.value?.trim();
  const email_institucional = document.getElementById('adm-inst-email')?.value?.trim();
  const anio_lectivo        = parseInt(document.getElementById('adm-inst-anio')?.value) || new Date().getFullYear();
  const nivel_inicial       = document.getElementById('tog-nivel-inicial')?.classList.contains('on');
  const nivel_primario      = document.getElementById('tog-nivel-primario')?.classList.contains('on');
  const nivel_secundario    = document.getElementById('tog-nivel-secundario')?.classList.contains('on');

  if (!nombre) { alert('El nombre de la institución es requerido.'); return; }

  const { error } = await sb.from('instituciones').update({
    nombre, direccion, telefono, email_institucional, anio_lectivo,
    nivel_inicial, nivel_primario, nivel_secundario,
  }).eq('id', USUARIO_ACTUAL.institucion_id);

  if (error) { alert('Error al guardar: ' + error.message); return; }

  if (INSTITUCION_ACTUAL) {
    INSTITUCION_ACTUAL.nombre           = nombre;
    INSTITUCION_ACTUAL.nivel_inicial    = nivel_inicial;
    INSTITUCION_ACTUAL.nivel_primario   = nivel_primario;
    INSTITUCION_ACTUAL.nivel_secundario = nivel_secundario;
  }
  const sbInst = document.getElementById('sb-inst-nombre');
  const pgSub  = document.querySelector('#page-admin .pg-s');
  if (sbInst) sbInst.textContent = nombre;
  if (pgSub)  pgSub.textContent  = nombre;
  document.title = nombre + ' · Kairu';

  _toastOk('Cambios guardados correctamente');

  const btn = document.getElementById('adm-inst-guardar-btn');
  if (btn) {
    const orig = btn.getAttribute('onclick');
    btn.textContent = 'Editar';
    btn.className = 'btn-s';
    btn.removeAttribute('onclick');
    btn.onclick = () => {
      btn.textContent = 'Guardar cambios';
      btn.className = 'btn-p';
      btn.setAttribute('onclick', orig);
      btn.onclick = null;
    };
  }
}

// ══════════════════════════════════════════════════════
// SECCIÓN: USUARIOS Y ROLES
// ══════════════════════════════════════════════════════
let _usrFiltroRol   = 'todos';
let _usrFiltroNivel = 'todos';

async function _renderUsuarios() {
  const sec = document.getElementById('adm-section-content');
  sec.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  let q = sb.from('usuarios')
    .select('*')
    .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
    .order('nombre_completo');

  if (USUARIO_ACTUAL.rol === 'directivo_nivel') q = q.eq('nivel', USUARIO_ACTUAL.nivel);

  const { data, error } = await q;
  if (error) { _admError(sec, error.message); return; }
  _adminUsuarios = data || [];
  _renderUsuariosList();
}

function _renderUsuariosList() {
  const sec = document.getElementById('adm-section-content');

  let filtrados = _adminUsuarios;
  if (_usrFiltroRol   !== 'todos') filtrados = filtrados.filter(u => u.rol   === _usrFiltroRol);
  if (_usrFiltroNivel !== 'todos') filtrados = filtrados.filter(u => u.nivel === _usrFiltroNivel);

  const roles   = ['director_general', 'directivo_nivel', 'docente', 'preceptor', 'eoe'];
  const niveles = ['inicial', 'primario', 'secundario'];
  const puedeCrear = USUARIO_ACTUAL.rol === 'director_general';

  sec.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <select onchange="_usrFiltroRol=this.value;_renderUsuariosList()" style="width:auto;padding:6px 28px 6px 10px">
          <option value="todos">Todos los roles</option>
          ${roles.map(r => `<option value="${r}" ${r === _usrFiltroRol ? 'selected' : ''}>${ROL_LABELS_ADM[r]}</option>`).join('')}
        </select>
        <select onchange="_usrFiltroNivel=this.value;_renderUsuariosList()" style="width:auto;padding:6px 28px 6px 10px">
          <option value="todos">Todos los niveles</option>
          ${niveles.map(n => `<option value="${n}" ${n === _usrFiltroNivel ? 'selected' : ''}>${NIVEL_LABELS_ADM[n]}</option>`).join('')}
        </select>
      </div>
      ${puedeCrear ? `<button class="btn-p" onclick="_abrirModalUsuario(null)">+ Nuevo usuario</button>` : ''}
    </div>

    ${!filtrados.length ? `<div class="empty-state">Sin usuarios encontrados</div>` : ''}

    <div class="card" style="padding:0;overflow:hidden">
      ${filtrados.map(u => {
        const iniciales  = u.avatar_iniciales || generarIniciales(u.nombre_completo || '');
        const rolBadge   = ROL_BADGE_ADM[u.rol] || 'tgr';
        const nivelColor = u.nivel ? NIVEL_COLORS_ADM[u.nivel] : 'var(--gris)';
        const inactivo   = u.activo === false;
        return `
          <div class="adm-user-row" onclick="_abrirModalUsuario('${u.id}')">
            <div class="av av32" style="background:${nivelColor};color:#fff;flex-shrink:0">${iniciales}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600;${inactivo ? 'color:var(--txt3);text-decoration:line-through' : ''}">${_esc(u.nombre_completo) || '—'}</div>
              <div style="font-size:10px;color:var(--txt2)">${u.username ? '@' + u.username : (u.email || '')}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">
              <span class="tag ${rolBadge}">${ROL_LABELS_ADM[u.rol] || u.rol}</span>
              ${u.nivel ? `<span style="font-size:9px;font-weight:600;color:${nivelColor}">${NIVEL_LABELS_ADM[u.nivel] || u.nivel}</span>` : ''}
              ${inactivo ? `<span class="tag tr">Inactivo</span>` : ''}
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

async function _abrirModalUsuario(userId) {
  const user   = userId ? _adminUsuarios.find(u => u.id === userId) : null;
  const esNuevo = !userId;

  const { data: cursosAll } = await sb.from('cursos')
    .select('id,nombre,division,nivel')
    .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
    .or('activo.is.null,activo.eq.true')
    .order('nivel').order('nombre');
  const cursosTodos = cursosAll || [];

  const rolesDisp = USUARIO_ACTUAL.rol === 'director_general'
    ? ['director_general', 'directivo_nivel', 'docente', 'preceptor', 'eoe']
    : ['docente', 'preceptor', 'eoe'];

  const nivelesDisp = USUARIO_ACTUAL.rol === 'directivo_nivel'
    ? [USUARIO_ACTUAL.nivel]
    : ['inicial', 'primario', 'secundario'];

  const rolSel    = user?.rol   || 'docente';
  const nivelSel  = user?.nivel || '';
  const cursosSel = user?.cursos_ids || [];
  const cursosFilt = nivelSel ? cursosTodos.filter(c => c.nivel === nivelSel) : [];

  const mostrarNivel   = ['directivo_nivel', 'preceptor', 'docente'].includes(rolSel);
  const mostrarCursos  = rolSel === 'preceptor' && cursosFilt.length > 0;

  const cursosTodosJSON = JSON.stringify(cursosTodos).replace(/"/g, '&quot;');
  const nivelesJSON     = JSON.stringify(nivelesDisp).replace(/"/g, '&quot;');

  const modal = _crearModal(
    esNuevo ? 'Nuevo usuario' : 'Editar usuario',
    `
    <div class="adm-form-row">
      <label class="adm-label">Nombre completo</label>
      <input type="text" id="mu-nombre" value="${_esc(user?.nombre_completo)}" placeholder="Nombre y apellido"
        ${esNuevo ? 'onblur="_muSugerirUsername()"' : ''}>
    </div>
    <div class="adm-form-row">
      <label class="adm-label">Nombre de usuario</label>
      <input type="text" id="mu-username" value="${_esc(user?.username)}" placeholder="Ej: jgarcia"
        ${!esNuevo ? 'readonly style="opacity:.6;cursor:default"' : ''}>
      ${esNuevo ? `<div style="font-size:10px;color:var(--txt2);margin-top:3px">Inicial del nombre + apellido. Se completa automático al salir del campo nombre.</div>` : ''}
    </div>
    <div class="adm-form-row">
      <label class="adm-label">DNI</label>
      <input type="text" id="mu-dni" value="${_esc(user?.dni)}" placeholder="Ej: 12345678">
    </div>
    ${esNuevo ? `
    <div class="adm-form-row">
      <label class="adm-label">Contraseña inicial</label>
      <input type="text" id="mu-pass" value="" placeholder="Dejar vacío para usar el DNI como contraseña">
      <div style="font-size:10px;color:var(--txt2);margin-top:3px">Si no se completa, el DNI se usa como contraseña de ingreso.</div>
    </div>` : `
    <div class="adm-form-row">
      <label class="adm-label">Nueva contraseña</label>
      <input type="text" id="mu-pass" value="" placeholder="${user?.dni ? 'Actual: ' + _esc(user.dni) + ' — Dejar vacío para no modificar' : 'Dejar vacío para no modificar'}">
      <div style="font-size:10px;color:var(--txt2);margin-top:3px">Si completás este campo se actualizará la contraseña y el DNI registrado.</div>
    </div>`}
    <div class="adm-form-row">
      <label class="adm-label">Email (para recuperación de contraseña)</label>
      <input type="email" id="mu-email" value="${_esc(user?.email)}" placeholder="email@ejemplo.com"
        ${!esNuevo ? 'readonly style="opacity:.6;cursor:default"' : ''}>
    </div>
    <div class="adm-form-row">
      <label class="adm-label">Rol</label>
      <select id="mu-rol" onchange="_muOnRolChange('${nivelesJSON}','${cursosTodosJSON}')">
        ${rolesDisp.map(r => `<option value="${r}" ${r === rolSel ? 'selected' : ''}>${ROL_LABELS_ADM[r]}</option>`).join('')}
      </select>
    </div>
    <div id="mu-nivel-row" class="adm-form-row" ${mostrarNivel ? '' : 'style="display:none"'}>
      <label class="adm-label">Nivel</label>
      <select id="mu-nivel" onchange="_muOnNivelChange('${cursosTodosJSON}')"
        ${USUARIO_ACTUAL.rol === 'directivo_nivel' ? 'disabled' : ''}>
        <option value="">— Seleccionar —</option>
        ${nivelesDisp.map(n => `<option value="${n}" ${n === nivelSel ? 'selected' : ''}>${NIVEL_LABELS_ADM[n]}</option>`).join('')}
      </select>
    </div>
    <div id="mu-cursos-row" class="adm-form-row" ${mostrarCursos ? '' : 'style="display:none"'}>
      <label class="adm-label">Cursos asignados</label>
      <div id="mu-cursos-list" style="display:flex;flex-direction:column;gap:5px;max-height:160px;overflow-y:auto;border:1px solid var(--brd);border-radius:var(--rad);padding:8px">
        ${cursosFilt.map(c => `
          <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:12px">
            <input type="checkbox" value="${c.id}" ${cursosSel.includes(c.id) ? 'checked' : ''}>
            ${_esc(c.nombre)}${c.division || ''} <span style="font-size:10px;color:var(--txt2)">(${NIVEL_LABELS_ADM[c.nivel] || c.nivel})</span>
          </label>`).join('')}
      </div>
    </div>
    <div class="adm-form-row">
      <div class="toggle-row-ui">
        <span style="font-size:12px;font-weight:500">Usuario activo</span>
        <div class="tog${user?.activo !== false ? ' on' : ''}" id="mu-activo" onclick="_togAdm('mu-activo')">
          <div class="tog-thumb"></div>
        </div>
      </div>
    </div>
    ${(_configExtraOk && USUARIO_ACTUAL.rol === 'director_general') ? `
    <div class="adm-form-row">
      <label class="adm-label">Accesos a Configuración</label>
      <div style="display:flex;flex-direction:column;gap:6px;padding:10px;background:var(--surf2);border:1px solid var(--brd);border-radius:var(--rad)">
        <div style="font-size:10px;color:var(--txt2);margin-bottom:2px">Secciones adicionales habilitadas para este usuario:</div>
        ${CONFIG_TABS_TODOS.map(t => {
          const yaRol = { institucion:['director_general'], usuarios:['director_general','directivo_nivel'], cursos:['director_general','directivo_nivel','preceptor'], alumnos:['director_general','directivo_nivel','preceptor'], materias:['director_general','directivo_nivel'], asignaciones:['director_general','directivo_nivel'], parametros:['director_general','directivo_nivel'] }[t.id]?.includes(rolSel);
          const checked = (user?.config_extra?.tabs || []).includes(t.id);
          return `<label style="display:flex;align-items:center;gap:7px;cursor:${yaRol?'default':'pointer'};font-size:12px;${yaRol?'color:var(--txt3)':''}">
            <input type="checkbox" name="mu-cfg-tab" value="${t.id}" ${checked||yaRol?'checked':''} ${yaRol?'disabled':''}>
            ${t.label}${yaRol?' <span style="font-size:10px;color:var(--verde)">(por rol)</span>':''}
          </label>`;
        }).join('')}
      </div>
    </div>` : ''}
    `,
    async () => { await _guardarUsuario(userId, esNuevo); }
  );

  const puedeResetear = ['director_general', 'directivo_nivel'].includes(USUARIO_ACTUAL.rol);
  if (!esNuevo && puedeResetear) {
    const footer = modal.querySelector('.adm-modal-footer');
    const btnReset = document.createElement('button');
    btnReset.className = 'btn-s';
    btnReset.textContent = 'Resetear a DNI';
    btnReset.style.marginRight = 'auto';
    btnReset.title = 'Copia el DNI en el campo de nueva contraseña para resetear';
    btnReset.onclick = () => {
      const passInput = document.getElementById('mu-pass');
      const dniInput  = document.getElementById('mu-dni');
      if (passInput && dniInput) {
        passInput.value = dniInput.value;
        passInput.focus();
      }
    };
    footer.insertBefore(btnReset, footer.firstChild);
  }
}

function _togPassVis(inputId) {
  const inp = document.getElementById(inputId);
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}

function _muSugerirUsername() {
  const nombre = document.getElementById('mu-nombre')?.value?.trim();
  const usrInp = document.getElementById('mu-username');
  if (!nombre || !usrInp || usrInp.value) return;
  const rmDia = s => [...s.normalize('NFD')].filter(c => c.charCodeAt(0) < 768 || c.charCodeAt(0) > 879).join('');
  const clean = s => rmDia(s).toLowerCase().replace(/[^a-z]/g, '');
  let inicial = '', apellido = '';
  if (nombre.includes(',')) {
    const [ap, nm] = nombre.split(',');
    apellido = clean(ap.trim().split(/\s+/)[0]);
    inicial  = clean(nm.trim().split(/\s+/)[0])[0] || '';
  } else {
    const partes = nombre.trim().split(/\s+/);
    inicial  = clean(partes[0])[0] || '';
    apellido = clean(partes[partes.length - 1]);
  }
  usrInp.value = (inicial + apellido).slice(0, 20);
}

function _muOnRolChange(nivelesJSON, cursosTodosJSON) {
  const rol = document.getElementById('mu-rol')?.value;
  const nivelesDisp  = JSON.parse(nivelesJSON.replace(/&quot;/g, '"'));
  const cursosTodos  = JSON.parse(cursosTodosJSON.replace(/&quot;/g, '"'));
  const nivelRow     = document.getElementById('mu-nivel-row');
  const cursosRow    = document.getElementById('mu-cursos-row');

  if (nivelRow)  nivelRow.style.display  = ['directivo_nivel', 'preceptor', 'docente'].includes(rol) ? '' : 'none';
  if (cursosRow) cursosRow.style.display = 'none';

  if (rol === 'preceptor') _muOnNivelChange(JSON.stringify(cursosTodos).replace(/"/g, '&quot;'));
}

function _muOnNivelChange(cursosTodosJSON) {
  const rol         = document.getElementById('mu-rol')?.value;
  const nivel       = document.getElementById('mu-nivel')?.value;
  const cursosRow   = document.getElementById('mu-cursos-row');
  const cursosList  = document.getElementById('mu-cursos-list');
  const cursosTodos = JSON.parse(cursosTodosJSON.replace(/&quot;/g, '"'));

  if (rol !== 'preceptor' || !nivel) {
    if (cursosRow) cursosRow.style.display = 'none';
    return;
  }

  const filtrados = cursosTodos.filter(c => c.nivel === nivel);
  if (!filtrados.length) { if (cursosRow) cursosRow.style.display = 'none'; return; }

  if (cursosRow)  cursosRow.style.display  = '';
  if (cursosList) {
    cursosList.innerHTML = filtrados.map(c => `
      <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:12px">
        <input type="checkbox" value="${c.id}">
        ${_esc(c.nombre)}${c.division || ''}
      </label>`).join('');
  }
}

async function _guardarUsuario(userId, esNuevo) {
  const nombre_completo = document.getElementById('mu-nombre')?.value?.trim();
  const username        = document.getElementById('mu-username')?.value?.trim().toLowerCase();
  const email           = document.getElementById('mu-email')?.value?.trim();
  const dni             = document.getElementById('mu-dni')?.value?.trim() || null;
  const passField       = document.getElementById('mu-pass')?.value?.trim();
  const rol             = document.getElementById('mu-rol')?.value;
  const nivel           = document.getElementById('mu-nivel')?.value || null;
  const activo          = document.getElementById('mu-activo')?.classList.contains('on');

  const cursosChecks = document.querySelectorAll('#mu-cursos-list input[type=checkbox]:checked');
  const cursos_ids   = Array.from(cursosChecks).map(c => c.value);

  if (!nombre_completo)     { alert('El nombre es requerido.'); return; }
  if (esNuevo && !username) { alert('El nombre de usuario es requerido.'); return; }
  if (esNuevo && !email)    { alert('El email es requerido.'); return; }
  if (esNuevo && !dni)      { alert('El DNI es requerido.'); return; }
  if (esNuevo && !/^[a-z0-9._-]+$/.test(username)) {
    alert('El nombre de usuario solo puede contener letras minúsculas, números, puntos y guiones.');
    return;
  }

  try {
    if (esNuevo) {
      const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
        },
        body: JSON.stringify({
          email,
          password: passField || dni,
          email_confirm: true,
          user_metadata: {
            nombre_completo,
            username,
            rol,
            nivel:          nivel || '',
            activo:         activo,
            dni:            dni || '',
            institucion_id: USUARIO_ACTUAL.institucion_id,
            cursos_ids:     cursos_ids.length ? cursos_ids : [],
          },
        }),
      });
      const authData = await resp.json();
      if (authData.error || !authData.id) {
        throw new Error(authData.error?.message || authData.msg || 'Error al crear usuario en Auth');
      }
      // El trigger handle_new_user() ya insertó la fila en public.usuarios.
      // Verificamos que esté y actualizamos si cursos_ids quedó vacío.
      if (cursos_ids.length) {
        await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=eq.${authData.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY,
          },
          body: JSON.stringify({ cursos_ids }),
        });
      }
    } else {
      const updatePayload = {
        nombre_completo, rol, nivel, activo,
        dni: passField || dni || null,
        cursos_ids: cursos_ids.length ? cursos_ids : null,
      };
      if (_configExtraOk && USUARIO_ACTUAL.rol === 'director_general') {
        const tabChecks = document.querySelectorAll('input[name="mu-cfg-tab"]:not(:disabled):checked');
        const tabsExtra = Array.from(tabChecks).map(c => c.value);
        updatePayload.config_extra = tabsExtra.length ? { tabs: tabsExtra } : {};
      }
      const { error } = await sb.from('usuarios').update(updatePayload).eq('id', userId);
      if (error) throw error;
      if (passField) {
        const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY,
          },
          body: JSON.stringify({ password: passField }),
        });
        const data = await resp.json();
        if (data.error || !data.id) throw new Error(data.error?.message || data.msg || 'Error al actualizar contraseña');
      }
    }

    _cerrarModal();
    await _renderUsuarios();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}


// ══════════════════════════════════════════════════════
// SECCIÓN: CURSOS
// ══════════════════════════════════════════════════════
async function _renderCursos() {
  const sec = document.getElementById('adm-section-content');
  sec.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  let q = sb.from('cursos')
    .select('*')
    .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
    .order('nivel').order('nombre').order('division');

  if (USUARIO_ACTUAL.rol === 'directivo_nivel') q = q.eq('nivel', USUARIO_ACTUAL.nivel);
  if (USUARIO_ACTUAL.rol === 'preceptor') {
    const ids = USUARIO_ACTUAL.cursos_ids || [];
    if (ids.length) q = q.in('id', ids); else { sec.innerHTML = '<div class="empty-state">Sin cursos asignados</div>'; return; }
  }

  const { data, error } = await q;
  if (error) { _admError(sec, error.message); return; }
  _adminCursos = data || [];

  // Contar alumnos
  const countMap = {};
  if (_adminCursos.length) {
    const { data: alData } = await sb.from('alumnos')
      .select('curso_id').in('curso_id', _adminCursos.map(c => c.id)).eq('activo', true);
    (alData || []).forEach(a => { countMap[a.curso_id] = (countMap[a.curso_id] || 0) + 1; });
  }

  // Cargar nombres de preceptores
  const precIds = [...new Set(_adminCursos.map(c => c.preceptor_id).filter(Boolean))];
  const precMap = {};
  if (precIds.length) {
    const { data: precs } = await sb.from('usuarios').select('id,nombre_completo').in('id', precIds);
    (precs || []).forEach(p => { precMap[p.id] = p.nombre_completo; });
  }

  const porNivel  = {};
  _adminCursos.forEach(c => {
    const n = c.nivel || 'sin_nivel';
    if (!porNivel[n]) porNivel[n] = [];
    porNivel[n].push(c);
  });

  const canEdit = ['director_general', 'directivo_nivel'].includes(USUARIO_ACTUAL.rol);

  const html = Object.entries(porNivel).map(([nivel, lista]) => {
    const color = NIVEL_COLORS_ADM[nivel] || 'var(--gris)';
    return `
      <div class="sec-lb" style="color:${color}">${NIVEL_LABELS_ADM[nivel] || nivel}</div>
      ${lista.map(c => `
        <div class="card" style="border-left:3px solid ${color};padding:12px 14px;margin-bottom:8px;cursor:pointer" onclick="_irAAlumnosDeCurso('${c.id}')" title="Ver alumnos de este curso">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <div style="background:${color}1a;color:${color};font-size:13px;font-weight:700;padding:4px 10px;border-radius:6px;flex-shrink:0">
              ${_esc(c.nombre)}${c.division || ''}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:11px;color:var(--txt2)">Preceptor: ${precMap[c.preceptor_id] ? _esc(precMap[c.preceptor_id]) : '—'}</div>
              <div style="font-size:11px;color:var(--txt2)">${countMap[c.id] || 0} alumnos · Año ${c.ciclo_lectivo || c.anio || '—'}</div>
            </div>
            ${canEdit ? `
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn-s" onclick="event.stopPropagation();_abrirModalCurso('${c.id}')">Editar</button>
              <button class="btn-d" onclick="event.stopPropagation();_eliminarCurso('${c.id}')">Eliminar</button>
            </div>` : ''}
          </div>
        </div>`).join('')}`;
  }).join('');

  sec.innerHTML = `
    ${canEdit ? `<div style="text-align:right;margin-bottom:12px"><button class="btn-p" onclick="_abrirModalCurso(null)">+ Nuevo curso</button></div>` : ''}
    ${html || '<div class="empty-state">Sin cursos registrados</div>'}`;
}

function _irAAlumnosDeCurso(cursoId) {
  _admAlumnosCursoSel = cursoId;
  _switchAdminTab('alumnos');
}

async function _abrirModalCurso(cursoId) {
  const curso = cursoId ? _adminCursos.find(c => c.id === cursoId) : null;

  const [precsRes, orientsRes] = await Promise.all([
    sb.from('usuarios')
      .select('id,nombre_completo,nivel')
      .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
      .eq('rol', 'preceptor').eq('activo', true).order('nombre_completo'),
    sb.from('orientaciones').select('id,nombre').eq('activo', true).order('nombre'),
  ]);

  const precs   = precsRes.data || [];
  const orients = orientsRes.data || [];

  const niveles   = USUARIO_ACTUAL.rol === 'directivo_nivel' ? [USUARIO_ACTUAL.nivel] : ['inicial', 'primario', 'secundario'];
  const nivelSel  = curso?.nivel || niveles[0];
  const precsDisp = precs;
  const anioActual = new Date().getFullYear();
  const esAnioAlto = /^[456]/.test((curso?.nombre || '').trim());

  _crearModal(
    cursoId ? 'Editar curso' : 'Nuevo curso',
    `
    <div class="adm-form-row">
      <label class="adm-label">Nombre (ej: 3°, Sala 5)</label>
      <input type="text" id="mc-nombre" value="${_esc(curso?.nombre)}" placeholder="Ej: 3°" oninput="_toggleOrientacion()">
    </div>
    <div class="adm-form-row">
      <label class="adm-label">División</label>
      <input type="text" id="mc-division" value="${_esc(curso?.division)}" placeholder="Ej: A" style="max-width:80px">
    </div>
    <div class="adm-form-row">
      <label class="adm-label">Nivel</label>
      <select id="mc-nivel" ${USUARIO_ACTUAL.rol === 'directivo_nivel' ? 'disabled' : ''}>
        ${niveles.map(n => `<option value="${n}" ${n === nivelSel ? 'selected' : ''}>${NIVEL_LABELS_ADM[n]}</option>`).join('')}
      </select>
    </div>
    <div class="adm-form-row">
      <label class="adm-label">Año lectivo</label>
      <input type="number" id="mc-anio" value="${curso?.ciclo_lectivo || curso?.anio || anioActual}" min="2020" max="2050" style="max-width:120px">
    </div>
    <div class="adm-form-row" id="mc-orient-row" style="display:${esAnioAlto ? '' : 'none'}">
      <label class="adm-label">Orientación</label>
      <select id="mc-orientacion">
        <option value="">— Sin orientación —</option>
        ${orients.map(o => `<option value="${o.id}" ${o.id === curso?.orientacion_id ? 'selected' : ''}>${_esc(o.nombre)}</option>`).join('')}
      </select>
    </div>
    <div class="adm-form-row">
      <label class="adm-label">Preceptor asignado</label>
      <select id="mc-prec">
        <option value="">— Sin asignar —</option>
        ${precsDisp.map(p => `<option value="${p.id}" ${p.id === curso?.preceptor_id ? 'selected' : ''}>${_esc(p.nombre_completo)}</option>`).join('')}
      </select>
    </div>
    `,
    async () => { await _guardarCurso(cursoId); }
  );
}

function _toggleOrientacion() {
  const nombre = document.getElementById('mc-nombre')?.value?.trim() || '';
  const row    = document.getElementById('mc-orient-row');
  if (row) row.style.display = /^[456]/.test(nombre) ? '' : 'none';
}

async function _guardarCurso(cursoId) {
  const nombre        = document.getElementById('mc-nombre')?.value?.trim();
  const division      = document.getElementById('mc-division')?.value?.trim();
  const nivel         = document.getElementById('mc-nivel')?.value;
  const ciclo_lectivo = parseInt(document.getElementById('mc-anio')?.value);
  const preceptor_id  = document.getElementById('mc-prec')?.value || null;
  const orientRow     = document.getElementById('mc-orient-row');
  const orientacion_id = (orientRow && orientRow.style.display !== 'none')
    ? (document.getElementById('mc-orientacion')?.value || null)
    : null;

  if (!nombre) { alert('El nombre del curso es requerido.'); return; }
  if (!nivel)  { alert('El nivel es requerido.'); return; }

  try {
    if (cursoId) {
      const { error } = await sb.from('cursos').update({ nombre, division, nivel, ciclo_lectivo, preceptor_id, orientacion_id }).eq('id', cursoId);
      if (error) throw error;
    } else {
      const { data: nuevo, error } = await sb.from('cursos').insert([{
        nombre, division, nivel, ciclo_lectivo, anio: ciclo_lectivo, preceptor_id, orientacion_id,
        institucion_id: USUARIO_ACTUAL.institucion_id, activo: true,
      }]).select().single();
      if (error) throw error;

      if (preceptor_id && nuevo?.id) {
        const { data: prec } = await sb.from('usuarios').select('cursos_ids').eq('id', preceptor_id).single();
        const nuevosIds = [...new Set([...(prec?.cursos_ids || []), nuevo.id])];
        await sb.from('usuarios').update({ cursos_ids: nuevosIds }).eq('id', preceptor_id);
      }
    }
    _cerrarModal();
    await _renderCursos();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function _eliminarCurso(cursoId) {
  if (!confirm('¿Eliminar este curso? Se eliminará definitivamente y no se podrá recuperar.')) return;
  const { error } = await sb.from('cursos').delete().eq('id', cursoId);
  if (error) { alert('Error: ' + error.message); return; }
  await _renderCursos();
}

// ══════════════════════════════════════════════════════
// SECCIÓN: ALUMNOS
// ══════════════════════════════════════════════════════
let _admAlumnosCursoSel = null;
let _admAlumnosList     = [];

async function _renderAlumnos() {
  const sec = document.getElementById('adm-section-content');
  sec.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  let qc = sb.from('cursos')
    .select('id,nombre,division,nivel')
    .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
    .or('activo.is.null,activo.eq.true')
    .order('nivel').order('nombre');

  if (USUARIO_ACTUAL.rol === 'directivo_nivel') qc = qc.eq('nivel', USUARIO_ACTUAL.nivel);
  else if (USUARIO_ACTUAL.rol === 'preceptor') {
    const ids = USUARIO_ACTUAL.cursos_ids || [];
    if (ids.length) qc = qc.in('id', ids);
    else { sec.innerHTML = '<div class="empty-state">Sin cursos asignados</div>'; return; }
  }

  const { data: cursosDisp } = await qc;
  const cursos = cursosDisp || [];

  if (!_admAlumnosCursoSel && cursos.length) _admAlumnosCursoSel = cursos[0].id;

  const canEdit   = ['director_general', 'directivo_nivel'].includes(USUARIO_ACTUAL.rol);
  const canImport = canEdit;

  sec.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <select id="adm-alumnos-curso-sel" onchange="_admCursoChange(this.value)" style="flex:1;max-width:280px">
        ${cursos.map(c => `<option value="${c.id}" ${c.id === _admAlumnosCursoSel ? 'selected' : ''}>${NIVEL_LABELS_ADM[c.nivel] || c.nivel} · ${_esc(c.nombre)}${c.division || ''}</option>`).join('')}
      </select>
      ${canEdit   ? `<button class="btn-p" onclick="_abrirModalAlumno(null)">+ Nuevo alumno</button>` : ''}
      ${canImport ? `<button class="btn-s" onclick="_abrirImportCSV()">Importar Excel</button>` : ''}
    </div>
    <div id="adm-alumnos-list"></div>`;

  if (_admAlumnosCursoSel) await _cargarAlumnosDeCurso(_admAlumnosCursoSel);
}

async function _admCursoChange(cursoId) {
  _admAlumnosCursoSel = cursoId;
  await _cargarAlumnosDeCurso(cursoId);
}

async function _cargarAlumnosDeCurso(cursoId) {
  const list = document.getElementById('adm-alumnos-list');
  if (!list) return;
  list.innerHTML = '<div class="loading-state small"><div class="spinner"></div></div>';

  const { data, error } = await sb.from('alumnos')
    .select('*').eq('curso_id', cursoId).order('apellido').order('nombre');

  _admAlumnosList = data || [];

  if (error) { list.innerHTML = `<div class="alr"><div class="alr-t">Error</div><div class="alr-d">${error.message}</div></div>`; return; }
  if (!_admAlumnosList.length) { list.innerHTML = '<div class="empty-state">Sin alumnos en este curso</div>'; return; }

  const canEdit = ['director_general', 'directivo_nivel'].includes(USUARIO_ACTUAL.rol);

  list.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden">
      ${_admAlumnosList.map(al => `
        <div class="adm-user-row" style="cursor:default">
          <div class="av av32" style="background:var(--gris-l);color:var(--gris);flex-shrink:0">${generarIniciales((al.nombre || '') + ' ' + (al.apellido || ''))}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;${al.activo === false ? 'color:var(--txt3);text-decoration:line-through' : ''}">${_esc(al.apellido)}, ${_esc(al.nombre)}</div>
            <div style="font-size:10px;color:var(--txt2)">DNI: ${al.dni || '—'} · Nac: ${al.fecha_nacimiento ? formatFechaLatam(al.fecha_nacimiento) : '—'}</div>
          </div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end">
            ${canEdit ? `<button class="btn-s" onclick="_abrirModalAlumno('${al.id}')">Editar</button>` : ''}
            ${canEdit ? `<button class="btn-s" onclick="_abrirCambiarCurso('${al.id}')">Cambiar curso</button>` : ''}
            ${canEdit && al.activo !== false ? `<button class="btn-d" onclick="_desactivarAlumno('${al.id}')">Desactivar</button>` : ''}
            ${al.activo === false ? `<span class="tag tr">Inactivo</span>` : ''}
          </div>
        </div>`).join('')}
    </div>`;
}

async function _abrirModalAlumno(alumnoId) {
  const al = alumnoId ? _admAlumnosList.find(a => a.id === alumnoId) : null;

  let qc = sb.from('cursos').select('id,nombre,division,nivel')
    .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
    .or('activo.is.null,activo.eq.true')
    .order('nivel').order('nombre');
  if (USUARIO_ACTUAL.rol === 'directivo_nivel')  qc = qc.eq('nivel', USUARIO_ACTUAL.nivel);
  else if (USUARIO_ACTUAL.rol === 'preceptor') {
    const ids = USUARIO_ACTUAL.cursos_ids || [];
    if (ids.length) qc = qc.in('id', ids);
  }
  const { data: cursosDisp } = await qc;
  const cursoActual = al?.curso_id || _admAlumnosCursoSel;

  _crearModal(
    alumnoId ? 'Editar alumno' : 'Nuevo alumno',
    `
    <div class="adm-form-row">
      <label class="adm-label">Nombre</label>
      <input type="text" id="mal-nombre" value="${_esc(al?.nombre)}" placeholder="Nombre">
    </div>
    <div class="adm-form-row">
      <label class="adm-label">Apellido</label>
      <input type="text" id="mal-apellido" value="${_esc(al?.apellido)}" placeholder="Apellido">
    </div>
    <div class="adm-form-row">
      <label class="adm-label">DNI</label>
      <input type="text" id="mal-dni" value="${_esc(al?.dni)}" placeholder="Número de documento">
    </div>
    <div class="adm-form-row">
      <label class="adm-label">Fecha de nacimiento</label>
      ${renderFechaInput('mal-fnac', al?.fecha_nacimiento || '')}
    </div>
    <div class="adm-form-row">
      <label class="adm-label">Curso</label>
      <select id="mal-curso">
        ${(cursosDisp || []).map(c => `<option value="${c.id}" ${c.id === cursoActual ? 'selected' : ''}>${NIVEL_LABELS_ADM[c.nivel] || c.nivel} · ${_esc(c.nombre)}${c.division || ''}</option>`).join('')}
      </select>
    </div>
    `,
    async () => { await _guardarAlumno(alumnoId); }
  );
}

async function _guardarAlumno(alumnoId) {
  const nombre           = document.getElementById('mal-nombre')?.value?.trim();
  const apellido         = document.getElementById('mal-apellido')?.value?.trim();
  const dni              = document.getElementById('mal-dni')?.value?.trim();
  const fecha_nacimiento = getFechaInput('mal-fnac') || null;
  const curso_id         = document.getElementById('mal-curso')?.value;

  if (!nombre || !apellido) { alert('Nombre y apellido son requeridos.'); return; }

  try {
    if (alumnoId) {
      const { error } = await sb.from('alumnos').update({ nombre, apellido, dni, fecha_nacimiento, curso_id }).eq('id', alumnoId);
      if (error) throw error;
    } else {
      const { error } = await sb.from('alumnos').insert([{
        nombre, apellido, dni, fecha_nacimiento, curso_id,
        institucion_id: USUARIO_ACTUAL.institucion_id, activo: true,
      }]);
      if (error) throw error;
    }
    _cerrarModal();
    await _cargarAlumnosDeCurso(_admAlumnosCursoSel);
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function _desactivarAlumno(alumnoId) {
  if (!confirm('¿Desactivar este alumno? El historial se conserva.')) return;
  const { error } = await sb.from('alumnos').update({ activo: false }).eq('id', alumnoId);
  if (error) { alert('Error: ' + error.message); return; }
  await _cargarAlumnosDeCurso(_admAlumnosCursoSel);
}

async function _abrirCambiarCurso(alumnoId) {
  const al = _admAlumnosList.find(a => a.id === alumnoId);
  if (!al) return;

  const cursoActual = _adminCursos.find(c => c.id === al.curso_id);
  let qc = sb.from('cursos').select('id,nombre,division,nivel')
    .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
    .or('activo.is.null,activo.eq.true')
    .order('nivel').order('nombre');
  if (cursoActual?.nivel) qc = qc.eq('nivel', cursoActual.nivel);
  const { data: cursosDisp } = await qc;
  const otros = (cursosDisp || []).filter(c => c.id !== al.curso_id);

  _crearModal(
    'Cambiar de curso',
    `
    <p style="font-size:12px;color:var(--txt2);margin-bottom:12px">${_esc(al.apellido)}, ${_esc(al.nombre)}</p>
    <div class="adm-form-row">
      <label class="adm-label">Nuevo curso</label>
      <select id="mcc-curso">
        ${otros.map(c => `<option value="${c.id}">${NIVEL_LABELS_ADM[c.nivel] || c.nivel} · ${_esc(c.nombre)}${c.division || ''}</option>`).join('')}
      </select>
    </div>
    `,
    async () => {
      const nuevoCursoId = document.getElementById('mcc-curso')?.value;
      if (!nuevoCursoId) return;
      try {
        await sb.from('historial_cursos').insert([{ alumno_id: alumnoId, curso_id: al.curso_id, anio: new Date().getFullYear() }]);
        const { error } = await sb.from('alumnos').update({ curso_id: nuevoCursoId }).eq('id', alumnoId);
        if (error) throw error;
        _cerrarModal();
        await _cargarAlumnosDeCurso(_admAlumnosCursoSel);
      } catch (e) { alert('Error: ' + e.message); }
    }
  );
}

// ─── IMPORTAR EXCEL / CSV ─────────────────────────────
let _csvDatos = [];

function _cargarSheetJS(cb) {
  if (window.XLSX) { cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  s.onload = cb;
  document.head.appendChild(s);
}

function _abrirImportCSV() {
  _csvDatos = [];
  const modal = _crearModal(
    'Importar alumnos desde Excel',
    `
    <p style="font-size:11px;color:var(--txt2);margin-bottom:10px">
      Columnas requeridas: <strong>Nombre y apellido</strong>, <strong>DNI</strong>, <strong>Fecha de nacimiento</strong><br>
      La primera fila debe ser el encabezado. Formatos aceptados: .xlsx, .xls, .csv
    </p>
    <div class="adm-form-row">
      <input type="file" id="csv-input" accept=".xlsx,.xls,.csv" onchange="_parsearCSV(event)" style="font-size:12px">
    </div>
    <div id="csv-preview" style="margin-top:10px"></div>
    `,
    async () => { await _confirmarImportCSV(); }
  );
  const btnG = modal.querySelector('.btn-p');
  if (btnG) btnG.textContent = 'Importar';
}

function _parsearFecha(val) {
  if (!val) return null;
  const s = String(val).trim();
  // DD/MM/YYYY o DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  // YYYY-MM-DD ya correcto
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Número serial de Excel
  if (/^\d+$/.test(s)) {
    const d = new Date(Math.round((parseInt(s) - 25569) * 86400 * 1000));
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  return null;
}

function _procesarFilasImport(rows) {
  if (!rows || rows.length < 2) {
    document.getElementById('csv-preview').innerHTML = '<div class="alr"><div class="alr-t">El archivo está vacío o no tiene datos.</div></div>';
    return;
  }
  const headers = rows[0].map(h => String(h || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  // Detectar columnas
  const iNA = headers.findIndex(h => h.includes('nombre') && h.includes('apellido'));
  const iN  = headers.findIndex(h => h === 'nombre');
  const iA  = headers.findIndex(h => h === 'apellido');
  const iD  = headers.findIndex(h => h.includes('dni'));
  const iF  = headers.findIndex(h => h.includes('fecha'));

  _csvDatos = [];
  const errores = [];
  rows.slice(1).forEach((row, i) => {
    const get = idx => idx >= 0 ? String(row[idx] || '').trim() : '';
    let nombre = '', apellido = '';
    if (iNA >= 0) {
      const full = get(iNA);
      if (full.includes(',')) {
        const commaIdx = full.indexOf(',');
        apellido = full.slice(0, commaIdx).trim();
        nombre   = full.slice(commaIdx + 1).trim();
      } else {
        const parts = full.split(/\s+/);
        apellido = parts[0] || '';
        nombre   = parts.slice(1).join(' ') || '';
      }
    } else {
      nombre   = get(iN);
      apellido = get(iA);
    }
    if (!nombre && !apellido) return; // fila vacía
    if (!nombre || !apellido) { errores.push(`Fila ${i + 2}: nombre/apellido incompleto`); return; }
    _csvDatos.push({
      nombre,
      apellido,
      dni: iD >= 0 ? get(iD) : '',
      fecha_nacimiento: iF >= 0 ? _parsearFecha(row[iF]) : null,
    });
  });

  const prev = document.getElementById('csv-preview');
  if (!_csvDatos.length) { prev.innerHTML = '<div class="alr"><div class="alr-t">Sin datos válidos</div></div>'; return; }

  prev.innerHTML = `
    <div style="font-size:11px;font-weight:600;margin-bottom:6px">
      ${_csvDatos.length} alumnos a importar${errores.length ? ` · <span style="color:var(--rojo)">${errores.length} filas con error</span>` : ''}
    </div>
    <div style="max-height:180px;overflow-y:auto;border:1px solid var(--brd);border-radius:var(--rad)">
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="background:var(--surf2)">
          <th style="padding:5px 8px;text-align:left;border-bottom:1px solid var(--brd)">Apellido</th>
          <th style="padding:5px 8px;text-align:left;border-bottom:1px solid var(--brd)">Nombre</th>
          <th style="padding:5px 8px;text-align:left;border-bottom:1px solid var(--brd)">DNI</th>
          <th style="padding:5px 8px;text-align:left;border-bottom:1px solid var(--brd)">F.Nac.</th>
        </tr></thead>
        <tbody>
          ${_csvDatos.slice(0, 20).map(r => `<tr>
            <td style="padding:5px 8px;border-bottom:1px solid var(--brd)">${_esc(r.apellido)}</td>
            <td style="padding:5px 8px;border-bottom:1px solid var(--brd)">${_esc(r.nombre)}</td>
            <td style="padding:5px 8px;border-bottom:1px solid var(--brd)">${r.dni}</td>
            <td style="padding:5px 8px;border-bottom:1px solid var(--brd)">${r.fecha_nacimiento || '—'}</td>
          </tr>`).join('')}
          ${_csvDatos.length > 20 ? `<tr><td colspan="4" style="padding:5px 8px;color:var(--txt2);font-style:italic">... y ${_csvDatos.length - 20} más</td></tr>` : ''}
        </tbody>
      </table>
    </div>
    ${errores.length ? `<div style="margin-top:6px;font-size:10px;color:var(--rojo)">${errores.slice(0,5).join(' · ')}${errores.length>5?` · y ${errores.length-5} más`:''}</div>` : ''}`;
}

function _parsearCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'csv') {
    const reader = new FileReader();
    reader.onload = e => {
      const lines = e.target.result.split('\n').map(l => l.trim()).filter(Boolean);
      const rows  = lines.map(l => l.split(',').map(c => c.replace(/^["']|["']$/g, '').trim()));
      _procesarFilasImport(rows);
    };
    reader.readAsText(file, 'UTF-8');
  } else {
    _cargarSheetJS(() => {
      const reader = new FileReader();
      reader.onload = e => {
        const wb   = XLSX.read(e.target.result, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        _procesarFilasImport(rows);
      };
      reader.readAsArrayBuffer(file);
    });
  }
}

async function _confirmarImportCSV() {
  if (!_csvDatos.length) { alert('No hay datos para importar. Seleccioná un archivo CSV válido.'); return; }
  if (!_admAlumnosCursoSel) { alert('Seleccioná un curso primero.'); return; }

  const registros = _csvDatos.map(r => ({
    ...r,
    curso_id: _admAlumnosCursoSel,
    institucion_id: USUARIO_ACTUAL.institucion_id,
    activo: true,
  }));

  let importados = 0;
  const errores  = [];
  for (let i = 0; i < registros.length; i += 50) {
    const { error } = await sb.from('alumnos').insert(registros.slice(i, i + 50));
    if (error) errores.push(error.message);
    else importados += Math.min(50, registros.length - i);
  }

  _cerrarModal();
  _csvDatos = [];
  alert(`Importación completada:\n${importados} alumno${importados !== 1 ? 's' : ''} importado${importados !== 1 ? 's' : ''}.${errores.length ? '\n\nErrores:\n' + errores.join('\n') : ''}`);
  await _cargarAlumnosDeCurso(_admAlumnosCursoSel);
}

// ══════════════════════════════════════════════════════
// SECCIÓN: MATERIAS
// ══════════════════════════════════════════════════════
let _adminMateriasList = [];

async function _renderMaterias() {
  const sec = document.getElementById('adm-section-content');
  sec.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  let q = sb.from('materias').select('*')
    .eq('institucion_id', USUARIO_ACTUAL.institucion_id).order('nivel').order('nombre');
  if (USUARIO_ACTUAL.rol === 'directivo_nivel') q = q.eq('nivel', USUARIO_ACTUAL.nivel);

  const { data, error } = await q;
  if (error) { _admError(sec, error.message); return; }
  _adminMateriasList = data || [];

  const porNivel = {};
  _adminMateriasList.forEach(m => {
    const n = m.nivel || 'sin_nivel';
    if (!porNivel[n]) porNivel[n] = [];
    porNivel[n].push(m);
  });

  const html = Object.entries(porNivel).map(([nivel, lista]) => {
    const color = NIVEL_COLORS_ADM[nivel] || 'var(--gris)';
    return `
      <div class="sec-lb" style="color:${color}">${NIVEL_LABELS_ADM[nivel] || nivel}</div>
      ${lista.map(m => `
        <div class="card" style="display:flex;align-items:center;gap:10px;padding:10px 14px;margin-bottom:6px">
          <div style="flex:1;font-size:12px;font-weight:500;${m.activo === false ? 'color:var(--txt3);text-decoration:line-through' : ''}">${_esc(m.nombre)}</div>
          <button class="btn-s" onclick="_abrirModalMateria('${m.id}')">Editar</button>
          ${m.activo !== false
            ? `<button class="btn-d" onclick="_desactivarMateria('${m.id}')">Desactivar</button>`
            : `<span class="tag tr">Inactivo</span>`}
        </div>`).join('')}`;
  }).join('');

  sec.innerHTML = `
    <div style="text-align:right;margin-bottom:12px">
      <button class="btn-p" onclick="_abrirModalMateria(null)">+ Nueva materia</button>
    </div>
    ${html || '<div class="empty-state">Sin materias registradas</div>'}`;
}

async function _abrirModalMateria(materiaId) {
  const mat      = materiaId ? _adminMateriasList.find(m => m.id === materiaId) : null;
  const niveles  = USUARIO_ACTUAL.rol === 'directivo_nivel' ? [USUARIO_ACTUAL.nivel] : ['inicial', 'primario', 'secundario'];
  const nivelSel = mat?.nivel || niveles[0];

  _crearModal(
    materiaId ? 'Editar materia' : 'Nueva materia',
    `
    <div class="adm-form-row">
      <label class="adm-label">Nombre de la materia</label>
      <input type="text" id="mmat-nombre" value="${_esc(mat?.nombre)}" placeholder="Ej: Matemática">
    </div>
    <div class="adm-form-row">
      <label class="adm-label">Nivel</label>
      <select id="mmat-nivel" ${USUARIO_ACTUAL.rol === 'directivo_nivel' ? 'disabled' : ''}>
        ${niveles.map(n => `<option value="${n}" ${n === nivelSel ? 'selected' : ''}>${NIVEL_LABELS_ADM[n]}</option>`).join('')}
      </select>
    </div>
    `,
    async () => {
      const nombre = document.getElementById('mmat-nombre')?.value?.trim();
      const nivel  = document.getElementById('mmat-nivel')?.value;
      if (!nombre) { alert('El nombre es requerido.'); return; }
      try {
        if (materiaId) {
          const { error } = await sb.from('materias').update({ nombre, nivel }).eq('id', materiaId);
          if (error) throw error;
        } else {
          const { error } = await sb.from('materias').insert([{ nombre, nivel, institucion_id: USUARIO_ACTUAL.institucion_id, activo: true }]);
          if (error) throw error;
        }
        _cerrarModal();
        await _renderMaterias();
      } catch (e) { alert('Error: ' + e.message); }
    }
  );
}

async function _desactivarMateria(materiaId) {
  if (!confirm('¿Desactivar esta materia?')) return;
  const { error } = await sb.from('materias').update({ activo: false }).eq('id', materiaId);
  if (error) { alert('Error: ' + error.message); return; }
  await _renderMaterias();
}

// ══════════════════════════════════════════════════════
// SECCIÓN: ASIGNACIONES
// ══════════════════════════════════════════════════════

// UI para inicial/primario: maestra de grado + docentes especiales
function _buildAsigFilasNivel(materias, docentes, asigns, cursoNivel) {
  const labelNivel = cursoNivel === 'inicial' ? 'sala' : 'grado';
  const gradoAsig  = asigns.find(a => a.tipo_docente === 'grado');
  const especMap   = {};
  asigns.filter(a => a.tipo_docente !== 'grado').forEach(a => { if (a.materia_id) especMap[a.materia_id] = a.docente_id; });
  const nomMap = {};
  docentes.forEach(d => { nomMap[d.id] = d.nombre_completo; });

  if (!_admAsigModoEdicion) {
    return `
      <div class="card">
        <div style="font-size:10px;font-weight:600;color:var(--verde);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Maestra/o de ${labelNivel}</div>
        <div style="padding:8px 0;border-bottom:2px solid var(--brd);margin-bottom:14px">
          <span style="font-size:12px;color:${gradoAsig ? 'var(--txt2)' : 'var(--txt3)'}">
            ${gradoAsig ? _esc(nomMap[gradoAsig.docente_id] || '') : '— Sin asignar —'}
          </span>
        </div>
        <div style="font-size:10px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Docentes especiales</div>
        ${materias.map(m => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--brd)">
            <div style="flex:1;font-size:12px;font-weight:500">${_esc(m.nombre)}</div>
            <span style="font-size:12px;color:${especMap[m.id] ? 'var(--txt2)' : 'var(--txt3)'}">
              ${especMap[m.id] ? _esc(nomMap[especMap[m.id]] || '') : '— Sin asignar —'}
            </span>
          </div>`).join('')}
        <div class="acc" style="margin-top:12px">
          <button class="btn-s" onclick="_admAsigModoEdicion=true;_renderAsigContent()">Editar asignaciones</button>
        </div>
      </div>`;
  }

  const gradoOptHtml = docentes.map(d =>
    `<option value="${d.id}" ${d.id === gradoAsig?.docente_id ? 'selected' : ''}>${_esc(d.nombre_completo)}</option>`
  ).join('');

  return `
    <div class="card">
      <div style="font-size:10px;font-weight:600;color:var(--verde);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Maestra/o de ${labelNivel}</div>
      <div style="padding:8px 0;border-bottom:2px solid var(--brd);margin-bottom:14px">
        <div style="font-size:11px;color:var(--txt2);margin-bottom:6px">Docente responsable del aula — toma asistencia y califica todas las áreas</div>
        <select id="asig-grado" style="width:100%;max-width:320px">
          <option value="">— Sin asignar —</option>
          ${gradoOptHtml}
        </select>
      </div>
      <div style="font-size:10px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;margin-top:8px">Docentes especiales</div>
      <div style="font-size:11px;color:var(--txt2);margin-bottom:8px">Solo califican su materia específica</div>
      ${materias.map(m => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--brd)">
          <div style="flex:1;font-size:12px;font-weight:500">${_esc(m.nombre)}</div>
          <select id="asig-${m.id}" style="max-width:220px">
            <option value="">— Sin asignar —</option>
            ${docentes.map(d => `<option value="${d.id}" ${d.id === especMap[m.id] ? 'selected' : ''}>${_esc(d.nombre_completo)}</option>`).join('')}
          </select>
        </div>`).join('')}
      <div class="acc" style="margin-top:12px">
        <button class="btn-p" onclick="_guardarAsignaciones()">Guardar asignaciones</button>
      </div>
    </div>`;
}

let _admAsigCursoSel       = null;
let _admAsigVistaPor       = 'curso';
let _admAsigDocenteSel     = null;
let _admAsigDocenteCursoSel = null;
let _admAsigAnioLectivo    = new Date().getFullYear();
let _admAsigModoEdicion    = true;

async function _renderAsignaciones() {
  const sec = document.getElementById('adm-section-content');
  sec.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  const [cursosRes, materiasRes, docentesRes] = await Promise.all([
    sb.from('cursos').select('id,nombre,division,nivel')
      .eq('institucion_id', USUARIO_ACTUAL.institucion_id).or('activo.is.null,activo.eq.true').order('nivel').order('nombre'),
    sb.from('materias').select('id,nombre,nivel')
      .eq('institucion_id', USUARIO_ACTUAL.institucion_id).eq('activo', true).order('nombre'),
    sb.from('usuarios').select('id,nombre_completo,nivel')
      .eq('institucion_id', USUARIO_ACTUAL.institucion_id).eq('rol', 'docente').eq('activo', true).order('nombre_completo'),
  ]);

  let cursos   = cursosRes.data   || [];
  const materias = materiasRes.data || [];
  const docentes = docentesRes.data || [];

  if (USUARIO_ACTUAL.rol === 'directivo_nivel') cursos = cursos.filter(c => c.nivel === USUARIO_ACTUAL.nivel);
  if (!_admAsigCursoSel && cursos.length) _admAsigCursoSel = cursos[0].id;
  if (!_admAsigDocenteSel && docentes.length) _admAsigDocenteSel = docentes[0].id;
  if (!_admAsigDocenteCursoSel && cursos.length) _admAsigDocenteCursoSel = cursos[0].id;

  // Guardar para acceso desde funciones de guardado
  window._admAsigCursos   = cursos;
  window._admAsigMaterias = materias;
  window._admAsigDocentes = docentes;

  sec.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:14px;flex-wrap:wrap">
      <div class="chip-row" style="margin:0">
        <div class="chip${_admAsigVistaPor === 'curso'   ? ' on' : ''}" onclick="_admAsigVista('curso')">Por curso</div>
        <div class="chip${_admAsigVistaPor === 'docente' ? ' on' : ''}" onclick="_admAsigVista('docente')">Por docente</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <label class="adm-label" style="margin:0;white-space:nowrap">Año lectivo</label>
        <input type="number" id="asig-anio-sel" value="${_admAsigAnioLectivo}" min="2020" max="2050"
          style="max-width:88px;padding:6px 10px;border:1px solid var(--brd);border-radius:6px;font-size:12px;background:var(--bg);color:var(--txt)"
          onchange="_admAsigAnioLectivo=parseInt(this.value)||new Date().getFullYear();_renderAsigContent()">
      </div>
    </div>
    <div id="adm-asig-content"></div>`;

  await _renderAsigContent();
}

async function _admAsigVista(modo) {
  _admAsigVistaPor = modo;
  _admAsigModoEdicion = true;
  document.querySelectorAll('#adm-section-content .chip').forEach(c => {
    c.classList.toggle('on', (modo === 'curso' && c.textContent === 'Por curso') || (modo === 'docente' && c.textContent === 'Por docente'));
  });
  const cont = document.getElementById('adm-asig-content');
  if (cont) cont.innerHTML = '<div class="loading-state small"><div class="spinner"></div></div>';
  await _renderAsigContent();
}

async function _renderAsigContent() {
  const cont     = document.getElementById('adm-asig-content');
  if (!cont) return;
  const cursos   = window._admAsigCursos   || [];
  const materias = window._admAsigMaterias || [];
  const docentes = window._admAsigDocentes || [];

  function _buildAsigFilas(materiasCurso, docentesCurso, asigMap) {
    if (!materiasCurso.length) return '<div class="empty-state">Sin materias para este nivel</div>';
    const nomMap = {};
    docentesCurso.forEach(d => { nomMap[d.id] = d.nombre_completo; });
    const asignadas  = materiasCurso.filter(m => asigMap[m.id]);
    const sinAsignar = materiasCurso.filter(m => !asigMap[m.id]);
    const optsHtml   = docentesCurso.map(d => `<option value="${d.id}">${_esc(d.nombre_completo)}</option>`).join('');

    if (!_admAsigModoEdicion) {
      const filaVista = m => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--brd)">
          <div style="flex:1;font-size:12px;font-weight:500">${_esc(m.nombre)}</div>
          <span style="font-size:12px;color:${asigMap[m.id] ? 'var(--txt2)' : 'var(--txt3)'}">${asigMap[m.id] ? _esc(nomMap[asigMap[m.id]] || '') : '— Sin asignar —'}</span>
        </div>`;
      return `
        <div class="card">
          ${materiasCurso.map(filaVista).join('')}
          <div class="acc" style="margin-top:12px">
            <button class="btn-s" onclick="_admAsigModoEdicion=true;_renderAsigContent()">Editar asignaciones</button>
          </div>
        </div>`;
    }

    const filaAsignada = m => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--brd)">
        <div style="flex:1;font-size:12px;font-weight:500">${_esc(m.nombre)}</div>
        <div id="static-asig-${m.id}" style="display:flex;align-items:center;gap:6px">
          <span style="font-size:12px;color:var(--txt2)">${_esc(nomMap[asigMap[m.id]] || '')}</span>
          <button class="btn-s" onclick="_asigEditarFila('${m.id}')" style="padding:3px 8px;font-size:11px">Cambiar</button>
        </div>
        <select id="asig-${m.id}" style="max-width:220px;display:none">
          <option value="">— Sin asignar —</option>
          ${docentesCurso.map(d => `<option value="${d.id}" ${d.id === asigMap[m.id] ? 'selected' : ''}>${_esc(d.nombre_completo)}</option>`).join('')}
        </select>
      </div>`;

    const filaSinAsignar = m => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--brd)">
        <div style="flex:1;font-size:12px;font-weight:500">${_esc(m.nombre)}</div>
        <select id="asig-${m.id}" style="max-width:220px">
          <option value="">— Sin asignar —</option>
          ${optsHtml}
        </select>
      </div>`;

    return `
      <div class="card">
        ${asignadas.length ? `
          <div style="font-size:10px;font-weight:600;color:var(--verde);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Asignadas</div>
          ${asignadas.map(filaAsignada).join('')}` : ''}
        ${sinAsignar.length ? `
          <div style="font-size:10px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.5px;margin-top:${asignadas.length ? 14 : 0}px;margin-bottom:4px">Sin asignar</div>
          ${sinAsignar.map(filaSinAsignar).join('')}` : ''}
        <div class="acc" style="margin-top:12px">
          <button class="btn-p" onclick="_guardarAsignaciones()">Guardar asignaciones</button>
        </div>
      </div>`;
  }

  if (_admAsigVistaPor === 'curso') {
    const cursoSel = cursos.find(c => c.id === _admAsigCursoSel);

    const { data: asigns } = await sb.from('asignaciones')
      .select('*').eq('curso_id', _admAsigCursoSel || '').eq('anio_lectivo', _admAsigAnioLectivo);

    const materiasCurso = cursoSel ? materias.filter(m => m.nivel === cursoSel.nivel) : [];
    const docentesCurso = cursoSel ? docentes.filter(d => !d.nivel || d.nivel === cursoSel.nivel) : docentes;
    const esNivel       = cursoSel?.nivel === 'inicial' || cursoSel?.nivel === 'primario';

    window._admAsigMateriaIds     = materiasCurso.map(m => m.id);
    window._admAsigDocentesCurso  = docentesCurso;
    window._admAsigCursoNivel     = cursoSel?.nivel;

    let asigContent;
    if (esNivel) {
      asigContent = _buildAsigFilasNivel(materiasCurso, docentesCurso, asigns || [], cursoSel.nivel);
    } else {
      const asigMap = {};
      (asigns || []).forEach(a => { if (a.materia_id) asigMap[a.materia_id] = a.docente_id; });
      asigContent = _buildAsigFilas(materiasCurso, docentesCurso, asigMap);
    }

    cont.innerHTML = `
      <div class="adm-form-row">
        <label class="adm-label">Curso</label>
        <select onchange="_admAsigCursoSel=this.value;_renderAsigContent()" style="max-width:280px">
          ${cursos.map(c => `<option value="${c.id}" ${c.id === _admAsigCursoSel ? 'selected' : ''}>${NIVEL_LABELS_ADM[c.nivel] || c.nivel} · ${_esc(c.nombre)}${c.division || ''}</option>`).join('')}
        </select>
      </div>
      ${asigContent}`;
  } else {
    const { data: asigns } = await sb.from('asignaciones')
      .select('*').eq('docente_id', _admAsigDocenteSel || '').eq('anio_lectivo', _admAsigAnioLectivo);

    const materiasMap = {};
    materias.forEach(m => { materiasMap[m.id] = m; });

    const porCurso = {};
    (asigns || []).forEach(a => {
      if (!porCurso[a.curso_id]) porCurso[a.curso_id] = [];
      porCurso[a.curso_id].push(a.materia_id);
    });

    const cursosConAsig = cursos.filter(c => porCurso[c.id]);
    const filasCursos = cursosConAsig.map(c => {
      const color = NIVEL_COLORS_ADM[c.nivel] || 'var(--gris)';
      const items = (porCurso[c.id] || []).map(mId => {
        const mat = materiasMap[mId];
        return mat ? `<div style="font-size:12px;padding:5px 0;border-bottom:1px solid var(--brd)">${_esc(mat.nombre)}</div>` : '';
      }).join('');
      return `
        <div class="card" style="border-left:3px solid ${color};margin-bottom:10px">
          <div style="font-size:11px;font-weight:700;color:${color};margin-bottom:8px">
            ${NIVEL_LABELS_ADM[c.nivel] || c.nivel} · ${_esc(c.nombre)}${c.division || ''}
          </div>
          ${items}
        </div>`;
    }).join('');

    cont.innerHTML = `
      <div class="adm-form-row">
        <label class="adm-label">Docente</label>
        <select onchange="_admAsigDocenteSel=this.value;_renderAsigContent()" style="max-width:280px">
          ${docentes.map(d => `<option value="${d.id}" ${d.id === _admAsigDocenteSel ? 'selected' : ''}>${_esc(d.nombre_completo)}</option>`).join('')}
        </select>
      </div>
      ${!cursosConAsig.length
        ? '<div class="empty-state">Este docente no tiene asignaciones para el año seleccionado.</div>'
        : filasCursos}`;
  }
}

function _asigEditarFila(materiaId) {
  const staticEl = document.getElementById('static-asig-' + materiaId);
  const selectEl = document.getElementById('asig-' + materiaId);
  if (staticEl) staticEl.style.display = 'none';
  if (selectEl) selectEl.style.display = '';
}

async function _guardarAsignaciones() {
  const cursoId    = _admAsigVistaPor === 'docente' ? _admAsigDocenteCursoSel : _admAsigCursoSel;
  const materiaIds = window._admAsigMateriaIds || [];
  const cursoNivel = window._admAsigCursoNivel;
  if (!cursoId) { alert('Seleccioná un curso.'); return; }

  const esNivel = cursoNivel === 'inicial' || cursoNivel === 'primario';

  try {
    if (esNivel) {
      // 1. Guardar maestra de grado
      await sb.from('asignaciones').delete()
        .eq('curso_id', cursoId).eq('anio_lectivo', _admAsigAnioLectivo).eq('tipo_docente', 'grado');
      const gradoId = document.getElementById('asig-grado')?.value;
      if (gradoId) {
        const { error } = await sb.from('asignaciones').insert([{
          curso_id: cursoId, materia_id: null, docente_id: gradoId,
          anio_lectivo: _admAsigAnioLectivo, tipo_docente: 'grado',
        }]);
        if (error) throw error;
      }

      // 2. Guardar docentes especiales
      if (materiaIds.length) {
        const { error: delErr } = await sb.from('asignaciones').delete()
          .eq('curso_id', cursoId).eq('anio_lectivo', _admAsigAnioLectivo)
          .eq('tipo_docente', 'especial').in('materia_id', materiaIds);
        if (delErr) throw delErr;
        const upserts = materiaIds
          .map(mId => ({ mId, dId: document.getElementById('asig-' + mId)?.value }))
          .filter(x => x.dId)
          .map(x => ({ curso_id: cursoId, materia_id: x.mId, docente_id: x.dId, anio_lectivo: _admAsigAnioLectivo, tipo_docente: 'especial' }));
        if (upserts.length) {
          const { error: insErr } = await sb.from('asignaciones').insert(upserts);
          if (insErr) throw insErr;
        }
      }
    } else {
      // Secundario: flujo original
      if (!materiaIds.length) { alert('Seleccioná un curso con materias disponibles.'); return; }
      const upserts = [];
      materiaIds.forEach(mId => {
        const docenteId = document.getElementById('asig-' + mId)?.value;
        if (docenteId) upserts.push({ curso_id: cursoId, materia_id: mId, docente_id: docenteId, anio_lectivo: _admAsigAnioLectivo, tipo_docente: 'especial' });
      });
      const { error: delErr } = await sb.from('asignaciones').delete()
        .eq('curso_id', cursoId).eq('anio_lectivo', _admAsigAnioLectivo).in('materia_id', materiaIds);
      if (delErr) throw delErr;
      if (upserts.length) {
        const { error: insErr } = await sb.from('asignaciones').insert(upserts);
        if (insErr) throw insErr;
      }
    }

    _admAsigModoEdicion = false;
    await _renderAsigContent();
  } catch (e) {
    alert('Error al guardar asignaciones: ' + e.message);
  }
}

// ══════════════════════════════════════════════════════
// SECCIÓN: PARÁMETROS
// ══════════════════════════════════════════════════════
let _paramSubTab = 'inicial';

async function _renderParametros() {
  const sec  = document.getElementById('adm-section-content');
  const inst = INSTITUCION_ACTUAL || {};

  // Solo niveles que la institución tiene activos
  const nivelesActivos = ['inicial', 'primario', 'secundario'].filter(n => inst['nivel_' + n]);
  // Si ninguno está configurado todavía (institución sin setup), mostrar todos
  const nivelesBase = nivelesActivos.length ? nivelesActivos : ['inicial', 'primario', 'secundario'];

  const niveles = USUARIO_ACTUAL.rol === 'directivo_nivel'
    ? [USUARIO_ACTUAL.nivel].filter(n => nivelesBase.includes(n))
    : nivelesBase;

  if (!niveles.length) {
    sec.innerHTML = '<div class="empty-state">No hay niveles activos. Activá al menos un nivel en la pestaña Institución.</div>';
    return;
  }

  if (!niveles.includes(_paramSubTab)) _paramSubTab = niveles[0];

  sec.innerHTML = `
    <div class="chip-row" style="margin-bottom:14px">
      ${niveles.map(n => `
        <div class="chip${n === _paramSubTab ? ' on' : ''}" id="param-chip-${n}"
          onclick="_paramTab('${n}')"
          style="${n === _paramSubTab ? `background:${NIVEL_COLORS_ADM[n]};border-color:${NIVEL_COLORS_ADM[n]};color:#fff` : ''}">
          ${NIVEL_LABELS_ADM[n]}
        </div>`).join('')}
    </div>
    <div id="param-content"></div>`;

  await _renderParamNivel(_paramSubTab);
}

async function _paramTab(nivel) {
  _paramSubTab = nivel;
  const inst = INSTITUCION_ACTUAL || {};
  const nivelesActivos = ['inicial', 'primario', 'secundario'].filter(n => inst['nivel_' + n]);
  const nivelesBase = nivelesActivos.length ? nivelesActivos : ['inicial', 'primario', 'secundario'];
  nivelesBase.forEach(n => {
    const chip = document.getElementById('param-chip-' + n);
    if (!chip) return;
    const activo = n === nivel;
    chip.classList.toggle('on', activo);
    chip.style.background   = activo ? NIVEL_COLORS_ADM[n] : '';
    chip.style.borderColor  = activo ? NIVEL_COLORS_ADM[n] : '';
    chip.style.color        = activo ? '#fff' : '';
  });
  const cont = document.getElementById('param-content');
  if (cont) cont.innerHTML = '<div class="loading-state small"><div class="spinner"></div></div>';
  await _renderParamNivel(nivel);
}

async function _renderParamNivel(nivel) {
  const cont   = document.getElementById('param-content');
  if (!cont) return;
  const instId = USUARIO_ACTUAL.institucion_id;
  const color  = NIVEL_COLORS_ADM[nivel];

  const [cfgRes, tiposEvalRes, tiposJustRes, tiposEventoRes, periodosRes] = await Promise.all([
    sb.from('config_asistencia').select('*').eq('institucion_id', instId).eq('nivel', nivel).maybeSingle(),
    sb.from('tipos_evaluacion').select('*').eq('institucion_id', instId).or(`nivel.eq.${nivel},nivel.is.null`).order('nombre'),
    sb.from('tipos_justificacion').select('*').eq('institucion_id', instId).eq('nivel', nivel).order('nombre'),
    sb.from('tipos_evento').select('*').eq('institucion_id', instId).order('nombre'),
    sb.from('periodos_evaluativos').select('*').eq('institucion_id', instId).eq('nivel', nivel).order('fecha_inicio'),
  ]);

  const cfg         = cfgRes.data       || {};
  const tiposEval   = tiposEvalRes.data  || [];
  const tiposJust   = tiposJustRes.data  || [];
  const tiposEvento = tiposEventoRes.data || [];
  const periodos    = periodosRes.data   || [];
  const cfgId       = cfg.id || '';

  // ── Sección evaluación diferenciada por nivel ───────
  let htmlEvaluacion = '';

  if (nivel === 'inicial') {
    const DIMS_DEFAULT = ['Lenguaje y comunicación','Desarrollo motor','Socialización','Desarrollo cognitivo','Autonomía'];
    const dims = cfg.dimensiones_informe || DIMS_DEFAULT;
    htmlEvaluacion = `
      <div style="font-size:12px;color:var(--txt2);margin:14px 0 10px;padding:10px;background:var(--surf2);border-radius:var(--rad);border-left:3px solid ${color}">
        El nivel inicial trabaja con <strong>informes narrativos</strong> por dimensiones de desarrollo.
        No se aplican calificaciones numéricas ni conceptuales.
      </div>
      <div class="card-t" style="color:${color};margin:0 0 8px">Dimensiones de desarrollo evaluadas</div>
      <div id="lista-dims-inicial">${_renderListaDims(dims)}</div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <input type="text" id="new-dim-inicial" placeholder="Ej: Exploración del entorno" style="flex:1;font-size:12px">
        <button class="btn-s" onclick="_agregarDim()">Agregar</button>
      </div>`;

  } else if (nivel === 'primario') {
    const VALS_CONC = ['D','R','B','MB','S'];
    const aprob1    = cfg.aprobacion_ciclo1 || 'B';
    const notaMin2  = cfg.nota_minima       ?? 7;
    const notaRec2  = cfg.nota_recuperacion ?? 4;
    htmlEvaluacion = `
      <div class="card-t" style="color:${color};margin-top:16px">Calificaciones</div>

      <div style="font-size:12px;font-weight:600;margin:10px 0 8px;padding:6px 10px;background:var(--surf2);border-radius:var(--rad)">
        Primer Ciclo — 1°, 2° y 3° grado
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="adm-form-row" style="margin:0">
          <label class="adm-label">Escala</label>
          <div style="font-size:12px;padding:6px 8px;background:var(--surf2);border-radius:5px;color:var(--txt)">Conceptual (D · R · B · MB · S)</div>
        </div>
        <div class="adm-form-row" style="margin:0">
          <label class="adm-label">Aprobación mínima</label>
          <select id="cfg-aprobacion-ciclo1">
            ${VALS_CONC.map(v => `<option value="${v}" ${aprob1 === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="font-size:11px;color:var(--txt2);margin-bottom:6px;padding:8px 10px;background:var(--surf2);border-radius:var(--rad)">
        <strong style="color:var(--txt)">Referencia de escala:</strong>&nbsp;
        <span><b>D</b> = En inicio</span>&nbsp;·&nbsp;
        <span><b>R</b> = En proceso</span>&nbsp;·&nbsp;
        <span><b>B</b> = Bueno</span>&nbsp;·&nbsp;
        <span><b>MB</b> = Muy bueno</span>&nbsp;·&nbsp;
        <span><b>S</b> = Sobresaliente</span>
      </div>
      <div style="font-size:12px;font-weight:600;margin-bottom:8px;padding:6px 10px;background:var(--surf2);border-radius:var(--rad)">
        Segundo Ciclo — 4°, 5° y 6° grado
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px">
        <div class="adm-form-row" style="margin:0">
          <label class="adm-label">Nota mínima (cursada regular)</label>
          <input type="number" id="cfg-nota-min" value="${notaMin2}" min="1" max="10">
        </div>
        <div class="adm-form-row" style="margin:0">
          <label class="adm-label">Nota mínima (recuperación)</label>
          <input type="number" id="cfg-nota-rec" value="${notaRec2}" min="1" max="10">
        </div>
      </div>`;

  } else {
    // secundario — comportamiento existente
    htmlEvaluacion = `
      <div class="card-t" style="color:${color};margin-top:14px">Calificaciones</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="adm-form-row" style="margin:0">
          <label class="adm-label">Nota mínima aprobación</label>
          <input type="number" id="cfg-nota-min" value="${cfg.nota_minima ?? 7}" min="1" max="10">
        </div>
        <div class="adm-form-row" style="margin:0">
          <label class="adm-label">Escala</label>
          <select id="cfg-escala">
            <option value="numerica"   ${(cfg.escala || 'numerica') === 'numerica'   ? 'selected' : ''}>Numérica (1–10)</option>
            <option value="conceptual" ${cfg.escala === 'conceptual' ? 'selected' : ''}>Conceptual</option>
          </select>
        </div>
      </div>`;
  }

  const _fmtP = iso => {
    if (!iso) return '—';
    const d = new Date(iso + 'T12:00:00');
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(2)}`;
  };

  cont.innerHTML = `
    <!-- ASISTENCIA Y EVALUACIÓN -->
    <div class="card" style="border-top:3px solid ${color}">
      <div class="card-t" style="color:${color}">Asistencia</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">
        <div class="adm-form-row" style="margin:0">
          <label class="adm-label">Alerta 1 (%)</label>
          <input type="number" id="cfg-u1" value="${cfg.umbral_alerta_1 ?? 10}" min="0" max="100">
        </div>
        <div class="adm-form-row" style="margin:0">
          <label class="adm-label">Alerta 2 (%)</label>
          <input type="number" id="cfg-u2" value="${cfg.umbral_alerta_2 ?? 20}" min="0" max="100">
        </div>
        <div class="adm-form-row" style="margin:0">
          <label class="adm-label">Riesgo (%)</label>
          <input type="number" id="cfg-u3" value="${cfg.umbral_alerta_3 ?? 30}" min="0" max="100">
        </div>
      </div>
      <div class="adm-form-row">
        <div class="toggle-row-ui">
          <span style="font-size:12px">Las justificadas cuentan para regularidad</span>
          <div class="tog${cfg.justificadas_cuentan ? ' on' : ''}" id="tog-justif" onclick="_togAdm('tog-justif')"><div class="tog-thumb"></div></div>
        </div>
      </div>
      ${htmlEvaluacion}
      <div class="acc" style="margin-top:14px">
        <button class="btn-p" id="cfg-save-btn" onclick="_guardarConfigAsistencia('${nivel}','${cfgId}')">Guardar configuración</button>
      </div>
    </div>

    <!-- TIPOS EVALUACIÓN -->
    <div class="card">
      <div class="card-t">Tipos de evaluación</div>
      <div id="lista-tipos-eval">
        ${_renderListaTipos(tiposEval, 'tipos_evaluacion', nivel, 'lista-tipos-eval')}
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <input type="text" id="new-tipo-eval-${nivel}" placeholder="Nuevo tipo de evaluación" style="flex:1">
        <button class="btn-s" onclick="_agregarTipo('tipos_evaluacion','new-tipo-eval-${nivel}','${nivel}','lista-tipos-eval')">Agregar</button>
      </div>
    </div>

    <!-- TIPOS JUSTIFICACIÓN -->
    <div class="card">
      <div class="card-t">Tipos de justificación de asistencia</div>
      <div id="lista-tipos-just">
        ${_renderListaTipos(tiposJust, 'tipos_justificacion', nivel, 'lista-tipos-just')}
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <input type="text" id="new-tipo-just-${nivel}" placeholder="Nuevo tipo de justificación" style="flex:1">
        <button class="btn-s" onclick="_agregarTipo('tipos_justificacion','new-tipo-just-${nivel}','${nivel}','lista-tipos-just')">Agregar</button>
      </div>
    </div>

    <!-- TIPOS EVENTO -->
    <div class="card">
      <div class="card-t">Tipos de eventos de agenda</div>
      <div id="lista-tipos-evento">
        ${_renderListaTipos(tiposEvento, 'tipos_evento', nivel, 'lista-tipos-evento')}
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <input type="text" id="new-tipo-evento-${nivel}" placeholder="Nuevo tipo de evento" style="flex:1">
        <button class="btn-s" onclick="_agregarTipo('tipos_evento','new-tipo-evento-${nivel}','${nivel}','lista-tipos-evento')">Agregar</button>
      </div>
    </div>

    <!-- PERÍODOS EVALUATIVOS -->
    <div class="card">
      <div class="card-t">Períodos evaluativos</div>
      <div id="lista-periodos">
        ${periodos.length ? periodos.map(p => `
          <div style="background:var(--surf2);border:1px solid var(--brd);border-radius:var(--rad);padding:12px 14px;margin-bottom:8px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px">
              <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0">
                <div id="pnombre-text-${p.id}" style="font-size:13px;font-weight:600">${_esc(p.nombre)}</div>
                <input id="pnombre-inp-${p.id}" type="text" value="${_esc(p.nombre)}"
                  style="display:none;font-size:13px;font-weight:600;padding:2px 6px;border:1px solid var(--brd);border-radius:5px;background:var(--bg);color:var(--txt);max-width:200px">
                <button id="pnombre-btn-${p.id}" onclick="_editarNombrePeriodo('${p.id}')"
                  style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--txt3);padding:0 3px;line-height:1;flex-shrink:0" title="Editar nombre">✎</button>
                <button id="pnombre-save-${p.id}" onclick="_guardarNombrePeriodo('${p.id}','${nivel}')"
                  style="display:none;background:none;border:none;cursor:pointer;font-size:12px;color:var(--verde);padding:0 4px;font-weight:700;flex-shrink:0" title="Guardar nombre">✓</button>
              </div>
              <button onclick="_eliminarPeriodo('${p.id}','${nivel}')"
                style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--txt3);padding:0 2px;line-height:1;flex-shrink:0" title="Eliminar">×</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div>
                <div class="adm-label">Inicio</div>
                ${renderFechaInput(`per-${p.id}-ini`, p.fecha_inicio || '', {onchange:`_onPeriodoFecha('${p.id}','fecha_inicio','per-${p.id}-ini')`})}
                ${p.fecha_inicio ? `<div style="font-size:10px;color:var(--verde);margin-top:3px">${_fmtP(p.fecha_inicio)}</div>` : ''}
              </div>
              <div>
                <div class="adm-label">Fin</div>
                ${renderFechaInput(`per-${p.id}-fin`, p.fecha_fin || '', {onchange:`_onPeriodoFecha('${p.id}','fecha_fin','per-${p.id}-fin')`})}
                ${p.fecha_fin ? `<div style="font-size:10px;color:var(--verde);margin-top:3px">${_fmtP(p.fecha_fin)}</div>` : ''}
              </div>
            </div>
          </div>`).join('') : '<div style="color:var(--txt2);font-size:11px;padding:6px 0">Sin períodos definidos</div>'}
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <input type="text" id="new-periodo-${nivel}" placeholder="Ej: 1° Cuatrimestre" style="flex:1">
        <button class="btn-s" onclick="_agregarPeriodo('${nivel}')">Agregar período</button>
      </div>
    </div>`;
}

function _renderListaTipos(lista, tabla, nivel, listaId) {
  if (!lista.length) return '<div style="color:var(--txt2);font-size:11px;padding:6px 0">Sin tipos definidos</div>';
  return lista.map(t => `
    <div id="tipo-row-${t.id}" style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--brd)">
      <div id="tipo-text-${t.id}" style="flex:1;font-size:12px;${t.activo === false ? 'color:var(--txt3);text-decoration:line-through' : ''}">${_esc(t.nombre)}</div>
      <input id="tipo-input-${t.id}" type="text" value="${_esc(t.nombre)}" style="flex:1;display:none;font-size:12px;padding:4px 8px;border:1px solid var(--brd);border-radius:5px;background:var(--bg);color:var(--txt)">
      <button id="tipo-btn-edit-${t.id}" onclick="_editarTipoInline('${t.id}')"
        style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--txt3);padding:0 3px;line-height:1" title="Editar nombre">✎</button>
      <button id="tipo-btn-save-${t.id}" onclick="_guardarTipoEdit('${t.id}','${tabla}','${nivel}','${listaId}')"
        style="display:none;background:none;border:none;cursor:pointer;font-size:12px;color:var(--verde);padding:0 4px;font-weight:700" title="Guardar">✓</button>
      <div class="tog${t.activo !== false ? ' on' : ''}" onclick="_togTipoActivo('${tabla}','${t.id}','${listaId}','${nivel}')">
        <div class="tog-thumb"></div>
      </div>
    </div>`).join('');
}

function _editarTipoInline(id) {
  document.getElementById('tipo-text-'    + id).style.display = 'none';
  document.getElementById('tipo-input-'   + id).style.display = '';
  document.getElementById('tipo-btn-edit-'+ id).style.display = 'none';
  document.getElementById('tipo-btn-save-'+ id).style.display = '';
  document.getElementById('tipo-input-'   + id).focus();
}

async function _guardarTipoEdit(id, tabla, nivel, listaId) {
  const nombre = document.getElementById('tipo-input-' + id)?.value?.trim();
  if (!nombre) return;
  const { error } = await sb.from(tabla).update({ nombre }).eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  await _renderParamNivel(nivel);
}

async function _guardarConfigAsistencia(nivel, existingId) {
  const u1                   = parseInt(document.getElementById('cfg-u1')?.value) || 10;
  const u2                   = parseInt(document.getElementById('cfg-u2')?.value) || 20;
  const u3                   = parseInt(document.getElementById('cfg-u3')?.value) || 30;
  const justificadas_cuentan = document.getElementById('tog-justif')?.classList.contains('on');

  const datos = {
    institucion_id: USUARIO_ACTUAL.institucion_id, nivel,
    umbral_alerta_1: u1, umbral_alerta_2: u2, umbral_alerta_3: u3,
    justificadas_cuentan,
  };

  if (nivel === 'inicial') {
    datos.escala      = null;
    datos.nota_minima = null;
  } else if (nivel === 'primario') {
    datos.escala_ciclo1     = 'conceptual';
    datos.aprobacion_ciclo1 = document.getElementById('cfg-aprobacion-ciclo1')?.value || 'B';
    datos.escala            = 'numerica';
    datos.nota_minima       = parseInt(document.getElementById('cfg-nota-min')?.value) || 7;
    datos.nota_recuperacion = parseInt(document.getElementById('cfg-nota-rec')?.value) || 4;
  } else {
    datos.nota_minima = parseInt(document.getElementById('cfg-nota-min')?.value) || 7;
    datos.escala      = document.getElementById('cfg-escala')?.value || 'numerica';
  }

  try {
    if (existingId) {
      const { error } = await sb.from('config_asistencia').update(datos).eq('id', existingId);
      if (error) throw error;
    } else {
      const { error } = await sb.from('config_asistencia').insert([datos]);
      if (error) throw error;
    }
    await _renderParamNivel(nivel);
    _toastOk('Configuración guardada');
    const saveBtn = document.getElementById('cfg-save-btn');
    if (saveBtn) {
      const orig = saveBtn.getAttribute('onclick');
      saveBtn.textContent = 'Editar';
      saveBtn.className = 'btn-s';
      saveBtn.removeAttribute('onclick');
      saveBtn.onclick = () => {
        saveBtn.textContent = 'Guardar configuración';
        saveBtn.className = 'btn-p';
        saveBtn.setAttribute('onclick', orig);
        saveBtn.onclick = null;
      };
    }
  } catch (e) {
    alert('Error al guardar: ' + e.message);
  }
}

async function _togTipoActivo(tabla, id, listaId, nivel) {
  const { data: curr } = await sb.from(tabla).select('activo').eq('id', id).single();
  const { error } = await sb.from(tabla).update({ activo: !curr?.activo }).eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  await _renderParamNivel(nivel);
}

async function _agregarTipo(tabla, inputId, nivel, listaId) {
  const inp    = document.getElementById(inputId);
  const nombre = inp?.value?.trim();
  if (!nombre) return;

  const datos = { nombre, activo: true, institucion_id: USUARIO_ACTUAL.institucion_id };
  if (tabla !== 'tipos_evento') datos.nivel = nivel;

  const { error } = await sb.from(tabla).insert([datos]);
  if (error) { alert('Error: ' + error.message); return; }
  if (inp) inp.value = '';
  await _renderParamNivel(nivel);
}

function _onPeriodoFecha(periodoId, campo, inputId) {
  const iso = getFechaInput(inputId);
  if (iso) _actualizarPeriodo(periodoId, campo, iso);
}

async function _actualizarPeriodo(id, campo, valor) {
  const { error } = await sb.from('periodos_evaluativos').update({ [campo]: valor || null }).eq('id', id);
  if (error) alert('Error al actualizar: ' + error.message);
}

async function _eliminarPeriodo(id, nivel) {
  if (!confirm('¿Eliminar este período evaluativo?')) return;
  const { error } = await sb.from('periodos_evaluativos').delete().eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  await _renderParamNivel(nivel);
}

async function _agregarPeriodo(nivel) {
  const inp    = document.getElementById('new-periodo-' + nivel);
  const nombre = inp?.value?.trim();
  if (!nombre) return;
  const { error } = await sb.from('periodos_evaluativos').insert([{
    nombre, nivel, anio: new Date().getFullYear(),
    institucion_id: USUARIO_ACTUAL.institucion_id,
    fecha_inicio: null, fecha_fin: null,
  }]);
  if (error) { alert('Error: ' + error.message); return; }
  if (inp) inp.value = '';
  await _renderParamNivel(nivel);
}

function _editarNombrePeriodo(id) {
  document.getElementById('pnombre-text-' + id).style.display = 'none';
  document.getElementById('pnombre-inp-'  + id).style.display = '';
  document.getElementById('pnombre-btn-'  + id).style.display = 'none';
  document.getElementById('pnombre-save-' + id).style.display = '';
  document.getElementById('pnombre-inp-'  + id).focus();
}

async function _guardarNombrePeriodo(id, nivel) {
  const nombre = document.getElementById('pnombre-inp-' + id)?.value?.trim();
  if (!nombre) return;
  const { error } = await sb.from('periodos_evaluativos').update({ nombre }).eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  _toastOk('Período actualizado');
  await _renderParamNivel(nivel);
}

// ── Dimensiones de desarrollo (Nivel Inicial) ─────────
const _DIMS_INICIAL_DEFAULT = [
  'Lenguaje y comunicación','Desarrollo motor','Socialización',
  'Desarrollo cognitivo','Autonomía',
];

function _renderListaDims(dims) {
  if (!dims || !dims.length) return '<div style="color:var(--txt2);font-size:11px;padding:6px 0">Sin dimensiones definidas</div>';
  return dims.map((d, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--brd)">
      <div style="flex:1;font-size:12px">${_esc(d)}</div>
      <button onclick="_quitarDim(${i})"
        style="background:none;border:none;cursor:pointer;font-size:15px;color:var(--txt3);padding:0 2px;line-height:1" title="Quitar">×</button>
    </div>`).join('');
}

async function _agregarDim() {
  const inp    = document.getElementById('new-dim-inicial');
  const nombre = inp?.value?.trim();
  if (!nombre) return;
  const instId = USUARIO_ACTUAL.institucion_id;
  const { data: cfg } = await sb.from('config_asistencia')
    .select('id, dimensiones_informe').eq('institucion_id', instId).eq('nivel', 'inicial').maybeSingle();
  const nuevas = [...(cfg?.dimensiones_informe || _DIMS_INICIAL_DEFAULT), nombre];
  let error;
  if (cfg?.id) {
    ({ error } = await sb.from('config_asistencia').update({ dimensiones_informe: nuevas }).eq('id', cfg.id));
  } else {
    ({ error } = await sb.from('config_asistencia').insert([{
      institucion_id: instId, nivel: 'inicial', dimensiones_informe: nuevas,
      umbral_alerta_1: 10, umbral_alerta_2: 20, umbral_alerta_3: 30, justificadas_cuentan: false,
    }]));
  }
  if (error) { alert('Error al guardar dimensión: ' + error.message); return; }
  if (inp) inp.value = '';
  await _renderParamNivel('inicial');
}

async function _quitarDim(idx) {
  const instId = USUARIO_ACTUAL.institucion_id;
  const { data: cfg } = await sb.from('config_asistencia')
    .select('id, dimensiones_informe').eq('institucion_id', instId).eq('nivel', 'inicial').maybeSingle();
  const dims = (cfg?.dimensiones_informe || _DIMS_INICIAL_DEFAULT).filter((_, i) => i !== idx);
  let error;
  if (cfg?.id) {
    ({ error } = await sb.from('config_asistencia').update({ dimensiones_informe: dims }).eq('id', cfg.id));
  } else {
    ({ error } = await sb.from('config_asistencia').insert([{
      institucion_id: instId, nivel: 'inicial', dimensiones_informe: dims,
      umbral_alerta_1: 10, umbral_alerta_2: 20, umbral_alerta_3: 30, justificadas_cuentan: false,
    }]));
  }
  if (error) { alert('Error al quitar dimensión: ' + error.message); return; }
  await _renderParamNivel('inicial');
}

// ══════════════════════════════════════════════════════
// SISTEMA DE MODALES
// ══════════════════════════════════════════════════════
function _crearModal(titulo, contenidoHtml, onGuardar) {
  const existente = document.getElementById('adm-modal-overlay');
  if (existente) existente.remove();

  const overlay = document.createElement('div');
  overlay.id        = 'adm-modal-overlay';
  overlay.className = 'adm-modal-overlay';
  // Click fuera no cierra — el usuario debe usar Cancelar o ×

  overlay.innerHTML = `
    <div class="adm-modal">
      <div class="adm-modal-header">
        <div style="font-size:14px;font-weight:600">${titulo}</div>
        <button onclick="_cerrarModal()" style="background:none;border:none;cursor:pointer;font-size:22px;color:var(--txt2);padding:0 4px;line-height:1">×</button>
      </div>
      <div class="adm-modal-body">${contenidoHtml}</div>
      <div class="adm-modal-footer">
        <button class="btn-s" onclick="_cerrarModal()">Cancelar</button>
        <button class="btn-p" id="adm-modal-guardar">Guardar</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const btnG = document.getElementById('adm-modal-guardar');
  if (btnG && onGuardar) {
    btnG.onclick = async () => {
      btnG.disabled    = true;
      btnG.textContent = 'Guardando...';
      try   { await onGuardar(); }
      finally {
        if (document.getElementById('adm-modal-guardar')) {
          btnG.disabled    = false;
          btnG.textContent = 'Guardar';
        }
      }
    };
  }

  return overlay;
}

function _cerrarModal() {
  const m = document.getElementById('adm-modal-overlay');
  if (m) m.remove();
}

// ══════════════════════════════════════════════════════
// UTILIDADES
// ══════════════════════════════════════════════════════
function _esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _admError(container, msg) {
  container.innerHTML = `<div class="alr"><div class="alr-t">Error al cargar</div><div class="alr-d">${msg}</div></div>`;
}

// ══════════════════════════════════════════════════════
// ESTILOS
// ══════════════════════════════════════════════════════
function inyectarEstilosAdmin() {
  if (document.getElementById('adm-styles')) return;
  const s = document.createElement('style');
  s.id = 'adm-styles';
  s.textContent = `
    /* ── Tabs ── */
    .adm-tabs-bar {
      display: flex;
      gap: 2px;
      overflow-x: auto;
      background: var(--surf2);
      border: 1px solid var(--brd);
      border-radius: var(--rad-lg);
      padding: 4px;
      margin-bottom: 14px;
      scrollbar-width: none;
    }
    .adm-tabs-bar::-webkit-scrollbar { display: none; }

    .adm-tab {
      padding: 6px 14px;
      border-radius: var(--rad);
      border: none;
      background: none;
      cursor: pointer;
      font-size: 12px;
      font-family: 'DM Sans', sans-serif;
      font-weight: 500;
      color: var(--txt2);
      white-space: nowrap;
      transition: all .12s;
    }
    .adm-tab:hover { background: var(--surf); color: var(--txt); }
    .adm-tab.on    { background: var(--surf); color: var(--verde); font-weight: 600; box-shadow: 0 1px 4px rgba(0,0,0,.08); }

    .adm-tab-sel {
      width: 100%;
      margin-bottom: 14px;
    }

    /* ── Formularios ── */
    .adm-form-row  { margin-bottom: 12px; }
    .adm-label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      color: var(--txt2);
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: .05em;
    }

    /* ── Lista usuarios/alumnos ── */
    .adm-user-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--brd);
      cursor: pointer;
      transition: background .1s;
    }
    .adm-user-row:hover        { background: var(--surf2); }
    .adm-user-row:last-child   { border-bottom: none; }

    /* ── Modal ── */
    .adm-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.46);
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .adm-modal {
      background: var(--surf);
      border-radius: var(--rad-lg);
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,.24);
      animation: admModalIn .15s ease;
    }
    @keyframes admModalIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
    .adm-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid var(--brd);
      flex-shrink: 0;
    }
    .adm-modal-body {
      padding: 16px;
      overflow-y: auto;
      flex: 1;
    }
    .adm-modal-footer {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;
      padding: 12px 16px;
      border-top: 1px solid var(--brd);
      flex-shrink: 0;
    }

    /* ── Mobile ── */
    @media (max-width: 600px) {
      .adm-modal-overlay { align-items: flex-end; padding: 0; }
      .adm-modal         { max-width: none; max-height: 92vh; border-radius: var(--rad-lg) var(--rad-lg) 0 0; }
    }

    /* ── Toast de confirmación ── */
    .adm-toast-ok {
      position: fixed;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%) translateY(14px);
      background: var(--verde);
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      padding: 10px 22px;
      border-radius: 24px;
      box-shadow: 0 4px 18px rgba(0,0,0,.2);
      z-index: 9999;
      opacity: 0;
      transition: opacity .2s, transform .2s;
      pointer-events: none;
      white-space: nowrap;
    }
    .adm-toast-ok.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  `;
  document.head.appendChild(s);
}

function _toastOk(msg) {
  const t = document.createElement('div');
  t.className = 'adm-toast-ok';
  t.textContent = msg || 'Guardado correctamente';
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2500);
}
