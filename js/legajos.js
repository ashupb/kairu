// =====================================================
// LEGAJOS.JS — Módulo completo de legajos de alumnos
// =====================================================

let _legVista        = 'anios';   // 'anios' | 'cursos' | 'alumnos' | 'legajo'
let _legAnioSel      = null;
let _legCursoSel     = null;
let _legAlumnoSel    = null;
let _legTab          = 0;
let _legCursosAll    = [];         // todos los cursos (cargados una vez)
let _legAlumnosCache = [];
let _legSemMap       = {};

const NIVEL_COL = {
  inicial:    { bg:'var(--dor-l)',   fg:'var(--dorado)', txt:'Inicial' },
  primaria:   { bg:'var(--verde-l)', fg:'var(--verde)',  txt:'Primaria' },
  secundaria: { bg:'var(--azul-l)',  fg:'var(--azul)',   txt:'Secundaria' },
  terciaria:  { bg:'var(--rojo-l)',  fg:'var(--rojo)',   txt:'Terciaria' },
};
function nivCol(n) {
  return NIVEL_COL[n?.toLowerCase()] || { bg:'var(--gris-l)', fg:'var(--gris)', txt: n || '—' };
}

// Badge del curso: extrae número de nombre + división
// "Sala 5" + "A" → "5A" | "4°" + "B" → "4B" | "Año 1" + "A" → "1A"
function _cursoBadge(cur) {
  const m = (cur.nombre || '').match(/\d+/);
  return m ? m[0] + (cur.division || '') : ((cur.nombre || '?')[0].toUpperCase() + (cur.division || ''));
}

// Ciclo lectivo del curso: usa ciclo_lectivo si existe, sino año de created_at
function _cursoAnio(cur) {
  return cur.ciclo_lectivo || (cur.created_at ? new Date(cur.created_at).getFullYear() : new Date().getFullYear());
}

function legPermisos() {
  const r = USUARIO_ACTUAL?.rol;
  return {
    editarDatos:          ['director_general','directivo_nivel','admin','preceptor'].includes(r),
    editarContactos:      ['director_general','directivo_nivel','eoe','admin','preceptor'].includes(r),
    verEOE:               ['eoe','director_general','directivo_nivel','admin'].includes(r),
    agregarEOE:           r === 'eoe',
    agregarObservaciones: ['preceptor','docente','eoe','director_general','directivo_nivel','admin'].includes(r),
    verObsPrivadas:       ['eoe','director_general','directivo_nivel','admin'].includes(r),
    marcarPrivada:        ['eoe','director_general','directivo_nivel','admin'].includes(r),
    subirDocs:            ['director_general','directivo_nivel','admin'].includes(r),
  };
}

// Helper: buscar nombres de usuarios por IDs (evita FK joins problemáticos)
async function _fetchUserNames(ids) {
  if (!ids || !ids.length) return {};
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return {};
  const { data } = await sb.from('usuarios')
    .select('id,nombre_completo')
    .in('id', uniqueIds);
  return Object.fromEntries((data || []).map(u => [u.id, u.nombre_completo]));
}

// ── VISTA 1: SELECCIÓN DE AÑO LECTIVO ────────────────
async function rLeg() {
  showLoading('leg');
  inyectarEstilosLeg();
  const soloNivel = USUARIO_ACTUAL.rol === 'directivo_nivel' ? USUARIO_ACTUAL.nivel : null;
  try {
    let q = sb.from('cursos')
      .select('id,nombre,division,nivel,anio,ciclo_lectivo,created_at')
      .eq('institucion_id', USUARIO_ACTUAL.institucion_id);
    if (soloNivel) q = q.eq('nivel', soloNivel);
    const { data, error } = await q.order('nivel').order('nombre').order('division');

    // Si ciclo_lectivo no existe aún (schema viejo), reintenta sin ese campo
    if (error && (error.code === 'PGRST200' || error.message?.includes('ciclo_lectivo'))) {
      let q2 = sb.from('cursos')
        .select('id,nombre,division,nivel,anio,created_at')
        .eq('institucion_id', USUARIO_ACTUAL.institucion_id);
      if (soloNivel) q2 = q2.eq('nivel', soloNivel);
      const { data: d2, error: e2 } = await q2.order('nivel').order('nombre').order('division');
      if (e2) throw e2;
      _legCursosAll = d2 || [];
    } else {
      if (error) throw error;
      _legCursosAll = data || [];
    }

    const anios = [...new Set(_legCursosAll.map(_cursoAnio))].sort((a, b) => b - a);
    _legVista = 'anios';
    _legAnioSel = anios[0] || new Date().getFullYear();
    _renderLegAnios(anios);
  } catch(e) { showError('leg', 'Error: ' + e.message); }
}

function _renderLegAnios(anios) {
  const c = document.getElementById('page-leg');
  if (!anios || !anios.length) {
    c.innerHTML = `
      <div class="pg-t">Resumen del estudiante</div>
      <div class="pg-s">${INSTITUCION_ACTUAL?.nombre || ''}</div>
      <div class="empty-state">▤<br>Sin cursos registrados</div>`;
    return;
  }

  const cards = anios.map(a => `
    <div class="leg-anio-card" onclick="_abrirAnioLeg(${a})">
      <div class="leg-anio-num">${a}</div>
      <div style="font-size:10px;color:var(--txt2)">Ciclo lectivo</div>
      <div style="font-size:11px;color:var(--verde);margin-top:4px">
        ${_legCursosAll.filter(c => _cursoAnio(c) === a).length} cursos
      </div>
      <div class="leg-curso-arrow">›</div>
    </div>`).join('');

  c.innerHTML = `
    <div class="pg-t">Resumen del estudiante</div>
    <div class="pg-s">${INSTITUCION_ACTUAL?.nombre || ''} · Seleccioná el año lectivo</div>
    <div class="leg-anios-grid" style="margin-top:16px">${cards}</div>`;
}

function _abrirAnioLeg(anio) {
  _legAnioSel = anio;
  _legVista = 'cursos';
  _renderLegCursos(); // async, no need to await here
}

// ── VISTA 2: CURSOS DEL AÑO, AGRUPADOS POR NIVEL ─────
async function _renderLegCursos() {
  const c = document.getElementById('page-leg');
  c.innerHTML = '<div class="loading-state"><div class="spinner"></div><div>Cargando cursos...</div></div>';

  const cursos = _legCursosAll.filter(cur => _cursoAnio(cur) === _legAnioSel);

  // Contar alumnos por curso en un solo query
  const countMap = {};
  if (cursos.length) {
    const { data: alData } = await sb.from('alumnos')
      .select('curso_id')
      .in('curso_id', cursos.map(cu => cu.id))
      .eq('activo', true);
    (alData || []).forEach(a => { countMap[a.curso_id] = (countMap[a.curso_id] || 0) + 1; });
  }

  const porNivel = {};
  cursos.forEach(cur => {
    const niv = cur.nivel || 'sin nivel';
    if (!porNivel[niv]) porNivel[niv] = [];
    porNivel[niv].push(cur);
  });

  const html = Object.entries(porNivel).map(([nivel, lista]) => {
    const nc = nivCol(nivel);
    const cards = lista.map(cur => {
      const badge = _cursoBadge(cur);
      const cnt   = countMap[cur.id] || 0;
      return `
        <div class="leg-curso-card" onclick="abrirCursoLeg('${cur.id}')">
          <div class="leg-curso-badge" style="background:${nc.bg};color:${nc.fg}">${badge}</div>
          <div class="leg-curso-alumnos">${cnt} alumno${cnt !== 1 ? 's' : ''}</div>
        </div>`;
    }).join('');
    return `
      <div style="margin-bottom:18px">
        <div class="leg-nivel-header" style="color:${nc.fg}">${nc.txt}</div>
        <div class="leg-cursos-grid">${cards}</div>
      </div>`;
  }).join('') || '<div class="empty-state">▤<br>Sin cursos para este año</div>';

  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <button class="btn-ghost" onclick="rLeg()">‹ Años lectivos</button>
    </div>
    <div class="pg-t">Año lectivo ${_legAnioSel}</div>
    <div class="pg-s">${INSTITUCION_ACTUAL?.nombre || ''} · Seleccioná un curso</div>
    <div style="margin-top:12px">${html}</div>`;
}

// ── VISTA 3: ALUMNOS DEL CURSO ────────────────────────
async function abrirCursoLeg(cursoId) {
  const cur = _legCursosAll.find(c => c.id === cursoId);
  if (!cur) return;
  _legCursoSel = cur;
  _legVista = 'alumnos';

  const c = document.getElementById('page-leg');
  c.innerHTML = '<div class="loading-state"><div class="spinner"></div><div>Cargando alumnos...</div></div>';

  try {
    const { data, error } = await sb.from('alumnos')
      .select('id,nombre,apellido,dni,fecha_nacimiento,activo')
      .eq('curso_id', cursoId)
      .eq('activo', true)
      .order('apellido');
    if (error) throw error;
    _legAlumnosCache = data || [];

    await _cargarSemaforos(_legAlumnosCache.map(a => a.id));
    _renderLegAlumnos();
  } catch(e) { showError('leg', 'Error: ' + e.message); }
}

async function _cargarSemaforos(ids) {
  _legSemMap = {};
  if (!ids.length) return;
  try {
    const { data } = await sb.from('problematicas')
      .select('alumno_id,urgencia')
      .in('alumno_id', ids)
      .in('estado', ['abierta','en_seguimiento']);
    (data || []).forEach(p => {
      const cur = _legSemMap[p.alumno_id];
      if (p.urgencia === 'alta') {
        _legSemMap[p.alumno_id] = 'rojo';
      } else if (p.urgencia === 'media' && cur !== 'rojo') {
        _legSemMap[p.alumno_id] = 'amarillo';
      } else if (!cur) {
        _legSemMap[p.alumno_id] = 'verde';
      }
    });
  } catch(e) { /* sin problematicas — todo verde */ }
  ids.forEach(id => { if (!_legSemMap[id]) _legSemMap[id] = 'verde'; });
}

function _semClr(sem) {
  return sem === 'rojo' ? 'var(--rojo)' : sem === 'amarillo' ? 'var(--ambar)' : 'var(--verde)';
}

function _renderLegAlumnos() {
  const c  = document.getElementById('page-leg');
  const nc = nivCol(_legCursoSel?.nivel);
  const alumnos  = _legAlumnosCache;
  const rojos    = alumnos.filter(a => _legSemMap[a.id] === 'rojo').length;
  const amarillos= alumnos.filter(a => _legSemMap[a.id] === 'amarillo').length;

  const rows = alumnos.map(a => {
    const sem = _legSemMap[a.id] || 'verde';
    const ini = (a.apellido?.[0] || '') + (a.nombre?.[0] || '');
    return `
      <div class="leg-alumno-row" onclick="abrirLegajoAlumno('${a.id}')">
        <div class="av av32" style="background:${nc.bg};color:${nc.fg}">${ini}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:500">${a.apellido}, ${a.nombre}</div>
          ${a.dni ? `<div style="font-size:10px;color:var(--txt2)">DNI: ${a.dni}</div>` : ''}
        </div>
        <div class="leg-semaforo" style="background:${_semClr(sem)}" title="Semáforo: ${sem}"></div>
        <span style="font-size:13px;color:var(--txt2)">›</span>
      </div>`;
  }).join('') || '<div class="empty-state" style="padding:24px">◎<br>Sin alumnos en este curso</div>';

  const badge = _cursoBadge(_legCursoSel);
  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <button class="btn-ghost" onclick="_renderLegCursos()">‹ ${_legAnioSel}</button>
    </div>
    <div class="pg-t">${_legCursoSel.nombre} ${_legCursoSel.division || ''}</div>
    <div class="pg-s" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <span style="background:${nc.bg};color:${nc.fg};padding:2px 10px;border-radius:20px;font-size:10px;font-weight:600">${nc.txt}</span>
    </div>
    <div class="metrics m2" style="margin-top:12px;margin-bottom:12px">
      <div class="mc"><div class="mc-v" style="color:var(--rojo)">${rojos}</div><div class="mc-l">Situación crítica</div></div>
      <div class="mc"><div class="mc-v" style="color:var(--ambar)">${amarillos}</div><div class="mc-l">Requieren atención</div></div>
    </div>
    <div class="card" style="padding:0">${rows}</div>`;
}

// ── VISTA 4: LEGAJO INDIVIDUAL (TABS) ─────────────────
const LEG_TABS = [
  { id:'datos',         label:'Datos' },
  { id:'contactos',     label:'Contactos' },
  { id:'academico',     label:'Académico' },
  { id:'asistencia',    label:'Asistencia' },
  { id:'problematicas', label:'Situaciones' },
  { id:'objetivos',     label:'Objetivos' },
  { id:'eoe',           label:'EOE' },
  { id:'observaciones', label:'Notas' },
];

async function abrirLegajoAlumno(alumnoId) {
  const alumno = _legAlumnosCache.find(a => a.id === alumnoId);
  if (!alumno) return;
  _legAlumnoSel = alumno;
  _legTab = 0;
  _legVista = 'legajo';

  const c  = document.getElementById('page-leg');
  const nc = nivCol(_legCursoSel?.nivel);
  const sem= _legSemMap[alumnoId] || 'verde';
  const ini= (alumno.apellido?.[0] || '') + (alumno.nombre?.[0] || '');

  const tabsHtml = LEG_TABS.map((t, i) => `
    <button class="leg-tab-btn ${i === 0 ? 'on' : ''}" onclick="irTabLeg(${i})">${t.label}</button>`).join('');

  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <button class="btn-ghost" onclick="_renderLegAlumnos()">‹ ${_legCursoSel?.nombre || ''} ${_legCursoSel?.division || ''}</button>
    </div>

    <div class="card leg-header-card">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="av av40" style="background:${nc.bg};color:${nc.fg};font-size:14px;font-weight:700;position:relative;flex-shrink:0">
          ${ini}
          <div class="leg-sem-dot" style="background:${_semClr(sem)}"></div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:600">${alumno.apellido}, ${alumno.nombre}</div>
          <div style="font-size:11px;color:var(--txt2)">${_legCursoSel?.nombre || ''} ${_legCursoSel?.division || ''} · <span style="color:${nc.fg}">${nc.txt}</span></div>
          ${alumno.dni ? `<div style="font-size:10px;color:var(--txt3)">DNI: ${alumno.dni}</div>` : ''}
          ${alumno.fecha_nacimiento ? `<div style="font-size:10px;color:var(--txt3)">Nacimiento: ${formatFechaLatam(alumno.fecha_nacimiento)}</div>` : ''}
        </div>
      </div>
    </div>

    ${['director_general','directivo_nivel'].includes(USUARIO_ACTUAL?.rol) ? `
    <div style="margin-top:10px">
      <button id="leg-ia-btn" class="btn-s" style="font-size:11px;display:flex;align-items:center;gap:5px" onclick="_generarResumenIA('${alumno.id}')">✨ Generar resumen IA</button>
    </div>
    <div id="leg-ia-panel"></div>` : ''}

    <div class="leg-tabs-scroll">
      <div class="leg-tabs">${tabsHtml}</div>
    </div>
    <div id="leg-tab-contenido"></div>`;

  await _cargarTabLeg(0);
}

async function irTabLeg(idx) {
  _legTab = idx;
  document.querySelectorAll('.leg-tab-btn').forEach((b, i) => b.classList.toggle('on', i === idx));
  await _cargarTabLeg(idx);
}

async function _cargarTabLeg(idx) {
  const el = document.getElementById('leg-tab-contenido');
  if (!el) return;
  el.innerHTML = '<div class="loading-state small"><div class="spinner"></div></div>';
  const fns = {
    datos:         _tabDatos,
    contactos:     _tabContactos,
    academico:     _tabAcademico,
    asistencia:    _tabAsistencia,
    problematicas: _tabProblematicas,
    objetivos:     _tabObjetivos,
    eoe:           _tabEOE,
    observaciones: _tabObservaciones,
  };
  const fn = fns[LEG_TABS[idx].id];
  if (fn) await fn(el);
}

// ── TAB 0: DATOS ──────────────────────────────────────
async function _tabDatos(c) {
  const a = _legAlumnoSel;
  const p = legPermisos();

  const { data: al } = await sb.from('alumnos')
    .select('id,nombre,apellido,dni,fecha_nacimiento,observaciones_familiares')
    .eq('id', a.id).single();
  const alumno = al || a;

  if (p.editarDatos) {
    c.innerHTML = `
      <div class="card" style="margin-top:12px">
        <div class="sec-lb" style="margin-bottom:12px">Datos personales</div>
        <div class="leg-dato-grid">
          <div class="leg-dato">
            <label class="leg-dato-l">Apellido</label>
            <input type="text" id="leg-apellido" value="${alumno.apellido || ''}">
          </div>
          <div class="leg-dato">
            <label class="leg-dato-l">Nombre</label>
            <input type="text" id="leg-nombre" value="${alumno.nombre || ''}">
          </div>
          <div class="leg-dato">
            <label class="leg-dato-l">DNI</label>
            <input type="text" id="leg-dni" value="${alumno.dni || ''}">
          </div>
          <div class="leg-dato">
            <label class="leg-dato-l">Fecha de nacimiento</label>
            ${renderFechaInput('leg-fnac', alumno.fecha_nacimiento || '')}
          </div>
        </div>
        <button class="btn-p" style="margin-top:12px;font-size:11px" onclick="_guardarDatosAlumno('${alumno.id}')">Guardar datos</button>
      </div>
      <div class="card" style="margin-top:12px">
        <div class="sec-lb" style="margin-bottom:6px">Contexto familiar</div>
        <textarea id="leg-obs-fam" rows="3" placeholder="Información relevante del contexto familiar...">${alumno.observaciones_familiares || ''}</textarea>
        <button class="btn-p" style="margin-top:8px;font-size:11px" onclick="_guardarObsFam('${alumno.id}')">Guardar contexto</button>
      </div>`;
  } else {
    const obs_fam = alumno.observaciones_familiares || '';
    c.innerHTML = `
      <div class="card" style="margin-top:12px">
        <div class="sec-lb" style="margin-bottom:12px">Datos personales</div>
        <div class="leg-dato-grid">
          <div class="leg-dato"><span class="leg-dato-l">Apellido</span><span>${alumno.apellido}</span></div>
          <div class="leg-dato"><span class="leg-dato-l">Nombre</span><span>${alumno.nombre}</span></div>
          <div class="leg-dato"><span class="leg-dato-l">DNI</span><span>${alumno.dni || '—'}</span></div>
          <div class="leg-dato"><span class="leg-dato-l">Fecha de nac.</span><span>${alumno.fecha_nacimiento ? formatFechaLatam(alumno.fecha_nacimiento) : '—'}</span></div>
        </div>
        <div style="margin-top:14px;border-top:1px solid var(--brd);padding-top:12px">
          <div class="sec-lb" style="margin-bottom:6px">Contexto familiar</div>
          ${obs_fam
            ? `<div style="font-size:11px;color:var(--txt2);line-height:1.5">${obs_fam}</div>`
            : `<div style="font-size:11px;color:var(--txt3)">Sin información registrada.</div>`}
        </div>
      </div>`;
  }
}

async function _guardarDatosAlumno(alumnoId) {
  const apellido = document.getElementById('leg-apellido')?.value.trim();
  const nombre   = document.getElementById('leg-nombre')?.value.trim();
  if (!apellido || !nombre) { alert('Apellido y nombre son obligatorios.'); return; }
  const { error } = await sb.from('alumnos').update({
    apellido,
    nombre,
    dni:               document.getElementById('leg-dni')?.value.trim()  || null,
    fecha_nacimiento:  getFechaInput('leg-fnac')                          || null,
  }).eq('id', alumnoId);
  if (error) { alert('Error: ' + error.message); return; }
  // Actualizar cache local
  const idx = _legAlumnosCache.findIndex(a => a.id === alumnoId);
  if (idx >= 0) { _legAlumnosCache[idx].apellido = apellido; _legAlumnosCache[idx].nombre = nombre; }
  _legAlumnoSel.apellido = apellido;
  _legAlumnoSel.nombre   = nombre;
  alert('Datos guardados.');
}

async function _guardarObsFam(alumnoId) {
  const txt = document.getElementById('leg-obs-fam')?.value;
  const { error } = await sb.from('alumnos')
    .update({ observaciones_familiares: txt })
    .eq('id', alumnoId);
  if (error) alert('Error: ' + error.message);
  else alert('Guardado correctamente.');
}

// ── TAB 1: CONTACTOS ──────────────────────────────────
async function _tabContactos(c) {
  const p = legPermisos();
  try {
    const { data, error } = await sb.from('contactos_alumno')
      .select('id,nombre,tipo,telefono,email,es_principal')
      .eq('alumno_id', _legAlumnoSel.id)
      .order('es_principal', { ascending: false });
    if (error) throw error;
    const lista = data || [];

    const rows = lista.map(ct => `
      <div class="leg-contacto-row">
        <div style="display:flex;align-items:center;gap:8px">
          <div class="av av32" style="background:var(--azul-l);color:var(--azul)">
            ${ct.nombre?.[0]?.toUpperCase() || '?'}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:500;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              ${ct.nombre}
              ${ct.es_principal ? '<span class="tag tg" style="font-size:9px">Principal</span>' : ''}
            </div>
            <div style="font-size:10px;color:var(--txt2)">${ct.tipo || '—'}</div>
            ${ct.telefono ? `<div style="font-size:10px;color:var(--txt2)">☎ ${ct.telefono}</div>` : ''}
            ${ct.email    ? `<div style="font-size:10px;color:var(--txt2)">✉ ${ct.email}</div>`    : ''}
          </div>
        </div>
      </div>`).join('') || '<div style="font-size:11px;color:var(--txt2);padding:8px 0">Sin contactos registrados.</div>';

    c.innerHTML = `
      <div class="card" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div class="sec-lb" style="margin:0">Contactos y responsables</div>
          ${p.editarContactos ? '<button class="btn-p" style="font-size:11px" onclick="_mostrarFormContacto()">+ Agregar</button>' : ''}
        </div>
        ${rows}
        <div id="form-contacto"></div>
      </div>`;
  } catch(e) {
    c.innerHTML = `<div class="card" style="margin-top:12px">
      <div class="sec-lb" style="margin-bottom:8px">Contactos y responsables</div>
      <div style="font-size:11px;color:var(--txt2)">Sin contactos registrados.</div>
      ${legPermisos().editarContactos ? '<div id="form-contacto" style="margin-top:10px"></div>' : ''}
    </div>`;
    if (legPermisos().editarContactos) {
      // Agregar botón manualmente
      const card = c.querySelector('.card');
      if (card) {
        const btn = document.createElement('button');
        btn.className = 'btn-p';
        btn.style.fontSize = '11px';
        btn.style.marginBottom = '8px';
        btn.textContent = '+ Agregar contacto';
        btn.onclick = _mostrarFormContacto;
        card.insertBefore(btn, card.querySelector('#form-contacto'));
      }
    }
  }
}

function _mostrarFormContacto() {
  const fc = document.getElementById('form-contacto');
  if (!fc) return;
  if (fc.innerHTML) { fc.innerHTML = ''; return; }
  fc.innerHTML = `
    <div style="margin-top:12px;border-top:1px solid var(--brd);padding-top:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <input type="text" id="ct-nombre" placeholder="Nombre y apellido">
        <select id="ct-tipo">
          <option value="">Tipo de relación</option>
          <option>Madre</option><option>Padre</option><option>Tutor/a</option>
          <option>Abuela/o</option><option>Tío/a</option><option>Otro</option>
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <input type="text" id="ct-tel" placeholder="Teléfono">
        <input type="email" id="ct-email" placeholder="Email">
      </div>
      <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--txt2);margin-bottom:10px">
        <input type="checkbox" id="ct-principal"> Contacto principal
      </label>
      <div class="acc">
        <button class="btn-p" style="font-size:11px" onclick="_guardarContacto('${_legAlumnoSel?.id}')">Guardar</button>
        <button class="btn-s" style="font-size:11px" onclick="document.getElementById('form-contacto').innerHTML=''">Cancelar</button>
      </div>
    </div>`;
}

async function _guardarContacto(alumnoId) {
  const nombre = document.getElementById('ct-nombre')?.value.trim();
  if (!nombre) { alert('El nombre es obligatorio.'); return; }
  const { error } = await sb.from('contactos_alumno').insert({
    alumno_id: alumnoId,
    nombre,
    tipo:         document.getElementById('ct-tipo')?.value  || null,
    telefono:     document.getElementById('ct-tel')?.value   || null,
    email:        document.getElementById('ct-email')?.value || null,
    es_principal: document.getElementById('ct-principal')?.checked || false,
  });
  if (error) { alert('Error: ' + error.message); return; }
  await _tabContactos(document.getElementById('leg-tab-contenido'));
}

// ── TAB 2: ACADÉMICO ──────────────────────────────────
async function _tabAcademico(c) {
  try {
    const { data, error } = await sb.from('calificaciones')
      .select('nota, ausente, materia_id, periodo_id, materias(nombre), instancias_evaluativas(nombre,fecha)')
      .eq('alumno_id', _legAlumnoSel.id)
      .order('materias(nombre)');

    if (error) {
      c.innerHTML = `<div class="card" style="margin-top:12px"><div class="empty-state">≡<br>Sin calificaciones registradas.</div></div>`;
      return;
    }

    const lista = (data || []).filter(n => !n.ausente && n.nota !== null);
    if (!lista.length) {
      c.innerHTML = `<div class="card" style="margin-top:12px"><div class="empty-state">≡<br>Sin calificaciones registradas.</div></div>`;
      return;
    }

    const porMateria = {};
    lista.forEach(n => {
      const m = n.materias?.nombre || '—';
      if (!porMateria[m]) porMateria[m] = [];
      porMateria[m].push(n);
    });

    const rows = Object.entries(porMateria).map(([mat, ns]) => {
      const vals = ns.map(n => n.nota).filter(v => v !== null);
      const prom = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--brd)">
          <div style="font-size:11px;font-weight:500;flex:1">${mat}</div>
          <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
            ${ns.map(n => `<span class="nota-chip ${NC(n.nota)}" title="${n.instancias_evaluativas?.nombre || ''}">${n.nota}</span>`).join('')}
            ${prom !== null ? `<span class="nota-chip ${NC(prom)}" style="font-weight:700;margin-left:4px">${prom.toFixed(1)}</span>` : ''}
          </div>
        </div>`;
    }).join('');

    c.innerHTML = `
      <div class="card" style="margin-top:12px">
        <div class="sec-lb" style="margin-bottom:10px">Calificaciones por materia</div>
        ${rows}
        <div style="font-size:10px;color:var(--txt3);margin-top:8px">El número en negrita es el promedio por materia.</div>
      </div>`;
  } catch(e) {
    c.innerHTML = `<div class="card" style="margin-top:12px"><div class="empty-state">≡<br>Sin calificaciones registradas.</div></div>`;
  }
}

// ── TAB 3: ASISTENCIA ─────────────────────────────────
async function _tabAsistencia(c) {
  try {
    const { data, error } = await sb.from('asistencia')
      .select('fecha,estado,hora_clase,materia_id')
      .eq('alumno_id', _legAlumnoSel.id)
      .order('fecha', { ascending: false })
      .limit(60);
    if (error) throw error;
    const lista = data || [];

    if (!lista.length) {
      c.innerHTML = `<div class="card" style="margin-top:12px"><div class="empty-state">✓<br>Sin registros de asistencia.</div></div>`;
      return;
    }

    const ausentes   = lista.filter(r => r.estado === 'ausente').length;
    const mediaFalta = lista.filter(r => r.estado === 'media_falta').length;
    const tardanzas  = lista.filter(r => r.estado === 'tardanza').length;
    // Días únicos para calcular % de asistencia
    const diasUnicos = [...new Set(lista.filter(r => !r.hora_clase).map(r => r.fecha))];
    const ausentesDias = lista.filter(r => !r.hora_clase && r.estado === 'ausente').map(r => r.fecha);
    const ausDiasUnicos = [...new Set(ausentesDias)].length;
    const pct = diasUnicos.length ? Math.round(((diasUnicos.length - ausDiasUnicos) / diasUnicos.length) * 100) : 100;
    const pcClr = pct >= 85 ? 'var(--verde)' : pct >= 75 ? 'var(--ambar)' : 'var(--rojo)';

    const ESTADO_LABEL = {
      presente:'Presente', ausente:'Ausente', media_falta:'Media falta',
      tardanza:'Tardanza', justificado:'Justificado',
    };
    const rows = lista.slice(0, 30).map(r => {
      const clr = r.estado === 'presente' || r.estado === 'justificado'
        ? 'var(--verde)' : r.estado === 'ausente' ? 'var(--rojo)' : 'var(--ambar)';
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--brd)">
          <div style="width:8px;height:8px;border-radius:50%;background:${clr};flex-shrink:0"></div>
          <div style="font-size:11px;flex:1">${formatFechaLatam(r.fecha)}${r.hora_clase ? ' · <span style="color:var(--txt3)">'+r.hora_clase+'</span>' : ''}</div>
          <div style="font-size:10px;color:${clr};font-weight:500">${ESTADO_LABEL[r.estado] || r.estado}</div>
        </div>`;
    }).join('');

    c.innerHTML = `
      <div class="card" style="margin-top:12px">
        <div class="metrics m3" style="margin-bottom:14px">
          <div class="mc"><div class="mc-v" style="color:${pcClr}">${pct}%</div><div class="mc-l">Asistencia</div></div>
          <div class="mc"><div class="mc-v" style="color:var(--rojo)">${ausentes}</div><div class="mc-l">Inasistencias</div></div>
          <div class="mc"><div class="mc-v" style="color:var(--ambar)">${tardanzas + mediaFalta}</div><div class="mc-l">Tardanzas/medias</div></div>
        </div>
        <div class="sec-lb" style="margin-bottom:8px">Últimos registros</div>
        ${rows}
      </div>`;
  } catch(e) {
    c.innerHTML = `<div class="card" style="margin-top:12px"><div class="empty-state">✓<br>Sin registros de asistencia.</div></div>`;
  }
}

// ── TAB 4: PROBLEMÁTICAS ──────────────────────────────
async function _tabProblematicas(c) {
  const id = 'leg-probs-' + _legAlumnoSel.id;
  c.innerHTML = `<div id="${id}" style="margin-top:12px"></div>`;
  await cargarProbAlumno(_legAlumnoSel.id, id);
}

// ── TAB: OBJETIVOS ────────────────────────────────────
async function _tabObjetivos(c) {
  const alumnoId = _legAlumnoSel.id;
  try {
    const { data } = await sb.from('objetivo_incidentes')
      .select('*, obj:objetivos!objetivo_incidentes_objetivo_id_fkey(nombre,categoria), reg:usuarios!objetivo_incidentes_registrado_por_fkey(nombre_completo)')
      .eq('alumno_id', alumnoId)
      .order('created_at', { ascending: false });
    const incs = data || [];
    const catColor = { academico:'var(--azul)', conductual:'var(--rojo)', convivencial:'var(--verde)', institucional:'var(--dorado)' };
    const html = incs.length ? incs.map(i => `
      <div style="padding:8px 0;border-bottom:1px solid var(--brd)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:3px">
          <div style="font-size:11px;font-weight:600">${i.obj?.nombre||'—'}</div>
          ${i.obj?.categoria ? `<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:${catColor[i.obj.categoria]+'22'};color:${catColor[i.obj.categoria]};flex-shrink:0">${i.obj.categoria}</span>` : ''}
        </div>
        <div style="font-size:11px;color:var(--txt2)">${i.accion_tomada}</div>
        ${i.medida ? `<div style="font-size:10px;color:var(--txt3)">Medida: ${i.medida}</div>` : ''}
        <div style="font-size:10px;color:var(--txt3);margin-top:2px">${i.reg?.nombre_completo||'—'} · ${formatFechaCorta(i.created_at)}</div>
      </div>`).join('') : '<div style="font-size:11px;color:var(--txt2);padding:8px 0">Sin incidentes de objetivos registrados.</div>';
    c.innerHTML = `
      <div class="card" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div class="sec-lb" style="margin:0">Incidentes en objetivos</div>
          <button class="btn-s" style="font-size:10px" onclick="goPage('obj')">Ver objetivos →</button>
        </div>
        ${html}
      </div>`;
  } catch(e) {
    c.innerHTML = '<div class="card" style="margin-top:12px"><div style="font-size:11px;color:var(--txt2)">Sin incidentes de objetivos registrados.</div></div>';
  }
}

// ── TAB 5: EOE ────────────────────────────────────────
async function _tabEOE(c) {
  const p = legPermisos();
  if (!p.verEOE) {
    c.innerHTML = `<div class="card" style="margin-top:12px"><div class="empty-state">✦<br>Sin acceso a registros EOE.</div></div>`;
    return;
  }
  try {
    const { data, error } = await sb.from('intervenciones_eoe')
      .select('id,tipo,descripcion,derivacion,fecha,created_at,registrado_por')
      .eq('alumno_id', _legAlumnoSel.id)
      .order('fecha', { ascending: false });
    if (error) throw error;
    const lista = data || [];

    const usersMap = await _fetchUserNames(lista.map(i => i.registrado_por));

    const rows = lista.map(i => `
      <div style="padding:10px 0;border-bottom:1px solid var(--brd)">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:4px">
          <div style="font-size:11px;font-weight:600;color:var(--azul)">${i.tipo || 'Intervención EOE'}</div>
          <div style="font-size:10px;color:var(--txt3)">${formatFechaLatam(i.fecha)}</div>
        </div>
        <div style="font-size:11px;color:var(--txt);line-height:1.5">${i.descripcion}</div>
        ${i.derivacion ? `<div style="font-size:10px;color:var(--txt2);margin-top:4px">Derivación: ${i.derivacion}</div>` : ''}
        <div style="font-size:10px;color:var(--txt3);margin-top:4px">${usersMap[i.registrado_por] || '—'}</div>
      </div>`).join('') || '<div style="font-size:11px;color:var(--txt2);padding:8px 0">Sin intervenciones EOE registradas.</div>';

    c.innerHTML = `
      <div class="card" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div class="sec-lb" style="margin:0">Intervenciones EOE</div>
          ${p.agregarEOE ? `<button class="btn-p" style="font-size:11px" onclick="_mostrarFormEOE('${_legAlumnoSel.id}')">+ Registrar</button>` : ''}
        </div>
        ${rows}
        <div id="form-eoe"></div>
      </div>`;
  } catch(e) {
    c.innerHTML = `<div class="card" style="margin-top:12px">
      <div class="sec-lb" style="margin-bottom:8px">Intervenciones EOE</div>
      <div style="font-size:11px;color:var(--txt2)">Sin intervenciones registradas.</div>
      <div id="form-eoe"></div>
    </div>`;
  }
}

function _mostrarFormEOE(alumnoId) {
  const fc = document.getElementById('form-eoe');
  if (!fc) return;
  if (fc.innerHTML) { fc.innerHTML = ''; return; }
  fc.innerHTML = `
    <div style="margin-top:12px;border-top:1px solid var(--brd);padding-top:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <select id="eoe-tipo">
          <option value="">Tipo de intervención</option>
          <option>Entrevista individual</option><option>Entrevista familiar</option>
          <option>Derivación externa</option><option>Reunión de equipo</option>
          <option>Seguimiento</option><option>Otro</option>
        </select>
        ${renderFechaInput('eoe-fecha', hoyISO())}
      </div>
      <textarea id="eoe-desc" rows="3" placeholder="Descripción de la intervención..."></textarea>
      <input type="text" id="eoe-deriv" placeholder="Derivación a (si aplica)" style="margin-top:8px">
      <div class="acc" style="margin-top:10px">
        <button class="btn-p" style="font-size:11px" onclick="_guardarIntervencionEOE('${alumnoId}')">Guardar</button>
        <button class="btn-s" style="font-size:11px" onclick="document.getElementById('form-eoe').innerHTML=''">Cancelar</button>
      </div>
    </div>`;
}

async function _guardarIntervencionEOE(alumnoId) {
  const desc = document.getElementById('eoe-desc')?.value.trim();
  if (!desc) { alert('La descripción es obligatoria.'); return; }
  const { error } = await sb.from('intervenciones_eoe').insert({
    alumno_id:      alumnoId,
    registrado_por: USUARIO_ACTUAL.id,
    tipo:           document.getElementById('eoe-tipo')?.value  || null,
    descripcion:    desc,
    derivacion:     document.getElementById('eoe-deriv')?.value || null,
    fecha:          getFechaInput('eoe-fecha')                  || hoyISO(),
  });
  if (error) { alert('Error: ' + error.message); return; }
  await _tabEOE(document.getElementById('leg-tab-contenido'));
}

// ── TAB 6: OBSERVACIONES ─────────────────────────────
async function _tabObservaciones(c) {
  const p = legPermisos();
  try {
    const { data, error } = await sb.from('observaciones_legajo')
      .select('id,texto,privada,created_at,registrado_por')
      .eq('alumno_id', _legAlumnoSel.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const lista = (data || []).filter(o => !o.privada || p.verObsPrivadas);
    const usersMap = await _fetchUserNames(lista.map(o => o.registrado_por));

    const canEdit = legPermisos().agregarObservaciones;
    const rows = lista.map(o => `
      <div id="obs-row-${o.id}" style="padding:10px 0;border-bottom:1px solid var(--brd)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div style="font-size:10px;color:var(--txt3)">${usersMap[o.registrado_por] || '—'} · ${tiempoDesde(o.created_at)}</div>
          <div style="display:flex;gap:6px;align-items:center">
            ${o.privada ? '<span class="tag td" style="font-size:9px">Privada</span>' : ''}
            ${canEdit && o.registrado_por === USUARIO_ACTUAL.id
              ? `<button class="btn-ghost" style="font-size:10px;padding:2px 6px" onclick="_editarObs('${o.id}','${(o.texto||'').replace(/'/g,"\\'")}')">Editar</button>`
              : ''}
          </div>
        </div>
        <div id="obs-txt-${o.id}" style="font-size:11px;color:var(--txt);line-height:1.5">${o.texto}</div>
        <div id="obs-edit-${o.id}" style="display:none;margin-top:6px">
          <textarea id="obs-ta-${o.id}" rows="2" style="margin-bottom:6px"></textarea>
          <div style="display:flex;gap:6px">
            <button class="btn-p" style="font-size:10px" onclick="_guardarEditObs('${o.id}')">Guardar</button>
            <button class="btn-s" style="font-size:10px" onclick="_cancelarEditObs('${o.id}')">Cancelar</button>
          </div>
        </div>
      </div>`).join('') || '<div style="font-size:11px;color:var(--txt2);padding:8px 0">Sin observaciones registradas.</div>';

    c.innerHTML = `
      <div class="card" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div class="sec-lb" style="margin:0">Observaciones</div>
          ${p.agregarObservaciones ? '<button class="btn-p" style="font-size:11px" onclick="_mostrarFormObs()">+ Agregar</button>' : ''}
        </div>
        ${rows}
        <div id="form-obs"></div>
      </div>`;
  } catch(e) {
    c.innerHTML = `<div class="card" style="margin-top:12px">
      <div class="sec-lb" style="margin-bottom:8px">Observaciones</div>
      <div style="font-size:11px;color:var(--txt2)">Sin observaciones registradas.</div>
      <div id="form-obs"></div>
    </div>`;
  }
}

function _mostrarFormObs() {
  const fc = document.getElementById('form-obs');
  if (!fc) return;
  if (fc.innerHTML) { fc.innerHTML = ''; return; }
  const p = legPermisos();
  fc.innerHTML = `
    <div style="margin-top:12px;border-top:1px solid var(--brd);padding-top:12px">
      <textarea id="obs-texto" rows="3" placeholder="Escribí tu observación..."></textarea>
      ${p.marcarPrivada ? `<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--txt2);margin-top:8px">
        <input type="checkbox" id="obs-privada"> Solo visible para EOE y Dirección
      </label>` : ''}
      <div class="acc" style="margin-top:10px">
        <button class="btn-p" style="font-size:11px" onclick="_guardarObservacion('${_legAlumnoSel?.id}')">Guardar</button>
        <button class="btn-s" style="font-size:11px" onclick="document.getElementById('form-obs').innerHTML=''">Cancelar</button>
      </div>
    </div>`;
}

function _editarObs(obsId, textoActual) {
  const editDiv = document.getElementById('obs-edit-' + obsId);
  const txtDiv  = document.getElementById('obs-txt-'  + obsId);
  const ta      = document.getElementById('obs-ta-'   + obsId);
  if (!editDiv || !ta) return;
  ta.value = textoActual;
  editDiv.style.display = 'block';
  if (txtDiv) txtDiv.style.display = 'none';
  ta.focus();
}

function _cancelarEditObs(obsId) {
  const editDiv = document.getElementById('obs-edit-' + obsId);
  const txtDiv  = document.getElementById('obs-txt-'  + obsId);
  if (editDiv) editDiv.style.display = 'none';
  if (txtDiv)  txtDiv.style.display  = 'block';
}

async function _guardarEditObs(obsId) {
  const ta = document.getElementById('obs-ta-' + obsId);
  const texto = ta?.value.trim();
  if (!texto) { alert('Escribí el texto.'); return; }
  const { error } = await sb.from('observaciones_legajo')
    .update({ texto })
    .eq('id', obsId);
  if (error) { alert('Error: ' + error.message); return; }
  await _tabObservaciones(document.getElementById('leg-tab-contenido'));
}

async function _guardarObservacion(alumnoId) {
  const texto = document.getElementById('obs-texto')?.value.trim();
  if (!texto) { alert('Escribí una observación.'); return; }
  const { error } = await sb.from('observaciones_legajo').insert({
    alumno_id:      alumnoId,
    registrado_por: USUARIO_ACTUAL.id,
    texto,
    privada: document.getElementById('obs-privada')?.checked || false,
  });
  if (error) { alert('Error: ' + error.message); return; }
  await _tabObservaciones(document.getElementById('leg-tab-contenido'));
}

// ── TAB 7: DOCUMENTACIÓN ─────────────────────────────
async function _tabDocs(c) {
  const p = legPermisos();
  try {
    const { data, error } = await sb.from('documentacion_alumno')
      .select('id,nombre,tipo,url,created_at,subido_por')
      .eq('alumno_id', _legAlumnoSel.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const lista = data || [];

    const usersMap = await _fetchUserNames(lista.map(d => d.subido_por));

    const rows = lista.map(d => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--brd)">
        <div style="font-size:20px;flex-shrink:0">▤</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-weight:500">${d.nombre}</div>
          <div style="font-size:10px;color:var(--txt2)">${d.tipo || '—'} · ${usersMap[d.subido_por] || '—'}</div>
          <div style="font-size:10px;color:var(--txt3)">${tiempoDesde(d.created_at)}</div>
        </div>
        ${d.url ? `<a href="${d.url}" target="_blank" class="btn-s" style="font-size:10px;padding:4px 10px;text-decoration:none;display:inline-block;flex-shrink:0">Ver</a>` : ''}
      </div>`).join('') || '<div style="font-size:11px;color:var(--txt2);padding:8px 0">Sin documentos cargados.</div>';

    c.innerHTML = `
      <div class="card" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div class="sec-lb" style="margin:0">Documentación</div>
          ${p.subirDocs ? `<button class="btn-p" style="font-size:11px" onclick="_mostrarFormDoc('${_legAlumnoSel.id}')">+ Agregar</button>` : ''}
        </div>
        ${rows}
        <div id="form-doc"></div>
      </div>`;
  } catch(e) {
    c.innerHTML = `<div class="card" style="margin-top:12px">
      <div class="sec-lb" style="margin-bottom:8px">Documentación</div>
      <div style="font-size:11px;color:var(--txt2)">Sin documentos cargados.</div>
      <div id="form-doc"></div>
    </div>`;
  }
}

function _mostrarFormDoc(alumnoId) {
  const fc = document.getElementById('form-doc');
  if (!fc) return;
  if (fc.innerHTML) { fc.innerHTML = ''; return; }
  fc.innerHTML = `
    <div style="margin-top:12px;border-top:1px solid var(--brd);padding-top:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <input type="text" id="doc-nombre" placeholder="Nombre del documento">
        <select id="doc-tipo">
          <option value="">Tipo</option>
          <option>DNI</option><option>Partida de nacimiento</option>
          <option>Certificado médico</option><option>Constancia CUIL</option>
          <option>Informe escolar</option><option>Otro</option>
        </select>
      </div>
      <input type="url" id="doc-url" placeholder="URL del documento (Google Drive, etc.)" style="margin-bottom:8px">
      <div class="acc">
        <button class="btn-p" style="font-size:11px" onclick="_guardarDoc('${alumnoId}')">Guardar</button>
        <button class="btn-s" style="font-size:11px" onclick="document.getElementById('form-doc').innerHTML=''">Cancelar</button>
      </div>
    </div>`;
}

async function _guardarDoc(alumnoId) {
  const nombre = document.getElementById('doc-nombre')?.value.trim();
  if (!nombre) { alert('El nombre es obligatorio.'); return; }
  const { error } = await sb.from('documentacion_alumno').insert({
    alumno_id:  alumnoId,
    subido_por: USUARIO_ACTUAL.id,
    nombre,
    tipo: document.getElementById('doc-tipo')?.value || null,
    url:  document.getElementById('doc-url')?.value  || null,
  });
  if (error) { alert('Error: ' + error.message); return; }
  await _tabDocs(document.getElementById('leg-tab-contenido'));
}

// ── IA: RESUMEN DEL ALUMNO ────────────────────────────
async function _generarResumenIA(alumnoId) {
  const btn   = document.getElementById('leg-ia-btn');
  const panel = document.getElementById('leg-ia-panel');
  if (!btn || !panel) return;

  btn.disabled    = true;
  btn.textContent = 'Generando...';
  panel.innerHTML = `
    <div class="loading-state small" style="margin-top:8px">
      <div class="spinner"></div>
      <div style="font-size:11px;color:var(--txt2)">Generando resumen...</div>
    </div>`;

  try {
    // Queries secuenciales para loguear cada error por separado
    const asistRes = await sb.from('asistencia')
      .select('estado,fecha,hora_clase')
      .eq('alumno_id', alumnoId)
      .order('fecha', { ascending: false })
      .limit(90);
    if (asistRes.error) console.error('[IA] asistencia:', asistRes.error);

    const notasRes = await sb.from('calificaciones')
      .select('nota,materias(nombre)')
      .eq('alumno_id', alumnoId)
      .not('nota', 'is', null);
    if (notasRes.error) console.error('[IA] calificaciones:', notasRes.error);

    // Problematicas individuales (alumno_id directo en la tabla)
    const probDirRes = await sb.from('problematicas')
      .select('tipo,urgencia,estado,descripcion')
      .eq('alumno_id', alumnoId)
      .in('estado', ['abierta','en_seguimiento']);
    if (probDirRes.error) console.error('[IA] problematicas directas:', probDirRes.error);

    // Problematicas grupales: el alumno aparece en problematica_alumnos
    let probGrupales = [];
    const probAlRes = await sb.from('problematica_alumnos')
      .select('problematica_id')
      .eq('alumno_id', alumnoId);
    if (!probAlRes.error && probAlRes.data?.length) {
      const grpIds = probAlRes.data.map(r => r.problematica_id);
      const { data: pg } = await sb.from('problematicas')
        .select('tipo,urgencia,estado,descripcion')
        .in('id', grpIds)
        .in('estado', ['abierta','en_seguimiento']);
      probGrupales = pg || [];
    }

    // Intervenciones EOE del alumno
    const eoeRes = await sb.from('intervenciones_eoe')
      .select('tipo,descripcion,fecha')
      .eq('alumno_id', alumnoId)
      .order('fecha', { ascending: false })
      .limit(5);
    if (eoeRes.error) console.error('[IA] eoe:', eoeRes.error);

    const obsRes = await sb.from('observaciones_legajo')
      .select('texto,privada,created_at')
      .eq('alumno_id', alumnoId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (obsRes.error) console.error('[IA] observaciones:', obsRes.error);

    // Calcular % asistencia — días únicos sin hora_clase, solo lunes a viernes
    const asistencia   = asistRes.data || [];
    const esDiaHabil   = (f) => { const d = new Date(f + 'T12:00:00').getDay(); return d !== 0 && d !== 6; };
    const diasUnicos   = [...new Set(asistencia.filter(r => !r.hora_clase && esDiaHabil(r.fecha)).map(r => r.fecha))];
    const ausDias      = [...new Set(asistencia.filter(r => !r.hora_clase && r.estado === 'ausente' && esDiaHabil(r.fecha)).map(r => r.fecha))];
    const diasTotal    = diasUnicos.length;
    const diasAusentes = ausDias.length;
    const pctAsist     = diasTotal ? Math.round(((diasTotal - diasAusentes) / diasTotal) * 100) : null;

    // Agrupar notas por materia
    const porMateria = {};
    (notasRes.data || []).forEach(n => {
      const m = n.materias?.nombre || '—';
      if (!porMateria[m]) porMateria[m] = [];
      porMateria[m].push(n.nota);
    });
    const resumenNotas = Object.entries(porMateria).map(([mat, ns]) => ({
      materia:  mat,
      promedio: (ns.reduce((a, b) => a + b, 0) / ns.length).toFixed(1),
    }));

    const todasSituaciones = [
      ...(probDirRes.data || []),
      ...probGrupales,
    ].map(p => ({
      tipo:       p.tipo,
      urgencia:   p.urgencia,
      estado:     p.estado === 'abierta' ? 'Sin atender' : 'En seguimiento',
      seguimiento: p.estado === 'abierta'
        ? 'Sin intervenciones registradas — requiere seguimiento'
        : 'Con intervenciones registradas',
    }));

    const payload = {
      alumno:              `${_legAlumnoSel.apellido}, ${_legAlumnoSel.nombre}`,
      curso:               `${_legCursoSel?.nombre || ''} ${_legCursoSel?.division || ''}`.trim(),
      nivel:               _legCursoSel?.nivel || '',
      semaforo:            _legSemMap[alumnoId] || 'verde',
      asistencia_pct:      pctAsist,
      dias_total:          diasTotal || null,
      dias_ausentes:       diasAusentes || null,
      calificaciones:      resumenNotas,
      situaciones_activas: todasSituaciones,
      intervenciones_eoe:  (eoeRes.data || []).map(e => `${e.tipo || 'Intervención'}: ${e.descripcion} (${e.fecha})`),
      observaciones:       (obsRes.data || []).filter(o => !o.privada).map(o => o.texto),
    };

    console.log('[IA] payload enviado:', JSON.stringify(payload, null, 2));

    const resultado = await llamarIA('sintesis_legajo', payload);
    if (!resultado) throw new Error('Sin respuesta');

    panel.innerHTML = `
      <div class="card" style="margin-top:8px;background:var(--verde-l);border-color:var(--verde)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:11px;font-weight:600;color:var(--verde)">✨ Resumen generado por IA</div>
          <button class="btn-ghost" style="font-size:10px" onclick="navigator.clipboard.writeText(document.getElementById('leg-ia-text').textContent)">Copiar</button>
        </div>
        <div id="leg-ia-text" style="font-size:11px;color:var(--txt);line-height:1.6;white-space:pre-wrap">${resultado}</div>
        <div style="font-size:9px;color:var(--txt3);margin-top:8px">Generado con IA · Solo orientativo</div>
      </div>`;
  } catch(e) {
    panel.innerHTML = `
      <div style="font-size:11px;color:var(--rojo);margin-top:8px;padding:10px;background:var(--rojo-l);border-radius:8px">
        No se pudo generar el texto. Intentá más tarde.
      </div>`;
  } finally {
    if (btn) {
      btn.disabled    = false;
      btn.textContent = '✨ Generar resumen IA';
      btn.style.display = 'flex';
    }
  }
}

// ── ESTILOS ───────────────────────────────────────────
function inyectarEstilosLeg() {
  if (document.getElementById('leg-styles')) return;
  const s = document.createElement('style');
  s.id = 'leg-styles';
  s.textContent = `
    .leg-anios-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px}
    .leg-anio-card{background:var(--surf);border:1px solid var(--brd);border-radius:var(--rad);padding:18px 14px;cursor:pointer;display:flex;flex-direction:column;gap:4px;transition:box-shadow .15s,border-color .15s;position:relative}
    .leg-anio-card:hover{box-shadow:0 2px 10px rgba(0,0,0,.1);border-color:var(--verde)}
    .leg-anio-num{font-family:'Lora',serif;font-size:22px;font-weight:600;color:var(--verde)}
    .leg-anio-card .leg-curso-arrow{position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:16px}
    .leg-nivel-header{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;padding-left:2px}
    .leg-cursos-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
    .leg-curso-card{background:var(--surf);border:1px solid var(--brd);border-radius:var(--rad);padding:18px 12px 14px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;transition:box-shadow .15s,border-color .15s}
    .leg-curso-card:hover{box-shadow:0 2px 10px rgba(0,0,0,.1);border-color:var(--verde)}
    .leg-curso-badge{font-family:'Lora',serif;font-size:22px;font-weight:700;width:56px;height:56px;border-radius:14px;display:flex;align-items:center;justify-content:center}
    .leg-curso-alumnos{font-size:10px;color:var(--txt2);font-weight:400}
    .leg-alumno-row{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--brd);transition:background .1s}
    .leg-alumno-row:last-child{border-bottom:none}
    .leg-alumno-row:hover{background:var(--surf2)}
    .leg-semaforo{width:10px;height:10px;border-radius:50%;flex-shrink:0}
    .leg-header-card{margin-top:12px;margin-bottom:0}
    .leg-sem-dot{position:absolute;bottom:-1px;right:-1px;width:11px;height:11px;border-radius:50%;border:2px solid var(--surf)}
    .leg-tabs-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-top:12px;padding-bottom:2px}
    .leg-tabs{display:flex;gap:4px;min-width:max-content}
    .leg-tab-btn{background:var(--surf);border:1px solid var(--brd);border-radius:20px;padding:5px 13px;font-size:11px;font-weight:500;cursor:pointer;color:var(--txt2);font-family:'DM Sans',sans-serif;white-space:nowrap;transition:all .12s}
    .leg-tab-btn.on{background:var(--verde);color:#fff;border-color:var(--verde)}
    .leg-tab-btn:hover:not(.on){background:var(--verde-l);color:var(--verde);border-color:var(--verde)}
    .leg-dato-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .leg-dato{display:flex;flex-direction:column;gap:3px}
    .leg-dato-l{font-size:10px;color:var(--txt2);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
    .leg-contacto-row{padding:10px 0;border-bottom:1px solid var(--brd)}
    .leg-contacto-row:last-child{border-bottom:none}
    .nota-chip{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:22px;border-radius:6px;font-size:11px;font-weight:600;padding:0 6px}
    .nota-ok{background:var(--verde-l);color:var(--verde)}
    .nota-warn{background:var(--amb-l);color:var(--ambar)}
    .nota-risk{background:var(--rojo-l);color:var(--rojo)}
    .btn-ghost{background:none;border:none;cursor:pointer;color:var(--verde);font-size:12px;font-weight:500;padding:3px 8px;border-radius:6px;font-family:'DM Sans',sans-serif;transition:background .12s}
    .btn-ghost:hover{background:var(--verde-l)}
    @media(max-width:600px){
      .leg-anios-grid,.leg-cursos-grid{grid-template-columns:repeat(2,1fr)}
      .leg-dato-grid{grid-template-columns:1fr}
    }
  `;
  document.head.appendChild(s);
}
