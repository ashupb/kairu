// =====================================================
// OBJETIVOS INSTITUCIONALES
// =====================================================

let _objVista = 'lista';
let _objDetalleId = null;
let _objFiltros = { categoria: '', estado: '' };
let _objCache = [];
let _foTiposInc = [];
let _foTiposAcc = [];

const CAT_OBJ = {
  academico:     { label:'Académico',     color:'var(--azul)',   bg:'var(--azul-l)',  tag:'tp' },
  conductual:    { label:'Conductual',    color:'var(--rojo)',   bg:'var(--rojo-l)',  tag:'tr' },
  convivencial:  { label:'Convivencial',  color:'var(--verde)',  bg:'var(--verde-l)', tag:'tg' },
  institucional: { label:'Institucional', color:'var(--dorado)', bg:'var(--dor-l)',   tag:'td' },
};
const TENDENCIA_OBJ = {
  mejorando:  { label:'Avanzando',   icon:'↑', color:'var(--verde)' },
  estable:    { label:'En progreso', icon:'→', color:'var(--azul)'  },
  empeorando: { label:'En riesgo',   icon:'↓', color:'var(--rojo)'  },
  sin_datos:  { label:'Estático',    icon:'—', color:'var(--txt3)'  },
};
const ESTADO_OBJ = {
  activo:    { label:'Activo',    tag:'tg'  },
  en_riesgo: { label:'En riesgo', tag:'tr'  },
  logrado:   { label:'Logrado',   tag:'tp'  },
  archivado: { label:'Archivado', tag:'tgr' },
};

const TIPOS_INC = [
  'Tardanza','Ausencia injustificada','Conducta disruptiva',
  'Conflicto entre pares','Falta de materiales','Incumplimiento de tareas',
  'Agresión verbal','Agresión física','Uso inadecuado de dispositivos','Otro'
];
const ACCIONES_INC = [
  'Diálogo con el alumno','Llamado de atención','Contacto con familia',
  'Citación a padres','Acuerdo de convivencia','Amonestación',
  'Derivación a EOE','Suspensión','Otro'
];

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

function _objCatKeys(obj) {
  // Soporta categorias[] (nuevo) y categoria string (viejo)
  if (obj.categorias?.length) return obj.categorias;
  if (obj.categoria) return [obj.categoria];
  return [];
}
function _objNivelKeys(obj) {
  // Soporta niveles[] (nuevo) y nivel string (viejo)
  if (obj.niveles?.length) return obj.niveles;
  if (obj.nivel) return [obj.nivel];
  return [];
}
function _renderCatTags(catKeys) {
  return catKeys.map(k => {
    const c = CAT_OBJ[k];
    return c ? `<span class="tag ${c.tag}">${c.label}</span>` : `<span class="tag tgr">${k}</span>`;
  }).join('');
}

function _renderCardsObj() {
  let lista = [..._objCache];
  if (!_objFiltros.estado)    lista = lista.filter(o => o.estado !== 'archivado');
  if (_objFiltros.categoria)  lista = lista.filter(o => _objCatKeys(o).includes(_objFiltros.categoria));
  if (_objFiltros.estado)     lista = lista.filter(o => o.estado === _objFiltros.estado);
  // Filtrar por nivel del usuario (directores ven todo)
  const rolUser = USUARIO_ACTUAL?.rol;
  if (!['director_general','admin'].includes(rolUser) && USUARIO_ACTUAL?.nivel) {
    lista = lista.filter(o => {
      const nv = _objNivelKeys(o);
      return !nv.length || nv.includes(USUARIO_ACTUAL.nivel);
    });
  }
  const cont = document.getElementById('obj-cards');
  if (!cont) return;
  if (!lista.length) { cont.innerHTML = '<div class="empty-state">🎯<br>No hay objetivos con ese filtro.</div>'; return; }
  cont.innerHTML = lista.map(obj => {
    const catKeys  = _objCatKeys(obj);
    const firstCat = CAT_OBJ[catKeys[0]] || CAT_OBJ.institucional;
    const tnd      = TENDENCIA_OBJ[obj.tendencia] || TENDENCIA_OBJ.estable;
    const est      = ESTADO_OBJ[obj.estado]       || ESTADO_OBJ.activo;
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
                ${catKeys.length ? _renderCatTags(catKeys) : ''}
                <span class="tag ${est.tag}">${est.label}</span>
              </div>
            </div>
            <div style="font-size:10px;color:var(--txt2);margin-bottom:6px">${obj.responsable_texto||'—'}</div>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--txt3)">
              ${obj.tendencia !== 'sin_datos' ? `<span style="color:${tnd.color};font-weight:600">${tnd.icon} ${tnd.label}</span>` : '<span style="color:var(--txt3);font-style:italic">Sin medición aún</span>'}
              <span>${incCount} incidente${incCount!==1?'s':''}</span>
            </div>
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

  const [incsRes, hitosRes, tendRes] = await Promise.all([
    sb.from('objetivo_incidentes')
      .select('*, reg:usuarios!objetivo_incidentes_registrado_por_fkey(nombre_completo), alm:alumnos!objetivo_incidentes_alumno_id_fkey(nombre,apellido)')
      .eq('objetivo_id', objId).order('created_at', { ascending: false }),
    sb.from('objetivo_hitos')
      .select('*, reg:usuarios!objetivo_hitos_registrado_por_fkey(nombre_completo)')
      .eq('objetivo_id', objId).order('created_at', { ascending: true }),
    sb.rpc('calcular_tendencia_obj', { p_objetivo_id: objId }),
  ]);

  const respNombre = obj.responsable_texto || '—';
  const incs     = incsRes.data  || [];
  const hitos    = hitosRes.data || [];
  const tendData = tendRes.data  || null;
  const catKeys  = _objCatKeys(obj);
  const firstCat = CAT_OBJ[catKeys[0]] || CAT_OBJ.institucional;
  const tnd      = TENDENCIA_OBJ[obj.tendencia] || TENDENCIA_OBJ.estable;
  const est      = ESTADO_OBJ[obj.estado]       || ESTADO_OBJ.activo;
  const nivelKeys = _objNivelKeys(obj);
  const esActivo = ['activo','en_riesgo'].includes(obj.estado);

  const hitosHTML = hitos.length ? hitos.map(h => `
    <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px">
      <div style="width:8px;height:8px;border-radius:50%;margin-top:3px;flex-shrink:0;border:2px solid ${h.logrado?'var(--verde)':'var(--txt3)'};background:${h.logrado?'var(--verde)':'transparent'}"></div>
      <div>
        <div style="font-size:11px;font-weight:600${h.logrado?';text-decoration:line-through;color:var(--txt2)':''}">${h.titulo}</div>
        ${h.descripcion?`<div style="font-size:10px;color:var(--txt2)">${h.descripcion}</div>`:''}
        <div style="font-size:10px;color:var(--txt3)">${h.reg?.nombre_completo||'—'} · ${formatFechaCorta(h.created_at?.split('T')[0])}</div>
      </div>
    </div>`).join('') : '<div style="font-size:11px;color:var(--txt2)">Sin hitos registrados.</div>';

  // Cursos únicos para filtro
  const cursosUnicos = [...new Set(incs.filter(i => i.curso_texto).map(i => i.curso_texto))].sort();
  const cursoFilterOpts = cursosUnicos.map(ct => `<option value="${ct}">${ct}</option>`).join('');

  const incsHTML = incs.length ? incs.map(i => {
    const nom    = i.alm ? `${i.alm.apellido}, ${i.alm.nombre}` : (i.descripcion_alumno || null);
    const inicAl = nom ? nom.split(/[\s,]+/).filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase() : null;
    const desc   = i.descripcion || null;
    return `
      <div data-inc-curso="${i.curso_texto||''}" style="padding:10px 0;border-bottom:1px solid var(--brd)">
        ${nom ? `
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px">
          <div style="width:26px;height:26px;border-radius:50%;background:var(--rojo-l);color:var(--rojo);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0">${inicAl}</div>
          <div>
            <div style="font-size:12px;font-weight:600">${nom}</div>
            ${i.curso_texto?`<div style="font-size:10px;color:var(--txt3)">${i.curso_texto}</div>`:''}
          </div>
          <span style="margin-left:auto;font-size:9px;background:var(--verde-l);color:var(--verde);padding:2px 6px;border-radius:10px;flex-shrink:0">En legajo</span>
        </div>` : ''}
        ${desc ? `<span class="tag tp" style="margin-bottom:6px;display:inline-block">${desc}</span>` : ''}
        <div style="font-size:11px;color:var(--txt);font-weight:500">→ ${i.accion_tomada}</div>
        ${i.medida?`<div style="font-size:10px;color:var(--ambar);margin-top:2px">⚠ Medida: ${i.medida}</div>`:''}
        <div style="font-size:10px;color:var(--txt3);margin-top:3px">${i.reg?.nombre_completo||'—'} · ${formatFechaCorta(i.fecha || i.created_at?.split('T')[0])}</div>
      </div>`}).join('') : '<div style="font-size:11px;color:var(--txt2);padding:8px 0">Sin incidentes registrados.</div>';

  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <button class="btn-s" style="padding:4px 10px;font-size:11px" onclick="_volverListaObj()">‹ Volver</button>
      <div class="pg-t" style="margin:0;flex:1">${obj.nombre}</div>
    </div>
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        ${catKeys.length ? _renderCatTags(catKeys) : ''}
        ${nivelKeys.length ? nivelKeys.map(n=>`<span class="tag tgr" style="font-size:9px">${n[0].toUpperCase()+n.slice(1)}</span>`).join('') : ''}
        <span class="tag ${est.tag}">${est.label}</span>
        ${obj.tendencia !== 'sin_datos' ? `<span style="font-size:11px;font-weight:600;color:${tnd.color}">${tnd.icon} ${tnd.label}</span>` : ''}
      </div>
      ${obj.descripcion?`<div style="font-size:12px;color:var(--txt2);margin-bottom:10px">${obj.descripcion}</div>`:''}
      ${obj.punto_de_partida?`<div style="font-size:11px;margin-bottom:8px;padding:7px 10px;background:var(--bg);border-radius:var(--rad)"><span style="color:var(--txt3)">Punto de partida:</span> ${obj.punto_de_partida}</div>`:''}
      ${(obj.meta_descripcion||obj.meta)?`<div style="font-size:11px;margin-bottom:10px"><b>Meta:</b> ${obj.meta_descripcion||obj.meta}</div>`:''}
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
    ${_renderTendenciaWidget(obj, tendData)}
    ${_renderGraficoIncs(incs)}
    <div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="sec-lb" style="margin:0">Incidentes (${incs.length})</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${_objPuedeRegistrarInc()&&esActivo?`<button class="btn-p" style="font-size:11px" onclick="_abrirFormInc('${objId}')">+ Registrar</button>`:''}
          ${_objPuedeEditar()&&obj.categoria==='conductual'&&esActivo?`<button class="btn-s" style="font-size:11px" onclick="_importarTardanzas('${objId}')">Importar tardanzas</button>`:''}
        </div>
      </div>
      ${cursosUnicos.length > 1 ? `
      <div style="margin-bottom:10px">
        <select style="font-size:11px;padding:5px 8px;border:1px solid var(--brd);border-radius:var(--rad);background:var(--surf);color:var(--txt)"
          onchange="_filtrarIncsObjUI(this.value)">
          <option value="">Todos los cursos</option>${cursoFilterOpts}
        </select>
      </div>` : ''}
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

function _renderTendenciaWidget(obj, tendData) {
  if (!tendData) return '';
  const freqLabels = { diario:'Diario', semanal:'Semanal', quincenal:'Quincenal', mensual:'Mensual', trimestral:'Trimestral' };
  const freqLabel = freqLabels[obj.frecuencia_medicion || 'mensual'] || 'Mensual';
  const tnd       = TENDENCIA_OBJ[tendData.tendencia] || TENDENCIA_OBJ.estable;
  const sinDatos  = tendData.tendencia === 'sin_datos';
  const varPct    = tendData.variacion_pct;
  const varStr    = varPct === null ? '—' : (varPct > 0 ? '+' : '') + varPct + '%';
  // Menos incidentes = mejor → bajó es verde, subió es rojo
  const varClr    = sinDatos ? 'var(--txt3)'
    : varPct < 0 ? 'var(--verde)'
    : varPct > 0 ? 'var(--rojo)'
    : 'var(--ambar)';
  const fmtD = iso => iso ? iso.slice(8,10) + '/' + iso.slice(5,7) : '—';
  const pa = tendData.periodo_actual   || {};
  const pp = tendData.periodo_anterior || {};

  return `
    <div class="card" style="margin-bottom:12px;border-left:3px solid ${sinDatos ? 'var(--brd)' : tnd.color}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:11px;font-weight:700">Estado del objetivo</div>
        <span style="font-size:10px;color:var(--txt3)">Corte ${freqLabel.toLowerCase()} · umbral ${obj.umbral_riesgo||10}%</span>
      </div>
      ${sinDatos ? `
        <div style="font-size:11px;color:var(--txt3);font-style:italic">
          ${obj.punto_de_partida
            ? `Tiene punto de partida definido (<b>${obj.punto_de_partida}</b>). El estado aparecerá al completarse el primer período de medición.`
            : 'Sin punto de partida: se necesitan dos períodos para establecer la línea base. El primero servirá de referencia para el segundo.'}
        </div>
      ` : `
        <div style="font-size:11px;color:var(--txt2);margin-bottom:10px">
          Compara cuántos incidentes hubo en este período versus el anterior. Menos incidentes = objetivo avanzando.
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div style="background:var(--bg);border-radius:var(--rad);padding:8px 10px;text-align:center">
            <div style="font-size:9px;color:var(--txt3);text-transform:uppercase;font-weight:600;letter-spacing:.04em;margin-bottom:2px">Período actual</div>
            <div style="font-size:10px;color:var(--txt2);margin-bottom:4px">${fmtD(pa.inicio)} → ${fmtD(pa.fin)}</div>
            <div style="font-size:22px;font-weight:700;color:var(--txt)">${pa.count ?? 0}</div>
            <div style="font-size:9px;color:var(--txt3)">incidentes</div>
          </div>
          <div style="background:var(--bg);border-radius:var(--rad);padding:8px 10px;text-align:center">
            <div style="font-size:9px;color:var(--txt3);text-transform:uppercase;font-weight:600;letter-spacing:.04em;margin-bottom:2px">Período anterior</div>
            <div style="font-size:10px;color:var(--txt2);margin-bottom:4px">${fmtD(pp.inicio)} → ${fmtD(pp.fin)}</div>
            <div style="font-size:22px;font-weight:700;color:var(--txt)">${pp.count ?? 0}</div>
            <div style="font-size:9px;color:var(--txt3)">incidentes</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:center;gap:10px;padding-top:8px;border-top:1px solid var(--brd)">
          <span style="font-size:20px;font-weight:700;color:${varClr}">${varStr}</span>
          <span style="font-size:12px;font-weight:600;color:${tnd.color}">${tnd.icon} ${tnd.label}</span>
        </div>
      `}
    </div>`;
}

function _filtrarIncsObjUI(cursoTxt) {
  document.querySelectorAll('[data-inc-curso]').forEach(el => {
    el.style.display = (!cursoTxt || el.dataset.incCurso === cursoTxt) ? '' : 'none';
  });
}

function _renderGraficoIncs(incs) {
  if (incs.length < 3) return '';
  const grupos = {};
  incs.forEach(i => { const mes=(i.fecha||i.created_at).slice(0,7); grupos[mes]=(grupos[mes]||0)+1; });
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

  // Inicializar estado del formulario
  _foTiposInc = obj?.tipos_incidente ? [...obj.tipos_incidente] : [];
  _foTiposAcc = obj?.tipos_accion    ? [...obj.tipos_accion]    : [];

  // Categorías seleccionadas (nuevo: array | viejo: string)
  const selectedCats = obj?.categorias?.length ? obj.categorias
    : (obj?.categoria ? [obj.categoria] : []);

  // Niveles seleccionados (nuevo: array | viejo: string)
  const selectedNiveles = obj?.niveles?.length ? obj.niveles
    : (obj?.nivel ? [obj.nivel] : []);

  const catChks = Object.entries(CAT_OBJ).map(([k,v]) => `
    <label style="display:flex;align-items:center;gap:5px;cursor:pointer">
      <input type="checkbox" class="fo-cat-chk" value="${k}" ${selectedCats.includes(k)?'checked':''}>
      <span class="tag ${v.tag}" style="margin:0">${v.label}</span>
    </label>`).join('');

  const todosMarcado = selectedNiveles.length === 0;
  const nivelChks = ['inicial','primario','secundario','terciario'].map(n => `
    <label style="display:flex;align-items:center;gap:5px;cursor:pointer">
      <input type="checkbox" class="fo-nivel-chk" value="${n}" ${selectedNiveles.includes(n)?'checked':''} onchange="_foNivelChkChange()">
      <span style="font-size:11px">${n[0].toUpperCase()+n.slice(1)}</span>
    </label>`).join('');

  const selectedIds = obj?.responsable_ids?.length ? obj.responsable_ids
    : (obj?.responsable_id ? [obj.responsable_id] : []);
  const respChks = (usrRes.data||[]).map(u => `
    <label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;padding:3px 0">
      <input type="checkbox" class="fo-resp-chk" value="${u.id}" data-nombre="${u.nombre_completo}" data-rol="${u.rol}" ${selectedIds.includes(u.id)?'checked':''}>
      <span style="flex:1">${u.nombre_completo}</span>
      <span style="font-size:9px;color:var(--txt3)">${u.rol}</span>
    </label>`).join('');

  const html = `
    <div style="display:grid;gap:12px">
      <div><label class="lbl">Nombre *</label>
        <input type="text" id="fo-nombre" value="${obj?.nombre||''}" placeholder="Nombre del objetivo"></div>

      <div>
        <label class="lbl">Categorías</label>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:6px">${catChks}</div>
        <div id="fo-cats-extra" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px"></div>
        <div style="display:flex;gap:6px">
          <input type="text" id="fo-cat-nueva" placeholder="Nueva categoría..." style="flex:1;font-size:11px"
            onkeydown="if(event.key==='Enter'){event.preventDefault();_addCatObj();}">
          <button type="button" class="btn-s" style="font-size:10px;padding:4px 8px;flex-shrink:0" onclick="_addCatObj()">+ Agregar</button>
        </div>
      </div>

      <div>
        <label class="lbl">Nivel</label>
        <div style="display:flex;flex-wrap:wrap;gap:10px">
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer">
            <input type="checkbox" id="fo-nivel-todos" ${todosMarcado?'checked':''} onchange="_foToggleNivelTodos(this.checked)">
            <span style="font-size:11px;font-weight:600">Todos</span>
          </label>
          ${nivelChks}
        </div>
      </div>

      <div><label class="lbl">Descripción</label>
        <textarea id="fo-desc" rows="2" placeholder="Contexto...">${obj?.descripcion||''}</textarea></div>
      <div><label class="lbl">Punto de partida</label>
        <input type="text" id="fo-partida" value="${obj?.punto_de_partida||''}" placeholder="Situación inicial medible (ej: 15 tardanzas/mes, 30% ausentismo)">
        <div style="font-size:10px;color:var(--txt3);margin-top:3px">Si hay punto de partida, el estado se mide desde el primer período. Sin él, se necesitan dos períodos.</div>
      </div>
      <div><label class="lbl">Meta / Criterio de éxito</label>
        <textarea id="fo-meta" rows="2" placeholder="¿Qué queremos lograr y cómo lo mediremos?">${obj?.meta_descripcion||obj?.meta||''}</textarea></div>

      <div>
        <label class="lbl">Responsables</label>
        <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap">
          <button type="button" class="btn-s" style="font-size:10px;padding:3px 8px" onclick="_selRespRol('docente')">Todos docentes</button>
          <button type="button" class="btn-s" style="font-size:10px;padding:3px 8px" onclick="_selRespRol('preceptor')">Todos preceptores</button>
          <button type="button" class="btn-s" style="font-size:10px;padding:3px 8px" onclick="_selRespRol('')">Desmarcar todos</button>
        </div>
        <div style="border:1px solid var(--brd);border-radius:var(--rad);max-height:130px;overflow-y:auto;padding:6px 10px">${respChks||'<div style="font-size:11px;color:var(--txt2)">Sin usuarios</div>'}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><label class="lbl">Fecha inicio</label>${renderFechaInput('fo-inicio', obj?.fecha_inicio||'')}</div>
        <div><label class="lbl">Fecha cierre estimada</label>${renderFechaInput('fo-cierre', obj?.fecha_cierre||'')}</div>
      </div>

      <div>
        <label class="lbl">Tipos de incidente (opcionales)</label>
        <div style="font-size:10px;color:var(--txt3);margin-bottom:6px">Al registrar un incidente de este objetivo, aparecerán estas opciones. Vacío = tipos estándar.</div>
        <div id="fo-tipos-inc-list" style="display:flex;flex-wrap:wrap;gap:4px;min-height:20px;margin-bottom:6px"></div>
        <div style="display:flex;gap:6px">
          <input type="text" id="fo-tipos-inc-input" placeholder="Agregar tipo de incidente..." style="flex:1;font-size:11px"
            onkeydown="if(event.key==='Enter'){event.preventDefault();_addFoTipoInc();}">
          <button type="button" class="btn-s" style="font-size:10px;padding:4px 8px;flex-shrink:0" onclick="_addFoTipoInc()">+ Agregar</button>
        </div>
      </div>

      <div>
        <label class="lbl">Tipos de acción tomada (opcionales)</label>
        <div style="font-size:10px;color:var(--txt3);margin-bottom:6px">Al registrar un incidente, aparecerán estas acciones. Vacío = acciones estándar.</div>
        <div id="fo-tipos-acc-list" style="display:flex;flex-wrap:wrap;gap:4px;min-height:20px;margin-bottom:6px"></div>
        <div style="display:flex;gap:6px">
          <input type="text" id="fo-tipos-acc-input" placeholder="Agregar tipo de acción..." style="flex:1;font-size:11px"
            onkeydown="if(event.key==='Enter'){event.preventDefault();_addFoTipoAcc();}">
          <button type="button" class="btn-s" style="font-size:10px;padding:4px 8px;flex-shrink:0" onclick="_addFoTipoAcc()">+ Agregar</button>
        </div>
      </div>

      <div style="background:var(--bg);border-radius:var(--rad);padding:10px 12px">
        <div style="font-size:10px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Configuración de medición</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          <div><label class="lbl">Frecuencia de corte</label>
            <select id="fo-freq" style="width:100%">
              <option value="diario"    ${obj?.frecuencia_medicion==='diario'    ?'selected':''}>Diario</option>
              <option value="semanal"   ${obj?.frecuencia_medicion==='semanal'   ?'selected':''}>Semanal</option>
              <option value="quincenal" ${obj?.frecuencia_medicion==='quincenal' ?'selected':''}>Quincenal</option>
              <option value="mensual"   ${(obj?.frecuencia_medicion||'mensual')==='mensual'?'selected':''}>Mensual</option>
              <option value="trimestral"${obj?.frecuencia_medicion==='trimestral'?'selected':''}>Trimestral</option>
            </select></div>
          <div><label class="lbl">Umbral mejora (%)</label>
            <input type="number" id="fo-umbral-m" min="1" max="100" value="${obj?.umbral_mejora??10}" style="width:100%"></div>
          <div><label class="lbl">Umbral riesgo (%)</label>
            <input type="number" id="fo-umbral-r" min="1" max="100" value="${obj?.umbral_riesgo??10}" style="width:100%"></div>
        </div>
        <div style="font-size:10px;color:var(--txt3);margin-top:6px">Si los incidentes bajan más del umbral → Avanzando (verde) · Si suben más → En riesgo (rojo)</div>
      </div>
    </div>`;
  const btns = `
    <button class="btn-s" onclick="_cerrarModalObj('modal-form-obj')">Cancelar</button>
    <button class="btn-p" onclick="_guardarFormObj('${objId||''}')">${obj?'Guardar cambios':'Crear objetivo'}</button>`;
  _objModal('modal-form-obj', obj?'Editar objetivo':'Nuevo objetivo', html, btns);
  _renderFoTiposIncList();
  _renderFoTiposAccList();
}

function _selRespRol(rol) {
  const chks = document.querySelectorAll('.fo-resp-chk');
  if (rol === '') { chks.forEach(c => c.checked = false); }
  else { chks.forEach(c => { if (c.dataset.rol === rol) c.checked = true; }); }
}

function _addCatObj() {
  const inp = document.getElementById('fo-cat-nueva');
  const val = inp?.value.trim();
  if (!val) return;
  // Evitar duplicados con predefinidas o ya agregadas
  const existing = [...document.querySelectorAll('.fo-cat-chk')].map(c => c.value);
  if (existing.includes(val)) { if (inp) inp.value = ''; return; }
  const cont = document.getElementById('fo-cats-extra');
  if (!cont) return;
  const lbl = document.createElement('label');
  lbl.style.cssText = 'display:flex;align-items:center;gap:5px;cursor:pointer';
  lbl.innerHTML = `<input type="checkbox" class="fo-cat-chk" value="${val}" checked><span class="tag tgr" style="margin:0">${val}</span>`;
  cont.appendChild(lbl);
  if (inp) inp.value = '';
}

function _foToggleNivelTodos(checked) {
  document.querySelectorAll('.fo-nivel-chk').forEach(c => c.checked = false);
}
function _foNivelChkChange() {
  const algunos = [...document.querySelectorAll('.fo-nivel-chk')].some(c => c.checked);
  const todos = document.getElementById('fo-nivel-todos');
  if (todos) todos.checked = !algunos;
}

function _renderFoTiposIncList() {
  const cont = document.getElementById('fo-tipos-inc-list');
  if (!cont) return;
  cont.innerHTML = _foTiposInc.map((t, i) =>
    `<span style="display:inline-flex;align-items:center;gap:3px;background:var(--azul-l);color:var(--azul);padding:3px 8px;border-radius:10px;font-size:10px">
      ${t}
      <button onclick="_removeFoTipoInc(${i})" style="background:none;border:none;cursor:pointer;padding:0 0 0 2px;font-size:13px;color:var(--azul);line-height:1">×</button>
    </span>`).join('');
}
function _addFoTipoInc() {
  const inp = document.getElementById('fo-tipos-inc-input');
  const val = inp?.value.trim();
  if (!val || _foTiposInc.includes(val)) { if (inp) inp.value = ''; return; }
  _foTiposInc.push(val);
  if (inp) inp.value = '';
  _renderFoTiposIncList();
}
function _removeFoTipoInc(idx) { _foTiposInc.splice(idx, 1); _renderFoTiposIncList(); }

function _renderFoTiposAccList() {
  const cont = document.getElementById('fo-tipos-acc-list');
  if (!cont) return;
  cont.innerHTML = _foTiposAcc.map((t, i) =>
    `<span style="display:inline-flex;align-items:center;gap:3px;background:var(--verde-l);color:var(--verde);padding:3px 8px;border-radius:10px;font-size:10px">
      ${t}
      <button onclick="_removeFoTipoAcc(${i})" style="background:none;border:none;cursor:pointer;padding:0 0 0 2px;font-size:13px;color:var(--verde);line-height:1">×</button>
    </span>`).join('');
}
function _addFoTipoAcc() {
  const inp = document.getElementById('fo-tipos-acc-input');
  const val = inp?.value.trim();
  if (!val || _foTiposAcc.includes(val)) { if (inp) inp.value = ''; return; }
  _foTiposAcc.push(val);
  if (inp) inp.value = '';
  _renderFoTiposAccList();
}
function _removeFoTipoAcc(idx) { _foTiposAcc.splice(idx, 1); _renderFoTiposAccList(); }

async function _guardarFormObj(objId) {
  const nombre = document.getElementById('fo-nombre')?.value.trim();
  if (!nombre) { alert('El nombre es obligatorio.'); return; }
  const respChks = [...document.querySelectorAll('.fo-resp-chk:checked')];
  const responsable_ids   = respChks.map(c => c.value);
  const responsable_texto = respChks.map(c => c.dataset.nombre).join(', ') || null;

  const categorias = [...document.querySelectorAll('.fo-cat-chk:checked')].map(c => c.value);
  const nivelChks  = [...document.querySelectorAll('.fo-nivel-chk:checked')].map(c => c.value);
  const niveles    = nivelChks; // vacío = Todos

  const payload = {
    nombre,
    categorias:          categorias.length ? categorias : null,
    categoria:           categorias[0] || null,           // compat backward
    niveles:             niveles.length ? niveles : null,
    nivel:               niveles[0] || null,              // compat backward
    descripcion:         document.getElementById('fo-desc')?.value    || null,
    meta_descripcion:    document.getElementById('fo-meta')?.value    || null,
    responsable_ids:     responsable_ids.length ? responsable_ids : null,
    responsable_texto,
    punto_de_partida:    document.getElementById('fo-partida')?.value.trim() || null,
    fecha_inicio:        getFechaInput('fo-inicio')                    || null,
    fecha_cierre:        getFechaInput('fo-cierre')                    || null,
    tipos_incidente:     _foTiposInc.length ? _foTiposInc : null,
    tipos_accion:        _foTiposAcc.length ? _foTiposAcc : null,
    frecuencia_medicion: document.getElementById('fo-freq')?.value    || 'mensual',
    umbral_mejora:       Math.min(100, Math.max(1, parseInt(document.getElementById('fo-umbral-m')?.value)||10)),
    umbral_riesgo:       Math.min(100, Math.max(1, parseInt(document.getElementById('fo-umbral-r')?.value)||10)),
    updated_at:          new Date().toISOString(),
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
  const todosCursos = cursosRes.data || [];
  window._incTodosCursos = todosCursos;

  // Filtrar por nivel del usuario si aplica
  let cursosIniciales = todosCursos;
  if (USUARIO_ACTUAL?.nivel) {
    cursosIniciales = todosCursos.filter(c => c.nivel === USUARIO_ACTUAL.nivel);
  }

  // Mostrar filtro de nivel solo si hay múltiples niveles y el usuario no tiene nivel fijo
  const nivelesDisp = [...new Set(todosCursos.map(c => c.nivel).filter(Boolean))];
  const mostrarNivel = nivelesDisp.length > 1 && !USUARIO_ACTUAL?.nivel;
  const nivelesOpts = nivelesDisp.map(n =>
    `<option value="${n}">${n[0].toUpperCase()+n.slice(1)}</option>`).join('');

  const cursoOpts = cursosIniciales.map(cu => {
    const lbl = [cu.anio ? cu.anio+'°' : '', cu.nombre, cu.division||''].filter(Boolean).join(' ');
    return `<option value="${cu.id}">${lbl}</option>`;
  }).join('');

  // Usar tipos personalizados del objetivo si existen, si no los estándar
  const objRef     = _objCache.find(o => o.id === objId);
  const tiposList  = objRef?.tipos_incidente?.length ? [...objRef.tipos_incidente, 'Otro'] : TIPOS_INC;
  const accionList = objRef?.tipos_accion?.length    ? [...objRef.tipos_accion, 'Otro']    : ACCIONES_INC;
  const tiposOpts  = tiposList.map(t  => `<option value="${t}">${t}</option>`).join('');
  const accionOpts = accionList.map(a => `<option value="${a}">${a}</option>`).join('');
  const hoy = hoyISO();

  const html = `
    <div style="display:grid;gap:10px">
      <div style="background:var(--verde-l);border:1px solid rgba(34,153,87,0.2);border-radius:var(--rad);padding:10px 12px">
        <div style="font-size:11px;font-weight:700;color:var(--verde);margin-bottom:8px">Alumno involucrado</div>
        <div style="display:grid;gap:6px">
          ${mostrarNivel ? `<div><label class="lbl">Nivel</label>
            <select id="inc-nivel" onchange="_incFiltraCursos(this.value)">
              <option value="">Todos los niveles</option>${nivelesOpts}
            </select></div>` : ''}
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
      <div>
        <label class="lbl">Tipo de incidente *</label>
        <select id="inc-tipo" onchange="_incToggleTipoOtro(this.value)">
          <option value="">— Seleccioná el tipo —</option>${tiposOpts}
        </select>
        <input type="text" id="inc-tipo-otro" placeholder="Describí el incidente..." style="display:none;margin-top:6px">
      </div>
      <div>
        <label class="lbl">Acción tomada *</label>
        <select id="inc-accion-sel" onchange="_incToggleAccionOtro(this.value)">
          <option value="">— Seleccioná la acción —</option>${accionOpts}
        </select>
        <input type="text" id="inc-accion-otro" placeholder="Describí la acción tomada..." style="display:none;margin-top:6px">
      </div>
      <div><label class="lbl">Medida adoptada (opcional)</label>
        <input type="text" id="inc-medida" placeholder="Ej: Amonestación, acuerdo de convivencia..."></div>
      <div><label class="lbl">Fecha</label>
        ${renderFechaInput('inc-fecha', hoy, {wrapStyle:'max-width:360px'})}</div>
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

function _incFiltraCursos(nivel) {
  const cursos = window._incTodosCursos || [];
  const filtrados = nivel ? cursos.filter(c => c.nivel === nivel) : cursos;
  const sel = document.getElementById('inc-curso');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Seleccioná un curso —</option>' +
    filtrados.map(cu => {
      const lbl = [cu.anio ? cu.anio+'°' : '', cu.nombre, cu.division||''].filter(Boolean).join(' ');
      return `<option value="${cu.id}">${lbl}</option>`;
    }).join('');
  const alumSel = document.getElementById('inc-alumno');
  if (alumSel) alumSel.innerHTML = '<option value="">— Primero seleccioná el curso —</option>';
  const info = document.getElementById('inc-alumno-info');
  if (info) info.style.display = 'none';
}

function _incToggleTipoOtro(val) {
  const el = document.getElementById('inc-tipo-otro');
  if (el) el.style.display = val === 'Otro' ? '' : 'none';
}

function _incToggleAccionOtro(val) {
  const el = document.getElementById('inc-accion-otro');
  if (el) el.style.display = val === 'Otro' ? '' : 'none';
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
  const sinAlumno = document.getElementById('inc-sin-alumno')?.checked;
  const alumnoId  = sinAlumno ? null : (document.getElementById('inc-alumno')?.value || null);
  const cursoId   = sinAlumno ? null : (document.getElementById('inc-curso')?.value  || null);

  if (!sinAlumno && !alumnoId) {
    alert('Seleccioná un alumno o marcá "Sin alumno específico".');
    return;
  }

  const tipoSel = document.getElementById('inc-tipo')?.value;
  if (!tipoSel) { alert('Seleccioná el tipo de incidente.'); return; }
  const desc = tipoSel === 'Otro'
    ? (document.getElementById('inc-tipo-otro')?.value.trim() || '')
    : tipoSel;
  if (!desc) { alert('Describí el tipo de incidente.'); return; }

  const accionSel = document.getElementById('inc-accion-sel')?.value;
  if (!accionSel) { alert('Seleccioná la acción tomada.'); return; }
  const accion = accionSel === 'Otro'
    ? (document.getElementById('inc-accion-otro')?.value.trim() || '')
    : accionSel;
  if (!accion) { alert('Describí la acción tomada.'); return; }

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
    curso_id:           cursoId   || null,
    curso_texto:        cursoTexto,
    accion_tomada:      accion,
    medida:             document.getElementById('inc-medida')?.value.trim() || null,
    descripcion:        desc,
    fecha:              getFechaInput('inc-fecha') || hoyISO(),
  });
  if (error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Registrar incidente'; }
    alert('Error al guardar: ' + error.message);
    return;
  }

  const objEnCache = _objCache.find(o => o.id === objId);
  if (objEnCache) {
    const incsActuales = objEnCache.incs?.[0]?.count ?? 0;
    objEnCache.incs = [{ count: incsActuales + 1 }];
  }

  await _actualizarTendenciaObj(objId);

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
      confidencial:   false,
    });
  }

  _cerrarModalObj('modal-form-inc');
  if (descAlumno) _toastObj(`✓ Incidente registrado · Anotado en el legajo de ${descAlumno}`);
  await rObj();
}

async function _actualizarTendenciaObj(objId) {
  await sb.rpc('actualizar_tendencia_obj', { p_objetivo_id: objId });
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
    const [probRes, actRes] = await Promise.all([
      sb.from('problematicas')
        .select(`*, alumno:alumnos(nombre,apellido,curso:cursos(nombre,division))`)
        .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
        .neq('estado', 'resuelta')
        .in('tipo', ['emocional', 'familiar', 'salud'])
        .order('urgencia', { ascending: false }),
      sb.from('reuniones')
        .select(`*, prob:problematicas(descripcion), obj:objetivos(nombre)`)
        .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
        .not('tipo_actividad', 'is', null)
        .order('fecha', { ascending: false })
        .limit(30),
    ]);
    if (probRes.error) throw probRes.error;

    const casos      = probRes.data || [];
    const actividades = actRes.error ? [] : (actRes.data || []);
    const hoy        = hoyISO();
    const esEOE      = USUARIO_ACTUAL.rol === 'eoe';
    const puedeVer   = ['eoe', 'director_general', 'directivo_nivel'].includes(USUARIO_ACTUAL.rol);

    const c = document.getElementById('page-eoe');
    c.innerHTML = `
      <div class="pg-t">Panel EOE</div>
      <div class="pg-s">Equipo de Orientación Escolar · ${INSTITUCION_ACTUAL?.nombre || ''}</div>
      <div class="metrics m2" style="margin-bottom:14px">
        <div class="mc"><div class="mc-v" style="color:var(--rojo)">${casos.filter(p => p.urgencia === 'alta').length}</div><div class="mc-l">Urgentes</div></div>
        <div class="mc"><div class="mc-v" style="color:var(--ambar)">${casos.filter(p => p.urgencia === 'media').length}</div><div class="mc-l">Seguimiento</div></div>
      </div>

      <div class="sec-lb">Casos en seguimiento (${casos.length})</div>
      ${!casos.length
        ? '<div class="empty-state" style="margin-bottom:16px">🧠<br>Sin casos EOE activos</div>'
        : casos.map(p => {
            const ini = (p.alumno?.apellido?.[0] || '?') + (p.alumno?.nombre?.[0] || '');
            const nom = p.alumno ? `${p.alumno.apellido}, ${p.alumno.nombre}` : '—';
            const cur = p.alumno?.curso ? `${p.alumno.curso.nombre}${p.alumno.curso.division || ''}` : '—';
            return `
              <div class="caso-c u${p.urgencia?.[0] || 'm'}" style="cursor:pointer;margin-bottom:8px" onclick="goPage('prob')">
                <div class="caso-top">
                  <div class="av av32" style="background:var(--azul-l);color:var(--azul)">${ini}</div>
                  <div style="flex:1;min-width:0">
                    <div style="font-size:12px;font-weight:600">${nom}</div>
                    <div style="font-size:10px;color:var(--txt2)">${cur} · ${labelTipo(p.tipo)} · ${tiempoDesde(p.created_at)}</div>
                    <div style="margin-top:4px;display:flex;gap:4px">
                      <span class="tag ${p.urgencia === 'alta' ? 'tr' : 'ta'}">Urgencia ${p.urgencia}</span>
                      <span class="tag td">Confidencial</span>
                    </div>
                  </div>
                  <span style="font-size:11px;color:var(--txt2)">›</span>
                </div>
              </div>`;
          }).join('')}

      ${puedeVer ? `
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--brd)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div class="sec-lb" style="margin:0">Actividades EOE (${actividades.length})</div>
          ${esEOE ? `<button class="btn-p" style="font-size:11px" onclick="_abrirFormActividad()">+ Nueva actividad</button>` : ''}
        </div>
        ${_renderActividadesEOE(actividades, hoy)}
      </div>` : ''}`;
  } catch(e) { showError('eoe', 'Error: ' + e.message); }
}

// ─── EOE Actividades ────────────────────────────────

const _ACT_TIPO_LABEL = {
  charla:            'Charla',
  taller:            'Taller',
  entrevista_grupal: 'Entrevista grupal',
  otra:              'Otra',
};

let _actAlumnosSel = [];
let _actBusqTimer  = null;
let _actAlumnosMap = {};
let _actEncuentros = []; // encuentros adicionales (índice 0 = 2do encuentro visual)

function _renderActCard(a, hoy) {
  const esPasada  = a.fecha < hoy;
  const tipoLabel = _ACT_TIPO_LABEL[a.tipo_actividad] || a.tipo_actividad;
  const hora      = a.hora ? a.hora.slice(0, 5) : '';
  const probDesc  = a.prob?.descripcion;
  const objTit    = a.obj?.nombre;
  const planTxt   = a.objetivo_actividad || a.descripcion;
  return `
    <div class="card" style="margin-bottom:8px${esPasada ? ';opacity:.75' : ''};cursor:pointer" onclick="_verDetalleActividad('${a.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
        <div style="font-size:12px;font-weight:600;line-height:1.3;flex:1">${a.titulo}</div>
        <span class="tag ${esPasada ? 'tgr' : 'tg'}" style="flex-shrink:0;margin-left:8px">${esPasada ? 'Realizada' : 'Próxima'}</span>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:5px">
        <span class="tag tp">${tipoLabel}</span>
        ${probDesc ? `<span class="tag td" style="font-size:9px">Prob: ${probDesc.slice(0,30)}${probDesc.length>30?'…':''}</span>` : ''}
        ${objTit  ? `<span class="tag ta" style="font-size:9px">Obj: ${objTit.slice(0,30)}${objTit.length>30?'…':''}</span>` : ''}
        ${a.en_agenda ? `<span class="tag tg" style="font-size:9px">En agenda</span>` : ''}
      </div>
      <div style="font-size:10px;color:var(--txt2)">
        ${formatFechaCorta(a.fecha)}${hora ? ' · ' + hora : ''}${a.lugar ? ' · ' + a.lugar : ''}
      </div>
      ${a.destinatarios_texto ? `<div style="font-size:10px;color:var(--txt3);margin-top:2px">Destinatarios: ${a.destinatarios_texto}</div>` : ''}
      ${planTxt ? `<div style="font-size:11px;color:var(--txt2);margin-top:4px;font-style:italic">${planTxt}</div>` : ''}
      ${a.resultado ? `
        <div style="font-size:11px;margin-top:6px;padding:6px 8px;background:var(--verde-l);border-radius:var(--rad)">
          <span style="font-size:9px;font-weight:700;color:var(--verde);text-transform:uppercase;display:block;margin-bottom:2px">Resultado</span>
          ${a.resultado}
        </div>` : ''}
    </div>`;
}

async function _abrirFormActividad() {
  _actAlumnosSel = [];
  _actAlumnosMap = {};
  _actEncuentros = [];

  const [cursosRes, probsRes, objsRes, usrsRes] = await Promise.all([
    sb.from('cursos').select('id,nombre,division,anio,nivel')
      .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
      .or('activo.is.null,activo.eq.true').order('nivel').order('anio'),
    sb.from('problematicas').select('id,descripcion,alumno:alumnos(apellido,nombre)')
      .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
      .neq('estado', 'resuelta').order('created_at', { ascending: false }).limit(50),
    sb.from('objetivos').select('id,nombre')
      .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
      .not('estado', 'eq', 'archivado').order('created_at', { ascending: false }).limit(50),
    sb.from('usuarios').select('id,nombre_completo,rol')
      .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
      .or('activo.is.null,activo.eq.true')
      .neq('id', USUARIO_ACTUAL.id).order('rol').order('nombre_completo'),
  ]);

  const cursos = cursosRes.data || [];
  const probs  = probsRes.data  || [];
  const objs   = objsRes.data   || [];
  const usrs   = usrsRes.data   || [];
  window._actTodosCursos = cursos;

  const nivelesDisp  = [...new Set(cursos.map(c => c.nivel).filter(Boolean))];
  const mostrarNivel = nivelesDisp.length > 1;
  const nivelesOpts  = nivelesDisp.map(n =>
    `<option value="${n}">${n[0].toUpperCase() + n.slice(1)}</option>`).join('');

  const probsOpts = probs.map(p => {
    const nom  = p.alumno ? ` — ${p.alumno.apellido}, ${p.alumno.nombre}` : '';
    const desc = (p.descripcion || 'Sin descripción').slice(0, 40);
    return `<option value="${p.id}">${desc}${nom}</option>`;
  }).join('');

  const objsOpts = objs.map(o =>
    `<option value="${o.id}">${(o.nombre || 'Sin nombre').slice(0, 50)}</option>`
  ).join('');

  const invOpts = usrs.map(u => `
    <label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;padding:3px 0">
      <input type="checkbox" class="act-inv-chk" value="${u.id}">
      <span style="flex:1">${u.nombre_completo}</span>
      <span style="font-size:9px;color:var(--txt3)">${u.rol}</span>
    </label>`).join('');

  const cursosChksHTML = _buildCursosChks(cursos, '');

  const html = `
    <div style="display:grid;gap:14px">

      <div><label class="lbl">Título *</label>
        <input type="text" id="act-titulo" placeholder="Ej: Taller sobre vínculos saludables"></div>

      <div><label class="lbl">Tipo *</label>
        <select id="act-tipo" style="width:100%">
          <option value="">— Seleccioná el tipo —</option>
          <option value="charla">Charla</option>
          <option value="taller">Taller</option>
          <option value="entrevista_grupal">Entrevista grupal</option>
          <option value="otra">Otra</option>
        </select></div>

      <div><label class="lbl">Lugar</label>
        <input type="text" id="act-lugar" placeholder="Aula, SUM, salón de actos..."></div>

      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <label class="lbl" style="margin:0">Encuentros *</label>
          <button type="button" class="btn-s" style="font-size:10px;padding:3px 8px" onclick="_addEncuentro()">+ Agregar encuentro</button>
        </div>
        <div id="act-encuentros-list">
          <div data-enc-main style="background:var(--surf);border:1px solid var(--brd);border-radius:var(--rad);padding:10px;margin-bottom:6px">
            <div style="font-size:10px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Encuentro 1</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
              <div><label class="lbl">Fecha *</label>${renderFechaInput('act-fecha', hoyISO())}</div>
              <div><label class="lbl">Hora</label>
                <input type="time" id="act-hora" style="width:100%;border:1px solid var(--brd);border-radius:var(--rad);padding:8px;background:var(--surf);color:var(--txt)">
              </div>
            </div>
            <div><label class="lbl">Temática</label>
              <input type="text" id="enc-tematica-0" placeholder="Tema de este encuentro (opcional)">
            </div>
          </div>
          <div id="enc-extras"></div>
        </div>
      </div>

      <div>
        <label class="lbl">Destinatarios</label>
        <div style="display:flex;gap:12px;margin-bottom:8px;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:12px">
            <input type="radio" name="act-dest-tipo" value="nivel_completo" checked onchange="_actDestTipoChange('nivel_completo')"> Nivel completo
          </label>
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:12px">
            <input type="radio" name="act-dest-tipo" value="cursos_multiples" onchange="_actDestTipoChange('cursos_multiples')"> Varios cursos
          </label>
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:12px">
            <input type="radio" name="act-dest-tipo" value="alumnos_individuales" onchange="_actDestTipoChange('alumnos_individuales')"> Alumnos individuales
          </label>
        </div>
        <div id="act-dest-nivel">
          <select id="act-nivel-completo" style="width:100%">
            <option value="">— Seleccioná nivel —</option>${nivelesOpts}
          </select>
        </div>
        <div id="act-dest-cursos" style="display:none">
          ${mostrarNivel ? `<select id="act-nivel-filter" style="margin-bottom:8px;width:100%" onchange="_actFiltrarCursos(this.value)">
            <option value="">Todos los niveles</option>${nivelesOpts}
          </select>` : ''}
          <div id="act-cursos-chks" style="border:1px solid var(--brd);border-radius:var(--rad);max-height:150px;overflow-y:auto;padding:6px 10px">
            ${cursosChksHTML}
          </div>
        </div>
        <div id="act-dest-alumnos" style="display:none">
          <input type="text" id="act-busq-alum" placeholder="Buscar alumno por apellido..."
            style="margin-bottom:6px;width:100%" oninput="_debounceActAlumno()">
          <div id="act-busq-res" style="margin-bottom:6px"></div>
          <div id="act-alumnos-chips" style="display:flex;flex-wrap:wrap;gap:4px;min-height:24px"></div>
        </div>
      </div>

      <div>
        <label class="lbl">Relacionar con (opcional)</label>
        <div style="display:flex;gap:12px;margin-bottom:8px;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:12px">
            <input type="radio" name="act-rel-tipo" value="" checked onchange="_actRelTipoChange('')"> Ninguno
          </label>
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:12px">
            <input type="radio" name="act-rel-tipo" value="prob" onchange="_actRelTipoChange('prob')"> Problemática
          </label>
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:12px">
            <input type="radio" name="act-rel-tipo" value="obj" onchange="_actRelTipoChange('obj')"> Objetivo institucional
          </label>
        </div>
        <div id="act-rel-prob" style="display:none">
          <select id="act-prob" style="width:100%">
            <option value="">— Seleccioná problemática —</option>${probsOpts}
          </select>
        </div>
        <div id="act-rel-obj" style="display:none">
          <select id="act-objetivo" style="width:100%">
            <option value="">— Seleccioná objetivo —</option>${objsOpts}
          </select>
        </div>
      </div>

      <div class="toggle-row-ui">
        <div>
          <div style="font-size:12px;font-weight:500">Agregar a la agenda institucional</div>
          <div style="font-size:10px;color:var(--txt2)">Aparecerá visible para todos en Agenda</div>
        </div>
        <div class="tog off" id="act-en-agenda" onclick="this.classList.toggle('on');this.classList.toggle('off')">
          <div class="tog-thumb"></div>
        </div>
      </div>

      <div>
        <label class="lbl">Invitados de la institución</label>
        <div style="border:1px solid var(--brd);border-radius:var(--rad);max-height:130px;overflow-y:auto;padding:6px 10px">
          ${invOpts || '<div style="font-size:11px;color:var(--txt2)">Sin usuarios disponibles</div>'}
        </div>
      </div>

      <div><label class="lbl">Objetivo de la actividad</label>
        <textarea id="act-objetivo-txt" rows="2" placeholder="¿Qué se busca lograr con esta actividad?"></textarea></div>

      <div><label class="lbl">Resultado / descripción</label>
        <textarea id="act-desc" rows="2" placeholder="Podés completar esto luego de realizada la actividad..."></textarea></div>
    </div>`;

  const btns = `
    <button class="btn-s" onclick="_cerrarModalObj('modal-act-eoe')">Cancelar</button>
    <button class="btn-p" onclick="_guardarActividad()">Guardar actividad</button>`;
  _objModal('modal-act-eoe', 'Nueva actividad EOE', html, btns);
}

function _buildCursosChks(cursos, nivelFiltro) {
  const lista = nivelFiltro ? cursos.filter(c => c.nivel === nivelFiltro) : cursos;
  if (!lista.length) return '<div style="font-size:11px;color:var(--txt2)">Sin cursos disponibles</div>';
  return lista.map(cu => {
    const lbl = [cu.anio ? cu.anio + '°' : '', cu.nombre, cu.division || ''].filter(Boolean).join(' ');
    return `<label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;padding:3px 0">
      <input type="checkbox" class="act-curso-chk" value="${cu.id}" data-label="${lbl} · ${cu.nivel}" data-nivel="${cu.nivel}">
      <span style="flex:1">${lbl}</span>
      <span style="font-size:9px;color:var(--txt3)">${cu.nivel}</span>
    </label>`;
  }).join('');
}

function _actDestTipoChange(tipo) {
  document.getElementById('act-dest-nivel').style.display    = tipo === 'nivel_completo'      ? '' : 'none';
  document.getElementById('act-dest-cursos').style.display   = tipo === 'cursos_multiples'    ? '' : 'none';
  document.getElementById('act-dest-alumnos').style.display  = tipo === 'alumnos_individuales'? '' : 'none';
}

function _actFiltrarCursos(nivel) {
  const el = document.getElementById('act-cursos-chks');
  if (el) el.innerHTML = _buildCursosChks(window._actTodosCursos || [], nivel);
}

function _actRelTipoChange(tipo) {
  document.getElementById('act-rel-prob').style.display = tipo === 'prob' ? '' : 'none';
  document.getElementById('act-rel-obj').style.display  = tipo === 'obj'  ? '' : 'none';
}

function _addEncuentro() {
  _actEncuentros.push({ fecha: hoyISO(), hora: '', tematica: '' });
  _renderEncuentrosExtra();
}

function _removeEncuentro(i) {
  // Preserve current input values before splicing
  _actEncuentros = _actEncuentros.map((enc, j) => ({
    fecha:    getFechaInput('enc-fecha-' + j) || enc.fecha,
    hora:     document.getElementById('enc-hora-' + j)?.value  || enc.hora,
    tematica: document.getElementById('enc-tematica-extra-' + j)?.value || enc.tematica,
  }));
  _actEncuentros.splice(i, 1);
  _renderEncuentrosExtra();
}

function _renderEncuentrosExtra() {
  const cont = document.getElementById('enc-extras');
  if (!cont) return;
  cont.innerHTML = _actEncuentros.map((enc, i) => `
    <div style="background:var(--surf);border:1px solid var(--brd);border-radius:var(--rad);padding:10px;margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:10px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.5px">Encuentro ${i + 2}</div>
        <button type="button" onclick="_removeEncuentro(${i})" style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--txt3);padding:0;line-height:1">×</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div><label class="lbl">Fecha *</label>${renderFechaInput('enc-fecha-' + i, enc.fecha)}</div>
        <div><label class="lbl">Hora</label>
          <input type="time" id="enc-hora-${i}" value="${enc.hora}" style="width:100%;border:1px solid var(--brd);border-radius:var(--rad);padding:8px;background:var(--surf);color:var(--txt)">
        </div>
      </div>
      <div><label class="lbl">Temática</label>
        <input type="text" id="enc-tematica-extra-${i}" value="${enc.tematica}" placeholder="Tema de este encuentro (opcional)">
      </div>
    </div>`).join('');
}

function _debounceActAlumno() {
  clearTimeout(_actBusqTimer);
  _actBusqTimer = setTimeout(_buscarActAlumno, 350);
}

async function _buscarActAlumno() {
  const q   = document.getElementById('act-busq-alum')?.value.trim();
  const res = document.getElementById('act-busq-res');
  if (!res) return;
  if (!q || q.length < 2) { res.innerHTML = ''; return; }

  const { data } = await sb.from('alumnos')
    .select('id,nombre,apellido,curso:cursos(nombre,division,anio,nivel)')
    .or('activo.is.null,activo.eq.true')
    .ilike('apellido', `%${q}%`).limit(8).order('apellido');

  if (!data?.length) {
    res.innerHTML = '<div style="font-size:11px;color:var(--txt2);padding:4px 0">Sin resultados</div>';
    return;
  }
  data.forEach(a => { _actAlumnosMap[a.id] = `${a.apellido}, ${a.nombre}`; });
  res.innerHTML = data.map(a => {
    const nombre  = `${a.apellido}, ${a.nombre}`;
    const cur     = a.curso ? [a.curso.anio ? a.curso.anio + '°' : '', a.curso.nombre, a.curso.division || ''].filter(Boolean).join(' ') : '';
    const yaSelec = _actAlumnosSel.some(s => s.id === a.id);
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;border-radius:var(--rad);background:var(--bg);margin-bottom:3px">
        <div>
          <div style="font-size:11px;font-weight:600">${nombre}</div>
          ${cur ? `<div style="font-size:10px;color:var(--txt3)">${cur}</div>` : ''}
        </div>
        ${yaSelec
          ? '<span style="font-size:10px;color:var(--txt3)">Ya seleccionado</span>'
          : `<button class="btn-s" style="font-size:10px;padding:3px 8px" onclick="_addActAlumno('${a.id}')">+ Agregar</button>`}
      </div>`;
  }).join('');
}

function _addActAlumno(id) {
  const nombre = _actAlumnosMap[id];
  if (!nombre || _actAlumnosSel.some(s => s.id === id)) return;
  _actAlumnosSel.push({ id, nombre });
  _renderActAlumnosChips();
  _buscarActAlumno();
}

function _removeActAlumno(id) {
  _actAlumnosSel = _actAlumnosSel.filter(s => s.id !== id);
  _renderActAlumnosChips();
}

function _renderActAlumnosChips() {
  const cont = document.getElementById('act-alumnos-chips');
  if (!cont) return;
  cont.innerHTML = _actAlumnosSel.map(s =>
    `<span style="display:inline-flex;align-items:center;gap:4px;background:var(--azul-l);color:var(--azul);padding:3px 8px;border-radius:10px;font-size:10px">
      ${s.nombre}
      <button onclick="_removeActAlumno('${s.id}')" style="background:none;border:none;cursor:pointer;padding:0;font-size:14px;color:var(--azul);line-height:1">×</button>
    </span>`).join('');
}

async function _guardarActividad() {
  const titulo = document.getElementById('act-titulo')?.value.trim();
  const tipo   = document.getElementById('act-tipo')?.value;
  const fecha  = getFechaInput('act-fecha');
  if (!titulo) { alert('El título es obligatorio.'); return; }
  if (!tipo)   { alert('Seleccioná el tipo de actividad.'); return; }
  if (!fecha)  { alert('La fecha es obligatoria.'); return; }

  const destTipo = document.querySelector('[name="act-dest-tipo"]:checked')?.value || 'nivel_completo';
  let destinatarios_ids   = null;
  let destinatarios_texto = null;
  let nivel_destinatario  = null;

  if (destTipo === 'nivel_completo') {
    nivel_destinatario = document.getElementById('act-nivel-completo')?.value || null;
    if (!nivel_destinatario) { alert('Seleccioná el nivel de los destinatarios.'); return; }
    destinatarios_ids   = (window._actTodosCursos || []).filter(c => c.nivel === nivel_destinatario).map(c => c.id);
    destinatarios_texto = `Nivel ${nivel_destinatario}`;
  } else if (destTipo === 'cursos_multiples') {
    const chks = [...document.querySelectorAll('.act-curso-chk:checked')];
    if (!chks.length) { alert('Seleccioná al menos un curso.'); return; }
    destinatarios_ids   = chks.map(c => c.value);
    destinatarios_texto = chks.map(c => c.dataset.label).join(', ');
  } else {
    if (!_actAlumnosSel.length) { alert('Seleccioná al menos un alumno.'); return; }
    destinatarios_ids   = _actAlumnosSel.map(s => s.id);
    destinatarios_texto = `${_actAlumnosSel.length} alumno${_actAlumnosSel.length > 1 ? 's' : ''}`;
  }

  const relTipo    = document.querySelector('[name="act-rel-tipo"]:checked')?.value || '';
  const probId     = relTipo === 'prob' ? (document.getElementById('act-prob')?.value    || null) : null;
  const objetivoId = relTipo === 'obj'  ? (document.getElementById('act-objetivo')?.value || null) : null;
  const hora       = document.getElementById('act-hora')?.value || null;
  const lugar      = document.getElementById('act-lugar')?.value.trim() || null;
  const objTxt     = document.getElementById('act-objetivo-txt')?.value.trim() || null;
  const resultado  = document.getElementById('act-desc')?.value.trim() || null;
  const enAgenda   = document.getElementById('act-en-agenda')?.classList.contains('on') || false;
  const tematica0  = document.getElementById('enc-tematica-0')?.value.trim() || null;

  const btn = document.querySelector('#modal-act-eoe .btn-p');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  const { data: nueva, error } = await sb.from('reuniones').insert({
    institucion_id:     USUARIO_ACTUAL.institucion_id,
    creado_por:         USUARIO_ACTUAL.id,
    titulo,
    fecha,
    hora:               hora || null,
    lugar,
    descripcion:        objTxt,
    objetivo_actividad: objTxt,
    resultado,
    tipo_actividad:     tipo,
    problematica_id:    probId     || null,
    objetivo_id:        objetivoId || null,
    destinatarios_tipo: destTipo,
    destinatarios_ids:  destinatarios_ids?.length ? destinatarios_ids : null,
    destinatarios_texto,
    nivel_destinatario,
    en_agenda:          enAgenda,
  }).select().single();

  if (error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar actividad'; }
    alert('Error al guardar: ' + error.message);
    return;
  }

  // Encuentros adicionales
  const encRows = [];
  if (tematica0 || hora) {
    encRows.push({ reunion_id: nueva.id, fecha, hora: hora || null, tematica: tematica0, orden: 1 });
  }
  _actEncuentros.forEach((enc, i) => {
    encRows.push({
      reunion_id: nueva.id,
      fecha:      getFechaInput('enc-fecha-' + i) || enc.fecha || fecha,
      hora:       document.getElementById('enc-hora-' + i)?.value || null,
      tematica:   document.getElementById('enc-tematica-extra-' + i)?.value?.trim() || null,
      orden:      i + 2,
    });
  });
  if (encRows.length) await sb.from('actividad_encuentros').insert(encRows);

  // Invitados + notificaciones
  const invChks = [...document.querySelectorAll('.act-inv-chk:checked')];
  if (invChks.length) {
    const { error: errInv } = await sb.from('reunion_invitados').insert(
      invChks.map(c => ({ reunion_id: nueva.id, usuario_id: c.value, estado: 'pendiente' }))
    );
    if (errInv) console.error('reunion_invitados insert error:', errInv.message);
    const fechaStr = formatFechaCorta(fecha);
    const { error: errNotif } = await sb.from('notificaciones').insert(
      invChks.map(c => ({
        usuario_id:       c.value,
        tipo:             'invitacion_actividad_eoe',
        titulo:           `Invitación: ${titulo}`,
        descripcion:      `${_ACT_TIPO_LABEL[tipo] || tipo} · ${fechaStr}${hora ? ' · ' + hora.slice(0,5) : ''}${lugar ? ' · ' + lugar : ''} — Convoca ${USUARIO_ACTUAL.nombre_completo}`,
        referencia_id:    nueva.id,
        referencia_tabla: 'reuniones',
      }))
    );
    if (errNotif) console.error('notificaciones insert error:', errNotif.message);
  }

  // Agregar a agenda institucional
  if (enAgenda) {
    const { error: errAgenda } = await sb.from('eventos_institucionales').insert({
      institucion_id:      USUARIO_ACTUAL.institucion_id,
      creado_por:          USUARIO_ACTUAL.id,
      nombre:              titulo,
      nivel:               nivel_destinatario || 'todos',
      fecha_inicio:        fecha,
      hora:                hora || null,
      lugar,
      descripcion:         objTxt || null,
      convocatoria_grupos: [],
      convocados_ids:      [],
      responsables_ids:    [],
    });
    if (errAgenda) console.error('eventos_institucionales insert error:', errAgenda.message);
  }

  _cerrarModalObj('modal-act-eoe');
  _toastObj('✓ Actividad registrada correctamente');
  await rEOE();
}

function _renderActividadesEOE(actividades, hoy) {
  if (!actividades.length) return '<div class="empty-state">📋<br>Sin actividades registradas</div>';
  const proximas = actividades.filter(a => a.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const pasadas  = actividades.filter(a => a.fecha < hoy);
  let out = '';
  if (proximas.length) {
    out += `<div style="font-size:10px;font-weight:600;color:var(--verde);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Próximas</div>`;
    out += proximas.map(a => _renderActCard(a, hoy)).join('');
  }
  if (pasadas.length) {
    out += `<div style="font-size:10px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.5px;margin:${proximas.length ? '12px' : '0'} 0 6px">Realizadas</div>`;
    out += pasadas.map(a => _renderActCard(a, hoy)).join('');
  }
  return out;
}

async function _verDetalleActividad(id) {
  const [actRes, encRes] = await Promise.all([
    sb.from('reuniones')
      .select('*, prob:problematicas(descripcion), obj:objetivos(nombre)')
      .eq('id', id).single(),
    sb.from('actividad_encuentros').select('*').eq('reunion_id', id).order('orden'),
  ]);
  if (actRes.error) { alert('Error al cargar la actividad.'); return; }
  const a    = actRes.data;
  const encs = encRes.data || [];
  const esEOE    = USUARIO_ACTUAL.rol === 'eoe';
  const esPasada = a.fecha < hoyISO();
  const tipoLabel = _ACT_TIPO_LABEL[a.tipo_actividad] || a.tipo_actividad;

  const encHTML = encs.length
    ? encs.map((e, i) => `
      <div style="padding:8px 0;border-bottom:1px solid var(--brd)">
        <div style="font-size:10px;font-weight:600;color:var(--txt3);text-transform:uppercase;margin-bottom:3px">Encuentro ${e.orden || i + 1}</div>
        <div style="font-size:12px;font-weight:500">${formatFechaCorta(e.fecha)}${e.hora ? ' · ' + e.hora.slice(0, 5) : ''}</div>
        ${e.tematica ? `<div style="font-size:11px;color:var(--txt2);margin-top:2px">${e.tematica}</div>` : ''}
      </div>`).join('')
    : `<div style="font-size:11px;color:var(--txt2);padding:6px 0">Encuentro único: ${formatFechaCorta(a.fecha)}${a.hora ? ' · ' + a.hora.slice(0, 5) : ''}</div>`;

  const probTxt = a.prob?.descripcion;
  const objNom  = a.obj?.nombre;

  const html = `
    <div style="display:grid;gap:14px">
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span class="tag tp">${tipoLabel}</span>
        ${a.en_agenda ? '<span class="tag tg" style="font-size:9px">En agenda</span>' : ''}
        <span class="tag ${esPasada ? 'tgr' : 'tg'}">${esPasada ? 'Realizada' : 'Próxima'}</span>
      </div>

      <div>
        <div style="font-size:10px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Encuentros</div>
        ${encHTML}
      </div>

      ${a.lugar ? `<div>
        <div style="font-size:10px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">Lugar</div>
        <div style="font-size:12px">${a.lugar}</div>
      </div>` : ''}

      ${a.destinatarios_texto ? `<div>
        <div style="font-size:10px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">Destinatarios</div>
        <div style="font-size:12px">${a.destinatarios_texto}</div>
      </div>` : ''}

      ${probTxt || objNom ? `<div>
        <div style="font-size:10px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Relacionado con</div>
        ${probTxt ? `<div style="font-size:11px;color:var(--txt2)">Problemática: ${probTxt}</div>` : ''}
        ${objNom  ? `<div style="font-size:11px;color:var(--txt2)">Objetivo: ${objNom}</div>`      : ''}
      </div>` : ''}

      ${a.objetivo_actividad ? `<div>
        <div style="font-size:10px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">Objetivo de la actividad</div>
        <div style="font-size:12px;color:var(--txt2);font-style:italic">${a.objetivo_actividad}</div>
      </div>` : ''}

      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-size:10px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.4px">Resultado / descripción</div>
          ${esEOE ? `<button class="btn-s" style="font-size:10px;padding:3px 8px" onclick="_toggleEditarResultado('${a.id}')">Editar</button>` : ''}
        </div>
        <div id="det-res-display-${a.id}">
          ${a.resultado
            ? `<div style="font-size:12px;padding:8px 10px;background:var(--verde-l);border-radius:var(--rad)">${a.resultado}</div>`
            : `<div style="font-size:11px;color:var(--txt2);font-style:italic">Sin resultado registrado aún.</div>`}
        </div>
        <div id="det-res-edit-${a.id}" style="display:none">
          <textarea id="det-res-ta-${a.id}" rows="3" style="width:100%;margin-bottom:6px" placeholder="Describí lo sucedido y logrado en la actividad...">${a.resultado || ''}</textarea>
          <div style="display:flex;gap:6px;justify-content:flex-end">
            <button class="btn-s" style="font-size:11px" onclick="_toggleEditarResultado('${a.id}')">Cancelar</button>
            <button class="btn-p" id="btn-save-res-${a.id}" style="font-size:11px" onclick="_guardarResultadoActividad('${a.id}')">Guardar</button>
          </div>
        </div>
      </div>
    </div>`;

  const btns = `
    ${esEOE ? `<button class="btn-s" onclick="_abrirEditarActividad('${a.id}')">Editar actividad</button>` : ''}
    <button class="btn-p" onclick="_cerrarModalObj('modal-det-act')">Cerrar</button>`;
  _objModal('modal-det-act', a.titulo, html, btns);
}

function _toggleEditarResultado(actId) {
  const display = document.getElementById(`det-res-display-${actId}`);
  const edit    = document.getElementById(`det-res-edit-${actId}`);
  if (!display || !edit) return;
  const abriendo = edit.style.display === 'none';
  display.style.display = abriendo ? 'none' : '';
  edit.style.display    = abriendo ? ''     : 'none';
}

async function _guardarResultadoActividad(actId) {
  const ta  = document.getElementById(`det-res-ta-${actId}`);
  const btn = document.getElementById(`btn-save-res-${actId}`);
  if (!ta) return;
  const resultado = ta.value.trim() || null;
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  const { error } = await sb.from('reuniones').update({ resultado }).eq('id', actId);
  if (error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
    alert('Error: ' + error.message);
    return;
  }
  _cerrarModalObj('modal-det-act');
  _toastObj('✓ Resultado guardado');
  await rEOE();
}

async function _abrirEditarActividad(actId) {
  _cerrarModalObj('modal-det-act');
  const { data: a, error } = await sb.from('reuniones').select('*').eq('id', actId).single();
  if (error || !a) { alert('Error al cargar la actividad.'); return; }

  const html = `
    <div style="display:grid;gap:14px">
      <div><label class="lbl">Título *</label>
        <input type="text" id="edit-act-titulo" value="${(a.titulo || '').replace(/"/g, '&quot;')}"></div>
      <div><label class="lbl">Tipo *</label>
        <select id="edit-act-tipo" style="width:100%">
          <option value="charla"${a.tipo_actividad === 'charla' ? ' selected' : ''}>Charla</option>
          <option value="taller"${a.tipo_actividad === 'taller' ? ' selected' : ''}>Taller</option>
          <option value="entrevista_grupal"${a.tipo_actividad === 'entrevista_grupal' ? ' selected' : ''}>Entrevista grupal</option>
          <option value="otra"${a.tipo_actividad === 'otra' ? ' selected' : ''}>Otra</option>
        </select></div>
      <div><label class="lbl">Lugar</label>
        <input type="text" id="edit-act-lugar" value="${(a.lugar || '').replace(/"/g, '&quot;')}"></div>
      <div><label class="lbl">Objetivo de la actividad</label>
        <textarea id="edit-act-obj-txt" rows="2">${a.objetivo_actividad || ''}</textarea></div>
      <div><label class="lbl">Resultado / descripción</label>
        <textarea id="edit-act-resultado" rows="3">${a.resultado || ''}</textarea></div>
    </div>`;

  const btns = `
    <button class="btn-s" onclick="_cerrarModalObj('modal-edit-act')">Cancelar</button>
    <button class="btn-p" onclick="_guardarEdicionActividad('${actId}')">Guardar cambios</button>`;
  _objModal('modal-edit-act', 'Editar actividad', html, btns);
}

async function _guardarEdicionActividad(actId) {
  const titulo    = document.getElementById('edit-act-titulo')?.value.trim();
  const tipo      = document.getElementById('edit-act-tipo')?.value;
  const lugar     = document.getElementById('edit-act-lugar')?.value.trim() || null;
  const objTxt    = document.getElementById('edit-act-obj-txt')?.value.trim() || null;
  const resultado = document.getElementById('edit-act-resultado')?.value.trim() || null;
  if (!titulo) { alert('El título es obligatorio.'); return; }
  const btn = document.querySelector('#modal-edit-act .btn-p');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  const { error } = await sb.from('reuniones').update({
    titulo, tipo_actividad: tipo, lugar,
    objetivo_actividad: objTxt, descripcion: objTxt, resultado,
  }).eq('id', actId);
  if (error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar cambios'; }
    alert('Error: ' + error.message);
    return;
  }
  _cerrarModalObj('modal-edit-act');
  _toastObj('✓ Actividad actualizada');
  await rEOE();
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