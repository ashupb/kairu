// =====================================================
// PROBLEMATICAS.JS — v3 (soporte grupal)
// =====================================================

let _probFiltros = { estado: 'activas', urgencia: 'todas', nivel: 'todos' };

// ─── HELPERS ──────────────────────────────────────────
function labelTipoProb(t) {
  return {
    académica:'Académica', conductual:'Conductual', familiar:'Familiar',
    salud:'Salud', socioemocional:'Socioemocional', ausentismo:'Ausentismo', otros:'Otros',
    convivencia:'Convivencia', emocional:'Emocional', aprendizaje:'Aprendizaje',
    conducta:'Conducta', otro:'Otro',
  }[t] || (t || '—');
}

const TIPOS_LABEL_PROB = ['Académica','Conductual','Familiar','Salud','Socioemocional','Ausentismo','Otros'];
const TIPOS_VALOR_PROB = {
  'Académica':'académica', 'Conductual':'conductual', 'Familiar':'familiar',
  'Salud':'salud', 'Socioemocional':'socioemocional', 'Ausentismo':'ausentismo', 'Otros':'otros',
};

// ─── PERMISOS ─────────────────────────────────────────
function probPermisos() {
  const rol = USUARIO_ACTUAL.rol;
  return {
    verTodas:    ['director_general','directivo_nivel','eoe','preceptor'].includes(rol),
    soloPropias: rol === 'docente',
    soloCursos:  false,
    crear:       true,
    agregarSeg:  ['director_general','directivo_nivel','eoe','preceptor'].includes(rol),
    cerrar:      ['director_general','directivo_nivel','eoe'].includes(rol),
    reabrir:     ['director_general','directivo_nivel','eoe'].includes(rol),
  };
}

function puedeAgregarSeg(prob) {
  const perm = probPermisos();
  return perm.agregarSeg || (prob && prob.responsable_id === USUARIO_ACTUAL.id);
}

let _probMigracionOk = null;
async function detectarMigracion() {
  if (_probMigracionOk !== null) return _probMigracionOk;
  const { error } = await sb.from('problematicas').select('nivel').limit(1);
  _probMigracionOk = !error || !error.message?.includes('column');
  return _probMigracionOk;
}

// ─── DATA FETCH CON PERMISOS ──────────────────────────
async function getProblematicasData() {
  const perm   = probPermisos();
  const instId = USUARIO_ACTUAL.institucion_id;
  const f      = _probFiltros;
  const migOk  = await detectarMigracion();

  const selectBase = `*,
    alumnos_grupo:problematica_alumnos(alumno_id),
    alumno:alumnos(id,nombre,apellido,curso:cursos(id,nombre,division${migOk ? ',nivel' : ''})),
    registrado_por_usuario:usuarios!problematicas_registrado_por_fkey(id,nombre_completo)
    ${migOk ? ',responsable:usuarios!problematicas_responsable_id_fkey(id,nombre_completo)' : ''}`;

  let q = sb.from('problematicas')
    .select(selectBase)
    .eq('institucion_id', instId)
    .is('problematica_madre_id', null);

  if (f.estado === 'activas')    q = q.in('estado', ['abierta','en_seguimiento']);
  else if (f.estado !== 'todas') q = q.eq('estado', f.estado);

  if (f.urgencia !== 'todas') q = q.eq('urgencia', f.urgencia);
  if (migOk && f.nivel !== 'todos') q = q.eq('nivel', f.nivel);

  if (perm.soloPropias) {
    q = q.eq('registrado_por', USUARIO_ACTUAL.id);
  } else if (perm.soloCursos) {
    const cursosIds = USUARIO_ACTUAL.cursos_ids || [];
    if (!cursosIds.length) return { data: [] };
    const { data: als } = await sb.from('alumnos').select('id').in('curso_id', cursosIds);
    const alumnoIds = (als || []).map(a => a.id);
    if (!alumnoIds.length) return { data: [] };
    q = q.in('alumno_id', alumnoIds);
  }

  q = q.order('urgencia', { ascending: false }).order('created_at', { ascending: false });
  return q;
}

// ─── ENTRADA PRINCIPAL ────────────────────────────────
async function rProb() {
  showLoading('prob');
  try {
    await detectarMigracion();
    const q               = await getProblematicasData();
    const { data, error } = await q;
    if (error) throw error;

    let lista = data || [];
    if (USUARIO_ACTUAL.rol === 'preceptor') {
      if (USUARIO_ACTUAL.nivel) {
        lista = lista.filter(p => {
          const mod = p.modalidad || 'individual';
          if (mod === 'grupal' || mod === 'curso') return p.nivel === USUARIO_ACTUAL.nivel;
          return p.alumno?.curso?.nivel === USUARIO_ACTUAL.nivel;
        });
      }
      lista = lista.filter(p => !p.confidencial || p.responsable_id === USUARIO_ACTUAL.id);
    }
    window._probCache = lista;

    const abiertas = lista.filter(p => p.estado === 'abierta').length;
    const enSeg    = lista.filter(p => p.estado === 'en_seguimiento').length;
    const cerradas = lista.filter(p => p.estado === 'cerrada' || p.estado === 'resuelta' || p.estado === 'derivada').length;
    const perm     = probPermisos();

    const c = document.getElementById('page-prob');
    c.innerHTML = `
      <div class="pg-t">Problemáticas</div>
      <div class="pg-s">Seguimiento de situaciones · ${INSTITUCION_ACTUAL?.nombre || ''}</div>
      <div class="metrics m3">
        <div class="mc"><div class="mc-v" style="color:var(--rojo)">${abiertas}</div><div class="mc-l">Sin atender</div></div>
        <div class="mc"><div class="mc-v" style="color:var(--ambar)">${enSeg}</div><div class="mc-l">En seguimiento</div></div>
        <div class="mc"><div class="mc-v" style="color:var(--verde)">${cerradas}</div><div class="mc-l">Cerradas</div></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div class="sec-lb" style="margin:0">Filtros</div>
        ${perm.crear ? '<button class="btn-p" onclick="mostrarFormProb()">+ Registrar situación</button>' : ''}
      </div>
      ${renderFiltrosProb()}
      <div id="prob-lista" style="margin-top:10px">${renderListaProb(lista)}</div>
      <div id="form-prob"></div>`;

  } catch(e) { showError('prob', 'Error: ' + e.message); }
}

// ─── FILTROS ──────────────────────────────────────────
function renderFiltrosProb() {
  const f = _probFiltros;
  const chip = (campo, val, lbl, extra = '') => {
    const on = f[campo] === val;
    return `<div class="chip${on ? ' on' : ''}" style="${on ? '' : extra}" onclick="setFiltroProb('${campo}','${val}')">${lbl}</div>`;
  };
  return `
    <div style="display:flex;flex-direction:column;gap:6px">
      <div class="chip-row">
        ${chip('estado','activas','Activas')}
        ${chip('estado','abierta','Sin atender')}
        ${chip('estado','en_seguimiento','Seguimiento')}
        ${chip('estado','cerrada','Cerradas')}
        ${chip('estado','todas','Todas')}
      </div>
      <div class="chip-row">
        ${chip('urgencia','todas','Todas')}
        ${chip('urgencia','alta','Alta',   'color:var(--rojo);border-color:rgba(192,57,43,.3);background:var(--rojo-l)')}
        ${chip('urgencia','media','Media', 'color:var(--ambar);border-color:rgba(214,137,16,.3);background:var(--amb-l)')}
        ${chip('urgencia','baja','Baja',   'color:var(--verde);border-color:rgba(26,74,46,.3);background:var(--verde-l)')}
      </div>
      ${(_probMigracionOk === true) ? `<div class="chip-row">
        ${chip('nivel','todos','Todos los niveles')}
        ${chip('nivel','inicial','Inicial')}
        ${chip('nivel','primario','Primario')}
        ${chip('nivel','secundario','Secundario')}
      </div>` : ''}
    </div>`;
}

async function setFiltroProb(campo, valor) {
  _probFiltros[campo] = valor;
  await rProb();
}

// ─── RENDER LISTA ─────────────────────────────────────
function renderListaProb(lista) {
  if (!lista.length) return '<div class="empty-state">✓<br>No hay problemáticas con los filtros aplicados</div>';
  return lista.map(p => {
    const open      = EX === 'pr-' + p.id;
    const modalidad = p.modalidad || 'individual';
    const esGrupal  = modalidad === 'grupal' || modalidad === 'curso';

    let ini, nom, cur;
    if (esGrupal) {
      const contAlumnos = (p.alumnos_grupo || []).length;
      ini = modalidad === 'curso' ? 'CC' : 'GR';
      nom = modalidad === 'curso'
        ? `Curso completo · ${contAlumnos} alumno${contAlumnos !== 1 ? 's' : ''}`
        : `Grupal · ${contAlumnos} alumno${contAlumnos !== 1 ? 's' : ''}`;
      cur = p.nivel ? p.nivel[0].toUpperCase() + p.nivel.slice(1) : '—';
    } else {
      ini = (p.alumno?.apellido?.[0] || '?') + (p.alumno?.nombre?.[0] || '');
      nom = p.alumno ? `${p.alumno.apellido}, ${p.alumno.nombre}` : '—';
      const curso = p.alumno?.curso;
      cur = curso ? `${curso.nombre} ${curso.division || ''}`.trim() : '—';
    }

    const nivel  = p.nivel || p.alumno?.curso?.nivel || '';
    const resp   = p.responsable?.nombre_completo;
    const urgCls = p.urgencia === 'alta' ? 'ua' : p.urgencia === 'media' ? 'um' : 'ub';
    const urgTag = p.urgencia === 'alta' ? 'tr' : p.urgencia === 'media' ? 'ta' : 'tg';
    const estCls = p.estado === 'abierta' ? 'tr' : p.estado === 'en_seguimiento' ? 'ta' : 'tg';
    const estLbl = { abierta:'Sin atender', en_seguimiento:'En seguimiento', cerrada:'Cerrada', resuelta:'Cerrada', derivada:'Derivada' }[p.estado] || p.estado;
    const avBg   = esGrupal ? 'var(--azul-l)' : 'var(--rojo-l)';
    const avCl   = esGrupal ? 'var(--azul)'   : 'var(--rojo)';

    return `
      <div class="caso-c ${urgCls}">
        <div class="caso-top" onclick="togProb('pr-${p.id}')">
          <div class="av av32" style="background:${avBg};color:${avCl};font-size:10px;font-weight:700">${ini}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600">${nom}</div>
            <div style="font-size:10px;color:var(--txt2)">${cur}${nivel && !esGrupal ? ' · ' + nivel[0].toUpperCase() + nivel.slice(1) : ''} · ${labelTipoProb(p.tipo)}</div>
            <div style="font-size:10px;color:var(--txt3);margin-top:1px">${resp ? 'Resp: ' + resp + ' · ' : ''}${tiempoDesde(p.created_at)}</div>
            <div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">
              <span class="tag ${urgTag}">Urgencia ${p.urgencia}</span>
              <span class="tag ${estCls}">${estLbl}</span>
              ${esGrupal ? `<span class="tag td">${modalidad === 'curso' ? 'Curso' : 'Grupal'}</span>` : ''}
              ${p.confidencial ? '<span class="tag td">Confidencial</span>' : ''}
            </div>
          </div>
          <span style="font-size:11px;color:var(--txt2)">${open ? '▲' : '▼'}</span>
        </div>
        ${open ? `<div id="det-${p.id}" class="caso-det"><div class="loading-state small"><div class="spinner"></div></div></div>` : ''}
      </div>`;
  }).join('');
}

// ─── TOGGLE ───────────────────────────────────────────
async function togProb(key) {
  togEx(key, () => {
    const lista = document.getElementById('prob-lista');
    if (lista) lista.innerHTML = renderListaProb(window._probCache || []);
  });
  if (EX === key) {
    const probId = key.replace('pr-', '');
    setTimeout(() => cargarDetProb(probId), 50);
  }
}

// ─── DETALLE ──────────────────────────────────────────
async function cargarDetProb(probId) {
  const det  = document.getElementById('det-' + probId);
  if (!det) return;
  const prob      = (window._probCache || []).find(p => p.id === probId);
  const modalidad = prob?.modalidad || 'individual';
  const esGrupal  = modalidad === 'grupal' || modalidad === 'curso';

  const { data: intvs } = await sb
    .from('intervenciones')
    .select('*, usr:usuarios!intervenciones_registrado_por_fkey(nombre_completo)')
    .eq('problematica_id', probId)
    .order('created_at', { ascending: true });

  let hijasHTML = '';
  if (esGrupal) {
    const { data: hijas } = await sb
      .from('problematicas')
      .select('id, estado, alumno:alumnos(id,nombre,apellido,curso:cursos(nombre,division))')
      .eq('problematica_madre_id', probId)
      .order('created_at');

    if (hijas?.length) {
      const eCls = e => e === 'abierta' ? 'tr' : e === 'en_seguimiento' ? 'ta' : 'tg';
      const eLbl = e => ({ abierta:'Sin atender', en_seguimiento:'Seguimiento', cerrada:'Cerrada', resuelta:'Cerrada', derivada:'Derivada' }[e] || e);
      hijasHTML = `
        <div style="font-size:10px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">
          Alumnos involucrados (${hijas.length})
        </div>
        ${hijas.map(h => {
          const al  = h.alumno;
          const nom = al ? `${al.apellido}, ${al.nombre}` : '—';
          const cur = al?.curso ? `${al.curso.nombre} ${al.curso.division || ''}`.trim() : '';
          return `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--brd)">
              <div style="flex:1;min-width:0">
                <div style="font-size:11px;font-weight:600">${nom}</div>
                ${cur ? `<div style="font-size:10px;color:var(--txt2)">${cur}</div>` : ''}
              </div>
              <span class="tag ${eCls(h.estado)}" style="font-size:9px;flex-shrink:0">${eLbl(h.estado)}</span>
              <button class="btn-s" style="font-size:10px;padding:3px 8px;flex-shrink:0"
                onclick="abrirDetalleHija('${h.id}')">Ver →</button>
            </div>`;
        }).join('')}
        <div style="margin-bottom:14px"></div>`;
    }
  }

  const perm     = probPermisos();
  const puedeSeg = puedeAgregarSeg(prob);
  const cerrada  = prob?.estado === 'cerrada' || prob?.estado === 'resuelta' || prob?.estado === 'derivada';

  const dotColor = t => t === 'Caso cerrado' ? 'var(--verde)' : t === 'Caso reabierto' ? 'var(--ambar)' : 'var(--azul)';
  const invsHTML = (intvs || []).length
    ? intvs.map(iv => `
        <div class="tl-it">
          <div class="tl-d" style="background:${dotColor(iv.titulo)}"></div>
          <div class="tl-f">${formatFechaCorta(iv.created_at?.split('T')[0])}</div>
          <div style="flex:1;min-width:0">
            <div class="tl-t">${iv.titulo}</div>
            <div class="tl-ds">${iv.descripcion}</div>
            ${iv.proximo_paso ? `<div style="font-size:10px;color:var(--verde);font-weight:500;margin-top:2px">→ ${iv.proximo_paso}</div>` : ''}
            <div style="font-size:10px;color:var(--txt3);margin-top:2px">${iv.usr?.nombre_completo || '—'}</div>
          </div>
        </div>`).join('')
    : '<div style="font-size:11px;color:var(--txt2);padding:4px 0">Sin intervenciones aún.</div>';

  det.innerHTML = `
    <div style="padding:12px 14px">
      ${prob?.descripcion ? `<div style="font-size:11px;color:var(--txt2);line-height:1.5;padding:8px 10px;background:var(--surf);border-radius:var(--rad);margin-bottom:10px">${prob.descripcion}</div>` : ''}
      ${cerrada && prob?.motivo_cierre ? `<div style="background:var(--verde-l);border-radius:var(--rad);padding:8px 10px;margin-bottom:10px;font-size:11px"><span style="font-weight:600;color:var(--verde)">Cerrada</span> · ${prob.motivo_cierre}${prob.cerrado_at ? ' · ' + formatFechaLatam(prob.cerrado_at.split('T')[0]) : ''}</div>` : ''}

      ${hijasHTML}

      <div style="font-size:10px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Bitácora${esGrupal ? ' grupal' : ' de seguimiento'}</div>
      ${invsHTML}

      ${puedeSeg && !cerrada ? `
      <div style="margin-top:12px;border-top:1px solid var(--brd);padding-top:12px">
        <div style="font-size:11px;font-weight:600;margin-bottom:8px">Agregar seguimiento${esGrupal ? ' grupal' : ''}</div>
        <textarea id="id-${probId}" rows="2" placeholder="Describí la acción tomada..."></textarea>
        <input type="text" id="ip-${probId}" placeholder="Próximo paso (opcional)" style="margin-top:6px">
        <div class="acc" style="margin-top:8px">
          <button class="btn-p" style="font-size:11px" onclick="guardarSeguimiento('${probId}')">Guardar</button>
        </div>
      </div>` : ''}

      <div class="acc" style="margin-top:10px;border-top:1px solid var(--brd);padding-top:10px">
        ${perm.cerrar && !cerrada ? `<button class="btn-d" style="font-size:11px" onclick="mostrarFormCierre('${probId}')">Cerrar caso</button>` : ''}
        ${perm.reabrir && cerrada ? `<button class="btn-s" style="font-size:11px" onclick="reabrirProb('${probId}')">Reabrir caso</button>` : ''}
      </div>
      <div id="cierre-form-${probId}"></div>
    </div>`;
}

// ─── DETALLE HIJA (modal) ─────────────────────────────
async function abrirDetalleHija(hijaId) {
  const { data: hija } = await sb
    .from('problematicas')
    .select(`*,
      alumno:alumnos(id,nombre,apellido,curso:cursos(nombre,division)),
      responsable:usuarios!problematicas_responsable_id_fkey(id,nombre_completo)`)
    .eq('id', hijaId)
    .single();

  const { data: intvs } = await sb
    .from('intervenciones')
    .select('*, usr:usuarios!intervenciones_registrado_por_fkey(nombre_completo)')
    .eq('problematica_id', hijaId)
    .order('created_at', { ascending: true });

  if (!hija) return;

  const perm    = probPermisos();
  const cerrada = hija.estado === 'cerrada' || hija.estado === 'resuelta' || hija.estado === 'derivada';
  const nom     = hija.alumno ? `${hija.alumno.apellido}, ${hija.alumno.nombre}` : '—';
  const cur     = hija.alumno?.curso ? `${hija.alumno.curso.nombre} ${hija.alumno.curso.division || ''}`.trim() : '';
  const madreId = hija.problematica_madre_id;

  const dotColor = t => t === 'Caso cerrado' ? 'var(--verde)' : t === 'Caso reabierto' ? 'var(--ambar)' : 'var(--azul)';
  const invsHTML = (intvs || []).length
    ? intvs.map(iv => `
        <div class="tl-it">
          <div class="tl-d" style="background:${dotColor(iv.titulo)}"></div>
          <div class="tl-f">${formatFechaCorta(iv.created_at?.split('T')[0])}</div>
          <div style="flex:1;min-width:0">
            <div class="tl-t">${iv.titulo}</div>
            <div class="tl-ds">${iv.descripcion}</div>
            ${iv.proximo_paso ? `<div style="font-size:10px;color:var(--verde);font-weight:500;margin-top:2px">→ ${iv.proximo_paso}</div>` : ''}
            <div style="font-size:10px;color:var(--txt3);margin-top:2px">${iv.usr?.nombre_completo || '—'}</div>
          </div>
        </div>`).join('')
    : '<div style="font-size:11px;color:var(--txt2);padding:4px 0">Sin intervenciones individuales aún.</div>';

  document.getElementById('modal-hija-prob')?.remove();
  const modal = document.createElement('div');
  modal.id = 'modal-hija-prob';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.46);z-index:310;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
  modal.innerHTML = `
    <div style="background:var(--surf);border-radius:var(--rad-lg);width:100%;max-width:500px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.24)">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--brd);flex-shrink:0">
        <div>
          <div style="font-size:10px;color:var(--azul);font-weight:600;margin-bottom:2px">↑ Parte de problemática grupal</div>
          <div style="font-size:14px;font-weight:700">${nom}${cur ? ' · ' + cur : ''}</div>
        </div>
        <button onclick="document.getElementById('modal-hija-prob').remove()"
          style="background:none;border:none;cursor:pointer;font-size:22px;color:var(--txt2);padding:0 4px;line-height:1">×</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:16px 18px">
        ${hija.descripcion ? `<div style="font-size:11px;color:var(--txt2);line-height:1.5;padding:8px 10px;background:var(--surf2);border-radius:var(--rad);margin-bottom:12px">${hija.descripcion}</div>` : ''}
        <div style="font-size:10px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Bitácora individual</div>
        ${invsHTML}
        ${perm.agregarSeg && !cerrada ? `
        <div style="margin-top:12px;border-top:1px solid var(--brd);padding-top:12px">
          <div style="font-size:11px;font-weight:600;margin-bottom:8px">Agregar seguimiento individual</div>
          <textarea id="id-hija-${hijaId}" rows="2" placeholder="Describí la acción tomada..."></textarea>
          <input type="text" id="ip-hija-${hijaId}" placeholder="Próximo paso (opcional)" style="margin-top:6px">
          <div class="acc" style="margin-top:8px">
            <button class="btn-p" style="font-size:11px" onclick="guardarSegHija('${hijaId}','${madreId}')">Guardar</button>
          </div>
        </div>` : ''}
        ${perm.cerrar && !cerrada ? `
        <div style="margin-top:10px;border-top:1px solid var(--brd);padding-top:10px">
          <button class="btn-d" style="font-size:11px" onclick="cerrarHija('${hijaId}','${madreId}')">Cerrar seguimiento individual</button>
        </div>` : ''}
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function guardarSegHija(hijaId, madreId) {
  const d = document.getElementById('id-hija-' + hijaId)?.value.trim();
  const p = document.getElementById('ip-hija-' + hijaId)?.value.trim();
  if (!d) { alert('Describí la acción tomada.'); return; }
  const { error } = await sb.from('intervenciones').insert({
    problematica_id: hijaId,
    registrado_por:  USUARIO_ACTUAL.id,
    titulo:          'Seguimiento',
    descripcion:     d,
    proximo_paso:    p || null,
    tipo:            'otro',
  });
  if (error) { alert('Error: ' + error.message); return; }
  await sb.from('problematicas')
    .update({ estado: 'en_seguimiento', updated_at: new Date().toISOString() })
    .eq('id', hijaId);
  document.getElementById('modal-hija-prob')?.remove();
  await rProb();
  if (madreId) setTimeout(() => cargarDetProb(madreId), 100);
}

async function cerrarHija(hijaId, madreId) {
  const migOk = await detectarMigracion();
  const payload = migOk
    ? { estado:'cerrada', cerrado_por:USUARIO_ACTUAL.id, cerrado_at:new Date().toISOString(), updated_at:new Date().toISOString() }
    : { estado:'cerrada', updated_at:new Date().toISOString() };
  const { error } = await sb.from('problematicas').update(payload).eq('id', hijaId);
  if (error) { alert('Error: ' + error.message); return; }
  await sb.from('intervenciones').insert({
    problematica_id: hijaId,
    registrado_por:  USUARIO_ACTUAL.id,
    titulo:          'Caso cerrado',
    descripcion:     'Seguimiento individual cerrado.',
    tipo:            'otro',
  });
  document.getElementById('modal-hija-prob')?.remove();
  await rProb();
  if (madreId) setTimeout(() => cargarDetProb(madreId), 100);
}

// ─── SEGUIMIENTO ──────────────────────────────────────
async function guardarSeguimiento(probId) {
  const d = document.getElementById('id-' + probId)?.value.trim();
  const p = document.getElementById('ip-' + probId)?.value.trim();
  if (!d) { alert('Describí la acción tomada.'); return; }
  const { error } = await sb.from('intervenciones').insert({
    problematica_id: probId,
    registrado_por:  USUARIO_ACTUAL.id,
    titulo:          'Seguimiento',
    descripcion:     d,
    proximo_paso:    p || null,
    tipo:            'otro',
  });
  if (error) { alert('Error: ' + error.message); return; }
  await sb.from('problematicas')
    .update({ estado: 'en_seguimiento', updated_at: new Date().toISOString() })
    .eq('id', probId);
  await rProb();
}

// ─── CIERRE ───────────────────────────────────────────
function mostrarFormCierre(probId) {
  const fc = document.getElementById('cierre-form-' + probId);
  if (!fc) return;
  if (fc.innerHTML) { fc.innerHTML = ''; return; }
  fc.innerHTML = `
    <div style="margin-top:10px;padding:12px;background:var(--surf);border:1px solid var(--brd);border-radius:var(--rad)">
      <div style="font-size:11px;font-weight:600;margin-bottom:8px">Motivo de cierre</div>
      <div class="chip-row" id="motivos-${probId}">
        ${['Resuelta','Derivada externamente','Sin resolución','Archivo'].map((m, i) =>
          `<div class="chip${i === 0 ? ' on' : ''}" onclick="selChipRow(this,'motivos-${probId}')">${m}</div>`
        ).join('')}
      </div>
      <div class="acc" style="margin-top:10px">
        <button class="btn-d" style="font-size:11px" onclick="confirmarCierreProb('${probId}')">Confirmar cierre</button>
        <button class="btn-s" style="font-size:11px" onclick="document.getElementById('cierre-form-${probId}').innerHTML=''">Cancelar</button>
      </div>
    </div>`;
}

function selChipRow(el, rowId) {
  document.getElementById(rowId)?.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
}

async function confirmarCierreProb(probId) {
  const el     = document.querySelector(`#motivos-${probId} .chip.on`);
  const motivo = el?.textContent || 'Resuelta';
  const migOk  = await detectarMigracion();
  const updatePayload = migOk
    ? { estado:'cerrada', motivo_cierre:motivo, cerrado_por:USUARIO_ACTUAL.id, cerrado_at:new Date().toISOString(), updated_at:new Date().toISOString() }
    : { estado:'resuelta', updated_at:new Date().toISOString() };
  const { error } = await sb.from('problematicas').update(updatePayload).eq('id', probId);
  if (error) { alert('Error: ' + error.message); return; }
  await sb.from('intervenciones').insert({
    problematica_id: probId,
    registrado_por:  USUARIO_ACTUAL.id,
    titulo:          'Caso cerrado',
    descripcion:     `Motivo: ${motivo}`,
    tipo:            'otro',
  });
  await rProb();
}

// ─── REABRIR ──────────────────────────────────────────
async function reabrirProb(probId) {
  const migOk = await detectarMigracion();
  const payload = migOk
    ? { estado:'en_seguimiento', reabierto_por:USUARIO_ACTUAL.id, reabierto_at:new Date().toISOString(), updated_at:new Date().toISOString() }
    : { estado:'en_seguimiento', updated_at:new Date().toISOString() };
  const { error } = await sb.from('problematicas').update(payload).eq('id', probId);
  if (error) { alert('Error: ' + error.message); return; }
  await sb.from('intervenciones').insert({
    problematica_id: probId,
    registrado_por:  USUARIO_ACTUAL.id,
    titulo:          'Caso reabierto',
    descripcion:     `Reabierto por ${USUARIO_ACTUAL.nombre_completo}`,
    tipo:            'otro',
  });
  await rProb();
}

// ─── FORMULARIO NUEVA PROBLEMÁTICA ────────────────────
async function mostrarFormProb() {
  const { data: usuarios } = await sb.from('usuarios')
    .select('id,nombre_completo,rol')
    .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
    .eq('activo', true)
    .in('rol', ['eoe','preceptor','director_general','directivo_nivel'])
    .order('nombre_completo');

  const responsablesOpts = (usuarios || []).map(u =>
    `<option value="${u.id}">${u.nombre_completo} (${labelRol(u.rol)})</option>`
  ).join('');

  document.getElementById('modal-form-prob')?.remove();
  const modal = document.createElement('div');
  modal.id = 'modal-form-prob';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.46);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
  modal.innerHTML = `
    <div style="background:var(--surf);border-radius:var(--rad-lg);width:100%;max-width:520px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.24)">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--brd);flex-shrink:0">
        <span style="font-size:14px;font-weight:700">Registrar nueva situación</span>
        <button onclick="document.getElementById('modal-form-prob').remove()"
          style="background:none;border:none;cursor:pointer;font-size:22px;color:var(--txt2);padding:0 4px;line-height:1">×</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:16px 18px">

        <div class="sec-lb">Modalidad</div>
        <div class="chip-row" id="pb-modalidad">
          <div class="chip on" onclick="selChipRow(this,'pb-modalidad');onModalidadProbChange('individual')">Individual</div>
          <div class="chip" onclick="selChipRow(this,'pb-modalidad');onModalidadProbChange('grupal')">Grupal</div>
          <div class="chip" onclick="selChipRow(this,'pb-modalidad');onModalidadProbChange('curso')">Curso completo</div>
        </div>
        <div id="pb-modalidad-hint" style="font-size:10px;color:var(--txt2);margin-top:4px">Un alumno específico.</div>

        <div class="sec-lb" style="margin-top:10px">Nivel</div>
        <select id="pb-nivel" onchange="onNivelProbChange(this.value)">
          <option value="">— Seleccioná nivel —</option>
          <option value="inicial">Inicial</option>
          <option value="primario">Primario</option>
          <option value="secundario">Secundario</option>
        </select>

        <div class="sec-lb" style="margin-top:10px">Curso</div>
        <select id="pb-curso" onchange="onCursoProbChange(this.value)" disabled>
          <option value="">— Primero seleccioná nivel —</option>
        </select>

        <div class="sec-lb" style="margin-top:10px">
          Alumno/s <span id="pb-al-hint" style="font-weight:400;color:var(--txt3)">(seleccioná uno)</span>
        </div>
        <div id="pb-al-lista" style="border:1px solid var(--brd);border-radius:var(--rad);background:var(--surf2);min-height:44px;max-height:160px;overflow-y:auto">
          <div style="padding:10px 12px;font-size:11px;color:var(--txt3)">Seleccioná un curso primero</div>
        </div>
        <div id="pb-al-sel" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px"></div>

        <div class="sec-lb" style="margin-top:10px">Tipo</div>
        <div class="chip-row" id="pb-tipo">
          ${TIPOS_LABEL_PROB.map((t, i) =>
            `<div class="chip${i === 0 ? ' on' : ''}" onclick="selChipRow(this,'pb-tipo')">${t}</div>`
          ).join('')}
        </div>

        <div class="sec-lb" style="margin-top:10px">Urgencia</div>
        <div class="urg-row">
          <div class="urg-b ua" data-u="alta"  onclick="selUrgProb(this)">Alta</div>
          <div class="urg-b um" data-u="media" onclick="selUrgProb(this)">Media</div>
          <div class="urg-b"   data-u="baja"  onclick="selUrgProb(this)">Baja</div>
        </div>

        <div class="sec-lb" style="margin-top:10px">Descripción</div>
        <textarea id="pb-desc" rows="3" placeholder="Describí la situación observada..."></textarea>

        <div class="sec-lb" style="margin-top:10px">Responsable de seguimiento</div>
        <select id="pb-resp">
          <option value="">— Sin asignar —</option>
          ${responsablesOpts}
        </select>

        <div class="toggle-row-ui" style="margin-top:10px">
          <div>
            <div style="font-size:12px;font-weight:500">Confidencial</div>
            <div style="font-size:10px;color:var(--txt2)">Solo visible para EOE y directivos</div>
          </div>
          <div class="tog" id="pb-conf" onclick="this.classList.toggle('on');this.classList.toggle('off')">
            <div class="tog-thumb"></div>
          </div>
        </div>

      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--brd);flex-shrink:0">
        <button class="btn-s" onclick="document.getElementById('modal-form-prob').remove()">Cancelar</button>
        <button class="btn-p" id="btn-guardar-prob" onclick="guardarProb()">Registrar y notificar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  window._alumnosSelProb = [];
}

// ─── FORM HANDLERS ────────────────────────────────────
function onModalidadProbChange(modalidad) {
  const mHints  = { individual:'Un alumno específico.', grupal:'Múltiples alumnos del mismo u otros cursos.', curso:'Se cargarán automáticamente todos los alumnos del curso.' };
  const alHints = { individual:'(seleccioná uno)', grupal:'(podés seleccionar más de uno)', curso:'(se cargan al seleccionar el curso)' };
  const mHint  = document.getElementById('pb-modalidad-hint');
  const alHint = document.getElementById('pb-al-hint');
  if (mHint)  mHint.textContent  = mHints[modalidad]  || '';
  if (alHint) alHint.textContent = alHints[modalidad] || '';

  window._alumnosSelProb = [];
  const lista  = document.getElementById('pb-al-lista');
  const sel    = document.getElementById('pb-al-sel');
  const nivelEl = document.getElementById('pb-nivel');
  const cursoEl = document.getElementById('pb-curso');
  if (lista)   lista.innerHTML = '<div style="padding:10px 12px;font-size:11px;color:var(--txt3)">Seleccioná un curso primero</div>';
  if (sel)     sel.innerHTML   = '';
  if (nivelEl) nivelEl.value   = '';
  if (cursoEl) { cursoEl.innerHTML = '<option value="">— Primero seleccioná nivel —</option>'; cursoEl.disabled = true; }
}

async function onNivelProbChange(nivel) {
  const cursosEl = document.getElementById('pb-curso');
  const listaEl  = document.getElementById('pb-al-lista');
  window._alumnosSelProb = [];
  document.getElementById('pb-al-sel').innerHTML = '';

  if (!nivel) {
    cursosEl.innerHTML = '<option value="">— Primero seleccioná nivel —</option>';
    cursosEl.disabled = true;
    listaEl.innerHTML = '<div style="padding:10px 12px;font-size:11px;color:var(--txt3)">Seleccioná un curso primero</div>';
    return;
  }

  cursosEl.innerHTML = '<option>Cargando...</option>';
  cursosEl.disabled  = true;

  const migOk = await detectarMigracion();
  let cursoQ = sb.from('cursos').select('id,nombre,division')
    .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
    .order('nombre');
  if (migOk && nivel) cursoQ = cursoQ.eq('nivel', nivel);
  const { data } = await cursoQ;

  cursosEl.innerHTML = '<option value="">— Seleccioná curso —</option>' +
    (data || []).map(c => `<option value="${c.id}">${c.nombre} ${c.division || ''}</option>`).join('');
  cursosEl.disabled  = false;
  listaEl.innerHTML  = '<div style="padding:10px 12px;font-size:11px;color:var(--txt3)">Seleccioná un curso</div>';
}

async function onCursoProbChange(cursoId) {
  const listaEl = document.getElementById('pb-al-lista');
  window._alumnosSelProb = [];
  document.getElementById('pb-al-sel').innerHTML = '';

  if (!cursoId) {
    listaEl.innerHTML = '<div style="padding:10px 12px;font-size:11px;color:var(--txt3)">Seleccioná un curso</div>';
    return;
  }
  listaEl.innerHTML = '<div class="loading-state small"><div class="spinner"></div></div>';

  const { data } = await sb.from('alumnos')
    .select('id,nombre,apellido')
    .eq('curso_id', cursoId)
    .eq('activo', true)
    .order('apellido');

  if (!data?.length) {
    listaEl.innerHTML = '<div style="padding:10px 12px;font-size:11px;color:var(--txt3)">Sin alumnos en este curso</div>';
    return;
  }

  listaEl.innerHTML = data.map(a => {
    const nombre = (a.apellido + ', ' + a.nombre).replace(/'/g, '&apos;');
    return `
      <div id="al-opt-${a.id}" onclick="toggleAlumnoSel('${a.id}','${nombre}',this)"
        style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;transition:background .1s">
        <div id="chk-${a.id}" style="width:15px;height:15px;border-radius:3px;border:1.5px solid var(--brd);flex-shrink:0;display:flex;align-items:center;justify-content:center"></div>
        <span style="font-size:11px">${a.apellido}, ${a.nombre}</span>
      </div>`;
  }).join('');

  const modalidadEl = document.querySelector('#pb-modalidad .chip.on');
  if (modalidadEl?.textContent?.trim() === 'Curso completo') {
    data.forEach(a => {
      const nombre = (a.apellido + ', ' + a.nombre).replace(/'/g, '&apos;');
      toggleAlumnoSel(a.id, nombre, document.getElementById('al-opt-' + a.id));
    });
  }
}

function toggleAlumnoSel(alumnoId, nombre, rowEl) {
  if (!window._alumnosSelProb) window._alumnosSelProb = [];
  const idx = window._alumnosSelProb.findIndex(a => a.id === alumnoId);
  const chk = document.getElementById('chk-' + alumnoId);
  const row = document.getElementById('al-opt-' + alumnoId);
  if (idx >= 0) {
    window._alumnosSelProb.splice(idx, 1);
    if (chk) { chk.style.background = ''; chk.style.borderColor = 'var(--brd)'; chk.innerHTML = ''; }
    if (row) row.style.background = '';
  } else {
    window._alumnosSelProb.push({ id: alumnoId, nombre });
    if (chk) {
      chk.style.background = 'var(--verde)';
      chk.style.borderColor = 'var(--verde)';
      chk.innerHTML = '<svg width="9" height="7" viewBox="0 0 9 7"><path d="M1 3.5l2.5 2L8 1" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    if (row) row.style.background = 'var(--verde-p)';
  }
  const selEl = document.getElementById('pb-al-sel');
  selEl.innerHTML = window._alumnosSelProb.map(a =>
    `<span class="tag tg" style="cursor:pointer;display:inline-flex;align-items:center;gap:4px"
      onclick="toggleAlumnoSel('${a.id}','${a.nombre}',null)">
      ${a.nombre} <b style="font-size:13px;line-height:1;font-weight:400">×</b>
    </span>`
  ).join('');
}

function selUrgProb(el) {
  el.closest('.urg-row').querySelectorAll('.urg-b').forEach(b => b.className = 'urg-b');
  el.className = 'urg-b u' + el.dataset.u[0];
}

// ─── GUARDAR ──────────────────────────────────────────
async function guardarProb() {
  const nivel       = document.getElementById('pb-nivel')?.value || null;
  const desc        = document.getElementById('pb-desc')?.value.trim();
  const tipoEl      = document.querySelector('#pb-tipo .chip.on');
  const urgEl       = document.querySelector('.urg-b.ua, .urg-b.um, .urg-b.ub');
  const conf        = document.getElementById('pb-conf')?.classList.contains('on');
  const respId      = document.getElementById('pb-resp')?.value || null;
  const alumnos     = window._alumnosSelProb || [];
  const modalidadEl = document.querySelector('#pb-modalidad .chip.on');
  const modalidad   = { 'Individual':'individual', 'Grupal':'grupal', 'Curso completo':'curso' }[modalidadEl?.textContent?.trim()] || 'individual';

  if (!alumnos.length) { alert('Seleccioná al menos un alumno.'); return; }
  if (!desc)           { alert('Escribí una descripción.'); return; }
  if (modalidad === 'individual' && alumnos.length > 1) { alert('Para Individual seleccioná solo un alumno.'); return; }

  const tipo = TIPOS_VALOR_PROB[tipoEl?.textContent?.trim()] || 'otros';
  const urg  = urgEl?.dataset.u || 'media';

  const btn = document.getElementById('btn-guardar-prob');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  const migOk = await detectarMigracion();

  if (modalidad === 'individual') {
    const alumno = alumnos[0];
    const base   = {
      institucion_id: USUARIO_ACTUAL.institucion_id,
      alumno_id:      alumno.id,
      registrado_por: USUARIO_ACTUAL.id,
      tipo, urgencia: urg, descripcion: desc, confidencial: conf,
      estado: 'abierta', modalidad: 'individual',
    };
    const payload = migOk ? { ...base, responsable_id: respId || null, nivel: nivel || null } : base;
    const { data: nueva, error } = await sb.from('problematicas').insert(payload).select().single();
    if (error) {
      alert('Error: ' + error.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Registrar y notificar'; }
      return;
    }
    await crearAlertasProb(nueva.id, urg, nivel, alumno.id, respId);

  } else {
    const base = {
      institucion_id: USUARIO_ACTUAL.institucion_id,
      alumno_id:      null,
      registrado_por: USUARIO_ACTUAL.id,
      tipo, urgencia: urg, descripcion: desc, confidencial: conf,
      estado: 'abierta', modalidad,
    };
    const madrePayload = migOk ? { ...base, responsable_id: respId || null, nivel: nivel || null } : base;
    const { data: madre, error: errMadre } = await sb.from('problematicas').insert(madrePayload).select().single();
    if (errMadre) {
      alert('Error: ' + errMadre.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Registrar y notificar'; }
      return;
    }

    await sb.from('intervenciones').insert({
      problematica_id: madre.id,
      registrado_por:  USUARIO_ACTUAL.id,
      titulo:          'Problemática grupal iniciada',
      descripcion:     `${alumnos.length} alumno${alumnos.length !== 1 ? 's' : ''} involucrado${alumnos.length !== 1 ? 's' : ''}: ${alumnos.map(a => a.nombre).join(', ')}`,
      tipo:            'otro',
    });

    for (const alumno of alumnos) {
      const hijaBase    = { ...base, alumno_id: alumno.id, modalidad: 'individual', problematica_madre_id: madre.id };
      const hijaPayload = migOk ? { ...hijaBase, responsable_id: respId || null, nivel: nivel || null } : hijaBase;
      const { data: hija, error: errHija } = await sb.from('problematicas').insert(hijaPayload).select().single();
      if (errHija || !hija) continue;

      await sb.from('intervenciones').insert({
        problematica_id: hija.id,
        registrado_por:  USUARIO_ACTUAL.id,
        titulo:          'Originada en problemática grupal',
        descripcion:     `Registrada como parte de una problemática ${modalidad === 'curso' ? 'de curso completo' : 'grupal'}.`,
        tipo:            'otro',
      });
      await sb.from('problematica_alumnos').insert({ problematica_id: madre.id, alumno_id: alumno.id });
    }

    await crearAlertasProb(madre.id, urg, nivel, null, respId);
  }

  document.getElementById('modal-form-prob')?.remove();
  window._alumnosSelProb = [];
  await rProb();
  cargarNotificaciones();
}

// ─── ALERTAS AUTOMÁTICAS ──────────────────────────────
async function crearAlertasProb(probId, urgencia, nivel, alumnoId, respId) {
  const instId = USUARIO_ACTUAL.institucion_id;
  let dests = [];

  let cursoIdAlumno = null;
  if (alumnoId) {
    const { data: al } = await sb.from('alumnos').select('curso_id').eq('id', alumnoId).single();
    cursoIdAlumno = al?.curso_id || null;
  }

  let qDir = sb.from('usuarios').select('id')
    .eq('institucion_id', instId).eq('activo', true)
    .in('rol', ['director_general','directivo_nivel']);
  if (nivel) qDir = qDir.or(`rol.eq.director_general,nivel.eq.${nivel}`);
  const { data: dirs } = await qDir;
  dests.push(...(dirs || []).map(u => u.id));

  if (urgencia === 'alta' || urgencia === 'media') {
    const { data: eoe } = await sb.from('usuarios').select('id')
      .eq('institucion_id', instId).eq('rol', 'eoe').eq('activo', true);
    dests.push(...(eoe || []).map(u => u.id));
  }

  if (cursoIdAlumno) {
    const { data: precs } = await sb.from('usuarios').select('id')
      .eq('institucion_id', instId).eq('rol', 'preceptor').eq('activo', true)
      .contains('cursos_ids', [cursoIdAlumno]);
    dests.push(...(precs || []).map(u => u.id));
  }

  if (respId) dests.push(respId);

  dests = [...new Set(dests)].filter(id => id !== USUARIO_ACTUAL.id);
  if (!dests.length) return;

  try {
    await sb.from('alertas_problematicas').insert(
      dests.map(uid => ({ problematica_id: probId, usuario_id: uid }))
    );
  } catch(_) {}

  const urgLabel = urgencia === 'alta' ? 'URGENTE' : urgencia === 'media' ? 'Media' : 'Baja';
  await sb.from('notificaciones').insert(
    dests.map(uid => ({
      usuario_id:       uid,
      tipo:             'nueva_problematica',
      titulo:           `[${urgLabel}] Nueva situación problemática`,
      descripcion:      `Registrado por ${USUARIO_ACTUAL.nombre_completo}. Podés ver el seguimiento en Problemáticas.`,
      referencia_id:    probId,
      referencia_tabla: 'problematicas',
    }))
  );
}

// ─── INTEGRACIÓN LEGAJO ───────────────────────────────
async function cargarProbAlumno(alumnoId, contenedorId) {
  const cont = document.getElementById(contenedorId);
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state small"><div class="spinner"></div></div>';

  const migOk  = await detectarMigracion();
  const campos = migOk
    ? 'id,tipo,urgencia,estado,descripcion,created_at,motivo_cierre,confidencial'
    : 'id,tipo,urgencia,estado,descripcion,created_at,confidencial';
  const { data } = await sb.from('problematicas')
    .select(campos)
    .eq('alumno_id', alumnoId)
    .order('created_at', { ascending: false });

  const rol   = USUARIO_ACTUAL.rol;
  const lista = (data || []).filter(p =>
    !p.confidencial || ['director_general','directivo_nivel','eoe'].includes(rol)
  );

  if (!lista.length) {
    cont.innerHTML = '<div style="font-size:11px;color:var(--txt2);padding:8px 0">Sin problemáticas registradas.</div>';
    return;
  }

  cont.innerHTML = lista.map(p => {
    const urgTag = p.urgencia === 'alta' ? 'tr' : p.urgencia === 'media' ? 'ta' : 'tg';
    const estCls = p.estado === 'abierta' ? 'tr' : p.estado === 'en_seguimiento' ? 'ta' : 'tg';
    const estLbl = { abierta:'Sin atender', en_seguimiento:'En seguimiento', cerrada:'Cerrada', resuelta:'Cerrada', derivada:'Derivada' }[p.estado] || p.estado;
    return `
      <div style="border-bottom:1px solid var(--brd)">
        <div style="display:flex;align-items:flex-start;gap:8px;padding:10px 0;cursor:pointer" onclick="togDetProbLegajo('${p.id}')">
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;font-weight:600">${labelTipoProb(p.tipo)}</div>
            <div style="font-size:10px;color:var(--txt2);margin-top:1px">${formatFechaLatam(p.created_at?.split('T')[0])}</div>
            ${p.descripcion ? `<div style="font-size:10px;color:var(--txt3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">${p.descripcion}</div>` : ''}
            ${p.motivo_cierre ? `<div style="font-size:10px;color:var(--txt3);margin-top:1px">${p.motivo_cierre}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">
            <span class="tag ${urgTag}" style="font-size:9px">Urg. ${p.urgencia}</span>
            <span class="tag ${estCls}" style="font-size:9px">${estLbl}</span>
            ${p.confidencial ? '<span class="tag td" style="font-size:9px">Conf.</span>' : ''}
            <span style="font-size:9px;color:var(--verde);font-weight:600;margin-top:2px">Ver ↓</span>
          </div>
        </div>
        <div id="prob-leg-det-${p.id}" style="display:none"></div>
      </div>`;
  }).join('');
}

async function togDetProbLegajo(probId) {
  const det = document.getElementById('prob-leg-det-' + probId);
  if (!det) return;
  if (det.style.display !== 'none') { det.style.display = 'none'; return; }
  det.style.display = 'block';
  det.innerHTML = '<div style="padding:8px 0 8px 10px"><div class="spinner" style="width:16px;height:16px;border-width:2px"></div></div>';

  const { data: intvs } = await sb
    .from('intervenciones')
    .select('*, usr:usuarios!intervenciones_registrado_por_fkey(nombre_completo)')
    .eq('problematica_id', probId)
    .order('created_at', { ascending: true });

  const dotColor = t => t === 'Caso cerrado' ? 'var(--verde)' : t === 'Caso reabierto' ? 'var(--ambar)' : 'var(--azul)';
  const invsHTML = (intvs || []).length
    ? intvs.map(iv => `
        <div class="tl-it">
          <div class="tl-d" style="background:${dotColor(iv.titulo)}"></div>
          <div class="tl-f">${formatFechaCorta(iv.created_at?.split('T')[0])}</div>
          <div style="flex:1;min-width:0">
            <div class="tl-t">${iv.titulo}</div>
            <div class="tl-ds">${iv.descripcion}</div>
            ${iv.proximo_paso ? `<div style="font-size:10px;color:var(--verde);font-weight:500;margin-top:2px">→ ${iv.proximo_paso}</div>` : ''}
            <div style="font-size:10px;color:var(--txt3);margin-top:2px">${iv.usr?.nombre_completo || '—'}</div>
          </div>
        </div>`).join('')
    : '<div style="font-size:11px;color:var(--txt2);padding:4px 0">Sin intervenciones registradas.</div>';

  det.innerHTML = `
    <div style="padding:0 0 12px 10px;border-left:2px solid var(--azul);margin:0 0 4px 4px">
      <div style="font-size:10px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Bitácora de seguimiento</div>
      ${invsHTML}
    </div>`;
}

// ─── BACKWARD COMPAT ──────────────────────────────────
async function guardarInterv(probId) { return guardarSeguimiento(probId); }
async function cambiarEstProb(probId, estado) {
  await sb.from('problematicas').update({ estado, updated_at: new Date().toISOString() }).eq('id', probId);
  await rProb();
}
async function buscarAlProb(q) {}
