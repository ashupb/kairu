// =====================================================
// CONFIGURACION.JS — Módulo de administración institucional
// =====================================================

// ─── HELPER: operaciones de admin vía Edge Function ──
async function _llamarAdminUsers(action, payload) {
  const { data: { session } } = await sb.auth.getSession();
  const resp = await fetch(
    'https://vxsgzutluqfonhakiltz.supabase.co/functions/v1/admin-users',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, payload }),
    }
  );
  const data = await resp.json();
  if (!resp.ok || data.error) throw new Error(data.error || 'Error en operación de administración');
  return data;
}

// ─── ESTADO LOCAL ────────────────────────────────────
let _admGrupo    = null;  // grupo activo (ej: 'institucion') — se navega desde el sidebar principal (nav.js)
let _admItem     = null;  // subsección activa dentro del grupo (ej: 'cursos')
let _admItemTab  = null;  // tab interno activo, si el item tiene 'tabs' (ej: 'asignaciones')
let _adminCursos    = [];
let _adminUsuarios  = [];
let _adminMaterias  = [];
let _adminDocentes  = [];
let _docFiltroNivel = 'todos';
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
  director_general: 'Administrador',
  directivo_nivel:  'Directivo de Nivel',
  secretario:       'Secretario/a',
  vicedirector:     'Vicedirector/a',
  docente:          'Docente',
  preceptor:        'Preceptor',
  eoe:              'EOE',
};

const ROL_BADGE_ADM = {
  director_general: 'tg',
  directivo_nivel:  'tp',
  secretario:       'tp',
  vicedirector:     'tp',
  docente:          'td',
  preceptor:        'ta',
  eoe:              'tr',
};

// ─── MENÚ DE CONFIGURACIÓN — grupos + subsecciones, se navegan desde el ──
// sidebar principal (nav.js → _renderNavExpandable), no desde un menú
// aparte dentro de la página. Cuando dos vistas conviven dentro de una
// misma subsección (ej. Materias + Asignaciones) se usan tabs internos
// en el contenido en vez de sumar filas al sidebar.
const CONFIG_GRUPOS = [
  { id: 'institucion', label: 'Institución', items: [
      { id: 'institucion',   label: 'General',        roles: ['director_general'], renderer: _renderInstitucion },
      { id: 'ciclo_lectivo', label: 'Ciclo Lectivo',   roles: ['director_general', 'directivo_nivel'], renderer: _renderCicloLectivo },
      { id: 'cursos',        label: 'Cursos',          roles: ['director_general', 'directivo_nivel', 'preceptor'], renderer: _renderCursos },
      { id: 'materias',      label: 'Materias',        roles: ['director_general', 'directivo_nivel'], tabs: [
          { id: 'materias',     label: 'Materias',     renderer: _renderMaterias },
          { id: 'asignaciones', label: 'Asignaciones', renderer: _renderAsignaciones },
        ] },
      { id: 'alumnos',  label: 'Alumnos',  roles: ['director_general', 'directivo_nivel', 'preceptor'], renderer: _renderAlumnos },
      { id: 'docentes', label: 'Docentes', roles: ['director_general', 'directivo_nivel'], tabs: [
          { id: 'docentes',   label: 'Docentes',   renderer: _renderDocentes },
          { id: 'suplencias', label: 'Suplencias', renderer: _renderSuplencias },
        ] },
    ] },
  { id: 'parametros', label: 'Parámetros académicos', items: [
      { id: 'param_asistencia',     label: 'Asistencia',              roles: ['director_general', 'directivo_nivel'], renderer: _renderParamAsistencia },
      { id: 'param_calificaciones', label: 'Calificaciones y escalas', roles: ['director_general', 'directivo_nivel'], tabs: [
          { id: 'notas', label: 'Escalas y notas',       renderer: _renderParamNotas },
          { id: 'dims',  label: 'Dimensiones (Inicial)', renderer: _renderParamDimensiones, soloInicial: true },
        ] },
    ] },
  { id: 'usuarios', label: 'Usuarios', items: [
      { id: 'usuarios', label: 'General', roles: ['director_general', 'directivo_nivel'], renderer: _renderUsuarios },
    ] },
  { id: 'portal', label: 'Portal Familiar', items: [
      { id: 'familias', label: 'Usuarios', roles: ['director_general', 'directivo_nivel', 'preceptor'], renderer: _renderFamilias },
    ] },
];

// Ids viejos (pre-reorganización) que un usuario puede tener guardados en
// config_extra.tabs — se traducen a los ids nuevos para no perder accesos.
const _LEGACY_TAB_ALIAS = {
  asignaciones: ['materias'],
  suplencias:   ['docentes'],
  parametros:   ['param_asistencia', 'param_calificaciones'],
};

function _normalizarExtras(tabsArr) {
  const out = new Set();
  (tabsArr || []).forEach(id => {
    (_LEGACY_TAB_ALIAS[id] || [id]).forEach(x => out.add(x));
  });
  return out;
}

function _configTodosLosItems() {
  return CONFIG_GRUPOS.flatMap(g => g.items.map(it => ({ ...it, label: `${g.label} · ${it.label}` })));
}

function _configGruposVisibles() {
  const r      = USUARIO_ACTUAL?.rol;
  const extras = _normalizarExtras(USUARIO_ACTUAL?.config_extra?.tabs);

  return CONFIG_GRUPOS
    .map(g => {
      const items = g.items.filter(it => it.roles.includes(r) || extras.has(it.id));
      return items.length ? { ...g, items } : null;
    })
    .filter(Boolean);
}

function _paramTieneInicial() {
  if (!USUARIO_ACTUAL) return false;
  return USUARIO_ACTUAL.rol === 'directivo_nivel'
    ? USUARIO_ACTUAL.nivel === 'inicial'
    : !!INSTITUCION_ACTUAL?.nivel_inicial;
}

// ─── RENDER PRINCIPAL ─────────────────────────────────
// El menú (grupos + subsecciones) vive en el sidebar principal — ver
// _renderNavExpandable() en nav.js. Esta página solo pinta el título y
// despacha el contenido de la subsección activa.
async function rAdmin() {
  showLoading('admin');
  inyectarEstilosAdmin();
  await _detectarConfigExtra();

  const grupos = _configGruposVisibles();
  if (!grupos.length) {
    document.getElementById('page-admin').innerHTML =
      `<div class="pg-t">Configuración</div><div class="empty-state">Sin permisos para esta sección</div>`;
    return;
  }

  if (!_admGrupo || !grupos.find(g => g.id === _admGrupo)) _admGrupo = grupos[0].id;
  const grupoActivo = grupos.find(g => g.id === _admGrupo);
  if (!_admItem || !grupoActivo.items.find(it => it.id === _admItem)) _admItem = grupoActivo.items[0].id;

  // Al entrar a la página se abre el árbol y el grupo activo — una sola vez acá,
  // no en el render del nav, para no pisar si el usuario los pliega manualmente después.
  _navAdminOpen = true;
  _navAdminGruposAbiertos.add(_admGrupo);

  // goPage() ya llamó a renderNav() antes de entrar acá, cuando _admGrupo/_admItem
  // todavía no estaban definidos — se vuelve a pintar para reflejar el grupo/item
  // recién resuelto (grupo activo expandido, item activo resaltado).
  renderNav();

  document.getElementById('page-admin').innerHTML = `
    <div class="pg-t">Configuración</div>
    <div class="pg-s">${INSTITUCION_ACTUAL?.nombre || ''}</div>
    <div id="adm-item-tabs"></div>
    <div id="adm-section-content"></div>`;

  await _dispatchAdminItem();
}

// Navegación desde el sidebar principal (llamado por _renderNavExpandable en nav.js).
async function _irAItemAdmin(grupoId, itemId) {
  _admGrupo   = grupoId;
  _admItem    = itemId;
  _admItemTab = null;
  _navAdminOpen = true;
  _navAdminGruposAbiertos.add(grupoId);
  if (CUR_PAGE === 'admin') {
    renderNav();
    await _dispatchAdminItem();
  } else {
    await goPage('admin');
  }
}

async function _irATabAdmin(tabId) {
  _admItemTab = tabId;
  await _dispatchAdminItem();
}

async function _dispatchAdminItem() {
  const grupos = _configGruposVisibles();
  const grupo  = grupos.find(g => g.id === _admGrupo);
  const item   = grupo?.items.find(it => it.id === _admItem);
  if (!item) return;

  const tabsWrap = document.getElementById('adm-item-tabs');
  const content  = document.getElementById('adm-section-content');

  if (item.tabs) {
    const tabsVisibles = item.tabs.filter(t => !t.soloInicial || _paramTieneInicial());
    if (!_admItemTab || !tabsVisibles.find(t => t.id === _admItemTab)) _admItemTab = tabsVisibles[0].id;
    if (tabsWrap) {
      tabsWrap.innerHTML = `<div class="adm-tabs-bar">
        ${tabsVisibles.map(t => `<button class="adm-tab${t.id === _admItemTab ? ' on' : ''}" onclick="_irATabAdmin('${t.id}')">${_esc(t.label)}</button>`).join('')}
      </div>`;
    }
    if (content) content.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
    const tab = tabsVisibles.find(t => t.id === _admItemTab);
    await tab.renderer();
  } else {
    if (tabsWrap) tabsWrap.innerHTML = '';
    if (content) content.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
    await item.renderer();
  }
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

    <div class="card">
      <div class="card-t">Apariencia</div>
      <div style="font-size:11px;color:var(--txt2);margin-bottom:14px">Este cambio se aplica para todos los usuarios de la institución.</div>

      <div class="adm-form-row">
        <label class="adm-label">Logo</label>
        <div style="display:flex;align-items:center;gap:14px">
          <div id="adm-logo-preview" style="width:64px;height:64px;border-radius:12px;background:var(--surf2);border:1px solid var(--brd);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">
            ${inst.logo_url ? `<img src="${_esc(inst.logo_url)}" alt="" style="width:100%;height:100%;object-fit:cover">` : `<span style="font-size:10px;color:var(--txt3)">Sin logo</span>`}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <input type="file" id="adm-logo-file" accept="image/*" style="display:none" onchange="_subirLogoInstitucion(this)">
            <button class="btn-s" onclick="document.getElementById('adm-logo-file').click()">Subir logo</button>
            ${inst.logo_url ? `<button class="btn-d" onclick="_quitarLogoInstitucion()">Quitar logo</button>` : ''}
          </div>
        </div>
      </div>

      <div class="adm-form-row" style="margin-bottom:0">
        <label class="adm-label">Color de la plataforma</label>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">
          ${PALETA_TEMA_INSTITUCION.map(c => `
            <div class="tema-swatch${(inst.tema_color || '#229957') === c.hex ? ' on' : ''}" data-hex="${c.hex}"
              style="background:${c.hex}" title="${c.label}" onclick="_seleccionarColorTema('${c.hex}')"></div>
          `).join('')}
        </div>
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
  if (!confirm('¿Eliminar esta orientación? Esta acción no se puede deshacer.')) return;
  const { error } = await sb.from('orientaciones').delete().eq('id', id);
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
  document.title = nombre + ' · Kairú';

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

// ── Apariencia — color de plataforma ──────────────────
async function _seleccionarColorTema(hex) {
  document.querySelectorAll('.tema-swatch').forEach(el => {
    el.classList.toggle('on', el.dataset.hex === hex);
  });
  const { error } = await sb.from('instituciones').update({ tema_color: hex }).eq('id', USUARIO_ACTUAL.institucion_id);
  if (error) { alert('Error al guardar: ' + error.message); return; }
  if (INSTITUCION_ACTUAL) INSTITUCION_ACTUAL.tema_color = hex;
  _aplicarTemaInstitucion(hex);
  _toastOk('Color actualizado');
}

// ── Apariencia — logo institucional ───────────────────
async function _comprimirLogo(file, maxPx = 300) {
  return new Promise((resolve, reject) => {
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
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo procesar la imagen')), 'image/png');
    };
    img.onerror = () => reject(new Error('Imagen inválida'));
    img.src = url;
  });
}

async function _subirLogoInstitucion(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { alert('Elegí un archivo de imagen.'); input.value = ''; return; }

  const preview = document.getElementById('adm-logo-preview');
  const original = preview?.innerHTML;
  if (preview) preview.innerHTML = '<div class="spinner" style="width:20px;height:20px"></div>';

  try {
    const blob = await _comprimirLogo(file);
    const path = `${USUARIO_ACTUAL.institucion_id}/logo-${Date.now()}.png`;
    const { error: upErr } = await sb.storage.from('institucion-assets').upload(path, blob, { contentType: 'image/png' });
    if (upErr) throw upErr;
    const { data: urlData } = sb.storage.from('institucion-assets').getPublicUrl(path);

    const { error } = await sb.from('instituciones').update({ logo_url: urlData.publicUrl }).eq('id', USUARIO_ACTUAL.institucion_id);
    if (error) throw error;

    if (INSTITUCION_ACTUAL) INSTITUCION_ACTUAL.logo_url = urlData.publicUrl;
    const sbLogoEl = document.getElementById('sb-inst-logo');
    if (sbLogoEl) sbLogoEl.innerHTML = `<img src="${urlData.publicUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;

    await _renderInstitucion();
    _toastOk('Logo actualizado');
  } catch (e) {
    if (preview) preview.innerHTML = original;
    alert('No se pudo subir el logo: ' + (e?.message || 'error desconocido') + '\n\nSi el bucket "institucion-assets" ya existe, revisá que tenga políticas de Storage que permitan subir archivos (ver migrations/apariencia_institucional.sql).');
  }
  input.value = '';
}

async function _quitarLogoInstitucion() {
  if (!confirm('¿Quitar el logo de la institución?')) return;
  const { error } = await sb.from('instituciones').update({ logo_url: null }).eq('id', USUARIO_ACTUAL.institucion_id);
  if (error) { alert('Error: ' + error.message); return; }
  if (INSTITUCION_ACTUAL) INSTITUCION_ACTUAL.logo_url = null;
  const sbLogoEl   = document.getElementById('sb-inst-logo');
  const instNombre = INSTITUCION_ACTUAL?.nombre || 'Kairú';
  if (sbLogoEl) sbLogoEl.textContent = instNombre[0]?.toUpperCase() || 'K';
  await _renderInstitucion();
  _toastOk('Logo eliminado');
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

  const roles   = ['director_general', 'directivo_nivel', 'secretario', 'vicedirector', 'docente', 'preceptor', 'eoe'];
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

    ${(() => {
      if (!filtrados.length) return '<div class="empty-state">Sin usuarios encontrados</div>';
      const mkRow = u => {
        const iniciales  = u.avatar_iniciales || generarIniciales(u.nombre_completo || '');
        const rolBadge   = ROL_BADGE_ADM[u.rol] || 'tgr';
        const nivelColor = u.nivel ? NIVEL_COLORS_ADM[u.nivel] : 'var(--gris)';
        const inactivo   = u.activo === false;
        const enLicencia = u.en_licencia === true;
        return `<div class="adm-user-row" onclick="_abrirModalUsuario('${u.id}')">
            <div class="av av32" style="background:${nivelColor};color:#fff;flex-shrink:0">${iniciales}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600;${inactivo ? 'color:var(--txt3);text-decoration:line-through' : ''}">${_esc(u.nombre_completo) || '—'}</div>
              <div style="font-size:10px;color:var(--txt2)">${u.username ? '@' + u.username : (u.email || '')}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">
              <span class="tag ${rolBadge}">${ROL_LABELS_ADM[u.rol] || u.rol}</span>
              ${inactivo ? '<span class="tag tr">Inactivo</span>' : ''}
              ${enLicencia ? '<span class="tag" style="background:#f59e0b22;color:#b45309;border-color:#f59e0b44">En licencia</span>' : ''}
            </div>
          </div>`;
      };
      const grupos = [
        { key: null,         label: 'Institucionales', color: 'var(--txt2)' },
        { key: 'inicial',    label: 'Inicial',         color: NIVEL_COLORS_ADM.inicial },
        { key: 'primario',   label: 'Primario',        color: NIVEL_COLORS_ADM.primario },
        { key: 'secundario', label: 'Secundario',      color: NIVEL_COLORS_ADM.secundario },
      ];
      return grupos.map(g => {
        const users = filtrados.filter(u => (u.nivel || null) === g.key);
        if (!users.length) return '';
        return `<div style="margin-bottom:16px">
            <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
              color:${g.color};margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid ${g.color}">
              ${g.label}
            </div>
            <div class="card" style="padding:0;overflow:hidden">
              ${users.map(mkRow).join('')}
            </div>
          </div>`;
      }).join('');
    })()}`;
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
    ? ['director_general', 'directivo_nivel', 'secretario', 'vicedirector', 'docente', 'preceptor', 'eoe']
    : ['docente', 'preceptor', 'eoe'];

  const nivelesDisp = USUARIO_ACTUAL.rol === 'directivo_nivel'
    ? [USUARIO_ACTUAL.nivel]
    : ['inicial', 'primario', 'secundario'];

  const rolSel    = user?.rol   || 'docente';
  const nivelSel  = user?.nivel || '';
  const cursosSel = user?.cursos_ids || [];
  const cursosFilt = nivelSel ? cursosTodos.filter(c => c.nivel === nivelSel) : [];

  const mostrarNivel   = ['directivo_nivel', 'secretario', 'vicedirector', 'preceptor', 'docente'].includes(rolSel);
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
      <label class="adm-label">Email</label>
      <input type="email" id="mu-email" value="${_esc(user?.email)}" placeholder="email@ejemplo.com"
        ${!esNuevo ? 'readonly style="opacity:.6;cursor:default"' : ''}>
      <div style="font-size:10px;color:var(--txt2);margin-top:3px">Solo informativo.</div>
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
    <div class="adm-form-row">
      <div class="toggle-row-ui">
        <div>
          <span style="font-size:12px;font-weight:500">En licencia</span>
          <div style="font-size:10px;color:var(--txt2);margin-top:2px">No puede iniciar sesión mientras esté activo</div>
        </div>
        <div class="tog${user?.en_licencia ? ' on' : ''}" id="mu-licencia" onclick="_togAdm('mu-licencia')">
          <div class="tog-thumb"></div>
        </div>
      </div>
    </div>
    ${(_configExtraOk && USUARIO_ACTUAL.rol === 'director_general') ? `
    <div class="adm-form-row">
      <label class="adm-label">Accesos a Configuración</label>
      <div style="display:flex;flex-direction:column;gap:6px;padding:10px;background:var(--surf2);border:1px solid var(--brd);border-radius:var(--rad)">
        <div style="font-size:10px;color:var(--txt2);margin-bottom:2px">Secciones adicionales habilitadas para este usuario:</div>
        ${(() => {
          const extrasActuales = _normalizarExtras(user?.config_extra?.tabs);
          return _configTodosLosItems().map(it => {
            const yaRol = it.roles.includes(rolSel);
            const checked = extrasActuales.has(it.id);
            return `<label style="display:flex;align-items:center;gap:7px;cursor:${yaRol?'default':'pointer'};font-size:12px;${yaRol?'color:var(--txt3)':''}">
              <input type="checkbox" name="mu-cfg-tab" value="${it.id}" ${checked||yaRol?'checked':''} ${yaRol?'disabled':''}>
              ${it.label}${yaRol?' <span style="font-size:10px;color:var(--verde)">(por rol)</span>':''}
            </label>`;
          }).join('');
        })()}
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

  if (nivelRow)  nivelRow.style.display  = ['directivo_nivel', 'secretario', 'vicedirector', 'preceptor', 'docente'].includes(rol) ? '' : 'none';
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
  const en_licencia     = document.getElementById('mu-licencia')?.classList.contains('on') ?? false;

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
      const authData = await _llamarAdminUsers('crear_usuario', {
        email,
        password:      passField || dni,
        user_metadata: {
          nombre_completo,
          username,
          rol,
          nivel:          nivel || '',
          activo,
          dni:            dni || '',
          institucion_id: USUARIO_ACTUAL.institucion_id,
          cursos_ids:     cursos_ids.length ? cursos_ids : [],
        },
        cursos_ids:     cursos_ids.length ? cursos_ids : [],
        institucion_id: USUARIO_ACTUAL.institucion_id,
      });
      if (rol === 'preceptor' && cursos_ids.length) {
        await sb.from('cursos').update({ preceptor_id: authData.id }).in('id', cursos_ids);
      }
    } else {
      const campos = {
        nombre_completo, rol, nivel, activo, en_licencia,
        dni: dni || null,
        cursos_ids: cursos_ids.length ? cursos_ids : null,
      };
      if (_configExtraOk && USUARIO_ACTUAL.rol === 'director_general') {
        const tabChecks = document.querySelectorAll('input[name="mu-cfg-tab"]:not(:disabled):checked');
        const tabsExtra = Array.from(tabChecks).map(c => c.value);
        campos.config_extra = tabsExtra.length ? { tabs: tabsExtra } : {};
      }
      await _llamarAdminUsers('actualizar_usuario', { usuario_id: userId, campos });
      if (rol === 'preceptor') {
        await sb.from('cursos')
          .update({ preceptor_id: null })
          .eq('preceptor_id', userId)
          .eq('institucion_id', USUARIO_ACTUAL.institucion_id);
        if (cursos_ids.length) {
          await sb.from('cursos').update({ preceptor_id: userId }).in('id', cursos_ids);
        }
      }
      if (passField) {
        await _llamarAdminUsers('actualizar_contrasena', { usuario_id: userId, password: passField });
      }
    }

    _cerrarModal();
    await _renderUsuarios();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}


// ══════════════════════════════════════════════════════
// SECCIÓN: DOCENTES
// ══════════════════════════════════════════════════════
async function _renderDocentes() {
  const sec = document.getElementById('adm-section-content');
  sec.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  const { data, error } = await sb.from('usuarios')
    .select('id, nombre_completo, nivel, username, email, activo, en_licencia, avatar_iniciales')
    .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
    .eq('rol', 'docente')
    .order('nombre_completo');

  if (error) { _admError(sec, error.message); return; }
  _adminDocentes  = data || [];
  _docFiltroNivel = 'todos';
  _renderDocentesList();
}

function _renderDocentesList() {
  const sec     = document.getElementById('adm-section-content');
  const niveles = ['inicial', 'primario', 'secundario'];

  const filtrados = _docFiltroNivel === 'todos'
    ? _adminDocentes
    : _adminDocentes.filter(d => d.nivel === _docFiltroNivel);

  sec.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <select onchange="_docFiltroNivel=this.value;_renderDocentesList()" style="width:auto;padding:6px 28px 6px 10px">
        <option value="todos">Todos los niveles</option>
        ${niveles.map(n => `<option value="${n}" ${n === _docFiltroNivel ? 'selected' : ''}>${NIVEL_LABELS_ADM[n]}</option>`).join('')}
      </select>
      <span style="font-size:11px;color:var(--txt2)">${filtrados.length} docente${filtrados.length !== 1 ? 's' : ''}</span>
    </div>
    ${_htmlDocentesList(filtrados)}`;
}

function _htmlDocentesList(docentes) {
  if (!docentes.length) return '<div class="empty-state">Sin docentes encontrados</div>';

  if (_docFiltroNivel !== 'todos') {
    return `<div class="card" style="padding:0;overflow:hidden">
      ${docentes.map(_htmlDocenteRow).join('')}
    </div>`;
  }

  const grupos = [
    { key: 'inicial',    label: 'Inicial',    color: NIVEL_COLORS_ADM.inicial },
    { key: 'primario',   label: 'Primario',   color: NIVEL_COLORS_ADM.primario },
    { key: 'secundario', label: 'Secundario', color: NIVEL_COLORS_ADM.secundario },
    { key: null,         label: 'Sin nivel',  color: 'var(--txt2)' },
  ];

  return grupos.map(g => {
    const lista = docentes.filter(d => (d.nivel || null) === g.key);
    if (!lista.length) return '';
    return `<div style="margin-bottom:16px">
      <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
        color:${g.color};margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid ${g.color}">
        ${g.label}
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        ${lista.map(_htmlDocenteRow).join('')}
      </div>
    </div>`;
  }).join('');
}

function _htmlDocenteRow(d) {
  const iniciales  = d.avatar_iniciales || generarIniciales(d.nombre_completo || '');
  const nivelColor = d.nivel ? NIVEL_COLORS_ADM[d.nivel] : 'var(--gris)';
  const inactivo   = d.activo === false;
  const enLicencia = d.en_licencia === true;
  return `<div class="adm-user-row">
    <div class="av av32" style="background:${nivelColor};color:#fff;flex-shrink:0">${iniciales}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:600;${inactivo ? 'color:var(--txt3);text-decoration:line-through' : ''}">${_esc(d.nombre_completo) || '—'}</div>
      <div style="font-size:10px;color:var(--txt2)">${d.username ? '@' + d.username : (d.email || '')}</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">
      ${d.nivel ? `<span class="tag" style="background:${nivelColor}22;color:${nivelColor};border-color:${nivelColor}44">${NIVEL_LABELS_ADM[d.nivel]}</span>` : ''}
      ${inactivo ? '<span class="tag tr">Inactivo</span>' : ''}
      ${enLicencia ? '<span class="tag" style="background:#f59e0b22;color:#b45309;border-color:#f59e0b44">En licencia</span>' : ''}
    </div>
  </div>`;
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
  _irAItemAdmin('institucion', 'alumnos');
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
    const color    = NIVEL_COLORS_ADM[nivel] || 'var(--gris)';
    const showTipo = nivel !== 'secundario';
    return `
      <div class="sec-lb" style="color:${color}">${NIVEL_LABELS_ADM[nivel] || nivel}</div>
      ${lista.map(m => `
        <div class="card" style="display:flex;align-items:center;gap:10px;padding:10px 14px;margin-bottom:6px">
          <div style="flex:1;font-size:12px;font-weight:500">${_esc(m.nombre)}</div>
          ${showTipo ? `<span class="tag ${m.tipo === 'especial' ? 'td' : 'tg'}" style="font-size:9px">${m.tipo === 'especial' ? 'especial' : 'común'}</span>` : ''}
          <button class="btn-s" onclick="_abrirModalMateria('${m.id}')">Editar</button>
          <button class="btn-d" onclick="_desactivarMateria('${m.id}')">Eliminar</button>
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
      <select id="mmat-nivel" ${USUARIO_ACTUAL.rol === 'directivo_nivel' ? 'disabled' : ''} onchange="_mmatToggleTipo()">
        ${niveles.map(n => `<option value="${n}" ${n === nivelSel ? 'selected' : ''}>${NIVEL_LABELS_ADM[n]}</option>`).join('')}
      </select>
    </div>
    <div class="adm-form-row" id="mmat-tipo-row" ${nivelSel === 'secundario' ? 'style="display:none"' : ''}>
      <label class="adm-label">Tipo</label>
      <select id="mmat-tipo">
        <option value="comun"    ${(mat?.tipo || 'comun') !== 'especial' ? 'selected' : ''}>Común (evalúa el docente de grado)</option>
        <option value="especial" ${mat?.tipo === 'especial' ? 'selected' : ''}>Especial (tiene su propio docente)</option>
      </select>
    </div>
    `,
    async () => {
      const nombre = document.getElementById('mmat-nombre')?.value?.trim();
      const nivel  = document.getElementById('mmat-nivel')?.value;
      const tipo   = document.getElementById('mmat-tipo')?.value || 'comun';
      if (!nombre) { alert('El nombre es requerido.'); return; }
      try {
        if (materiaId) {
          const { error } = await sb.from('materias').update({ nombre, nivel, tipo }).eq('id', materiaId);
          if (error) throw error;
        } else {
          const { error } = await sb.from('materias').insert([{ nombre, nivel, tipo, institucion_id: USUARIO_ACTUAL.institucion_id, activo: true }]);
          if (error) throw error;
        }
        _cerrarModal();
        await _renderMaterias();
      } catch (e) { alert('Error: ' + e.message); }
    }
  );
}

async function _desactivarMateria(materiaId) {
  const { count } = await sb.from('asignaciones').select('id', { count: 'exact', head: true }).eq('materia_id', materiaId);
  const msg = count > 0
    ? `¿Eliminar esta materia? Tiene ${count} asignación${count !== 1 ? 'es' : ''} vinculada${count !== 1 ? 's' : ''} que también se eliminarán. Esta acción no se puede deshacer.`
    : '¿Eliminar esta materia? Esta acción no se puede deshacer.';
  if (!confirm(msg)) return;
  if (count > 0) {
    const { error: errAsig } = await sb.from('asignaciones').delete().eq('materia_id', materiaId);
    if (errAsig) { alert('Error al eliminar asignaciones: ' + errAsig.message); return; }
  }
  const { error } = await sb.from('materias').delete().eq('id', materiaId);
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
        ${materias.length === 0 ? '<div style="font-size:11px;color:var(--txt3);padding:6px 0">Sin materias especiales configuradas. Editá las materias en la pestaña Materias.</div>' : ''}
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
      ${materias.length === 0 ? '<div style="font-size:11px;color:var(--txt3);padding:4px 0 10px">Sin materias especiales configuradas para este nivel. Agregálas en la pestaña Materias y marcalas como tipo "Especial".</div>' : ''}
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
let _admAsigModoEdicion    = false;

async function _renderAsignaciones() {
  const sec = document.getElementById('adm-section-content');
  sec.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  const [cursosRes, materiasRes, docentesRes] = await Promise.all([
    sb.from('cursos').select('id,nombre,division,nivel')
      .eq('institucion_id', USUARIO_ACTUAL.institucion_id).or('activo.is.null,activo.eq.true').order('nivel').order('nombre'),
    sb.from('materias').select('id,nombre,nivel,tipo')
      .eq('institucion_id', USUARIO_ACTUAL.institucion_id).or('activo.is.null,activo.eq.true').order('nombre'),
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
  _admAsigModoEdicion = false;
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

    const esNivel       = cursoSel?.nivel === 'inicial' || cursoSel?.nivel === 'primario';
    const materiasCurso = cursoSel
      ? materias.filter(m => (!m.nivel || m.nivel === cursoSel.nivel) && (!esNivel || m.tipo === 'especial'))
      : [];
    const docentesCurso = cursoSel ? docentes.filter(d => !d.nivel || d.nivel === cursoSel.nivel) : docentes;

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
// SECCIÓN: PARÁMETROS ACADÉMICOS — Asistencia / Calificaciones y escalas
// ══════════════════════════════════════════════════════
async function _ensureInstNiveles() {
  // Garantizar que INSTITUCION_ACTUAL tenga los campos de niveles (pueden faltar si el
  // SELECT de auth.js fue actualizado en una versión anterior sin estos campos)
  if (INSTITUCION_ACTUAL && INSTITUCION_ACTUAL.nivel_inicial === undefined) {
    const { data: fresh } = await sb
      .from('instituciones')
      .select('nivel_inicial, nivel_primario, nivel_secundario, anio_lectivo')
      .eq('id', USUARIO_ACTUAL.institucion_id)
      .single();
    if (fresh) {
      INSTITUCION_ACTUAL.nivel_inicial    = fresh.nivel_inicial;
      INSTITUCION_ACTUAL.nivel_primario   = fresh.nivel_primario;
      INSTITUCION_ACTUAL.nivel_secundario = fresh.nivel_secundario;
    }
  }
}

function _paramNivelesDisponibles() {
  const inst = INSTITUCION_ACTUAL || {};
  const nivelesActivos = ['inicial', 'primario', 'secundario'].filter(n => inst['nivel_' + n]);
  return USUARIO_ACTUAL.rol === 'directivo_nivel'
    ? [USUARIO_ACTUAL.nivel].filter(n => nivelesActivos.includes(n))
    : nivelesActivos;
}

// ── ASISTENCIA ─────────────────────────────────────────
let _paramAsistNivel = null;

async function _renderParamAsistencia() {
  const sec = document.getElementById('adm-section-content');
  await _ensureInstNiveles();
  const niveles = _paramNivelesDisponibles();

  if (!niveles.length) {
    sec.innerHTML = '<div class="empty-state">No hay niveles activos. Activá al menos un nivel en Institución → General.</div>';
    return;
  }
  if (!niveles.includes(_paramAsistNivel)) _paramAsistNivel = niveles[0];

  sec.innerHTML = `
    <div class="chip-row" style="margin-bottom:14px">
      ${niveles.map(n => `
        <div class="chip${n === _paramAsistNivel ? ' on' : ''}" id="param-asist-chip-${n}"
          onclick="_paramAsistTab('${n}')"
          style="${n === _paramAsistNivel ? `background:${NIVEL_COLORS_ADM[n]};border-color:${NIVEL_COLORS_ADM[n]};color:#fff` : ''}">
          ${NIVEL_LABELS_ADM[n]}
        </div>`).join('')}
    </div>
    <div id="param-asist-content"></div>
    <div id="param-asist-otros"></div>`;

  await _renderParamAsistNivel(_paramAsistNivel);
  await _renderParamAsistOtros();
}

async function _paramAsistTab(nivel) {
  _paramAsistNivel = nivel;
  _paramNivelesDisponibles().forEach(n => {
    const chip = document.getElementById('param-asist-chip-' + n);
    if (!chip) return;
    const activo = n === nivel;
    chip.classList.toggle('on', activo);
    chip.style.background  = activo ? NIVEL_COLORS_ADM[n] : '';
    chip.style.borderColor = activo ? NIVEL_COLORS_ADM[n] : '';
    chip.style.color       = activo ? '#fff' : '';
  });
  const cont = document.getElementById('param-asist-content');
  if (cont) cont.innerHTML = '<div class="loading-state small"><div class="spinner"></div></div>';
  await _renderParamAsistNivel(nivel);
}

async function _renderParamAsistNivel(nivel) {
  const cont = document.getElementById('param-asist-content');
  if (!cont) return;
  const instId = USUARIO_ACTUAL.institucion_id;
  const color  = NIVEL_COLORS_ADM[nivel];

  const { data: cfg } = await sb.from('config_asistencia').select('*')
    .eq('institucion_id', instId).eq('nivel', nivel).maybeSingle();
  const cfgRow = cfg || {};
  const cfgId  = cfgRow.id || '';

  cont.innerHTML = `
    <div class="card" style="border-top:3px solid ${color}">
      <div class="card-t" style="color:${color}">Asistencia — ${NIVEL_LABELS_ADM[nivel]}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">
        <div class="adm-form-row" style="margin:0">
          <label class="adm-label">Alerta 1 (%)</label>
          <input type="number" id="cfg-u1" value="${cfgRow.umbral_alerta_1 ?? 10}" min="0" max="100">
        </div>
        <div class="adm-form-row" style="margin:0">
          <label class="adm-label">Alerta 2 (%)</label>
          <input type="number" id="cfg-u2" value="${cfgRow.umbral_alerta_2 ?? 20}" min="0" max="100">
        </div>
        <div class="adm-form-row" style="margin:0">
          <label class="adm-label">Riesgo (%)</label>
          <input type="number" id="cfg-u3" value="${cfgRow.umbral_alerta_3 ?? 30}" min="0" max="100">
        </div>
      </div>
      <div class="adm-form-row">
        <div class="toggle-row-ui">
          <span style="font-size:12px">Las justificadas cuentan para regularidad</span>
          <div class="tog${cfgRow.justificadas_cuentan ? ' on' : ''}" id="tog-justif" onclick="_togAdm('tog-justif')"><div class="tog-thumb"></div></div>
        </div>
      </div>
      <div class="acc" style="margin-top:14px">
        <button class="btn-p" id="cfg-save-btn" onclick="_guardarAsistenciaCfg('${nivel}','${cfgId}')">Guardar configuración</button>
      </div>
    </div>`;
}

async function _guardarAsistenciaCfg(nivel, existingId) {
  const u1                   = parseInt(document.getElementById('cfg-u1')?.value) || 10;
  const u2                   = parseInt(document.getElementById('cfg-u2')?.value) || 20;
  const u3                   = parseInt(document.getElementById('cfg-u3')?.value) || 30;
  const justificadas_cuentan = document.getElementById('tog-justif')?.classList.contains('on');

  const datos = { umbral_alerta_1: u1, umbral_alerta_2: u2, umbral_alerta_3: u3, justificadas_cuentan };

  try {
    if (existingId) {
      const { error } = await sb.from('config_asistencia').update(datos).eq('id', existingId);
      if (error) throw error;
    } else {
      const { error } = await sb.from('config_asistencia').insert([{
        institucion_id: USUARIO_ACTUAL.institucion_id, nivel, ...datos,
      }]);
      if (error) throw error;
    }
    await _renderParamAsistNivel(nivel);
    _toastOk('Configuración guardada');
  } catch (e) {
    alert('Error al guardar: ' + e.message);
  }
}

async function _renderParamAsistOtros() {
  const cont = document.getElementById('param-asist-otros');
  if (!cont) return;
  const instId = USUARIO_ACTUAL.institucion_id;

  const [tiposJustRes, tiposEventoRes, tiposProbRes, tiposIntervRes] = await Promise.all([
    sb.from('tipos_justificacion').select('*').eq('institucion_id', instId).order('nombre'),
    sb.from('tipos_evento').select('*').eq('institucion_id', instId).order('nombre'),
    sb.from('tipos_problematicas').select('*').eq('institucion_id', instId).eq('activo', true).order('orden'),
    sb.from('tipos_intervencion').select('*').eq('institucion_id', instId).eq('activo', true).order('orden'),
  ]);

  const tiposJust   = tiposJustRes.data   || [];
  const tiposEvento = tiposEventoRes.data || [];
  const tiposProb   = tiposProbRes.data   || [];
  const tiposInterv = tiposIntervRes.data || [];

  cont.innerHTML = `
    <div class="sec-lb" style="margin-top:18px">Otros parámetros institucionales</div>

    <div class="card">
      <div class="card-t">Tipos de justificación de asistencia</div>
      <div id="lista-tipos-just">
        ${_renderListaTipos(tiposJust, 'tipos_justificacion', 'global', 'lista-tipos-just')}
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <input type="text" id="new-tipo-just-global" placeholder="Nuevo tipo de justificación" style="flex:1">
        <button class="btn-s" onclick="_agregarTipo('tipos_justificacion','new-tipo-just-global','global','lista-tipos-just')">Agregar</button>
      </div>
    </div>

    <div class="card">
      <div class="card-t">Tipos de eventos de agenda</div>
      <div id="lista-tipos-evento">
        ${_renderListaTipos(tiposEvento, 'tipos_evento', 'global', 'lista-tipos-evento')}
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <input type="text" id="new-tipo-evento-global" placeholder="Nuevo tipo de evento" style="flex:1">
        <button class="btn-s" onclick="_agregarTipo('tipos_evento','new-tipo-evento-global','global','lista-tipos-evento')">Agregar</button>
      </div>
    </div>

    <div class="card">
      <div class="card-t">Tipos de problemática</div>
      <div style="font-size:11px;color:var(--txt2);margin-bottom:10px">Opciones disponibles al registrar una nueva situación</div>
      <div id="lista-tipos-prob">
        ${_renderListaTipos(tiposProb, 'tipos_problematicas', 'global', 'lista-tipos-prob')}
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <input type="text" id="new-tipo-prob-global" placeholder="Ej: Convivencia" style="flex:1">
        <button class="btn-s" onclick="_agregarTipoProb()">Agregar</button>
      </div>
    </div>

    <div class="card">
      <div class="card-t">Tipos de intervención</div>
      <div style="font-size:11px;color:var(--txt2);margin-bottom:10px">Opciones disponibles al registrar un seguimiento</div>
      <div id="lista-tipos-interv">
        ${_renderListaTipos(tiposInterv, 'tipos_intervencion', 'global', 'lista-tipos-interv')}
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <input type="text" id="new-tipo-interv-global" placeholder="Ej: Reunión con familia" style="flex:1">
        <button class="btn-s" onclick="_agregarTipoInterv()">Agregar</button>
      </div>
    </div>`;
}

// ── CALIFICACIONES Y ESCALAS — tab "Escalas y notas" ───
let _paramCalifNivel = null;

async function _renderParamNotas() {
  const sec = document.getElementById('adm-section-content');
  await _ensureInstNiveles();
  const niveles = _paramNivelesDisponibles();

  if (!niveles.length) {
    sec.innerHTML = '<div class="empty-state">No hay niveles activos. Activá al menos un nivel en Institución → General.</div>';
    return;
  }
  if (!niveles.includes(_paramCalifNivel)) _paramCalifNivel = niveles[0];

  sec.innerHTML = `
    <div class="chip-row" style="margin-bottom:14px">
      ${niveles.map(n => `
        <div class="chip${n === _paramCalifNivel ? ' on' : ''}" id="param-calif-chip-${n}"
          onclick="_paramCalifTab('${n}')"
          style="${n === _paramCalifNivel ? `background:${NIVEL_COLORS_ADM[n]};border-color:${NIVEL_COLORS_ADM[n]};color:#fff` : ''}">
          ${NIVEL_LABELS_ADM[n]}
        </div>`).join('')}
    </div>
    <div id="param-calif-content"></div>
    <div id="param-calif-tipos"></div>`;

  await _renderParamCalifNivel(_paramCalifNivel);
  await _renderParamCalifTipos();
}

async function _paramCalifTab(nivel) {
  _paramCalifNivel = nivel;
  _paramNivelesDisponibles().forEach(n => {
    const chip = document.getElementById('param-calif-chip-' + n);
    if (!chip) return;
    const activo = n === nivel;
    chip.classList.toggle('on', activo);
    chip.style.background  = activo ? NIVEL_COLORS_ADM[n] : '';
    chip.style.borderColor = activo ? NIVEL_COLORS_ADM[n] : '';
    chip.style.color       = activo ? '#fff' : '';
  });
  const cont = document.getElementById('param-calif-content');
  if (cont) cont.innerHTML = '<div class="loading-state small"><div class="spinner"></div></div>';
  await _renderParamCalifNivel(nivel);
}

async function _renderParamCalifNivel(nivel) {
  const cont   = document.getElementById('param-calif-content');
  if (!cont) return;
  const instId = USUARIO_ACTUAL.institucion_id;
  const color  = NIVEL_COLORS_ADM[nivel];

  const [cfgRes, periodosRes] = await Promise.all([
    sb.from('config_asistencia').select('*').eq('institucion_id', instId).eq('nivel', nivel).maybeSingle(),
    sb.from('periodos_evaluativos').select('*').eq('institucion_id', instId).eq('nivel', nivel).order('fecha_inicio'),
  ]);

  const cfg     = cfgRes.data     || {};
  const periodos = periodosRes.data || [];
  const cfgId   = cfg.id || '';

  // ── Sección evaluación diferenciada por nivel ───────
  let htmlEvaluacion = '';

  if (nivel === 'inicial') {
    htmlEvaluacion = `
      <div style="font-size:12px;color:var(--txt2);margin:0 0 10px;padding:10px;background:var(--surf2);border-radius:var(--rad);border-left:3px solid ${color}">
        El nivel inicial trabaja con <strong>informes narrativos</strong> por dimensiones de desarrollo.
        No se aplican calificaciones numéricas ni conceptuales. Las dimensiones evaluadas se configuran
        en la pestaña <strong>Dimensiones (Inicial)</strong>.
      </div>`;

  } else if (nivel === 'primario') {
    const escalaConc = cfg.escala_conceptual_valores || ['MB','B','R','I'];
    const aprob1     = escalaConc.includes(cfg.aprobacion_ciclo1) ? cfg.aprobacion_ciclo1 : (escalaConc[escalaConc.length - 1] || 'MB');
    const notaMin2   = cfg.nota_minima       ?? 7;
    const notaRec2   = cfg.nota_recuperacion ?? 4;
    const escala2    = cfg.escala            || 'numerica';
    htmlEvaluacion = `
      <div class="card-t" style="color:${color};margin-top:16px">Calificaciones</div>

      <div style="font-size:12px;font-weight:600;margin:10px 0 8px;padding:6px 10px;background:var(--surf2);border-radius:var(--rad)">
        Primer Ciclo — 1°, 2° y 3° grado · escala siempre conceptual
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="adm-form-row" style="margin:0">
          <label class="adm-label">Valores de la escala (mayor → menor)</label>
          <div id="lista-escala-conc">${_renderEscalaConc(escalaConc)}</div>
          <div style="display:flex;gap:6px;margin-top:6px">
            <input type="text" id="new-escala-val" placeholder="Ej: MB" style="flex:1;font-size:11px">
            <button class="btn-s" style="white-space:nowrap;font-size:11px;padding:4px 10px" onclick="_agregarEscalaVal()">Agregar</button>
          </div>
        </div>
        <div class="adm-form-row" style="margin:0">
          <label class="adm-label">Valor mínimo aprobatorio</label>
          <select id="cfg-aprobacion-ciclo1">
            ${escalaConc.map(v => `<option value="${v}" ${aprob1 === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="font-size:12px;font-weight:600;margin-bottom:8px;padding:6px 10px;background:var(--surf2);border-radius:var(--rad)">
        Segundo Ciclo — 4°, 5° y 6° grado
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px">
        <div class="adm-form-row" style="margin:0">
          <label class="adm-label">Escala Ciclo 2</label>
          <select id="cfg-escala-ciclo2">
            <option value="numerica"   ${escala2 === 'numerica'   ? 'selected' : ''}>Numérica (1–10)</option>
            <option value="conceptual" ${escala2 === 'conceptual' ? 'selected' : ''}>Conceptual (misma que Ciclo 1)</option>
          </select>
        </div>
        <div class="adm-form-row" style="margin:0">
          <label class="adm-label">Nota mínima (cursada regular)</label>
          <input type="number" id="cfg-nota-min" value="${notaMin2}" min="1" max="10">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px">
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
    <!-- CALIFICACIONES -->
    ${nivel === 'inicial' ? htmlEvaluacion : `
    <div class="card" style="border-top:3px solid ${color}">
      <div class="card-t" style="color:${color}">Calificaciones — ${NIVEL_LABELS_ADM[nivel]}</div>
      ${htmlEvaluacion}
      <div class="acc" style="margin-top:14px">
        <button class="btn-p" id="cfg-save-btn" onclick="_guardarCalifCfg('${nivel}','${cfgId}')">Guardar configuración</button>
      </div>
    </div>`}

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

async function _guardarCalifCfg(nivel, existingId) {
  const datos = {};
  if (nivel === 'primario') {
    datos.escala_ciclo1     = 'conceptual';
    datos.aprobacion_ciclo1 = document.getElementById('cfg-aprobacion-ciclo1')?.value || 'B';
    datos.escala            = document.getElementById('cfg-escala-ciclo2')?.value || 'numerica';
    datos.nota_minima       = parseInt(document.getElementById('cfg-nota-min')?.value) || 7;
    datos.nota_recuperacion = parseInt(document.getElementById('cfg-nota-rec')?.value) || 4;
  } else if (nivel === 'secundario') {
    datos.nota_minima = parseInt(document.getElementById('cfg-nota-min')?.value) || 7;
    datos.escala      = document.getElementById('cfg-escala')?.value || 'numerica';
  } else {
    return; // nivel inicial: sin campos editables en esta pestaña
  }

  try {
    if (existingId) {
      const { error } = await sb.from('config_asistencia').update(datos).eq('id', existingId);
      if (error) throw error;
    } else {
      const { error } = await sb.from('config_asistencia').insert([{
        institucion_id: USUARIO_ACTUAL.institucion_id, nivel,
        umbral_alerta_1: 10, umbral_alerta_2: 20, umbral_alerta_3: 30, justificadas_cuentan: false,
        ...datos,
      }]);
      if (error) throw error;
    }
    await _renderParamCalifNivel(nivel);
    _toastOk('Configuración guardada');
  } catch (e) {
    alert('Error al guardar: ' + e.message);
  }
}

async function _renderParamCalifTipos() {
  const cont  = document.getElementById('param-calif-tipos');
  if (!cont) return;
  const instId = USUARIO_ACTUAL.institucion_id;

  // Invalidar cache de tipos de instancia usado en calificaciones.js
  window._tiposInstanciaCache = null;

  let { data: tiposInst, error: tiposInstErr } = await sb.from('tipos_instancia_evaluativa')
    .select('*').eq('institucion_id', instId).eq('activo', true).order('created_at');
  tiposInst = tiposInst || [];

  // Sembrar valores por defecto si la institución no tiene tipos configurados aún
  if (!tiposInst.length && !tiposInstErr) {
    const defaults = ['Evaluación escrita','Trabajo práctico','Exposición oral','Evaluación integradora','Trabajo en clase'];
    const rows = defaults.map(nombre => ({ nombre, institucion_id: instId, activo: true, orden: 0 }));
    const { data: seeded } = await sb.from('tipos_instancia_evaluativa').insert(rows).select('*');
    tiposInst = seeded || [];
  }

  cont.innerHTML = `
    <div class="sec-lb" style="margin-top:18px">Instancias evaluativas</div>

    <!-- TIPOS INSTANCIA EVALUATIVA -->
    <div class="card">
      <div class="card-t">Tipos de instancia evaluativa</div>
      <div style="font-size:11px;color:var(--txt2);margin-bottom:10px">Disponibles al cargar notas en todos los niveles</div>
      <div id="lista-tipos-inst">
        ${_renderListaTipos(tiposInst, 'tipos_instancia_evaluativa', 'global', 'lista-tipos-inst')}
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <input type="text" id="new-tipo-inst-global" placeholder="Ej: Exposición oral" style="flex:1">
        <button class="btn-s" onclick="_agregarTipoInst()">Agregar</button>
      </div>
    </div>`;
}

async function _renderParamDimensiones() {
  const sec = document.getElementById('adm-section-content');
  const instId = USUARIO_ACTUAL.institucion_id;
  const color  = NIVEL_COLORS_ADM.inicial;

  const { data: cfg } = await sb.from('config_asistencia').select('*')
    .eq('institucion_id', instId).eq('nivel', 'inicial').maybeSingle();
  const dims = cfg?.dimensiones_informe || _DIMS_INICIAL_DEFAULT;

  sec.innerHTML = `
    <div class="card" style="border-top:3px solid ${color}">
      <div class="card-t" style="color:${color}">Dimensiones de desarrollo evaluadas</div>
      <div style="font-size:11px;color:var(--txt2);margin-bottom:10px">Se usan en los informes narrativos semestrales de Nivel Inicial.</div>
      <div id="lista-dims-inicial">${_renderListaDims(dims)}</div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <input type="text" id="new-dim-inicial" placeholder="Ej: Exploración del entorno" style="flex:1;font-size:12px">
        <button class="btn-s" onclick="_agregarDim()">Agregar</button>
      </div>
    </div>`;
}

async function _refrescarTiposGlobales() {
  await _renderParamAsistOtros();
  await _renderParamCalifTipos();
}

async function _agregarTipoInst() {
  const inp    = document.getElementById('new-tipo-inst-global');
  const nombre = inp?.value?.trim();
  if (!nombre) return;
  const { error } = await sb.from('tipos_instancia_evaluativa').insert([{
    nombre, activo: true, orden: 0, institucion_id: USUARIO_ACTUAL.institucion_id,
  }]);
  if (error) { alert('Error: ' + error.message); return; }
  if (inp) inp.value = '';
  window._tiposInstanciaCache = null;
  await _refrescarTiposGlobales();
}

async function _agregarTipoProb() {
  const inp    = document.getElementById('new-tipo-prob-global');
  const nombre = inp?.value?.trim();
  if (!nombre) return;
  const { error } = await sb.from('tipos_problematicas').insert([{
    nombre, activo: true, orden: 0, institucion_id: USUARIO_ACTUAL.institucion_id,
  }]);
  if (error) { alert('Error: ' + error.message); return; }
  if (inp) inp.value = '';
  window._tiposProbCache = null; // invalidar cache en problematicas.js
  await _refrescarTiposGlobales();
}

async function _agregarTipoInterv() {
  const inp    = document.getElementById('new-tipo-interv-global');
  const nombre = inp?.value?.trim();
  if (!nombre) return;
  const { error } = await sb.from('tipos_intervencion').insert([{
    nombre, activo: true, orden: 0, institucion_id: USUARIO_ACTUAL.institucion_id,
  }]);
  if (error) { alert('Error: ' + error.message); return; }
  if (inp) inp.value = '';
  window._tiposIntervCache = null; // invalidar cache en problematicas.js
  await _refrescarTiposGlobales();
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
      <button onclick="_eliminarTipo('${tabla}','${t.id}')"
        style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--rojo);padding:0 3px;line-height:1" title="Eliminar">✕</button>
    </div>`).join('');
}

async function _eliminarTipo(tabla, id) {
  if (!confirm('¿Eliminar este tipo? Esta acción no se puede deshacer.')) return;
  const { error } = await sb.from(tabla).delete().eq('id', id);
  if (error) { alert('No se puede eliminar: tiene registros vinculados.'); return; }
  await _refrescarTiposGlobales();
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
  await _refrescarTiposGlobales();
}

async function _togTipoActivo(tabla, id, listaId, nivel) {
  const { data: curr } = await sb.from(tabla).select('activo').eq('id', id).single();
  const { error } = await sb.from(tabla).update({ activo: !curr?.activo }).eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  await _refrescarTiposGlobales();
}

async function _agregarTipo(tabla, inputId, nivel, listaId) {
  const inp    = document.getElementById(inputId);
  const nombre = inp?.value?.trim();
  if (!nombre) return;

  const datos = { nombre, activo: true, institucion_id: USUARIO_ACTUAL.institucion_id };

  const { error } = await sb.from(tabla).insert([datos]);
  if (error) { alert('Error: ' + error.message); return; }
  if (inp) inp.value = '';
  await _refrescarTiposGlobales();
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
  await _renderParamCalifNivel(nivel);
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
  await _renderParamCalifNivel(nivel);
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
  await _renderParamCalifNivel(nivel);
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
      <div class="dim-label" style="flex:1;font-size:12px">${_esc(d)}</div>
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
  await _renderParamDimensiones();
}

function _mmatToggleTipo() {
  const nivel = document.getElementById('mmat-nivel')?.value;
  const row   = document.getElementById('mmat-tipo-row');
  if (row) row.style.display = nivel === 'secundario' ? 'none' : '';
}

function _renderEscalaConc(vals) {
  if (!vals || !vals.length) return '<div style="color:var(--txt2);font-size:11px;padding:6px 0">Sin valores. Agregá valores de mayor a menor.</div>';
  return vals.map((v, i) => `
    <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--brd)">
      <span style="font-size:10px;color:var(--txt3);width:16px;text-align:right">${i + 1}.</span>
      <div style="flex:1;font-size:12px;font-weight:600">${_esc(v)}</div>
      <button onclick="_quitarEscalaVal(${i})"
        style="background:none;border:none;cursor:pointer;font-size:14px;color:var(--txt3);padding:0 2px;line-height:1" title="Quitar">×</button>
    </div>`).join('');
}

async function _agregarEscalaVal() {
  const inp = document.getElementById('new-escala-val');
  const val = inp?.value?.trim();
  if (!val) return;
  const instId = USUARIO_ACTUAL.institucion_id;
  const { data: cfg } = await sb.from('config_asistencia')
    .select('id, escala_conceptual_valores').eq('institucion_id', instId).eq('nivel', 'primario').maybeSingle();
  const nuevos = [...(cfg?.escala_conceptual_valores || ['MB','B','R','I']), val];
  let error;
  if (cfg?.id) {
    ({ error } = await sb.from('config_asistencia').update({ escala_conceptual_valores: nuevos }).eq('id', cfg.id));
  } else {
    ({ error } = await sb.from('config_asistencia').insert([{
      institucion_id: instId, nivel: 'primario', escala_conceptual_valores: nuevos,
      umbral_alerta_1: 10, umbral_alerta_2: 20, umbral_alerta_3: 30, justificadas_cuentan: false,
    }]));
  }
  if (error) { alert('Error: ' + error.message); return; }
  if (inp) inp.value = '';
  await _renderParamCalifNivel('primario');
}

async function _quitarEscalaVal(idx) {
  const instId = USUARIO_ACTUAL.institucion_id;
  const { data: cfg } = await sb.from('config_asistencia')
    .select('id, escala_conceptual_valores').eq('institucion_id', instId).eq('nivel', 'primario').maybeSingle();
  if (!cfg?.id) return;
  const vals = (cfg.escala_conceptual_valores || ['MB','B','R','I']).filter((_, i) => i !== idx);
  const { error } = await sb.from('config_asistencia').update({ escala_conceptual_valores: vals }).eq('id', cfg.id);
  if (error) { alert('Error: ' + error.message); return; }
  await _renderParamCalifNivel('primario');
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
  await _renderParamDimensiones();
}

// ══════════════════════════════════════════════════════
// SECCIÓN: SUPLENCIAS Y LICENCIAS
// ══════════════════════════════════════════════════════
async function _renderSuplencias() {
  const sec    = document.getElementById('adm-section-content');
  sec.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  const instId = USUARIO_ACTUAL.institucion_id;
  const { data: usuarios, error: usrErr } = await sb.from('usuarios')
    .select('id,nombre_completo,rol,nivel,en_licencia,activo')
    .eq('institucion_id', instId)
    .order('nombre_completo');
  if (usrErr) { _admError(sec, usrErr.message); return; }

  const usuariosMap = {};
  const usuariosIds = (usuarios || []).map(u => { usuariosMap[u.id] = u; return u.id; });

  let suplencias = [];
  if (usuariosIds.length) {
    const { data, error } = await sb.from('suplencias')
      .select('*')
      .in('titular_id', usuariosIds)
      .order('created_at', { ascending: false });
    if (error) { _admError(sec, error.message); return; }
    suplencias = data || [];
  }

  const activas   = suplencias.filter(s => s.activo);
  const historial = suplencias.filter(s => !s.activo);

  const mkRow = (s, esActiva) => {
    const titular  = usuariosMap[s.titular_id]  || {};
    const suplente = usuariosMap[s.suplente_id] || {};
    const fi = s.fecha_inicio ? new Date(s.fecha_inicio + 'T12:00:00').toLocaleDateString('es-AR') : '—';
    const ff = s.fecha_fin    ? new Date(s.fecha_fin    + 'T12:00:00').toLocaleDateString('es-AR') : null;
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--brd)">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;margin-bottom:3px">
            ${_esc(titular.nombre_completo || 'Desconocido')}
            <span style="color:var(--txt3);margin:0 5px;font-weight:400">cubierto por</span>
            ${_esc(suplente.nombre_completo || 'Desconocido')}
          </div>
          <div style="font-size:10px;color:var(--txt2)">
            ${ROL_LABELS_ADM[titular.rol] || titular.rol || '—'} · Desde ${fi}${ff ? ' · Hasta ' + ff : ''}
          </div>
          ${s.notas ? `<div style="font-size:10px;color:var(--txt3);margin-top:2px;font-style:italic">${_esc(s.notas)}</div>` : ''}
        </div>
        ${esActiva
          ? `<button class="btn-d" style="flex-shrink:0" onclick="_finalizarSuplencia('${s.id}')">Finalizar</button>`
          : `<span class="tag tr" style="flex-shrink:0">Cerrada</span>`}
      </div>`;
  };

  sec.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-size:14px;font-weight:600">Licencias y suplencias</div>
        <div style="font-size:11px;color:var(--txt2)">Gestión de reemplazos temporales de docentes y personal</div>
      </div>
      <button class="btn-p" onclick="_abrirModalNuevaLicencia()">+ Nueva licencia</button>
    </div>

    <div class="sec-lb">Suplencias activas${activas.length ? ' (' + activas.length + ')' : ''}</div>
    ${activas.length
      ? `<div class="card" style="padding:0;overflow:hidden;margin-bottom:20px">${activas.map(s => mkRow(s, true)).join('')}</div>`
      : `<div class="empty-state" style="margin-bottom:20px">Sin suplencias activas</div>`}

    <div class="sec-lb">Historial${historial.length ? ' (' + historial.length + ')' : ''}</div>
    ${historial.length
      ? `<div class="card" style="padding:0;overflow:hidden">${historial.map(s => mkRow(s, false)).join('')}</div>`
      : `<div style="color:var(--txt2);font-size:12px;padding:6px 0">Sin historial de suplencias</div>`}`;
}

async function _abrirModalNuevaLicencia() {
  const instId = USUARIO_ACTUAL.institucion_id;
  const { data: usuarios, error } = await sb.from('usuarios')
    .select('id,nombre_completo,rol,nivel,en_licencia,activo')
    .eq('institucion_id', instId)
    .neq('activo', false)
    .order('nombre_completo');
  if (error) { alert('Error al cargar usuarios: ' + error.message); return; }

  const todos  = usuarios || [];
  const sinLic = todos.filter(u => !u.en_licencia);
  const today  = new Date().toISOString().split('T')[0];

  const opsTitular  = sinLic.map(u =>
    `<option value="${u.id}">${_esc(u.nombre_completo)} · ${ROL_LABELS_ADM[u.rol] || u.rol}</option>`
  ).join('');
  const opsSuplente = todos.map(u =>
    `<option value="${u.id}">${_esc(u.nombre_completo)} · ${ROL_LABELS_ADM[u.rol] || u.rol}</option>`
  ).join('');

  _crearModal(
    'Registrar licencia',
    `<div class="adm-form-row">
      <label class="adm-label">Titular que sale de licencia</label>
      <select id="lic-titular">
        <option value="">— Seleccionar —</option>
        ${opsTitular}
      </select>
    </div>
    <div class="adm-form-row">
      <label class="adm-label">Suplente que cubre</label>
      <select id="lic-suplente">
        <option value="">— Seleccionar —</option>
        ${opsSuplente}
      </select>
    </div>
    <div class="adm-form-row">
      <label class="adm-label">Fecha de inicio</label>
      <input type="date" id="lic-fecha-inicio" value="${today}">
    </div>
    <div class="adm-form-row">
      <label class="adm-label">Fecha de fin (opcional)</label>
      <input type="date" id="lic-fecha-fin">
      <div style="font-size:10px;color:var(--txt2);margin-top:3px">Dejar vacío si no está definida la fecha de regreso.</div>
    </div>
    <div class="adm-form-row">
      <label class="adm-label">Motivo / notas (opcional)</label>
      <textarea id="lic-notas" rows="2" placeholder="Ej: Licencia médica, licencia por maternidad..."
        style="resize:vertical;font-size:12px;width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--brd);border-radius:var(--rad);background:var(--bg);color:var(--txt);font-family:inherit"></textarea>
    </div>`,
    async () => { await _guardarLicencia(todos); }
  );
}

async function _guardarLicencia(usuariosList) {
  const titularId  = document.getElementById('lic-titular')?.value;
  const suplenteId = document.getElementById('lic-suplente')?.value;
  const fechaIni   = document.getElementById('lic-fecha-inicio')?.value;
  const fechaFin   = document.getElementById('lic-fecha-fin')?.value || null;
  const notas      = document.getElementById('lic-notas')?.value?.trim() || null;

  if (!titularId)              { alert('Seleccioná el titular.'); return; }
  if (!suplenteId)             { alert('Seleccioná el suplente.'); return; }
  if (titularId === suplenteId){ alert('El titular y el suplente no pueden ser la misma persona.'); return; }
  if (!fechaIni)               { alert('La fecha de inicio es requerida.'); return; }

  try {
    const { data: sup, error: supErr } = await sb.from('suplencias').insert([{
      titular_id: titularId, suplente_id: suplenteId,
      fecha_inicio: fechaIni, fecha_fin: fechaFin,
      notas, creado_por: USUARIO_ACTUAL.id,
    }]).select().single();
    if (supErr) throw supErr;

    const { error: licErr } = await sb.from('usuarios')
      .update({ en_licencia: true }).eq('id', titularId);
    if (licErr) throw licErr;

    const titular = usuariosList.find(u => u.id === titularId);
    if (titular?.rol === 'docente') {
      const { data: asigs, error: asigErr } = await sb.from('asignaciones')
        .select('curso_id,materia_id,anio_lectivo')
        .eq('docente_id', titularId)
        .is('suplencia_id', null);
      if (asigErr) throw asigErr;

      if (asigs?.length) {
        const { error: insErr } = await sb.from('asignaciones').insert(
          asigs.map(a => ({
            docente_id: suplenteId, curso_id: a.curso_id,
            materia_id: a.materia_id, anio_lectivo: a.anio_lectivo,
            suplencia_id: sup.id,
          }))
        );
        if (insErr) {
          await sb.from('suplencias').delete().eq('id', sup.id);
          await sb.from('usuarios').update({ en_licencia: false }).eq('id', titularId);
          throw insErr;
        }
      }
    }

    _cerrarModal();
    _toastOk('Licencia registrada. El suplente ya tiene acceso.');
    await _renderSuplencias();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function _finalizarSuplencia(supId) {
  if (!confirm('¿Finalizar esta suplencia? El titular recuperará sus permisos originales.')) return;

  try {
    const { data: sup, error: getErr } = await sb.from('suplencias')
      .select('titular_id,fecha_fin').eq('id', supId).single();
    if (getErr) throw getErr;

    const today = new Date().toISOString().split('T')[0];
    const { error: supErr } = await sb.from('suplencias')
      .update({ activo: false, fecha_fin: sup.fecha_fin || today })
      .eq('id', supId);
    if (supErr) throw supErr;

    await sb.from('asignaciones').delete().eq('suplencia_id', supId);

    const { error: usrErr } = await sb.from('usuarios')
      .update({ en_licencia: false }).eq('id', sup.titular_id);
    if (usrErr) throw usrErr;

    _toastOk('Suplencia finalizada. El titular recuperó sus accesos.');
    await _renderSuplencias();
  } catch (e) {
    alert('Error: ' + e.message);
  }
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
    /* ── Tabs internos de una subsección ── */
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
    .adm-tab.on    { background: var(--surf); color: var(--acento); font-weight: 600; box-shadow: 0 1px 4px rgba(0,0,0,.08); }

    /* ── Apariencia institucional (logo + color) ── */
    .tema-swatch {
      position: relative;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      flex-shrink: 0;
      box-shadow: 0 0 0 1px var(--brd);
      transition: transform .1s, box-shadow .12s;
    }
    .tema-swatch:hover { transform: scale(1.08); }
    .tema-swatch.on { box-shadow: 0 0 0 2px var(--surf), 0 0 0 4px var(--txt2); }
    .tema-swatch.on::after {
      content: '✓';
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 14px; font-weight: 700;
      text-shadow: 0 1px 2px rgba(0,0,0,.4);
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

// ══════════════════════════════════════════════════════
// SECCIÓN: CICLO LECTIVO (v15 — Res. 1650/2024)
// ══════════════════════════════════════════════════════

async function _renderCicloLectivo() {
  const sec = document.getElementById('adm-section-content');
  sec.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  const instId = USUARIO_ACTUAL.institucion_id;
  const anio   = new Date().getFullYear();

  const [periodosRes, cierresRes, instRes] = await Promise.all([
    sb.from('periodos_intensificacion')
      .select('*').eq('institucion_id', instId)
      .eq('ciclo_lectivo', anio).order('fecha_inicio'),
    sb.from('cierres_periodo')
      .select('*').eq('institucion_id', instId)
      .eq('ciclo_lectivo', anio).order('tipo'),
    sb.from('instituciones')
      .select('fecha_inicio_ciclo,fecha_fin_ciclo,fecha_activacion')
      .eq('id', instId).single(),
  ]);

  const periodos    = periodosRes.data || [];
  const cierres     = cierresRes.data  || [];
  const cierreC1    = cierres.find(c => c.tipo === 'cuatrimestre_1');
  const cierreC2    = cierres.find(c => c.tipo === 'cuatrimestre_2');
  const instCiclo   = instRes.data || {};
  const fechaActiv  = instCiclo.fecha_activacion;

  const TIPO_LABELS = {
    inicio_c1: 'Inicio C1', fin_c1: 'Fin C1',
    diciembre: 'Diciembre', febrero: 'Febrero',
  };

  sec.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div class="card-t">Fechas del ciclo lectivo ${anio}</div>
      <div style="font-size:11px;color:var(--txt2);margin-bottom:14px">
        Establecé el rango del año lectivo. La fecha de inicio es el primer día de clases y la de cierre el último.
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div class="adm-form-row" style="flex:1;min-width:160px;margin-bottom:0">
          <label class="adm-label">Fecha de inicio</label>
          <input type="date" id="cl-fecha-inicio" value="${instCiclo.fecha_inicio_ciclo || ''}">
        </div>
        <div class="adm-form-row" style="flex:1;min-width:160px;margin-bottom:0">
          <label class="adm-label">Fecha de cierre</label>
          <input type="date" id="cl-fecha-fin" value="${instCiclo.fecha_fin_ciclo || ''}">
        </div>
      </div>
      <div class="acc" style="margin-top:14px">
        <button class="btn-s" onclick="_guardarFechasCiclo()">Guardar fechas</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-t">Activación del sistema</div>
      <div style="font-size:11px;color:var(--txt2);margin-bottom:12px">
        Al activar el sistema empiezan a correr los días sin lista, las alertas por inasistencia y todos los contadores automáticos.
      </div>
      ${fechaActiv ? `
        <div style="display:flex;align-items:center;gap:10px;padding:12px;background:#e8f5e9;border-radius:var(--rad);border-left:3px solid var(--verde);margin-bottom:12px">
          <div style="font-size:18px">✅</div>
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--verde)">Sistema activo</div>
            <div style="font-size:11px;color:var(--txt2)">Activado el ${_fmtFechaHora(fechaActiv)}</div>
          </div>
        </div>
        <button class="btn-s" style="font-size:11px;color:var(--txt3)" onclick="_reactivarSistema()">Reactivar (reinicia la fecha de activación)</button>
      ` : `
        <div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--surf2);border-radius:var(--rad);border-left:3px solid var(--brd);margin-bottom:12px">
          <div style="font-size:18px">⏸</div>
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--txt2)">Sistema no activado</div>
            <div style="font-size:11px;color:var(--txt3)">Los contadores de asistencia y alertas no están corriendo.</div>
          </div>
        </div>
        <button class="btn-p" id="btn-activar-sistema" onclick="_activarSistema()">Iniciar uso de la app</button>
      `}
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-t">Períodos de intensificación — ${anio}</div>
      <div style="font-size:11px;color:var(--txt2);margin-bottom:12px">
        Cuatro períodos por año según Res. 1650/2024. Activar el período correcto para que preceptores y docentes puedan registrar asistencia en intensificación.
      </div>

      ${periodos.length ? `
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
        ${periodos.map(p => `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surf2);border-radius:var(--rad);border-left:3px solid ${p.activo ? 'var(--verde)' : 'var(--brd)'}">
            <div style="flex:1">
              <div style="font-size:12px;font-weight:600">${_esc(p.nombre)}</div>
              <div style="font-size:10px;color:var(--txt2)">${TIPO_LABELS[p.tipo] || p.tipo} · ${_fmtFecha(p.fecha_inicio)} — ${_fmtFecha(p.fecha_fin)}</div>
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <div class="tog${p.activo ? ' on' : ''}" id="tog-periodo-${p.id}" onclick="_toggleActivoPeriodo('${p.id}',${!p.activo})" title="${p.activo ? 'Desactivar' : 'Activar'}">
                <div class="tog-thumb"></div>
              </div>
              <button onclick="_eliminarPeriodoIntensif('${p.id}')"
                style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--txt3);padding:0 2px;line-height:1" title="Eliminar">×</button>
            </div>
          </div>`).join('')}
      </div>` : `
      <div style="font-size:11px;color:var(--txt3);text-align:center;padding:16px 0;margin-bottom:12px">
        Sin períodos definidos para ${anio}.
      </div>`}

      <button class="btn-s" onclick="_nuevoPeriodoIntensif()" style="font-size:11px">+ Agregar período</button>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-t">Cierre de cuatrimestre</div>
      <div style="font-size:11px;color:var(--txt2);margin-bottom:12px">
        Al cerrar un cuatrimestre se generan alertas académicas automáticas según la cantidad de materias desaprobadas.
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px;padding:12px;background:var(--surf2);border-radius:var(--rad);border-left:3px solid ${cierreC1 ? 'var(--verde)' : 'var(--brd)'}">
          <div style="font-size:12px;font-weight:600;margin-bottom:4px">Cuatrimestre 1</div>
          ${cierreC1
            ? `<div style="font-size:10px;color:var(--verde)">✅ Cerrado el ${_fmtFecha(cierreC1.created_at?.slice(0,10))}</div>`
            : `<div style="font-size:10px;color:var(--txt2)">Sin cerrar</div>`}
          <button class="btn-s" onclick="_cerrarCuatrimestreConf(1)" style="font-size:10px;margin-top:8px">
            🔒 ${cierreC1 ? 'Re-generar alertas' : 'Cerrar C1'}
          </button>
        </div>
        <div style="flex:1;min-width:200px;padding:12px;background:var(--surf2);border-radius:var(--rad);border-left:3px solid ${cierreC2 ? 'var(--verde)' : 'var(--brd)'}">
          <div style="font-size:12px;font-weight:600;margin-bottom:4px">Cuatrimestre 2</div>
          ${cierreC2
            ? `<div style="font-size:10px;color:var(--verde)">✅ Cerrado el ${_fmtFecha(cierreC2.created_at?.slice(0,10))}</div>`
            : `<div style="font-size:10px;color:var(--txt2)">Sin cerrar</div>`}
          <button class="btn-s" onclick="_cerrarCuatrimestreConf(2)" style="font-size:10px;margin-top:8px">
            🔒 ${cierreC2 ? 'Re-generar alertas' : 'Cerrar C2'}
          </button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-t">Cierre anual / Promoción</div>
      <div style="font-size:11px;color:var(--txt2);margin-bottom:12px">
        Calcula el estado de promoción de cada alumno según las alertas generadas en el ciclo lectivo. Se aplica al nivel secundario.
      </div>
      <button class="btn-p" onclick="_verCierreAnualConf()" style="font-size:12px">
        🎓 Ver estado de promoción
      </button>
    </div>`;
}

function _fmtFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
}

function _fmtFechaHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

async function _guardarFechasCiclo() {
  const inicio = document.getElementById('cl-fecha-inicio')?.value;
  const fin    = document.getElementById('cl-fecha-fin')?.value;
  if (inicio && fin && fin < inicio) {
    alert('La fecha de cierre debe ser posterior a la de inicio.'); return;
  }
  const { error } = await sb.from('instituciones')
    .update({ fecha_inicio_ciclo: inicio || null, fecha_fin_ciclo: fin || null })
    .eq('id', USUARIO_ACTUAL.institucion_id);
  if (error) { alert('Error al guardar: ' + error.message); return; }
  _toastOk('Fechas del ciclo lectivo guardadas.');
}

async function _activarSistema() {
  if (!confirm('¿Activar el sistema ahora? Los contadores de asistencia y alertas empezarán a correr desde este momento.')) return;
  const btn = document.getElementById('btn-activar-sistema');
  if (btn) { btn.disabled = true; btn.textContent = 'Activando...'; }
  const { error } = await sb.from('instituciones')
    .update({ fecha_activacion: new Date().toISOString() })
    .eq('id', USUARIO_ACTUAL.institucion_id);
  if (error) { alert('Error al activar: ' + error.message); if (btn) { btn.disabled = false; btn.textContent = 'Iniciar uso de la app'; } return; }
  _toastOk('¡Sistema activado! Los contadores están corriendo.');
  await _renderCicloLectivo();
}

async function _reactivarSistema() {
  if (!confirm('¿Reiniciar la fecha de activación? Esto reemplazará la fecha actual. Los contadores se calcularán desde ahora.')) return;
  const { error } = await sb.from('instituciones')
    .update({ fecha_activacion: new Date().toISOString() })
    .eq('id', USUARIO_ACTUAL.institucion_id);
  if (error) { alert('Error: ' + error.message); return; }
  _toastOk('Fecha de activación actualizada.');
  await _renderCicloLectivo();
}

function _nuevoPeriodoIntensif() {
  const anio  = new Date().getFullYear();
  const today = new Date().toISOString().slice(0,10);
  _crearModal('Nuevo período de intensificación', `
    <div class="adm-form-row">
      <label class="adm-label">Nombre del período</label>
      <input type="text" id="pi-nombre" placeholder="Ej: Intensificación inicio C1 2026">
    </div>
    <div class="adm-form-row">
      <label class="adm-label">Tipo</label>
      <select id="pi-tipo">
        <option value="inicio_c1">Inicio C1</option>
        <option value="fin_c1">Fin C1</option>
        <option value="diciembre">Diciembre</option>
        <option value="febrero">Febrero</option>
      </select>
    </div>
    <div class="adm-form-row">
      <label class="adm-label">Fecha de inicio</label>
      <input type="date" id="pi-inicio" value="${today}">
    </div>
    <div class="adm-form-row">
      <label class="adm-label">Fecha de fin</label>
      <input type="date" id="pi-fin" value="${today}">
    </div>`,
    async () => { await _guardarPeriodoIntensif(anio); }
  );
}

async function _guardarPeriodoIntensif(anio) {
  const nombre = document.getElementById('pi-nombre')?.value?.trim();
  const tipo   = document.getElementById('pi-tipo')?.value;
  const inicio = document.getElementById('pi-inicio')?.value;
  const fin    = document.getElementById('pi-fin')?.value;

  if (!nombre) { alert('El nombre es obligatorio.'); return; }
  if (!inicio || !fin) { alert('Las fechas son obligatorias.'); return; }
  if (fin < inicio) { alert('La fecha de fin debe ser posterior al inicio.'); return; }

  const { error } = await sb.from('periodos_intensificacion').insert({
    institucion_id: USUARIO_ACTUAL.institucion_id,
    ciclo_lectivo:  anio,
    nombre, tipo,
    fecha_inicio: inicio,
    fecha_fin:    fin,
    activo:       false,
  });

  if (error) { alert('Error: ' + error.message); return; }
  _cerrarModal();
  _toastOk('Período creado correctamente.');
  await _renderCicloLectivo();
}

async function _eliminarPeriodoIntensif(id) {
  if (!confirm('¿Eliminar este período? Esta acción no se puede deshacer.')) return;
  const { error } = await sb.from('periodos_intensificacion').delete().eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  _toastOk('Período eliminado.');
  await _renderCicloLectivo();
}

async function _toggleActivoPeriodo(id, activo) {
  const tog = document.getElementById(`tog-periodo-${id}`);
  if (tog) tog.classList.toggle('on', activo);
  const { error } = await sb.from('periodos_intensificacion').update({ activo }).eq('id', id);
  if (error) { alert('Error: ' + error.message); if (tog) tog.classList.toggle('on', !activo); return; }
  _toastOk(activo ? 'Período activado.' : 'Período desactivado.');
}

async function _cerrarCuatrimestreConf(cuatrimestre) {
  const instId = USUARIO_ACTUAL.institucion_id;
  const anio   = new Date().getFullYear();

  const tipoCierre = cuatrimestre === 1 ? 'cuatrimestre_1' : 'cuatrimestre_2';
  const { data: existe } = await sb.from('cierres_periodo')
    .select('id').eq('institucion_id', instId)
    .eq('ciclo_lectivo', anio).eq('tipo', tipoCierre).maybeSingle();

  const accion = existe ? 're-generar las alertas' : `cerrar el Cuatrimestre ${cuatrimestre}`;
  if (!confirm(`¿Querés ${accion}? Se calcularán las materias desaprobadas por alumno y se generarán alertas académicas.`)) return;

  const sec = document.getElementById('adm-section-content');
  sec.innerHTML = '<div class="loading-state"><div class="spinner"></div><div style="font-size:11px;color:var(--txt2);margin-top:8px">Calculando alertas...</div></div>';

  // Reutilizar la lógica de calificaciones.js — llamar directamente si está disponible
  if (typeof _cerrarCuatrimestreTrayectoria === 'function') {
    await _cerrarCuatrimestreTrayectoria(cuatrimestre);
  } else {
    alert('Para usar esta función, el módulo de Calificaciones debe estar cargado. Ir a Calificaciones → Gestión del ciclo lectivo.');
  }

  await _renderCicloLectivo();
}

async function _verCierreAnualConf() {
  if (typeof _mostrarCierreAnual === 'function') {
    goPage('notas');
    setTimeout(() => _mostrarCierreAnual(), 400);
  } else {
    alert('Ir a Calificaciones → Cierre anual / Promoción para ver el estado de cada alumno.');
  }
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

// ══════════════════════════════════════════════════════
// SECCIÓN: FAMILIAS
// ══════════════════════════════════════════════════════
let _familiasData   = [];  // usuarios con rol=familia
let _famAlumnos     = [];  // todos los alumnos de la institución
let _famAlumnosSelIds = []; // IDs seleccionados en el modal

async function _renderFamilias() {
  const sec = document.getElementById('adm-section-content');
  sec.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  const instId = USUARIO_ACTUAL.institucion_id;
  const nivel  = USUARIO_ACTUAL.nivel; // para preceptor: filtrar alumnos por nivel

  const alumnosQuery = sb.from('alumnos')
    .select('id,nombre,apellido,curso_id,cursos!inner(id,nombre,division,nivel)')
    .eq('institucion_id', instId).eq('activo', true).order('apellido');

  const [famRes, alumnosRes] = await Promise.all([
    sb.from('usuarios').select('id,nombre_completo,email,activo')
      .eq('institucion_id', instId).eq('rol', 'familia').order('nombre_completo'),
    alumnosQuery,
  ]);

  _familiasData = famRes.data || [];
  let alumnosTodos = alumnosRes.data || [];
  if (nivel && USUARIO_ACTUAL.rol === 'preceptor') {
    alumnosTodos = alumnosTodos.filter(a => a.cursos?.nivel === nivel);
  }
  _famAlumnos = alumnosTodos;

  // Cargar vínculos filtrado por usuarios de esta institución
  const famIds = _familiasData.map(u => u.id);
  const vinculosRes = famIds.length
    ? await sb.from('familia_alumno').select('usuario_id,alumno_id').in('usuario_id', famIds)
    : { data: [] };

  // Mapear vínculos: usuario_id → [alumno_id, ...]
  const vinculoMap = {};
  (vinculosRes.data || []).forEach(v => {
    if (!vinculoMap[v.usuario_id]) vinculoMap[v.usuario_id] = [];
    vinculoMap[v.usuario_id].push(v.alumno_id);
  });

  // Mapear alumnos por id para lookup rápido
  const alumnoById = {};
  _famAlumnos.forEach(a => { alumnoById[a.id] = a; });

  sec.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>
        <div style="font-size:13px;font-weight:700">Usuarios Familias</div>
        <div style="font-size:11px;color:var(--txt3)">Acceso al portal de familias</div>
      </div>
      <button class="btn-p" style="font-size:12px" onclick="_abrirModalFamilia(null)">+ Nuevo</button>
    </div>
    <div id="fam-lista">
      ${_familiasData.length ? _familiasData.map(u => {
        const alumnosVinc = (vinculoMap[u.id] || []).map(aid => alumnoById[aid]).filter(Boolean);
        const alumnosLabel = alumnosVinc.length
          ? alumnosVinc.map(a => `${a.apellido}, ${a.nombre} (${a.cursos.nombre}${a.cursos.division||''})`).join(' · ')
          : '<span style="color:var(--txt3)">Sin alumnos vinculados</span>';
        return `
          <div class="adm-row" style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--brd)">
            <div class="avatar-circle" style="width:34px;height:34px;font-size:13px;flex-shrink:0">${(u.nombre_completo||'?').split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600">${u.nombre_completo}</div>
              <div style="font-size:11px;color:var(--txt2)">${u.email || ''}</div>
              <div style="font-size:11px;margin-top:2px">${alumnosLabel}</div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button class="btn-s" style="font-size:11px"
                onclick="_abrirModalFamilia('${u.id}')">Editar</button>
            </div>
          </div>`;
      }).join('') : '<div class="empty-state" style="padding:24px 0">Sin usuarios familias registrados</div>'}
    </div>
    <div id="fam-modal-wrap"></div>`;
}

function _abrirModalFamilia(userId) {
  const u = userId ? _familiasData.find(f => f.id === userId) : null;
  _famAlumnosSelIds = [];

  // Si es edición, pre-cargar vínculos existentes
  if (u) {
    // Traer vínculos del usuario y pre-seleccionar
    sb.from('familia_alumno').select('alumno_id').eq('usuario_id', userId)
      .then(({ data }) => {
        _famAlumnosSelIds = (data || []).map(v => v.alumno_id);
        _renderModalFamilia(u);
      });
  } else {
    _renderModalFamilia(null);
  }
}

function _renderModalFamilia(u) {
  const wrap = document.getElementById('fam-modal-wrap');
  if (!wrap) return;

  const esPreceptor = USUARIO_ACTUAL.rol === 'preceptor';

  // Niveles y cursos disponibles (de los alumnos cargados)
  const nivelesDisp = [...new Set(_famAlumnos.map(a => a.cursos?.nivel).filter(Boolean))].sort();
  const cursosDisp  = [...new Map(_famAlumnos.map(a => [a.curso_id, a.cursos])).values()].filter(Boolean)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const alumnosHtml = _buildAlumnosListHtml(_famAlumnos);

  const filtrosNivelCurso = esPreceptor ? '' : `
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <select id="fam-fil-nivel" onchange="_famFiltrarLista()" style="flex:1;font-size:12px">
        <option value="">Todos los niveles</option>
        ${nivelesDisp.map(n => `<option value="${n}">${NIVEL_LABELS_ADM[n]||n}</option>`).join('')}
      </select>
      <select id="fam-fil-curso" onchange="_famFiltrarLista()" style="flex:1;font-size:12px">
        <option value="">Todos los cursos</option>
        ${cursosDisp.map(c => `<option value="${c.id}">${c.nombre}${c.division||''}</option>`).join('')}
      </select>
    </div>`;

  wrap.innerHTML = `
    <div class="modal-overlay" onclick="_cerrarModalFamilia(event)"
      style="position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px">
      <div class="card" onclick="event.stopPropagation()"
        style="width:100%;max-width:480px;max-height:88vh;overflow-y:auto;padding:20px">

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-size:14px;font-weight:700">${u ? 'Editar usuario familia' : 'Nuevo usuario familia'}</div>
          <button onclick="_cerrarModalFamilia()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--txt2);line-height:1">×</button>
        </div>

        <div class="adm-form-row">
          <label class="adm-label">Nombre completo</label>
          <input type="text" id="fam-nombre" value="${_esc(u?.nombre_completo)}" placeholder="Ej: García, Ana">
        </div>
        <div class="adm-form-row">
          <label class="adm-label">Email</label>
          <input type="email" id="fam-email" value="${_esc(u?.email)}" placeholder="email@ejemplo.com"
            ${u ? 'readonly style="opacity:.6;cursor:default"' : ''}>
          ${u ? '<div style="font-size:10px;color:var(--txt2);margin-top:3px">El email no se puede cambiar.</div>' : ''}
        </div>
        <div class="adm-form-row">
          <label class="adm-label">${u ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
          <input type="password" id="fam-pass" placeholder="${u ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'}">
        </div>

        <div class="adm-form-row">
          <label class="adm-label">Alumnos vinculados</label>
          ${filtrosNivelCurso}
          <input type="text" id="fam-buscar-al" placeholder="Buscar por nombre..."
            oninput="_famFiltrarLista()" style="margin-bottom:8px;font-size:12px">
          <div id="fam-al-lista"
            style="max-height:210px;overflow-y:auto;border:1px solid var(--brd);border-radius:var(--rad);padding:4px">
            ${alumnosHtml}
          </div>
          <div id="fam-sel-count" style="font-size:10px;color:var(--txt3);margin-top:4px">
            ${_famAlumnosSelIds.length ? `${_famAlumnosSelIds.length} alumno(s) seleccionado(s)` : ''}
          </div>
        </div>

        <div id="fam-contactos-sugerencia"></div>

        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn-p" style="flex:1" onclick="_guardarFamilia('${u?.id || ''}')">
            ${u ? 'Guardar cambios' : 'Crear usuario'}
          </button>
          <button class="btn-s" onclick="_cerrarModalFamilia()">Cancelar</button>
        </div>
      </div>
    </div>`;

  _mostrarSugerenciasContacto();
}

function _buildAlumnosListHtml(alumnos) {
  if (!alumnos.length) return '<div style="padding:8px;font-size:12px;color:var(--txt3)">Sin alumnos disponibles</div>';
  return alumnos.map(a => {
    const sel = _famAlumnosSelIds.includes(a.id);
    return `<label data-alumno-id="${a.id}" data-nivel="${a.cursos?.nivel||''}" data-curso-id="${a.curso_id||''}"
      style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;${sel?'background:var(--verde-l)':''}">
      <input type="checkbox" value="${a.id}" ${sel?'checked':''}
        onchange="_toggleFamAlumno(this.value,this.checked)"
        style="accent-color:var(--verde);width:15px;height:15px;flex-shrink:0">
      <span style="font-size:12px">${_esc(a.apellido)}, ${_esc(a.nombre)}
        <span style="color:var(--txt3)">— ${_esc(a.cursos?.nombre||'')}${a.cursos?.division||''}</span>
      </span>
    </label>`;
  }).join('');
}

function _toggleFamAlumno(alumnoId, checked) {
  if (checked) {
    if (!_famAlumnosSelIds.includes(alumnoId)) _famAlumnosSelIds.push(alumnoId);
  } else {
    _famAlumnosSelIds = _famAlumnosSelIds.filter(id => id !== alumnoId);
  }
  document.querySelectorAll('#fam-al-lista label').forEach(lbl => {
    const cb = lbl.querySelector('input[type=checkbox]');
    lbl.style.background = cb?.checked ? 'var(--verde-l)' : '';
  });
  const cnt = document.getElementById('fam-sel-count');
  if (cnt) cnt.textContent = _famAlumnosSelIds.length ? `${_famAlumnosSelIds.length} alumno(s) seleccionado(s)` : '';
  _mostrarSugerenciasContacto();
}

function _famFiltrarLista() {
  const q      = (document.getElementById('fam-buscar-al')?.value || '').toLowerCase();
  const nivel  = document.getElementById('fam-fil-nivel')?.value || '';
  const cursoId= document.getElementById('fam-fil-curso')?.value || '';

  // Cuando cambia el nivel, recargar opciones de curso
  if (nivel) {
    const sel = document.getElementById('fam-fil-curso');
    if (sel) {
      const cursosDelNivel = [...new Map(
        _famAlumnos.filter(a => a.cursos?.nivel === nivel).map(a => [a.curso_id, a.cursos])
      ).values()].filter(Boolean).sort((a,b) => a.nombre.localeCompare(b.nombre));
      sel.innerHTML = `<option value="">Todos los cursos</option>` +
        cursosDelNivel.map(c => `<option value="${c.id}" ${c.id === cursoId?'selected':''}>${c.nombre}${c.division||''}</option>`).join('');
    }
  }

  document.querySelectorAll('#fam-al-lista label[data-alumno-id]').forEach(lbl => {
    const txt     = lbl.textContent.toLowerCase();
    const lNivel  = lbl.dataset.nivel  || '';
    const lCurso  = lbl.dataset.cursoId|| '';
    const ok = (!q || txt.includes(q)) && (!nivel || lNivel === nivel) && (!cursoId || lCurso === cursoId);
    lbl.style.display = ok ? '' : 'none';
  });
}

async function _mostrarSugerenciasContacto() {
  if (!_famAlumnosSelIds.length) {
    const div = document.getElementById('fam-contactos-sugerencia');
    if (div) div.innerHTML = '';
    return;
  }
  const { data: contactos } = await sb.from('contactos_alumno')
    .select('nombre,email,alumno_id')
    .in('alumno_id', _famAlumnosSelIds)
    .not('email', 'is', null);

  const div = document.getElementById('fam-contactos-sugerencia');
  if (!div) return;
  if (!contactos?.length) { div.innerHTML = ''; return; }

  const alumnoById = {};
  _famAlumnos.forEach(a => { alumnoById[a.id] = a; });

  div.innerHTML = `
    <div style="background:var(--azul-l);border-radius:var(--rad);padding:10px 12px">
      <div style="font-size:10px;font-weight:700;color:var(--txt2);margin-bottom:6px">EMAILS DE CONTACTOS REGISTRADOS</div>
      ${contactos.map(ct => {
        const al = alumnoById[ct.alumno_id];
        return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:11px">
            <span style="color:var(--txt3)">${ct.nombre || '—'} · ${al ? al.apellido+', '+al.nombre : ''}</span>
            <strong style="margin-left:6px">${ct.email}</strong>
          </span>
          <button class="btn-ghost" style="font-size:10px;padding:2px 8px"
            onclick="document.getElementById('fam-email').value='${ct.email}'">Usar</button>
        </div>`;
      }).join('')}
    </div>`;
}

function _cerrarModalFamilia(event) {
  if (event && event.target !== event.currentTarget) return;
  const wrap = document.getElementById('fam-modal-wrap');
  if (wrap) wrap.innerHTML = '';
}

async function _guardarFamilia(userId) {
  const nombre = document.getElementById('fam-nombre')?.value?.trim();
  const email  = document.getElementById('fam-email')?.value?.trim();
  const pass   = document.getElementById('fam-pass')?.value?.trim();
  const esNuevo = !userId;

  if (!nombre) { alert('El nombre es requerido.'); return; }
  if (esNuevo && !email) { alert('El email es requerido.'); return; }
  if (esNuevo && !pass)  { alert('La contraseña es requerida.'); return; }
  if (esNuevo && pass.length < 6) { alert('La contraseña debe tener al menos 6 caracteres.'); return; }
  if (!_famAlumnosSelIds.length)  { alert('Seleccioná al menos un alumno.'); return; }

  try {
    if (esNuevo) {
      await _llamarAdminUsers('crear_usuario_familia', {
        nombre_completo: nombre,
        email,
        password:    pass,
        alumno_ids:  _famAlumnosSelIds,
      });
    } else {
      await _llamarAdminUsers('actualizar_usuario_familia', {
        usuario_id:      userId,
        nombre_completo: nombre,
        alumno_ids:      _famAlumnosSelIds,
        password:        pass || null,
      });
    }
    _cerrarModalFamilia();
    await _renderFamilias();
    _toastOk(esNuevo ? 'Usuario familia creado correctamente' : 'Usuario familia actualizado');
  } catch (e) {
    alert('Error: ' + e.message);
  }
}
