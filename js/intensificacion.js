// =====================================================
// INTENSIFICACION.JS — Módulo Períodos de Intensificación
// Res. 1650/2024 — Provincia de Buenos Aires
// =====================================================

const ESTADO_INTENSIF_LABEL = {
  pendiente_intensif: 'Pendiente de intensificación',
  intensificando:     'Intensificando',
  recursando:         'Recursando',
  aprobada:           'Aprobada',
  no_acreditada:      'No acreditada',
  a_recursar:         'A recursar',
};

const ESTADO_INTENSIF_COLOR = {
  pendiente_intensif: 'var(--ambar)',
  intensificando:     'var(--ambar)',
  recursando:         'var(--rojo)',
  aprobada:           'var(--verde)',
  no_acreditada:      'var(--rojo)',
  a_recursar:         'var(--rojo)',
};

let _intensifTabActivo = null;

// ── MAIN RENDERER ──────────────────────────────────────
async function rIntensif() {
  showLoading('intensif');
  const instId = USUARIO_ACTUAL.institucion_id;
  const anio   = new Date().getFullYear();
  const rol    = USUARIO_ACTUAL.rol;

  const { data: periodos } = await sb.from('periodos_intensificacion')
    .select('id,nombre,tipo,fecha_inicio,fecha_fin,activo')
    .eq('institucion_id', instId)
    .eq('ciclo_lectivo', anio)
    .order('fecha_inicio');

  let cursoIds   = [];
  let materiaIds = null;

  if (rol === 'director_general' || rol === 'eoe') {
    const { data: cs } = await sb.from('cursos').select('id')
      .eq('institucion_id', instId).or('activo.is.null,activo.eq.true');
    cursoIds = (cs || []).map(c => c.id);
  } else if (rol === 'directivo_nivel') {
    const { data: cs } = await sb.from('cursos').select('id')
      .eq('institucion_id', instId).eq('nivel', USUARIO_ACTUAL.nivel).or('activo.is.null,activo.eq.true');
    cursoIds = (cs || []).map(c => c.id);
  } else if (rol === 'preceptor') {
    const { data: cs } = await sb.from('cursos').select('id')
      .eq('institucion_id', instId).eq('nivel', USUARIO_ACTUAL.nivel).or('activo.is.null,activo.eq.true');
    cursoIds = (cs || []).map(c => c.id);
  } else if (rol === 'docente') {
    const { data: asigs } = await sb.from('asignaciones')
      .select('curso_id,materia_id').eq('docente_id', USUARIO_ACTUAL.id).eq('anio_lectivo', anio);
    cursoIds   = [...new Set((asigs || []).map(a => a.curso_id))];
    materiaIds = [...new Set((asigs || []).map(a => a.materia_id))];
  }

  const pag = document.getElementById('page-intensif');

  if (!cursoIds.length) {
    pag.innerHTML = `
      <div class="pg-t">Intensificación</div>
      <div class="empty-state">Sin cursos asignados para este año.</div>`;
    return;
  }

  // Filtrar por alumno_id en vez de curso_id para encontrar registros aunque curso_id esté null
  const { data: alumnosEnCursos, error: _errAlumnos } = await sb.from('alumnos').select('id')
    .in('curso_id', cursoIds).or('activo.is.null,activo.eq.true');
  if (_errAlumnos) console.error('[Intensif] Error alumnos:', _errAlumnos.message);
  const alumnoIds = (alumnosEnCursos || []).map(a => a.id);
  console.log('[Intensif] cursoIds:', cursoIds.length, 'alumnoIds:', alumnoIds.length);

  const ESTADOS_ACTIVOS = ['pendiente_intensif','intensificando','recursando','a_recursar','no_acreditada'];

  let todosEstados = [];
  if (alumnoIds.length) {
    let q = sb.from('materias_estado_alumno')
      .select('id,estado,ciclo_lectivo_origen,nota_intensif_1,nota_intensif_2,nota_final,alumno_id,materia_id,curso_id,periodo_id,alumnos(nombre,apellido),materias(nombre),cursos(nombre,division)')
      .in('alumno_id', alumnoIds)
      .in('estado', ESTADOS_ACTIVOS);
    if (materiaIds?.length) q = q.in('materia_id', materiaIds);
    const { data: estados, error: _errEstados } = await q;
    if (_errEstados) console.error('[Intensif] Error estados:', _errEstados.message, _errEstados.details);
    console.log('[Intensif] estados encontrados:', estados?.length ?? 'null', estados?.[0]);
    todosEstados = estados || [];
  }

  if (!_intensifTabActivo) _intensifTabActivo = '__todos';

  const puedeAgregar = ['director_general','directivo_nivel','preceptor'].includes(rol);
  const showResumen  = rol !== 'docente';

  pag.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;gap:12px">
      <div>
        <div class="pg-t">Intensificación</div>
        <div class="pg-s">${anio} · ${todosEstados.length} registro(s) activo(s)</div>
      </div>
      ${puedeAgregar ? `<button class="btn-p" onclick="_mostrarFormAgregarIntensif()" style="flex-shrink:0;font-size:12px">+ Agregar</button>` : ''}
    </div>

    ${showResumen ? _htmlResumenIntensif(periodos || [], todosEstados) : ''}
    ${_htmlPeriodosTabs(periodos || [], todosEstados, rol)}
  `;
}

// ── RESUMEN / STATS ──────────────────────────────────────
function _htmlResumenIntensif(periodos, estados) {
  if (!estados.length) {
    return `<div class="card" style="margin-bottom:16px;padding:16px;text-align:center;color:var(--txt3);font-size:12px">
      Sin alumnos en períodos de intensificación este año.
    </div>`;
  }

  const porEstado = {};
  estados.forEach(e => { porEstado[e.estado] = (porEstado[e.estado] || 0) + 1; });

  const porCurso = {};
  estados.forEach(e => {
    const k = e.cursos ? `${e.cursos.nombre}${e.cursos.division || ''}` : '—';
    porCurso[k] = (porCurso[k] || 0) + 1;
  });
  const topCursos = Object.entries(porCurso).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const porMateria = {};
  estados.forEach(e => {
    const k = e.materias?.nombre || '—';
    porMateria[k] = (porMateria[k] || 0) + 1;
  });
  const topMaterias = Object.entries(porMateria).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const estadosActivos = ['pendiente_intensif','intensificando','recursando','a_recursar'];
  const chips = estadosActivos.filter(e => porEstado[e]).map(e => `
    <div class="card" style="padding:10px 14px;text-align:center;flex-shrink:0">
      <div style="font-size:22px;font-weight:700;color:${ESTADO_INTENSIF_COLOR[e]}">${porEstado[e]}</div>
      <div style="font-size:9px;color:var(--txt2);line-height:1.3;max-width:80px">${ESTADO_INTENSIF_LABEL[e]}</div>
    </div>`).join('');

  return `
    <div style="margin-bottom:16px">
      <div class="sec-lb">Resumen</div>
      <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:10px;scrollbar-width:none">
        <div class="card" style="padding:10px 14px;text-align:center;flex-shrink:0">
          <div style="font-size:22px;font-weight:700;color:var(--txt)">${estados.length}</div>
          <div style="font-size:9px;color:var(--txt2)">materias pendientes</div>
        </div>
        ${chips}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="card" style="padding:12px">
          <div style="font-size:9px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Cursos afectados</div>
          ${topCursos.map(([nombre, cnt]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;margin-bottom:5px">
              <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nombre}</span>
              <span style="font-weight:700;color:var(--ambar);margin-left:6px;flex-shrink:0">${cnt}</span>
            </div>`).join('')}
        </div>
        <div class="card" style="padding:12px">
          <div style="font-size:9px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Materias frecuentes</div>
          ${topMaterias.map(([nombre, cnt]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;margin-bottom:5px">
              <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nombre}</span>
              <span style="font-weight:700;color:var(--ambar);margin-left:6px;flex-shrink:0">${cnt}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

// ── TABS POR PERÍODO ──────────────────────────────────────
function _htmlPeriodosTabs(periodos, estados, rol) {
  if (!periodos.length) {
    return `
      <div class="sec-lb">Por período</div>
      <div class="card" style="padding:14px;font-size:12px;color:var(--txt2)">
        <div style="font-weight:600;margin-bottom:3px">Sin períodos configurados</div>
        Creá los períodos de intensificación desde <b>Configuración → Períodos de intensificación</b>.
      </div>
      <div style="margin-top:12px">
        ${_htmlListaEstados(estados, rol, null)}
      </div>`;
  }

  const tabs = [
    { id: '__todos', label: 'Todos' },
    ...periodos.map(p => ({ id: p.id, label: p.nombre })),
  ];
  const tab = _intensifTabActivo || '__todos';
  const estadosFiltrados = tab === '__todos'
    ? estados
    : estados.filter(e => e.periodo_id === tab);
  const periodoActual = periodos.find(p => p.id === tab) || null;

  return `
    <div class="sec-lb">Por período</div>
    <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:12px;scrollbar-width:none">
      ${tabs.map(t => `
        <button onclick="_intensifSelectTab('${t.id}')"
          style="flex-shrink:0;padding:5px 12px;border-radius:20px;cursor:pointer;white-space:nowrap;font-size:11px;
            border:1.5px solid ${tab === t.id ? 'var(--azul)' : 'var(--brd)'};
            background:${tab === t.id ? 'var(--azul)' : 'transparent'};
            color:${tab === t.id ? '#fff' : 'var(--txt)'};
            font-weight:${tab === t.id ? '600' : '400'}">
          ${t.label}
        </button>`).join('')}
    </div>
    ${_htmlListaEstados(estadosFiltrados, rol, periodoActual)}`;
}

function _intensifSelectTab(tabId) {
  _intensifTabActivo = tabId;
  rIntensif();
}

// ── LISTA DE ALUMNOS POR PERÍODO ──────────────────────────────────────
function _htmlListaEstados(estados, rol, periodo) {
  const puedeEditar = ['director_general','directivo_nivel','docente'].includes(rol);

  if (!estados.length) {
    return `<div style="text-align:center;padding:24px;color:var(--txt3);font-size:12px">Sin alumnos en este período.</div>`;
  }

  return `
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px">
      ${estados.map(r => {
        const clr        = ESTADO_INTENSIF_COLOR[r.estado] || 'var(--txt2)';
        const nombreAlum = `${r.alumnos?.apellido || ''}, ${r.alumnos?.nombre || ''}`;
        const nombreCurso = r.cursos ? `${r.cursos.nombre}${r.cursos.division || ''}` : '—';
        const fn = puedeEditar
          ? `onclick="verNotasIntensif('${r.id}','${_escIntensif(nombreAlum)}','${_escIntensif(r.materias?.nombre)}',${r.ciclo_lectivo_origen})"`
          : '';
        return `
          <div style="display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid var(--brd);cursor:${puedeEditar ? 'pointer' : 'default'}" ${fn}>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600">${nombreAlum}</div>
              <div style="font-size:10px;color:var(--txt2)">${nombreCurso} · ${r.materias?.nombre || '—'} · Ciclo ${r.ciclo_lectivo_origen}</div>
              <div style="margin-top:3px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <span style="font-size:10px;font-weight:600;color:${clr}">${ESTADO_INTENSIF_LABEL[r.estado] || r.estado}</span>
                ${r.nota_intensif_1 !== null && r.nota_intensif_1 !== undefined
                  ? `<span style="font-size:10px;color:var(--txt2)">Int.1: ${r.nota_intensif_1}</span>` : ''}
                ${r.nota_intensif_2 !== null && r.nota_intensif_2 !== undefined
                  ? `<span style="font-size:10px;color:var(--txt2)">Int.2: ${r.nota_intensif_2}</span>` : ''}
              </div>
            </div>
            ${puedeEditar ? `<span style="color:var(--txt3);font-size:14px;margin-left:8px;flex-shrink:0">→</span>` : ''}
          </div>`;
      }).join('')}
    </div>
    ${periodo ? `
      <button onclick="_toggleAsistenciaIntensif('${periodo.id}')"
        class="btn-s" style="font-size:11px;margin-bottom:8px">
        Ver asistencia del período
      </button>
      <div id="asist-intensif-${periodo.id}"></div>` : ''}`;
}

// ── ASISTENCIA DEL PERÍODO (resumen) ──────────────────────────────────────
async function _toggleAsistenciaIntensif(periodoId) {
  const contenedor = document.getElementById(`asist-intensif-${periodoId}`);
  if (!contenedor) return;
  if (contenedor.innerHTML) { contenedor.innerHTML = ''; return; }
  contenedor.innerHTML = '<div class="spinner" style="margin:8px auto;display:block"></div>';

  const { data: registros } = await sb.from('asistencia')
    .select('alumno_id,fecha,estado,alumnos(nombre,apellido)')
    .eq('periodo_intensif_id', periodoId)
    .order('fecha').order('alumnos(apellido)');

  if (!registros?.length) {
    contenedor.innerHTML = `<div style="font-size:11px;color:var(--txt3);padding:8px 0">
      Sin registros de asistencia para este período. Tomá lista desde el módulo <b>Asistencia</b>.
    </div>`;
    return;
  }

  const ASIST_LABEL = { presente:'P', ausente:'A', tardanza:'T', media_falta:'½', justificado:'J' };
  const ASIST_COLOR = { presente:'var(--verde)', ausente:'var(--rojo)', tardanza:'var(--ambar)', media_falta:'var(--ambar)', justificado:'var(--txt2)' };

  const porFecha = {};
  registros.forEach(r => {
    if (!porFecha[r.fecha]) porFecha[r.fecha] = [];
    porFecha[r.fecha].push(r);
  });

  contenedor.innerHTML = `
    <div class="card" style="padding:12px;margin-bottom:12px">
      <div style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">
        Asistencia · ${Object.keys(porFecha).length} día(s)
      </div>
      ${Object.entries(porFecha).sort().map(([fecha, regs]) => `
        <div style="margin-bottom:10px">
          <div style="font-size:10px;font-weight:600;color:var(--txt2);margin-bottom:5px">${_fmtFechaIntensif(fecha)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${regs.map(r => `
              <div style="display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:12px;background:var(--surf2);font-size:10px">
                <span style="font-weight:700;color:${ASIST_COLOR[r.estado] || 'var(--txt)'}">${ASIST_LABEL[r.estado] || r.estado}</span>
                <span>${r.alumnos?.apellido || ''}, ${r.alumnos?.nombre || ''}</span>
              </div>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;
}

function _fmtFechaIntensif(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`;
}

function _escIntensif(s) {
  if (!s) return '';
  return String(s).replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// ── VER / EDITAR NOTAS ──────────────────────────────────────
async function verNotasIntensif(estadoId, alumnoNombre, materiaNombre, cicloOrigen) {
  const pag = document.getElementById('page-intensif');
  showLoading('intensif');

  const anio = new Date().getFullYear();
  const [recRes, periodosRes] = await Promise.all([
    sb.from('materias_estado_alumno').select('*,periodos_intensificacion(nombre)').eq('id', estadoId).single(),
    sb.from('periodos_intensificacion').select('id,nombre,tipo')
      .eq('institucion_id', USUARIO_ACTUAL.institucion_id).eq('ciclo_lectivo', anio).order('fecha_inicio'),
  ]);

  const rec = recRes.data;
  if (recRes.error || !rec) {
    pag.innerHTML = `<div class="empty-state">Error: ${recRes.error?.message}</div>`;
    return;
  }
  const periodos    = periodosRes.data || [];
  const esDirectivo = ['director_general','directivo_nivel'].includes(USUARIO_ACTUAL.rol);
  const puedeEditar = esDirectivo || USUARIO_ACTUAL.rol === 'docente';

  pag.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <button onclick="rIntensif()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--txt2)">←</button>
      <div>
        <div class="pg-t">${alumnoNombre}</div>
        <div class="pg-s">${materiaNombre} · Ciclo ${cicloOrigen}</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">
        Estado actual
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
        <span style="font-size:13px;font-weight:600;color:${ESTADO_INTENSIF_COLOR[rec.estado] || 'var(--txt)'}">
          ${ESTADO_INTENSIF_LABEL[rec.estado] || rec.estado}
        </span>
        ${rec.periodos_intensificacion?.nombre
          ? `<span style="font-size:10px;color:var(--txt2)">· Período: ${rec.periodos_intensificacion.nombre}</span>`
          : ''}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
        <div>
          <label style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;display:block;margin-bottom:4px">Nota final</label>
          <span style="font-size:20px;font-weight:700;color:${NOTA_COLOR(rec.nota_final)}">${rec.nota_final ?? '—'}</span>
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;display:block;margin-bottom:4px">Intensif. 1</label>
          ${puedeEditar
            ? `<input type="number" id="nota-i1" value="${rec.nota_intensif_1 ?? ''}" min="1" max="10" step="0.5"
                style="width:70px;padding:8px;border:1.5px solid var(--brd);border-radius:var(--rad);font-size:14px;font-weight:700;text-align:center;background:var(--surf);color:var(--txt)">`
            : `<span style="font-size:20px;font-weight:700;color:${NOTA_COLOR(rec.nota_intensif_1)}">${rec.nota_intensif_1 ?? '—'}</span>`}
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;display:block;margin-bottom:4px">Intensif. 2</label>
          ${puedeEditar
            ? `<input type="number" id="nota-i2" value="${rec.nota_intensif_2 ?? ''}" min="1" max="10" step="0.5"
                style="width:70px;padding:8px;border:1.5px solid var(--brd);border-radius:var(--rad);font-size:14px;font-weight:700;text-align:center;background:var(--surf);color:var(--txt)">`
            : `<span style="font-size:20px;font-weight:700;color:${NOTA_COLOR(rec.nota_intensif_2)}">${rec.nota_intensif_2 ?? '—'}</span>`}
        </div>
      </div>

      ${puedeEditar ? `
        ${esDirectivo && periodos.length ? `
        <div style="margin-bottom:12px">
          <label style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;display:block;margin-bottom:4px">Período de intensificación</label>
          <select id="periodo-intensif" style="width:100%;padding:9px 12px;border:1.5px solid var(--brd);border-radius:var(--rad);font-size:12px;background:var(--surf);color:var(--txt)">
            <option value="">— Sin período asignado —</option>
            ${periodos.map(p => `<option value="${p.id}" ${rec.periodo_id === p.id ? 'selected' : ''}>${p.nombre}</option>`).join('')}
          </select>
          <div style="font-size:10px;color:var(--txt2);margin-top:4px">Asignar período para que aparezca en la lista de asistencia.</div>
        </div>` : ''}
        <div style="margin-bottom:14px">
          <label style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;display:block;margin-bottom:4px">Estado resultante</label>
          <select id="estado-intensif" style="width:100%;padding:9px 12px;border:1.5px solid var(--brd);border-radius:var(--rad);font-size:12px;background:var(--surf);color:var(--txt)">
            ${['pendiente_intensif','intensificando','recursando','aprobada','a_recursar'].map(e => `
              <option value="${e}" ${rec.estado === e ? 'selected' : ''}>${ESTADO_INTENSIF_LABEL[e]}</option>`).join('')}
          </select>
        </div>
        <button class="btn-p" onclick="_guardarNotasIntensif('${estadoId}')" style="font-size:12px">
          Guardar
        </button>` : ''}
    </div>`;
}

async function _guardarNotasIntensif(estadoId) {
  const i1        = parseFloat(document.getElementById('nota-i1')?.value);
  const i2        = parseFloat(document.getElementById('nota-i2')?.value);
  const estado    = document.getElementById('estado-intensif')?.value;
  const periodoEl = document.getElementById('periodo-intensif');

  const btn = event?.target;
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  const upd = {
    nota_intensif_1: isNaN(i1) ? null : i1,
    nota_intensif_2: isNaN(i2) ? null : i2,
    estado,
  };
  if (periodoEl) upd.periodo_id = periodoEl.value || null;

  const { error } = await sb.from('materias_estado_alumno').update(upd).eq('id', estadoId);
  if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
  if (error) { alert('Error: ' + error.message); return; }
  alert('Guardado correctamente.');
  rIntensif();
}

// ── AGREGAR ALUMNO MANUALMENTE ──────────────────────────────────────
async function _mostrarFormAgregarIntensif() {
  const instId = USUARIO_ACTUAL.institucion_id;
  const anio   = new Date().getFullYear();

  let qCursos = sb.from('cursos').select('id,nombre,division,nivel').eq('institucion_id', instId).order('nombre');
  if (USUARIO_ACTUAL.rol !== 'director_general' && USUARIO_ACTUAL.nivel) {
    qCursos = qCursos.eq('nivel', USUARIO_ACTUAL.nivel);
  }
  const [{ data: cursos }, { data: periodos }] = await Promise.all([
    qCursos,
    sb.from('periodos_intensificacion').select('id,nombre').eq('institucion_id', instId).eq('ciclo_lectivo', anio).order('fecha_inicio'),
  ]);

  document.getElementById('modal-agregar-intensif')?.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-agregar-intensif';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.45);z-index:1000;display:flex;align-items:flex-end';
  modal.innerHTML = `
    <div style="background:var(--bg);border-radius:16px 16px 0 0;padding:20px;width:100%;max-height:90vh;overflow-y:auto;box-sizing:border-box">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:14px;font-weight:700">Agregar materia pendiente</div>
        <button onclick="document.getElementById('modal-agregar-intensif').remove()"
          style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--txt2);line-height:1">×</button>
      </div>

      <div style="font-size:11px;color:var(--txt2);background:var(--surf2);border-radius:var(--rad);padding:10px 12px;margin-bottom:14px">
        Registrá materias pendientes de alumnos que ya estaban intensificando antes de usar el sistema, o para correcciones manuales.
      </div>

      <div style="margin-bottom:12px">
        <label style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;display:block;margin-bottom:4px">Curso</label>
        <select id="ai-curso" onchange="_onCursoAgregarIntensif()"
          style="width:100%;padding:9px 12px;border:1.5px solid var(--brd);border-radius:var(--rad);font-size:12px;background:var(--surf);color:var(--txt);box-sizing:border-box">
          <option value="">— Seleccionar curso —</option>
          ${(cursos || []).map(cu => `<option value="${cu.id}">${cu.nombre}${cu.division ? ' ' + cu.division : ''} (${cu.nivel})</option>`).join('')}
        </select>
      </div>

      <div style="margin-bottom:12px">
        <label style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;display:block;margin-bottom:4px">Alumno/a</label>
        <select id="ai-alumno"
          style="width:100%;padding:9px 12px;border:1.5px solid var(--brd);border-radius:var(--rad);font-size:12px;background:var(--surf);color:var(--txt);box-sizing:border-box">
          <option value="">— Elegí un curso primero —</option>
        </select>
      </div>

      <div style="margin-bottom:12px">
        <label style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;display:block;margin-bottom:4px">Materia</label>
        <select id="ai-materia"
          style="width:100%;padding:9px 12px;border:1.5px solid var(--brd);border-radius:var(--rad);font-size:12px;background:var(--surf);color:var(--txt);box-sizing:border-box">
          <option value="">— Elegí un curso primero —</option>
        </select>
      </div>

      ${periodos?.length ? `
      <div style="margin-bottom:12px">
        <label style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;display:block;margin-bottom:4px">Período</label>
        <select id="ai-periodo"
          style="width:100%;padding:9px 12px;border:1.5px solid var(--brd);border-radius:var(--rad);font-size:12px;background:var(--surf);color:var(--txt);box-sizing:border-box">
          <option value="">— Sin período (asignar después) —</option>
          ${periodos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
        </select>
      </div>` : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div>
          <label style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;display:block;margin-bottom:4px">Ciclo de origen</label>
          <input type="number" id="ai-ciclo" value="${anio - 1}" min="2020" max="${anio}"
            style="width:100%;padding:9px 12px;border:1.5px solid var(--brd);border-radius:var(--rad);font-size:12px;background:var(--surf);color:var(--txt);box-sizing:border-box">
          <div style="font-size:10px;color:var(--txt2);margin-top:3px">Año que debió cursar la materia.</div>
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;display:block;margin-bottom:4px">Estado inicial</label>
          <select id="ai-estado"
            style="width:100%;padding:9px 12px;border:1.5px solid var(--brd);border-radius:var(--rad);font-size:12px;background:var(--surf);color:var(--txt);box-sizing:border-box">
            <option value="pendiente_intensif">Pendiente de intensif.</option>
            <option value="intensificando">Intensificando</option>
            <option value="recursando">Recursando</option>
          </select>
        </div>
      </div>

      <button id="ai-btn-guardar" class="btn-p" onclick="_guardarNuevaIntensif()" style="width:100%;font-size:13px">
        Guardar materia pendiente
      </button>
    </div>`;

  document.body.appendChild(modal);
}

async function _onCursoAgregarIntensif() {
  const cursoId = document.getElementById('ai-curso')?.value;
  const selA    = document.getElementById('ai-alumno');
  const selM    = document.getElementById('ai-materia');
  if (!cursoId || !selA || !selM) return;

  selA.innerHTML = '<option value="">Cargando...</option>';
  selM.innerHTML = '<option value="">Cargando...</option>';

  const anio = new Date().getFullYear();
  const [alumnosRes, materiasRes] = await Promise.all([
    sb.from('alumnos').select('id,nombre,apellido').eq('curso_id', cursoId).or('activo.is.null,activo.eq.true').order('apellido'),
    sb.from('asignaciones').select('materia_id,materias(id,nombre)').eq('curso_id', cursoId).eq('anio_lectivo', anio),
  ]);

  selA.innerHTML = '<option value="">— Seleccionar —</option>' +
    (alumnosRes.data || []).map(a => `<option value="${a.id}">${a.apellido}, ${a.nombre}</option>`).join('');

  const matMap = {};
  (materiasRes.data || []).forEach(a => {
    if (a.materias && !matMap[a.materia_id]) matMap[a.materia_id] = a.materias.nombre;
  });
  selM.innerHTML = '<option value="">— Seleccionar —</option>' +
    Object.entries(matMap).sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, nombre]) => `<option value="${id}">${nombre}</option>`).join('');
}

async function _guardarNuevaIntensif() {
  const alumnoId    = document.getElementById('ai-alumno')?.value;
  const materiaId   = document.getElementById('ai-materia')?.value;
  const cursoId     = document.getElementById('ai-curso')?.value;
  const cicloOrigen = parseInt(document.getElementById('ai-ciclo')?.value);
  const estado      = document.getElementById('ai-estado')?.value;
  const periodoId   = document.getElementById('ai-periodo')?.value || null;

  if (!alumnoId || !materiaId || !cursoId || !cicloOrigen) {
    alert('Completá todos los campos antes de guardar.');
    return;
  }

  const anio   = new Date().getFullYear();
  const instId = USUARIO_ACTUAL.institucion_id;

  const { data: existe } = await sb.from('materias_estado_alumno')
    .select('id').eq('alumno_id', alumnoId).eq('materia_id', materiaId)
    .eq('ciclo_lectivo_origen', cicloOrigen).maybeSingle();

  if (existe) {
    alert('Ya existe un registro de esta materia para este alumno en ese ciclo lectivo.');
    return;
  }

  const btn = document.getElementById('ai-btn-guardar');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  const { error } = await sb.from('materias_estado_alumno').insert({
    alumno_id:             alumnoId,
    materia_id:            materiaId,
    curso_id:              cursoId,
    ciclo_lectivo_origen:  cicloOrigen,
    ciclo_lectivo_cursado: anio,
    estado,
    periodo_id:            periodoId,
    institucion_id:        instId,
  });

  if (error) {
    alert('Error al guardar: ' + error.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar materia pendiente'; }
    return;
  }

  document.getElementById('modal-agregar-intensif')?.remove();
  _intensifTabActivo = null;
  alert('Materia pendiente registrada. Ya aparece en el legajo del alumno y en este módulo.');
  rIntensif();
}
