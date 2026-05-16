async function rAsistencia() {
  const el = document.getElementById('page-asistencia');
  showLoading('asistencia');

  if (!ALUMNO_ACTUAL) {
    el.innerHTML = `<div class="page-body"><p class="empty-msg">Sin alumno vinculado.</p></div>`;
    return;
  }

  try {
    const anio   = new Date().getFullYear();
    const hoyStr = new Date().toISOString().split('T')[0];

    const { data, error } = await sb.from('asistencia')
      .select('fecha,estado,hora_clase')
      .eq('alumno_id', ALUMNO_ACTUAL.id)
      .gte('fecha', `${anio}-01-01`)
      .lte('fecha', hoyStr)
      .order('fecha', { ascending: false });

    if (error) throw error;

    // Solo registros diarios (sin hora_clase)
    const diarios = (data || []).filter(r => !r.hora_clase);

    if (!diarios.length) {
      el.innerHTML = `
        <div class="page-body">
          <div class="page-header"><h1 class="page-title">Asistencia</h1></div>
          <p class="empty-msg">Sin registros de asistencia este año.</p>
        </div>`;
      return;
    }

    const diasUnicos    = [...new Set(diarios.map(r => r.fecha))];
    const diasPresentes = [...new Set(diarios.filter(r => ['presente','tardanza','media_falta'].includes(r.estado)).map(r => r.fecha))].length;
    const ausentes      = diarios.filter(r => r.estado === 'ausente').length;
    const tardanzas     = diarios.filter(r => ['tardanza','media_falta'].includes(r.estado)).length;
    const pct           = Math.round(diasPresentes / diasUnicos.length * 100);
    const color         = pct >= 85 ? 'success' : pct >= 75 ? 'warning' : 'danger';

    const ESTADO_LABEL = {
      presente:    'Presente',
      ausente:     'Ausente',
      media_falta: 'Media falta',
      tardanza:    'Tardanza',
      justificado: 'Justificado',
    };
    const ESTADO_COLOR = {
      presente:    'var(--color-success)',
      justificado: 'var(--color-success)',
      ausente:     'var(--color-danger)',
      media_falta: 'var(--color-warning)',
      tardanza:    'var(--color-warning)',
    };

    const rows = diarios.map(r => {
      const clr   = ESTADO_COLOR[r.estado] || 'var(--color-text-muted)';
      const label = ESTADO_LABEL[r.estado] || r.estado;
      const fecha = _fmtFechaCorta(r.fecha);
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(0,0,0,0.06)">
          <div style="width:8px;height:8px;border-radius:50%;background:${clr};flex-shrink:0"></div>
          <span style="font-size:13px;flex:1;color:var(--color-dark)">${fecha}</span>
          <span style="font-size:12px;font-weight:600;color:${clr}">${label}</span>
        </div>`;
    }).join('');

    el.innerHTML = `
      <div class="page-body">
        <div class="page-header">
          <h1 class="page-title">Asistencia</h1>
          <p style="font-size:12px;color:var(--color-text-muted);margin-top:2px">Año lectivo ${anio}</p>
        </div>
        <div class="card">
          <div class="asist-grid" style="margin-bottom:0">
            <div class="asist-stat asist-stat--${color}">
              <span class="asist-num">${pct}%</span>
              <span class="asist-label">Asistencia</span>
            </div>
            <div class="asist-stat">
              <span class="asist-num" style="color:var(--color-danger)">${ausentes}</span>
              <span class="asist-label">Ausencias</span>
            </div>
            <div class="asist-stat">
              <span class="asist-num" style="color:var(--color-warning)">${tardanzas}</span>
              <span class="asist-label">Tardanzas</span>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header" style="margin-bottom:8px">
            <span class="card-label">REGISTROS</span>
            <span class="card-sublabel">${diasUnicos.length} días</span>
          </div>
          ${rows}
        </div>
      </div>`;

  } catch (e) {
    el.innerHTML = `
      <div class="page-body">
        <div class="page-header"><h1 class="page-title">Asistencia</h1></div>
        <div class="alert-card alert-danger"><p>No se pudo cargar la asistencia. Intentá de nuevo.</p></div>
      </div>`;
  }
}

function _fmtFechaCorta(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${String(y).slice(2)}`;
}
