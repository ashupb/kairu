// ── Constantes de presentación ────────────────────────────────────────
const _ESTADO_CLR = {
  cursando:           '#3b82f6',
  pendiente_intensif: '#f59e0b',
  intensificando:     '#f59e0b',
  recursando:         '#ef4444',
  aprobada:           '#16a34a',
  desaprobada:        '#ef4444',
  a_recursar:         '#ef4444',
};
const _ESTADO_LBL = {
  cursando:           'Cursando',
  pendiente_intensif: 'Pend. intensif.',
  intensificando:     'Intensificando',
  recursando:         'Recursando',
  aprobada:           'Aprobada',
  desaprobada:        'Desaprobada',
  a_recursar:         'A recursar',
};

// Mapeo de numero de período a etiqueta
// periodos_evaluativos.numero: 1 = 1° cuatrimestre, 2 = 2° cuatrimestre
const _PERIODO_NUM_LBL = {
  1: '1° cuatrimestre',
  2: '2° cuatrimestre',
};

// ── Renderer principal ────────────────────────────────────────────────
async function rSeguimiento() {
  showLoading('seguimiento');
  const el = document.getElementById('page-seguimiento');

  if (!ALUMNO_ACTUAL) {
    el.innerHTML = `
      <div class="page-body">
        <div class="alert-card alert-warning">
          <p>No hay alumno seleccionado.</p>
        </div>
      </div>`;
    return;
  }

  const alumnoId = ALUMNO_ACTUAL.id;

  try {
    const [califRes, trayRes] = await Promise.all([
      // calificaciones.periodo_id → periodos_evaluativos (no periodos_intensificacion)
      // Filtro ausente en JS para incluir filas con ausente=null
      sb.from('calificaciones')
        .select('nota, ausente, materia_id, materias(nombre), instancias_evaluativas(nombre), periodos_evaluativos(nombre, anio, numero)')
        .eq('alumno_id', alumnoId)
        .not('nota', 'is', null),

      // Estado histórico de materias (cierres de cuatrimestre / año / intensificación)
      sb.from('materias_estado_alumno')
        .select('estado, ciclo_lectivo_origen, ciclo_lectivo_cursado, nota_final, nota_intensif_1, nota_intensif_2, materia_id, materias(nombre)')
        .eq('alumno_id', alumnoId)
        .order('ciclo_lectivo_origen', { ascending: false }),
    ]);

    const califs = (califRes.data || []).filter(c => !c.ausente && c.nota !== null);
    const tray   = trayRes.data || [];

    if (!califs.length && !tray.length) {
      el.innerHTML = `
        <div class="page-body">
          <div class="page-header"><h1 class="page-title">Seguimiento académico</h1></div>
          <div class="card"><p class="empty-msg">Sin calificaciones registradas aún.</p></div>
        </div>`;
      return;
    }

    // ── Agrupar calificaciones: año → materia → numero_periodo → [notas] ──
    const califsPorAnio = {};
    califs.forEach(c => {
      const anio   = c.periodos_evaluativos?.anio;
      const numero = c.periodos_evaluativos?.numero ?? 0;
      const mat    = c.materias?.nombre || '—';
      if (!anio) return;
      if (!califsPorAnio[anio])               califsPorAnio[anio]               = {};
      if (!califsPorAnio[anio][mat])          califsPorAnio[anio][mat]          = {};
      if (!califsPorAnio[anio][mat][numero])  califsPorAnio[anio][mat][numero]  = [];
      califsPorAnio[anio][mat][numero].push(Number(c.nota));
    });

    // ── Agrupar trayectoria: ciclo → [registros] ─────────────────────
    const porCiclo = {};
    tray.forEach(r => {
      const k = r.ciclo_lectivo_origen;
      if (!porCiclo[k]) porCiclo[k] = [];
      porCiclo[k].push(r);
    });

    // Materias con acreditación pendiente (alerta al tope)
    const pendientes = tray.filter(r =>
      ['pendiente_intensif', 'intensificando', 'recursando', 'a_recursar'].includes(r.estado)
    );

    const aniosCalif = Object.keys(califsPorAnio).map(Number).sort((a, b) => b - a);

    el.innerHTML = `
      <div class="page-body">
        <div class="page-header">
          <h1 class="page-title">Seguimiento académico</h1>
        </div>
        ${pendientes.length ? _seguimientoPendientes(pendientes) : ''}
        ${aniosCalif.map(anio => _califAnioCard(anio, califsPorAnio[anio])).join('')}
        ${tray.length ? _trayectoriaSection(porCiclo) : ''}
      </div>`;

  } catch (e) {
    console.error('seguimiento:', e);
    el.innerHTML = `
      <div class="page-body">
        <div class="alert-card alert-danger">
          <p>No se pudo cargar el seguimiento. Intentá de nuevo más tarde.</p>
        </div>
      </div>`;
  }
}

// ── Sección: Calificaciones de un año ────────────────────────────────
function _califAnioCard(anio, materiaMap) {
  // Ordenar por numero de período (1, 2, 0 para sin período)
  const numerosOrden = [1, 2, 0];

  const rows = Object.entries(materiaMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mat, periodos]) => {
      const periodLines = numerosOrden
        .filter(num => periodos[num]?.length)
        .map(num => {
          const notas = periodos[num];
          const prom  = notas.reduce((a, b) => a + b, 0) / notas.length;
          const chips = notas.map(n => _notaBadge(n)).join('');
          const promBadge = notas.length > 1
            ? `<span class="nota-bdg ${_notaClase(prom)} nota-bdg--prom">${_fmtVal(prom)}</span>`
            : '';
          const lbl = _PERIODO_NUM_LBL[num] || 'Otro período';
          return `
            <div class="seg-periodo-row">
              <span class="seg-periodo-lbl">${lbl}</span>
              <div class="seg-notas-wrap">${chips}${promBadge}</div>
            </div>`;
        });

      return `
        <div class="seg-mat-item">
          <div class="seg-mat-nombre">${mat}</div>
          ${periodLines.length
            ? periodLines.join('')
            : '<p style="font-size:11px;color:var(--color-text-faint);margin-top:4px">Sin calificaciones cargadas</p>'}
        </div>`;
    }).join('');

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-label">CALIFICACIONES ${anio}</span>
        <span class="card-sublabel">El promedio aparece con borde</span>
      </div>
      ${rows}
    </div>`;
}

// ── Sección: Trayectoria / cierres ────────────────────────────────────
function _trayectoriaSection(porCiclo) {
  const cards = Object.entries(porCiclo)
    .sort((a, b) => b[0] - a[0])
    .map(([ciclo, registros]) => _trayectoriaCicloCard(+ciclo, registros))
    .join('');

  return `
    <div class="card-label" style="display:block;margin:18px 0 8px">TRAYECTORIA Y CIERRES DE PERÍODO</div>
    ${cards}`;
}

// ── Card de trayectoria por ciclo lectivo ─────────────────────────────
function _trayectoriaCicloCard(ciclo, registros) {
  const aprobadas    = registros.filter(r => r.estado === 'aprobada').length;
  const desaprobadas = registros.filter(r => ['desaprobada', 'a_recursar'].includes(r.estado)).length;
  const enCurso      = registros.filter(r => r.estado === 'cursando').length;
  const enPendiente  = registros.filter(r =>
    ['pendiente_intensif', 'intensificando', 'recursando'].includes(r.estado)
  ).length;

  const chips = [
    aprobadas    ? `<span class="seg-chip seg-chip--verde">${aprobadas} aprobada${aprobadas    !== 1 ? 's' : ''}</span>` : '',
    desaprobadas ? `<span class="seg-chip seg-chip--rojo">${desaprobadas} desaprobada${desaprobadas !== 1 ? 's' : ''}</span>` : '',
    enPendiente  ? `<span class="seg-chip seg-chip--ambar">${enPendiente} pendiente${enPendiente  !== 1 ? 's' : ''}</span>` : '',
    enCurso      ? `<span class="seg-chip seg-chip--azul">${enCurso} en curso</span>` : '',
  ].filter(Boolean).join('');

  const filas = registros
    .slice()
    .sort((a, b) => (a.materias?.nombre || '').localeCompare(b.materias?.nombre || ''))
    .map(r => {
      const clr = _ESTADO_CLR[r.estado] || '#6b7280';
      const detalles = [
        r.nota_final      != null ? `Final: <strong>${_fmtVal(r.nota_final)}</strong>`    : null,
        r.nota_intensif_1 != null ? `Dic: <strong>${_fmtVal(r.nota_intensif_1)}</strong>` : null,
        r.nota_intensif_2 != null ? `Feb: <strong>${_fmtVal(r.nota_intensif_2)}</strong>` : null,
        r.ciclo_lectivo_cursado !== r.ciclo_lectivo_origen
          ? `Resuelve en ${r.ciclo_lectivo_cursado}` : null,
      ].filter(Boolean).join(' · ');

      return `
        <div class="list-item" style="align-items:center">
          <div class="list-item-body">
            <p class="list-item-title">${r.materias?.nombre || '—'}</p>
            ${detalles ? `<p class="list-item-meta">${detalles}</p>` : ''}
          </div>
          <span style="font-size:11px;font-weight:700;color:${clr};white-space:nowrap;flex-shrink:0">
            ${_ESTADO_LBL[r.estado] || r.estado}
          </span>
        </div>`;
    }).join('');

  return `
    <div class="card" style="margin-top:8px">
      <div class="card-header">
        <span class="card-label">CICLO ${ciclo}</span>
      </div>
      ${chips ? `<div class="seg-chips">${chips}</div>` : ''}
      <div class="list-items">${filas}</div>
    </div>`;
}

// ── Card de materias con acreditación pendiente ───────────────────────
function _seguimientoPendientes(pendientes) {
  return `
    <div class="card" style="border-left:3px solid var(--color-danger)">
      <div class="card-header">
        <span class="card-label" style="color:var(--color-danger)">⚠ PENDIENTE DE ACREDITACIÓN (${pendientes.length})</span>
      </div>
      <div class="list-items">
        ${pendientes.map(r => `
          <div class="list-item">
            <div class="list-dot" style="background:var(--color-danger);flex-shrink:0"></div>
            <div class="list-item-body">
              <p class="list-item-title">${r.materias?.nombre || '—'}</p>
              <p class="list-item-meta">Ciclo ${r.ciclo_lectivo_origen}${
                r.ciclo_lectivo_cursado !== r.ciclo_lectivo_origen
                  ? ` · resolviendo en ${r.ciclo_lectivo_cursado}` : ''
              }</p>
            </div>
            <span class="seg-chip seg-chip--ambar">${_ESTADO_LBL[r.estado] || r.estado}</span>
          </div>
        `).join('')}
      </div>
    </div>`;
}

// ── Helpers de nota ───────────────────────────────────────────────────
function _notaClase(n) {
  return n >= 7 ? 'nota-bdg--verde' : n >= 4 ? 'nota-bdg--ambar' : 'nota-bdg--rojo';
}

function _notaBadge(n) {
  return `<span class="nota-bdg ${_notaClase(n)}">${_fmtVal(n)}</span>`;
}

function _fmtVal(n) {
  if (n == null) return '—';
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : parseFloat(v.toFixed(1));
}
