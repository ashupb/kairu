// =====================================================
// OBJETIVOS INSTITUCIONALES
// =====================================================

let _objVista = 'lista';
let _objDetalleId = null;
let _objFiltros = { categoria: '', estado: '' };
let _objCache = [];

const CAT_OBJ = {
  academico:     { label:'Académico',     color:'var(--azul)',   bg:'var(--azul-l)',  tag:'tp' },
  conductual:    { label:'Conductual',    color:'var(--rojo)',   bg:'var(--rojo-l)',  tag:'tr' },
  convivencial:  { label:'Convivencial',  color:'var(--verde)',  bg:'var(--verde-l)', tag:'tg' },
  institucional: { label:'Institucional', color:'var(--dorado)', bg:'var(--dor-l)',   tag:'td' },
};
const TENDENCIA_OBJ = {
  mejorando:  { label:'Mejorando',  icon:'↑', color:'var(--verde)' },
  estable:    { label:'Estable',    icon:'→', color:'var(--ambar)' },
  empeorando: { label:'Empeorando', icon:'↓', color:'var(--rojo)'  },
};
const ESTADO_OBJ = {
  activo:    { label:'Activo',    tag:'tg'  },
  en_riesgo: { label:'En riesgo', tag:'tr'  },
  logrado:   { label:'Logrado',   tag:'tp'  },
  archivado: { label:'Archivado', tag:'tgr' },
};

function _objPuedeEditar() {
  return ['director_general','directivo_nivel','admin','preceptor'].includes(USUARIO_ACTUAL?.rol);
}
function _objPuedeRegistrarInc() {
  return ['director_general','directivo_nivel','admin','preceptor','docente'].includes(USUARIO_ACTUAL?.rol);
}

async function rObj() {
  showLoading('obj');
  try {
    const { data, error } = await sb.from('objetivos')
      .select('*, incs:objetivo_incidentes(count)')
      .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    _objCache = data || [];
    if (_objVista === 'detalle' && _objDetalleId) {
      await _rObjDetalle(_objDetalleId);
    } else {
      _objVista = 'lista';
      _rObjLista();
    }
  } catch(e) { showError('obj', 'Error: ' + e.message); }
}

function _rObjLista() {
  const c   = document.getElementById('page-obj');
  const vis = _objCache.filter(o => o.estado !== 'archivado');
  const activos    = vis.filter(o => o.estado === 'activo').length;
  const enRiesgo   = vis.filter(o => o.estado === 'en_riesgo').length;
  const logrados   = vis.filter(o => o.estado === 'logrado').length;
  const empeorando = vis.filter(o => o.tendencia === 'empeorando').length;

  const cats = Object.entries(CAT_OBJ).map(([k,v]) =>
    `<option value="${k}" ${_objFiltros.categoria===k?'selected':''}>${v.label}</option>`).join('');
  const ests = Object.entries(ESTADO_OBJ).map(([k,v]) =>
    `<option value="${k}" ${_objFiltros.estado===k?'selected':''}>${v.label}</option>`).join('');

  c.innerHTML = `
    <div class="pg-t">Objetivos institucionales</div>
    <div class="pg-s">${INSTITUCION_ACTUAL?.nombre||''} · Ciclo ${new Date().getFullYear()}</div>
    <div class="metrics m4">
      <div class="mc"><div class="mc-v" style="color:var(--verde)">${activos}</div><div class="mc-l">Activos</div></div>
      <div class="mc"><div class="mc-v" style="color:var(--rojo)">${enRiesgo}</div><div class="mc-l">En riesgo</div></div>
      <div class="mc"><div class="mc-v" style="color:var(--azul)">${logrados}</div><div class="mc-l">Logrados</div></div>
      <div class="mc"><div class="mc-v" style="color:var(--ambar)">${empeorando}</div><div class="mc-l">Empeorando</div></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="sec-lb" style="margin:0">Objetivos</div>
      ${_objPuedeEditar()?'<button class="btn-p" onclick="_abrirFormObj()">+ Nuevo</button>':''}
    </div>
    <div style="margin-bottom:12px">
      <div style="font-size:10px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Filtros</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <select style="font-size:11px;padding:5px 8px;border:1px solid var(--brd);border-radius:var(--rad);background:var(--surf);color:var(--txt)" onchange="_objFiltros.categoria=this.value;_renderCardsObj()">
          <option value="">Todas las categorías</option>${cats}
        </select>
        <select style="font-size:11px;padding:5px 8px;border:1px solid var(--brd);border-radius:var(--rad);background:var(--surf);color:var(--txt)" onchange="_objFiltros.estado=this.value;_renderCardsObj()">
          <option value="">Todos los estados</option>${ests}
        </select>
      </div>
    </div>
    <div id="obj-cards"></div>`;
  _renderCardsObj();
}

function _renderCardsObj() {
  let lista = [..._objCache];
  if (!_objFiltros.estado)    lista = lista.filter(o => o.estado !== 'archivado');
  if (_objFiltros.categoria)  lista = lista.filter(o => o.categoria === _objFiltros.categoria);
  if (_objFiltros.estado)     lista = lista.filter(o => o.estado    === _objFiltros.estado);
  // Filtrar por nivel del usuario (directores ven todo)
  const rolUser = USUARIO_ACTUAL?.rol;
  if (!['director_general','admin'].includes(rolUser) && USUARIO_ACTUAL?.nivel) {
    lista = lista.filter(o => !o.nivel || o.nivel === USUARIO_ACTUAL.nivel);
  }
  const cont = document.getElementById('obj-cards');
  if (!cont) return;
  if (!lista.length) { cont.innerHTML = '<div class="empty-state">🎯<br>No hay objetivos con ese filtro.</div>'; return; }
  cont.innerHTML = lista.map(obj => {
    const cat  = CAT_OBJ[obj.categoria]       || CAT_OBJ.institucional;
    const tnd  = TENDENCIA_OBJ[obj.tendencia] || TENDENCIA_OBJ.estable;
    const est  = ESTADO_OBJ[obj.estado]       || ESTADO_OBJ.activo;
    const prog     = obj.progreso ?? obj.cumplimiento ?? 0;
    const incCount = obj.incs?.[0]?.count ?? 0;
    const semClr   = obj.estado==='en_riesgo'?'var(--rojo)':obj.estado==='logrado'?'var(--azul)':obj.estado==='archivado'?'var(--txt3)':'var(--verde)';
    const esActivo = ['activo','en_riesgo'].includes(obj.estado);
    return `
      <div class="card" style="margin-bottom:10px">
        <div style="display:flex;align-items:flex-start;gap:10px;cursor:pointer" onclick="_abrirDetalleObj('${obj.id}')">
          <div style="width:10px;height:10px;border-radius:50%;background:${semClr};margin-top:3px;flex-shrink:0"></div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:4px">
              <div style="font-size:12px;font-weight:600;line-height:1.3">${obj.nombre}</div>
              <div style="display:flex;gap:4px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
                <span class="tag ${cat.tag}">${cat.label}</span>
                <span class="tag ${est.tag}">${est.label}</span>
              </div>
            </div>
            <div style="font-size:10px;color:var(--txt2);margin-bottom:6px">${obj.responsable_texto||'—'}</div>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--txt3);margin-bottom:3px">
              <span style="color:${tnd.color};font-weight:600">${tnd.icon} ${tnd.label}</span>
              <span>${prog}% · ${incCount} incidente${incCount!==1?'s':''}</span>
            </div>
            <div class="bb"><div class="bf" style="width:${prog}%;background:${cat.color}"></div></div>
          </div>
        </div>
        ${esActivo && _objPuedeRegistrarInc() ? `
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--brd);display:flex;gap:6px">
          <button class="btn-s" style="font-size:10px;padding:4px 10px"
            onclick="_abrirFormInc('${obj.id}')">+ Registrar incidente</button>
          <button class="btn-s" style="font-size:10px;padding:4px 10px"
            onclick="_abrirDetalleObj('${obj.id}')">Ver detalle →</button>
        </div>` : ''}
      </div>`;
  }).join('');
}

async function _abrirDetalleObj(objId) {
  _objVista = 'detalle';
  _objDetalleId = objId;
  await _rObjDetalle(objId);
}

async function _rObjDetalle(objId) {
  const c = document.getElementById('page-obj');
  c.innerHTML = '<div style="padding:16px"><div class="loading-state"><div class="spinner"></div></div></div>';
  const obj = _objCache.find(o => o.id === objId);
  if (!obj) { _objVista='lista'; _rObjLista(); return; }

  const [incsRes, hitosRes] = await Promise.all([
    sb.from('objetivo_incidentes')
      .select('*, reg:usuarios!objetivo_incidentes_registrado_por_fkey(nombre_completo), alm:alumnos!objetivo_incidentes_alumno_id_fkey(nombre,apellido)')
      .eq('objetivo_id', objId).order('created_at', { ascending: false }),
    sb.from('objetivo_hitos')
      .select('*, reg:usuarios!objetivo_hitos_registrado_por_fkey(nombre_completo)')
      .eq('objetivo_id', objId).order('created_at', { ascending: true }),
  ]);

  const respNombre = obj.responsable_texto || '—';
  const incs  = incsRes.data  || [];
  const hitos = hitosRes.data || [];
  const cat   = CAT_OBJ[obj.categoria]       || CAT_OBJ.institucional;
  const tnd   = TENDENCIA_OBJ[obj.tendencia] || TENDENCIA_OBJ.estable;
  const est   = ESTADO_OBJ[obj.estado]       || ESTADO_OBJ.activo;
  const prog  = obj.progreso ?? obj.cumplimiento ?? 0;
  const esActivo = ['activo','en_riesgo'].includes(obj.estado);

  const hitosHTML = hitos.length ? hitos.map(h => `
    <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px">
      <div style="width:8px;height:8px;border-radius:50%;margin-top:3px;flex-shrink:0;border:2px solid ${h.logrado?'var(--verde)':'var(--txt3)'};background:${h.logrado?'var(--verde)':'transparent'}"></div>
      <div>
        <div style="font-size:11px;font-weight:600${h.logrado?';text-decoration:line-through;color:var(--txt2)':''}">${h.titulo}</div>
        ${h.descripcion?`<div style="font-size:10px;color:var(--txt2)">${h.descripcion}</div>`:''}
        <div style="font-size:10px;color:var(--txt3)">${h.reg?.nombre_completo||'—'} · ${formatFechaCorta(h.created_at)}</div>
      </div>
    </div>`).join('') : '<div style="font-size:11px;color:var(--txt2)">Sin hitos registrados.</div>';

  const incsHTML = incs.length ? incs.map(i => {
    const nom     = i.alm ? `${i.alm.apellido}, ${i.alm.nombre}` : (i.descripcion_alumno || null);
    const inicAl  = nom ? nom.split(/[\s,]+/).filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase() : null;
    const desc    = i.descripcion || null;
    return `
      <div style="padding:10px 0;border-bottom:1px solid var(--brd)">
        ${nom ? `
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px">
          <div style="width:26px;height:26px;border-radius:50%;background:var(--rojo-l);color:var(--rojo);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0">${inicAl}</div>
          <div>
            <div style="font-size:12px;font-weight:600">${nom}</div>
            ${i.curso_texto?`<div style="font-size:10px;color:var(--txt3)">${i.curso_texto}</div>`:''}
          </div>
          <span style="margin-left:auto;font-size:9px;background:var(--verde-l);color:var(--verde);padding:2px 6px;border-radius:10px;flex-shrink:0">En legajo</span>
        </div>` : ''}
        ${desc ? `<div style="font-size:11px;color:var(--txt2);margin-bottom:4px;font-style:italic">"${desc}"</div>` : ''}
        <div style="font-size:11px;color:var(--txt);font-weight:500">${i.accion_tomada}</div>
        ${i.medida?`<div style="font-size:10px;color:var(--ambar);margin-top:2px">⚠ Medida: ${i.medida}</div>`:''}
        <div style="font-size:10px;color:var(--txt3);margin-top:3px">${i.reg?.nombre_completo||'—'} · ${formatFechaCorta(i.created_at)}</div>
      </div>`}).join('') : '<div style="font-size:11px;color:var(--txt2);padding:8px 0">Sin incidentes registrados.</div>';

  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <button class="btn-s" style="padding:4px 10px;font-size:11px" onclick="_volverListaObj()">‹ Volver</button>
      <div class="pg-t" style="margin:0;flex:1">${obj.nombre}</div>
    </div>
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        <span class="tag ${cat.tag}">${cat.label}</span>
        <span class="tag ${est.tag}">${est.label}</span>
        <span style="font-size:11px;font-weight:600;color:${tnd.color}">${tnd.icon} ${tnd.label}</span>
      </div>
      ${obj.descripcion?`<div style="font-size:12px;color:var(--txt2);margin-bottom:10px">${obj.descripcion}</div>`:''}
      ${(obj.meta_descripcion||obj.meta)?`<div style="font-size:11px;margin-bottom:10px"><b>Meta:</b> ${obj.meta_descripcion||obj.meta}</div>`:''}
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--txt3);margin-bottom:4px"><span>Progreso</span><span>${prog}%</span></div>
      <div class="bb" style="margin-bottom:10px"><div class="bf" style="width:${prog}%;background:${cat.color}"></div></div>
      <div style="font-size:11px;color:var(--txt2);display:grid;grid-template-columns:1fr 1fr;gap:4px">
        <span style="grid-column:1/-1"><b>Responsable${(obj.responsable_ids?.length??0)>1?'s':''}:</b> ${respNombre}</span>
        ${obj.fecha_inicio   ?`<span><b>Inicio:</b> ${formatFechaCorta(obj.fecha_inicio)}</span>`   :'<span></span>'}
        ${obj.fecha_cierre   ?`<span><b>Cierre:</b> ${formatFechaCorta(obj.fecha_cierre)}</span>`   :'<span></span>'}
        ${obj.fecha_revision ?`<span><b>Revisión:</b> ${formatFechaCorta(obj.fecha_revision)}</span>`:'<span></span>'}
      </div>
    </div>
    ${(obj.estado==='logrado'||obj.estado==='archivado')&&obj.conclusion?`
    <div class="card" style="margin-bottom:12px;border-left:3px solid var(--azul)">
      <div style="font-size:11px;font-weight:600;margin-bottom:4px">Nota de cierre</div>
      <div style="font-size:11px;color:var(--txt2)">${obj.conclusion}</div>
    </div>`:''}
    ${_renderGraficoIncs(incs)}
    <div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="sec-lb" style="margin:0">Incidentes (${incs.length})</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${_objPuedeRegistrarInc()&&esActivo?`<button class="btn-p" style="font-size:11px" onclick="_abrirFormInc('${objId}')">+ Registrar</button>`:''}
          ${_objPuedeEditar()&&obj.categoria==='conductual'&&esActivo?`<button class="btn-s" style="font-size:11px" onclick="_importarTardanzas('${objId}')">Importar tardanzas</button>`:''}
        </div>
      </div>
      ${incsHTML}
      ${_objPuedeRegistrarInc()&&esActivo?`<button class="btn-p" style="font-size:11px;width:100%;margin-top:10px" onclick="_abrirFormInc('${objId}')">+ Registrar incidente</button>`:''}
    </div>
    <div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="sec-lb" style="margin:0">Hitos</div>
        ${_objPuedeEditar()?`<button class="btn-s" style="font-size:11px" onclick="_abrirFormHito('${objId}')">+ Hito</button>`:''}
      </div>
      ${hitosHTML}
    </div>
    ${_objPuedeEditar()?`
    <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--brd)">
      <button class="btn-s" style="font-size:11px" onclick="_abrirFormObj('${objId}')">Editar</button>
      ${esActivo?`<button class="btn-p" style="font-size:11px" onclick="_abrirCierreObj('${objId}')">Cerrar objetivo</button>`:''}
      ${!esActivo?`<button class="btn-s" style="font-size:11px" onclick="_reabrirObj('${objId}')">Reabrir</button>`:''}
    </div>`:''}`;
}

function _renderGraficoIncs(incs) {
  if (incs.length < 3) return '';
  const grupos = {};
  incs.forEach(i => { const mes=i.created_at.slice(0,7); grupos[mes]=(grupos[mes]||0)+1; });
  const entries = Object.entries(grupos).sort(([a],[b])=>a.localeCompare(b)).slice(-6);
  if (entries.length < 2) return '';
  const max = Math.max(...entries.map(([,v])=>v));
  const bars = entries.map(([mes,n]) => {
    const h = Math.round((n/max)*56)+4;
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1">
      <span style="font-size:9px;color:var(--txt3)">${n}</span>
      <div style="width:100%;height:${h}px;background:var(--azul-l);border-radius:3px 3px 0 0"></div>
      <span style="font-size:9px;color:var(--txt3)">${mes.slice(5)}/${mes.slice(2,4)}</span>
    </div>`;
  }).join('');
  return `
    <div class="card" style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:600;margin-bottom:8px;color:var(--txt2)">Evolución de incidentes</div>
      <div style="display:flex;align-items:flex-end;gap:4px;height:76px">${bars}</div>
    </div>`;
}

function _volverListaObj() {
  _objVista = 'lista'; _objDetalleId = null; _rObjLista();
}

function _objModal(modalId, titulo, html, btns) {
  document.getElementById(modalId)?.remove();
  const el = document.createElement('div');
  el.id = modalId;
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.46);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
  el.innerHTML = `
    <div style="background:var(--surf);border-radius:var(--rad-lg);width:100%;max-width:500px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.24)">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--brd);flex-shrink:0">
        <span style="font-size:14px;font-weight:600">${titulo}</span>
        <button onclick="_cerrarModalObj('${modalId}')" style="background:none;border:none;cursor:pointer;font-size:20px;color:var(--txt2);padding:0 4px;line-height:1">×</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:16px 18px">${html}</div>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--brd);flex-shrink:0">${btns}</div>
    </div>`;
  document.body.appendChild(el);
}
function _cerrarModalObj(id) { document.getElementById(id)?.remove(); }

function _toastObj(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1B2B22;color:#fff;padding:10px 20px;border-radius:10px;font-size:12px;font-weight:500;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.25);white-space:nowrap;max-width:90vw;overflow:hidden;text-overflow:ellipsis;transition:opacity .3s';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

async function _abrirFormObj(objId) {
  const obj = objId ? _objCache.find(o=>o.id===objId) : null;
  const usrRes = await sb.from('usuarios').select('id,nombre_completo,rol')
    .eq('institucion_id', USUARIO_ACTUAL.institucion_id).or('activo.is.null,activo.eq.true')
    .order('rol').order('nombre_completo');
  const cats = Object.entries(CAT_OBJ).map(([k,v]) =>
    `<option value="${k}" ${obj?.categoria===k?'selected':''}>${v.label}</option>`).join('');
  const nivelesOpts = ['primario','secundario','terciario'].map(n =>
    `<option value="${n}" ${obj?.nivel===n?'selected':''}>${n[0].toUpperCase()+n.slice(1)}</option>`).join('');

  const selectedIds = obj?.responsable_ids?.length ? obj.responsable_ids
    : (obj?.responsable_id ? [obj.responsable_id] : []);
  const respChks = (usrRes.data||[]).map(u => `
    <label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;padding:3px 0">
      <input type="checkbox" class="fo-resp-chk" value="${u.id}" data-nombre="${u.nombre_completo}" data-rol="${u.rol}" ${selectedIds.includes(u.id)?'checked':''}>
      <span style="flex:1">${u.nombre_completo}</span>
      <span style="font-size:9px;color:var(--txt3)">${u.rol}</span>
    </label>`).join('');

  const prog = obj?.progreso ?? obj?.cumplimiento ?? 0;
  const html = `
    <div style="display:grid;gap:10px">
      <div><label class="lbl">Nombre *</label>
        <input type="text" id="fo-nombre" value="${obj?.nombre||''}" placeholder="Nombre del objetivo"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><label class="lbl">Categoría</label>
          <select id="fo-cat" style="width:100%"><option value="">Sin categoría</option>${cats}</select></div>
        <div><label class="lbl">Nivel</label>
          <select id="fo-nivel" style="width:100%"><option value="">General</option>${nivelesOpts}</select></div>
      </div>
      <div><label class="lbl">Descripción</label>
        <textarea id="fo-desc" rows="2" placeholder="Contexto...">${obj?.descripcion||''}</textarea></div>
      <div><label class="lbl">Meta / Criterio de éxito</label>
        <textarea id="fo-meta" rows="2" placeholder="¿Qué queremos lograr y cómo lo mediremos?">${obj?.meta_descripcion||obj?.meta||''}</textarea></div>
      <div>
        <label class="lbl">Responsables</label>
        <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap">
          <button type="button" class="btn-s" style="font-size:10px;padding:3px 8px" onclick="_selRespRol('docente')">Todos docentes</button>
          <button type="button" class="btn-s" style="font-size:10px;padding:3px 8px" onclick="_selRespRol('preceptor')">Todos preceptores</button>
          <button type="button" class="btn-s" style="font-size:10px;padding:3px 8px" onclick="_selRespRol('')">Desmarcar todos</button>
        </div>
        <div style="border:1px solid var(--brd);border-radius:var(--rad);max-height:140px;overflow-y:auto;padding:6px 10px">${respChks||'<div style="font-size:11px;color:var(--txt2)">Sin usuarios</div>'}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><label class="lbl">Fecha inicio</label>
          <input type="date" id="fo-inicio" value="${obj?.fecha_inicio||''}"></div>
        <div><label class="lbl">Fecha cierre estimada</label>
          <input type="date" id="fo-cierre" value="${obj?.fecha_cierre||''}"></div>
      </div>
      <div><label class="lbl">Progreso actual (%)</label>
        <input type="number" id="fo-prog" min="0" max="100" value="${prog}"></div>
    </div>`;
  const btns = `
    <button class="btn-s" onclick="_cerrarModalObj('modal-form-obj')">Cancelar</button>
    <button class="btn-p" onclick="_guardarFormObj('${objId||''}')">${obj?'Guardar cambios':'Crear objetivo'}</button>`;
  _objModal('modal-form-obj', obj?'Editar objetivo':'Nuevo objetivo', html, btns);
}

function _selRespRol(rol) {
  const chks = document.querySelectorAll('.fo-resp-chk');
  if (rol === '') { chks.forEach(c => c.checked = false); }
  else { chks.forEach(c => { if (c.dataset.rol === rol) c.checked = true; }); }
}

async function _guardarFormObj(objId) {
  const nombre = document.getElementById('fo-nombre')?.value.trim();
  if (!nombre) { alert('El nombre es obligatorio.'); return; }
  const respChks = [...document.querySelectorAll('.fo-resp-chk:checked')];
  const responsable_ids   = respChks.map(c => c.value);
  const responsable_texto = respChks.map(c => c.dataset.nombre).join(', ') || null;
  const payload = {
    nombre,
    categoria:        document.getElementById('fo-cat')?.value   || null,
    nivel:            document.getElementById('fo-nivel')?.value  || null,
    descripcion:      document.getElementById('fo-desc')?.value   || null,
    meta_descripcion: document.getElementById('fo-meta')?.value   || null,
    responsable_ids:  responsable_ids.length ? responsable_ids : null,
    responsable_texto,
    fecha_inicio:     document.getElementById('fo-inicio')?.value || null,
    fecha_cierre:     document.getElementById('fo-cierre')?.value || null,
    progreso: Math.min(100, Math.max(0, parseInt(document.getElementById('fo-prog')?.value)||0)),
    updated_at: new Date().toISOString(),
  };
  const btn = document.querySelector('#modal-form-obj .btn-p');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  let error;
  if (objId) {
    ({ error } = await sb.from('objetivos').update(payload).eq('id', objId));
  } else {
    ({ error } = await sb.from('objetivos').insert({
      ...payload, institucion_id: USUARIO_ACTUAL.institucion_id,
      creado_por: USUARIO_ACTUAL.id, estado: 'activo', tendencia: 'estable',
    }));
  }
  if (error) {
    if (btn) { btn.disabled = false; btn.textContent = objId ? 'Guardar cambios' : 'Crear objetivo'; }
    alert('Error: ' + error.message);
    return;
  }
  _cerrarModalObj('modal-form-obj');
  _toastObj(`✓ Objetivo ${objId ? 'actualizado' : 'creado'} correctamente`);
  if (objId) _objDetalleId = objId;
  await rObj();
}

async function _abrirFormInc(objId) {
  const cursosRes = await sb.from('cursos').select('id,nombre,division,anio,nivel')
    .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
    .or('activo.is.null,activo.eq.true').order('nivel').order('anio');
  const cursoOpts = (cursosRes.data||[]).map(cu => {
    const lbl = [cu.anio ? cu.anio+'°' : '', cu.nombre, cu.division||''].filter(Boolean).join(' ');
    return `<option value="${cu.id}">${lbl}</option>`;
  }).join('');

  const hoy = new Date().toISOString().slice(0,10);
  const html = `
    <div style="display:grid;gap:10px">
      <div style="background:var(--verde-l);border:1px solid rgba(34,153,87,0.2);border-radius:var(--rad);padding:10px 12px">
        <div style="font-size:11px;font-weight:700;color:var(--verde);margin-bottom:8px">Alumno involucrado</div>
        <div style="display:grid;gap:6px">
          <div><label class="lbl">Curso</label>
            <select id="inc-curso" onchange="_incCargaAlumnos(this.value)">
              <option value="">— Seleccioná un curso —</option>${cursoOpts}
            </select></div>
          <div id="inc-alumno-wrap"><label class="lbl">Alumno</label>
            <select id="inc-alumno" onchange="_incMostrarInfo(this)">
              <option value="">— Primero seleccioná el curso —</option>
            </select></div>
          <div id="inc-alumno-info" style="display:none;background:var(--surf);border-radius:var(--rad);padding:8px 10px;font-size:11px;border:1px solid var(--brd)"></div>
        </div>
        <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--txt3);margin-top:8px;cursor:pointer">
          <input type="checkbox" id="inc-sin-alumno" onchange="_incToggleSinAlumno(this.checked)">
          Sin alumno específico (incidente institucional)
        </label>
      </div>
      <div><label class="lbl">Descripción del incidente *</label>
        <textarea id="inc-desc" rows="3" placeholder="Describí qué ocurrió, cuándo y en qué contexto..."></textarea></div>
      <div><label class="lbl">Acción tomada *</label>
        <textarea id="inc-accion" rows="2" placeholder="¿Qué se hizo al respecto?"></textarea></div>
      <div><label class="lbl">Medida adoptada (opcional)</label>
        <input type="text" id="inc-medida" placeholder="Ej: Llamado a padres, amonestación, acuerdo de convivencia..."></div>
      <div><label class="lbl">Fecha</label>
        <input type="date" id="inc-fecha" value="${hoy}" style="max-width:180px"></div>
    </div>`;
  const btns = `
    <button class="btn-s" onclick="_cerrarModalObj('modal-form-inc')">Cancelar</button>
    <button class="btn-p" onclick="_guardarInc('${objId}')">Registrar incidente</button>`;
  _objModal('modal-form-inc', 'Registrar incidente', html, btns);
}

function _incToggleSinAlumno(sinAlumno) {
  const wrap = document.getElementById('inc-alumno-wrap');
  const cur  = document.getElementById('inc-curso');
  const info = document.getElementById('inc-alumno-info');
  if (wrap) wrap.style.opacity = sinAlumno ? '0.4' : '1';
  if (cur)  cur.disabled = sinAlumno;
  const sel = document.getElementById('inc-alumno');
  if (sel)  sel.disabled = sinAlumno;
  if (info) info.style.display = 'none';
}

async function _incCargaAlumnos(cursoId) {
  const sel  = document.getElementById('inc-alumno');
  const info = document.getElementById('inc-alumno-info');
  if (!sel) return;
  if (!cursoId) {
    sel.innerHTML = '<option value="">— Primero seleccioná el curso —</option>';
    if (info) info.style.display = 'none';
    return;
  }
  sel.innerHTML = '<option>Cargando...</option>';
  const { data } = await sb.from('alumnos').select('id,nombre,apellido,dni,fecha_nacimiento')
    .eq('curso_id', cursoId).or('activo.is.null,activo.eq.true').order('apellido');
  sel.innerHTML = '<option value="">— Seleccioná un alumno —</option>' +
    (data||[]).map(a=>`<option value="${a.id}" data-nombre="${a.apellido}, ${a.nombre}" data-dni="${a.dni||''}">${a.apellido}, ${a.nombre}</option>`).join('');
  if (info) info.style.display = 'none';
}

function _incMostrarInfo(sel) {
  const info = document.getElementById('inc-alumno-info');
  if (!info) return;
  const opt = sel.options[sel.selectedIndex];
  if (!sel.value || !opt) { info.style.display = 'none'; return; }
  const nombre = opt.dataset.nombre || opt.text;
  const dni    = opt.dataset.dni;
  info.style.display = 'block';
  info.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px">
      <div style="width:28px;height:28px;border-radius:50%;background:var(--verde);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0">
        ${nombre.split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase()}
      </div>
      <div>
        <div style="font-weight:600">${nombre}</div>
        ${dni ? `<div style="color:var(--txt3)">DNI ${dni}</div>` : ''}
      </div>
      <span style="margin-left:auto;font-size:9px;background:var(--verde-l);color:var(--verde);padding:2px 6px;border-radius:10px;font-weight:600">Se registrará en su legajo</span>
    </div>`;
}

async function _guardarInc(objId) {
  const desc   = document.getElementById('inc-desc')?.value.trim();
  const accion = document.getElementById('inc-accion')?.value.trim();
  if (!desc)   { alert('La descripción del incidente es obligatoria.'); return; }
  if (!accion) { alert('La acción tomada es obligatoria.'); return; }

  const sinAlumno = document.getElementById('inc-sin-alumno')?.checked;
  const alumnoId  = sinAlumno ? null : (document.getElementById('inc-alumno')?.value || null);
  const cursoId   = sinAlumno ? null : (document.getElementById('inc-curso')?.value  || null);

  if (!sinAlumno && !alumnoId) {
    alert('Seleccioná un alumno o marcá "Sin alumno específico".');
    return;
  }

  // Obtener texto del alumno seleccionado desde la opción del select
  let descAlumno = null, cursoTexto = null;
  if (!sinAlumno) {
    const selAl = document.getElementById('inc-alumno');
    const opt   = selAl?.options[selAl.selectedIndex];
    if (opt && opt.value) descAlumno = opt.dataset.nombre || opt.text;

    if (cursoId) {
      const selCu = document.getElementById('inc-curso');
      const optCu = selCu?.options[selCu.selectedIndex];
      if (optCu && optCu.value) cursoTexto = optCu.text.trim();
    }
  }

  const btn = document.querySelector('#modal-form-inc .btn-p');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  const { error } = await sb.from('objetivo_incidentes').insert({
    objetivo_id:        objId,
    registrado_por:     USUARIO_ACTUAL.id,
    alumno_id:          alumnoId,
    descripcion_alumno: descAlumno || null,
    curso_texto:        cursoTexto,
    accion_tomada:      accion,
    medida:             document.getElementById('inc-medida')?.value.trim() || null,
    descripcion:        desc,
  });
  if (error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Registrar incidente'; }
    alert('Error al guardar: ' + error.message);
    return;
  }

  // Actualizar cache inmediatamente para que las métricas del card reflejen el nuevo total
  const objEnCache = _objCache.find(o => o.id === objId);
  if (objEnCache) {
    const incsActuales = objEnCache.incs?.[0]?.count ?? 0;
    objEnCache.incs = [{ count: incsActuales + 1 }];
  }

  await _actualizarTendenciaObj(objId);

  // Registrar automáticamente en el legajo del alumno (observaciones)
  if (alumnoId) {
    const objRef = _objCache.find(o => o.id === objId);
    const partes = [`[Objetivo: ${objRef?.nombre || 'Institucional'}]`, desc];
    if (accion) partes.push(`Acción: ${accion}`);
    const medidaVal = document.getElementById('inc-medida')?.value.trim();
    if (medidaVal) partes.push(`Medida: ${medidaVal}`);
    await sb.from('observaciones_legajo').insert({
      alumno_id:      alumnoId,
      registrado_por: USUARIO_ACTUAL.id,
      texto:          partes.join(' — '),
      privada:        false,
    });
  }

  _cerrarModalObj('modal-form-inc');

  // Mostrar toast de confirmación si hay alumno vinculado
  if (descAlumno) _toastObj(`✓ Incidente registrado · Anotado en el legajo de ${descAlumno}`);

  await rObj();
}

async function _actualizarTendenciaObj(objId) {
  const hace30 = new Date(); hace30.setDate(hace30.getDate()-30);
  const hace60 = new Date(); hace60.setDate(hace60.getDate()-60);
  const d30 = hace30.toISOString().slice(0,10);
  const d60 = hace60.toISOString().slice(0,10);
  const [r1, r2] = await Promise.all([
    sb.from('objetivo_incidentes').select('id', { count:'exact', head:true }).eq('objetivo_id', objId).gte('created_at', d30),
    sb.from('objetivo_incidentes').select('id', { count:'exact', head:true }).eq('objetivo_id', objId).gte('created_at', d60).lt('created_at', d30),
  ]);
  const rec = r1.count||0, ant = r2.count||0;
  const tendencia = rec > ant+1 ? 'empeorando' : rec < ant-1 ? 'mejorando' : 'estable';
  const upd = { tendencia, updated_at: new Date().toISOString() };
  if (tendencia==='empeorando') upd.estado = 'en_riesgo';
  await sb.from('objetivos').update(upd).eq('id', objId);
}

function _abrirFormHito(objId) {
  const html = `
    <div style="display:grid;gap:8px">
      <div><label class="lbl">Título del hito *</label>
        <input type="text" id="hit-titulo" placeholder="Ej: Primera revisión trimestral completada"></div>
      <div><label class="lbl">Descripción</label>
        <textarea id="hit-desc" rows="2" placeholder="Detalles..."></textarea></div>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
        <input type="checkbox" id="hit-logrado"> Marcar como logrado
      </label>
    </div>`;
  const btns = `
    <button class="btn-s" onclick="_cerrarModalObj('modal-form-hito')">Cancelar</button>
    <button class="btn-p" onclick="_guardarHito('${objId}')">Guardar hito</button>`;
  _objModal('modal-form-hito', 'Registrar hito', html, btns);
}

async function _guardarHito(objId) {
  const titulo = document.getElementById('hit-titulo')?.value.trim();
  if (!titulo) { alert('El título es obligatorio.'); return; }
  const { error } = await sb.from('objetivo_hitos').insert({
    objetivo_id:    objId, registrado_por: USUARIO_ACTUAL.id,
    titulo,
    descripcion: document.getElementById('hit-desc')?.value.trim() || null,
    logrado:     document.getElementById('hit-logrado')?.checked   || false,
  });
  if (error) { alert('Error: ' + error.message); return; }
  _cerrarModalObj('modal-form-hito');
  await _rObjDetalle(objId);
}

function _abrirCierreObj(objId) {
  const obj  = _objCache.find(o=>o.id===objId);
  const prog = obj?.progreso ?? obj?.cumplimiento ?? 0;
  const html = `
    <div style="display:grid;gap:8px">
      <div><label class="lbl">Estado de cierre</label>
        <select id="cie-estado" style="width:100%">
          <option value="logrado">Logrado ✓</option>
          <option value="archivado">Archivado</option>
        </select></div>
      <div><label class="lbl">Progreso final (%)</label>
        <input type="number" id="cie-prog" min="0" max="100" value="${prog}"></div>
      <div><label class="lbl">Nota de cierre</label>
        <textarea id="cie-concl" rows="3" placeholder="Describí el resultado del objetivo..."></textarea></div>
    </div>`;
  const btns = `
    <button class="btn-s" onclick="_cerrarModalObj('modal-cierre-obj')">Cancelar</button>
    <button class="btn-p" onclick="_cerrarObj('${objId}')">Confirmar cierre</button>`;
  _objModal('modal-cierre-obj', 'Cerrar objetivo', html, btns);
}

async function _cerrarObj(objId) {
  const estado     = document.getElementById('cie-estado')?.value;
  const progreso   = Math.min(100, Math.max(0, parseInt(document.getElementById('cie-prog')?.value)||0));
  const conclusion = document.getElementById('cie-concl')?.value.trim() || null;

  const btn = document.querySelector('#modal-cierre-obj .btn-p');
  if (btn) { btn.disabled = true; btn.textContent = 'Cerrando...'; }

  const { error }  = await sb.from('objetivos').update({
    estado, progreso, conclusion,
    cerrado_por: USUARIO_ACTUAL.id,
    cerrado_at:  new Date().toISOString(),
    updated_at:  new Date().toISOString(),
  }).eq('id', objId);

  if (error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Confirmar cierre'; }
    alert('Error al cerrar: ' + error.message);
    return;
  }
  _cerrarModalObj('modal-cierre-obj');
  _toastObj(`✓ Objetivo ${estado === 'logrado' ? 'logrado' : 'archivado'} correctamente`);
  _objVista = 'lista'; _objDetalleId = null;
  await rObj();
}

async function _reabrirObj(objId) {
  if (!confirm('¿Reabrir este objetivo?')) return;
  const { error } = await sb.from('objetivos').update({
    estado: 'activo', cerrado_por: null, cerrado_at: null, conclusion: null,
    updated_at: new Date().toISOString(),
  }).eq('id', objId);
  if (error) { alert('Error: ' + error.message); return; }
  await rObj();
}

async function _importarTardanzas(objId) {
  if (!confirm('¿Importar tardanzas de los últimos 30 días como incidentes?')) return;
  const hace30 = new Date(); hace30.setDate(hace30.getDate()-30);
  const desde = hace30.toISOString().slice(0,10);
  const { data: tardanzas } = await sb.from('asistencias')
    .select('*, alm:alumnos!asistencias_alumno_id_fkey(id,nombre,apellido,curso:cursos!alumnos_curso_id_fkey(nombre,division,anio))')
    .eq('estado','tardanza').gte('fecha', desde);
  if (!tardanzas?.length) { alert('No se encontraron tardanzas en los últimos 30 días.'); return; }
  const rows = tardanzas.filter(t=>t.alm).map(t => ({
    objetivo_id:        objId,
    registrado_por:     USUARIO_ACTUAL.id,
    alumno_id:          t.alm.id,
    descripcion_alumno: `${t.alm.apellido}, ${t.alm.nombre}`,
    curso_texto:        t.alm.curso ? `${t.alm.curso.anio}° ${t.alm.curso.nombre} ${t.alm.curso.division||''}`.trim() : null,
    accion_tomada:      `Tardanza registrada el ${t.fecha}`,
  }));
  if (!rows.length) { alert('No hay tardanzas con alumnos asignados.'); return; }
  const { error } = await sb.from('objetivo_incidentes').insert(rows);
  if (error) { alert('Error al importar: ' + error.message); return; }
  alert(`Se importaron ${rows.length} tardanzas como incidentes.`);
  await _actualizarTendenciaObj(objId);
  await rObj();
}

// =====================================================
// EOE.JS
// =====================================================

async function rEOE() {
  showLoading('eoe');
  try {
    const {data,error}=await sb.from('problematicas')
      .select(`*, alumno:alumnos(nombre,apellido,curso:cursos(nombre,division))`)
      .eq('institucion_id',USUARIO_ACTUAL.institucion_id)
      .neq('estado','resuelta')
      .in('tipo',['emocional','familiar','salud'])
      .order('urgencia',{ascending:false});
    if (error) throw error;

    const c=document.getElementById('page-eoe');
    c.innerHTML=`
      <div class="pg-t">Equipo de orientación</div>
      <div class="pg-s">Casos con seguimiento especializado · ${INSTITUCION_ACTUAL?.nombre||''}</div>
      <div class="metrics m2">
        <div class="mc"><div class="mc-v" style="color:var(--rojo)">${(data||[]).filter(p=>p.urgencia==='alta').length}</div><div class="mc-l">Urgentes</div></div>
        <div class="mc"><div class="mc-v" style="color:var(--ambar)">${(data||[]).filter(p=>p.urgencia==='media').length}</div><div class="mc-l">Seguimiento</div></div>
      </div>
      ${!(data?.length)?'<div class="empty-state">🧠<br>Sin casos EOE activos</div>':
        data.map(p=>{
          const ini=(p.alumno?.apellido?.[0]||'?')+(p.alumno?.nombre?.[0]||'');
          const nom=p.alumno?`${p.alumno.apellido}, ${p.alumno.nombre}`:'—';
          const cur=p.alumno?.curso?`${p.alumno.curso.nombre}${p.alumno.curso.division||''}`:'—';
          return `
            <div class="caso-c u${p.urgencia?.[0]||'m'}" style="cursor:pointer" onclick="goPage('prob')">
              <div class="caso-top">
                <div class="av av32" style="background:var(--azul-l);color:var(--azul)">${ini}</div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:600">${nom}</div>
                  <div style="font-size:10px;color:var(--txt2)">${cur} · ${labelTipo(p.tipo)} · ${tiempoDesde(p.created_at)}</div>
                  <div style="margin-top:4px;display:flex;gap:4px">
                    <span class="tag ${p.urgencia==='alta'?'tr':'ta'}">Urgencia ${p.urgencia}</span>
                    <span class="tag td">Confidencial</span>
                  </div>
                </div>
                <span style="font-size:11px;color:var(--txt2)">›</span>
              </div>
            </div>`;
        }).join('')}`;
  } catch(e){showError('eoe','Error: '+e.message);}
}

// =====================================================
// ASISTENCIA.JS (Fase 2)
// =====================================================

async function rAsist() {
  document.getElementById('page-asist').innerHTML=`
    <div class="pg-t">Asistencia</div>
    <div class="pg-s">Disponible en Fase 2</div>
    <div class="empty-state">✅<br>Módulo de asistencia en construcción.<br>
    <span style="font-size:11px;color:var(--txt2)">Problemáticas, objetivos y reuniones ya están completamente funcionales.</span></div>`;
}

// NOTAS (Fase 2)
async function rNotas() {
  document.getElementById('page-notas').innerHTML=`
    <div class="pg-t">Calificaciones</div>
    <div class="pg-s">Disponible en Fase 2</div>
    <div class="empty-state">📊<br>Módulo de calificaciones en construcción.</div>`;
}