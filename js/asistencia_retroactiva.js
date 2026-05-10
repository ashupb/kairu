// =====================================================
// ASISTENCIA_RETROACTIVA.JS
// Carga masiva retroactiva de asistencia por período
// =====================================================

const _RETRO_CICLO = ['presente', 'ausente', 'tardanza', 'media_falta', 'justificado'];

async function abrirCargaRetroactiva(cursoId, cursoNombre, nivel) {
  const pg = document.getElementById('page-asist');
  showLoading('asist');

  if (!window._diasNoLectivos) window._diasNoLectivos = new Set();

  const { data: alumnos, error } = await sb.from('alumnos')
    .select('id, nombre, apellido')
    .eq('curso_id', cursoId)
    .eq('activo', true)
    .order('apellido');

  if (error || !alumnos?.length) {
    pg.innerHTML = `
      <button onclick="rAsist()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--txt2);margin-bottom:12px">←</button>
      <div class="empty-state">Sin alumnos activos en este curso.</div>`;
    return;
  }

  window._retroCursoId  = cursoId;
  window._retroNombre   = cursoNombre;
  window._retroNivel    = nivel;
  window._retroAlumnos  = alumnos;
  window._retroEstados  = {};
  window._retroFechas   = [];

  _inyectarEstilosRetro();
  _renderRetroSelector();
}

function _renderRetroSelector() {
  const pg      = document.getElementById('page-asist');
  const alumnos = window._retroAlumnos;
  const nombre  = window._retroNombre;

  const anio         = new Date().getFullYear();
  const desdeDefault = INSTITUCION_ACTUAL?.fecha_inicio_ciclo || `${anio}-03-01`;
  const ayer         = new Date(); ayer.setDate(ayer.getDate() - 1);
  const ayerISO      = ayer.toISOString().slice(0, 10);

  pg.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <button onclick="rAsist()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--txt2)">←</button>
      <div>
        <div class="pg-t">Carga retroactiva</div>
        <div class="pg-s">${nombre} · ${alumnos.length} alumno${alumnos.length !== 1 ? 's' : ''}</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div style="font-size:13px;font-weight:600;margin-bottom:12px">📅 Configurar período</div>
      <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
        <label style="font-size:11px;color:var(--txt2);font-weight:500">
          Desde
          <input type="date" id="retro-desde" value="${desdeDefault}" max="${ayerISO}"
            style="display:block;margin-top:4px;padding:7px 10px;border:1.5px solid var(--brd);border-radius:var(--rad);font-size:13px;font-family:inherit;background:var(--surf)">
        </label>
        <label style="font-size:11px;color:var(--txt2);font-weight:500">
          Hasta
          <input type="date" id="retro-hasta" value="${ayerISO}" max="${ayerISO}"
            style="display:block;margin-top:4px;padding:7px 10px;border:1.5px solid var(--brd);border-radius:var(--rad);font-size:13px;font-family:inherit;background:var(--surf)">
        </label>
        <button class="btn-p" onclick="_retroGenerar()" style="padding:8px 16px">
          Generar grilla →
        </button>
      </div>
      <div style="font-size:11px;color:var(--txt3);margin-top:8px">
        Se excluyen automáticamente fines de semana, feriados y días sin clases configurados.
      </div>
    </div>

    <div id="retro-area"></div>
  `;
}

async function _retroGenerar() {
  const desde = document.getElementById('retro-desde')?.value;
  const hasta = document.getElementById('retro-hasta')?.value;

  if (!desde || !hasta) return;
  if (desde > hasta) { alert('La fecha de inicio debe ser anterior o igual a la de fin.'); return; }

  const area = document.getElementById('retro-area');
  area.innerHTML = `<div style="text-align:center;padding:24px;color:var(--txt3);font-size:12px">Calculando días hábiles...</div>`;

  const fechas = _retroGetFechasHabiles(desde, hasta);

  if (!fechas.length) {
    area.innerHTML = `<div class="empty-state">No hay días hábiles en el período seleccionado.</div>`;
    return;
  }

  const { data: existentes } = await sb.from('asistencia')
    .select('alumno_id, fecha, estado')
    .eq('curso_id', window._retroCursoId)
    .gte('fecha', fechas[0])
    .lte('fecha', fechas[fechas.length - 1])
    .is('hora_clase', null);

  const estados = {};
  window._retroAlumnos.forEach(al => {
    estados[al.id] = {};
    fechas.forEach(f => { estados[al.id][f] = 'presente'; });
  });
  (existentes || []).forEach(r => {
    if (estados[r.alumno_id]) estados[r.alumno_id][r.fecha] = r.estado;
  });

  window._retroEstados = estados;
  window._retroFechas  = fechas;

  const nExist = existentes?.length || 0;

  area.innerHTML = `
    ${nExist > 0 ? `
    <div style="background:var(--amb-l);border-left:4px solid var(--ambar);border-radius:var(--rad);padding:10px 14px;margin-bottom:12px;font-size:12px;color:var(--txt)">
      <strong style="color:var(--ambar)">⚠️ Período con datos existentes:</strong>
      ya hay ${nExist} registros en este rango. Al guardar serán reemplazados.
    </div>` : ''}

    <div class="card" style="margin-bottom:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:10px">
        <div>
          <span style="font-size:13px;font-weight:600">${fechas.length} días hábiles</span>
          <span style="font-size:11px;color:var(--txt2);margin-left:8px">
            ${formatFechaLatam(fechas[0])} → ${formatFechaLatam(fechas[fechas.length - 1])}
          </span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button class="btn-s" style="font-size:11px" onclick="_retroDescargarTemplate()">↓ Template CSV</button>
          <label class="btn-s" style="font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:4px">
            ↑ Importar CSV
            <input type="file" accept=".csv,.txt" style="display:none" onchange="_retroImportarCSV(this)">
          </label>
          <button class="btn-p" id="btn-retro-guardar" onclick="_retroGuardar()">💾 Guardar todo</button>
        </div>
      </div>
      <div class="retro-leyenda">
        ${_RETRO_CICLO.map(e => {
          const c = ESTADOS_ASIST[e];
          return `<span style="background:${c.bg};color:${c.color};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600">${c.short} = ${c.label}</span>`;
        }).join('')}
        <span style="font-size:10px;color:var(--txt3)">· Click en celda para cambiar</span>
      </div>
    </div>

    <div class="retro-tabla-wrap">
      ${_retroHtmlTabla()}
    </div>
  `;
}

function _retroHtmlTabla() {
  const alumnos = window._retroAlumnos;
  const fechas  = window._retroFechas;
  const estados = window._retroEstados;

  const grupos = [];
  let mesAct = null;
  fechas.forEach(f => {
    const m = f.slice(0, 7);
    if (m !== mesAct) { grupos.push({ mes: m, n: 0 }); mesAct = m; }
    grupos[grupos.length - 1].n++;
  });

  const MESES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const DIAS  = ['D','L','M','X','J','V','S'];
  const fmtMes = m => { const [y, mo] = m.split('-'); return `${MESES[parseInt(mo)]} ${y}`; };

  return `
    <table class="retro-tabla">
      <thead>
        <tr>
          <th class="retro-th-alumno retro-stick" rowspan="2">Alumno</th>
          ${grupos.map(g => `<th colspan="${g.n}" class="retro-th-mes">${fmtMes(g.mes)}</th>`).join('')}
        </tr>
        <tr>
          ${fechas.map(f => {
            const d = new Date(f + 'T12:00:00');
            return `<th class="retro-th-dia" title="${f}">
              <span style="font-size:8px;color:var(--txt3);display:block;line-height:1.2">${DIAS[d.getDay()]}</span>
              ${d.getDate()}
            </th>`;
          }).join('')}
        </tr>
      </thead>
      <tbody>
        ${alumnos.map(al => `
          <tr>
            <td class="retro-td-alumno retro-stick">${al.apellido}, ${al.nombre}</td>
            ${fechas.map(f => {
              const est = estados[al.id]?.[f] || 'presente';
              const cfg = ESTADOS_ASIST[est];
              return `<td class="retro-celda"
                style="background:${cfg.bg};color:${cfg.color}"
                onclick="_retroToggle('${al.id}','${f}',this)"
                title="${al.apellido} · ${f} · ${cfg.label}">${cfg.short}</td>`;
            }).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function _retroToggle(alumnoId, fecha, celda) {
  const cur  = window._retroEstados[alumnoId]?.[fecha] || 'presente';
  const idx  = _RETRO_CICLO.indexOf(cur);
  const next = _RETRO_CICLO[(idx + 1) % _RETRO_CICLO.length];
  if (!window._retroEstados[alumnoId]) window._retroEstados[alumnoId] = {};
  window._retroEstados[alumnoId][fecha] = next;
  const cfg = ESTADOS_ASIST[next];
  celda.style.background = cfg.bg;
  celda.style.color      = cfg.color;
  celda.textContent      = cfg.short;
}

function _retroGetFechasHabiles(desde, hasta) {
  const fechas = [];
  const curr   = new Date(desde + 'T12:00:00');
  const fin    = new Date(hasta + 'T12:00:00');
  while (curr <= fin) {
    const iso = curr.toISOString().slice(0, 10);
    if (esFechaHabil(iso)) fechas.push(iso);
    curr.setDate(curr.getDate() + 1);
  }
  return fechas;
}

// ── GUARDAR ──────────────────────────────────────────

async function _retroGuardar() {
  const btn = document.getElementById('btn-retro-guardar');
  if (!btn || btn.disabled) return;

  const cursoId = window._retroCursoId;
  const nivel   = window._retroNivel;
  const alumnos = window._retroAlumnos;
  const fechas  = window._retroFechas;
  const estados = window._retroEstados;

  if (!fechas.length) return;

  btn.disabled    = true;
  btn.textContent = 'Guardando...';

  try {
    const instId = USUARIO_ACTUAL.institucion_id;

    const { error: delErr } = await sb.from('asistencia')
      .delete()
      .eq('curso_id', cursoId)
      .gte('fecha', fechas[0])
      .lte('fecha', fechas[fechas.length - 1])
      .is('hora_clase', null);

    if (delErr) throw delErr;

    const registros = [];
    alumnos.forEach(al => {
      fechas.forEach(f => {
        registros.push({
          institucion_id: instId,
          alumno_id:      al.id,
          curso_id:       cursoId,
          fecha:          f,
          estado:         estados[al.id]?.[f] || 'presente',
          hora_clase:     null,
          materia_id:     null,
          registrado_por: USUARIO_ACTUAL.id,
        });
      });
    });

    const BATCH = 500;
    for (let i = 0; i < registros.length; i += BATCH) {
      const { error: insErr } = await sb.from('asistencia').insert(registros.slice(i, i + BATCH));
      if (insErr) throw insErr;
    }

    await verificarAlertas(alumnos.map(a => a.id), instId, nivel);

    btn.textContent      = '✅ Guardado';
    btn.style.background = 'var(--verde)';
    btn.style.color      = '#fff';
    setTimeout(() => rAsist(), 1500);

  } catch (err) {
    console.error(err);
    btn.disabled    = false;
    btn.textContent = '💾 Guardar todo';
    alert('Error al guardar: ' + err.message);
  }
}

// ── CSV EXPORT ────────────────────────────────────────

function _retroDescargarTemplate() {
  if (!window._retroFechas?.length) { alert('Primero generá la grilla.'); return; }
  const alumnos = window._retroAlumnos;
  const fechas  = window._retroFechas;
  const nombre  = window._retroNombre;

  const lineas = [
    '# Template de asistencia — completar con: P o vacío=Presente  A=Ausente  M=Media falta  T=Tardanza  J=Justificado  RA=Retiro anticipado',
    ['Alumno', ...fechas].join(','),
    ...alumnos.map(al => [`"${al.apellido} ${al.nombre}"`, ...fechas.map(() => '')].join(',')),
  ];

  _retroBajarCSV(lineas.join('\r\n'), `template_asistencia_${nombre.replace(/\s+/g, '_')}.csv`);
}

function _retroBajarCSV(contenido, nombreArchivo) {
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── CSV IMPORT ────────────────────────────────────────

function _retroImportarCSV(input) {
  const file = input.files?.[0];
  if (!file) return;
  input.value = '';
  const reader = new FileReader();
  reader.onload  = e => {
    try       { _retroProcesarCSV(e.target.result); }
    catch(err){ alert('Error al leer el CSV: ' + err.message); }
  };
  reader.readAsText(file, 'UTF-8');
}

function _retroProcesarCSV(texto) {
  const alumnos  = window._retroAlumnos;
  const fechasOk = new Set(window._retroFechas);

  const VAL = {
    '':'presente', 'P':'presente', 'A':'ausente', 'M':'media_falta',
    'T':'tardanza', 'J':'justificado', 'RA':'retiro_anticipado',
  };

  const alumnoIdx = {};
  alumnos.forEach(al => {
    const k = `${al.apellido} ${al.nombre}`.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    alumnoIdx[k] = al.id;
  });

  const lineas = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  if (lineas.length < 2) throw new Error('El archivo no tiene filas de alumnos.');

  const header    = _retroParseCsv(lineas[0]);
  const fechasCSV = header.slice(1).map(f => f.trim());

  const errores = [];
  const nuevos  = {};
  alumnos.forEach(al => { nuevos[al.id] = { ...window._retroEstados[al.id] }; });

  for (let i = 1; i < lineas.length; i++) {
    const cols   = _retroParseCsv(lineas[i]);
    const nomRaw = cols[0]?.trim() || '';
    const nomKey = nomRaw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const alId   = alumnoIdx[nomKey];

    if (!alId) { errores.push(`Fila ${i+1}: alumno no encontrado — "${nomRaw}"`); continue; }

    fechasCSV.forEach((f, idx) => {
      if (!fechasOk.has(f)) return;
      const val    = (cols[idx + 1] || '').trim().toUpperCase();
      const estado = VAL[val];
      if (estado !== undefined) {
        nuevos[alId][f] = estado;
      } else {
        errores.push(`Fila ${i+1} / ${f}: valor inválido "${val}"`);
      }
    });
  }

  if (errores.length) {
    const muestra = errores.slice(0, 5).join('\n');
    const extra   = errores.length > 5 ? `\n... y ${errores.length - 5} más` : '';
    if (!confirm(`${errores.length} advertencia(s):\n${muestra}${extra}\n\n¿Importar de todas formas?`)) return;
  }

  window._retroEstados = nuevos;

  const wrap = document.querySelector('.retro-tabla-wrap');
  if (wrap) wrap.innerHTML = _retroHtmlTabla();

  const toast = Object.assign(document.createElement('div'), {
    textContent: '✓ CSV importado. Revisá la grilla y guardá.',
    style: 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--verde);color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:600;z-index:9999;box-shadow:var(--shadow-md);pointer-events:none',
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function _retroParseCsv(linea) {
  const res = [];
  let cur = '', enQ = false;
  for (const ch of linea) {
    if      (ch === '"')         { enQ = !enQ; }
    else if (ch === ',' && !enQ) { res.push(cur); cur = ''; }
    else                         { cur += ch; }
  }
  res.push(cur);
  return res;
}

// ── ESTILOS ───────────────────────────────────────────

function _inyectarEstilosRetro() {
  if (document.getElementById('retro-styles')) return;
  const st = document.createElement('style');
  st.id    = 'retro-styles';
  st.textContent = `
    .retro-tabla-wrap  { overflow-x:auto; -webkit-overflow-scrolling:touch; border-radius:var(--rad); box-shadow:var(--shadow); }
    .retro-tabla       { border-collapse:collapse; font-size:11px; }
    .retro-stick       { position:sticky; left:0; z-index:2; }
    .retro-th-alumno   { text-align:left; padding:8px 12px; background:var(--surf2); font-weight:600; font-size:11px; min-width:150px; white-space:nowrap; border-bottom:2px solid var(--brd); }
    .retro-td-alumno   { padding:4px 12px; background:var(--surf); white-space:nowrap; font-size:11px; border-bottom:1px solid var(--brd); box-shadow:2px 0 4px rgba(0,0,0,.05); }
    .retro-th-mes      { background:var(--surf2); padding:5px 4px; text-align:center; font-size:10px; font-weight:700; color:var(--txt2); border-bottom:1px solid var(--brd); border-left:2px solid var(--brd); white-space:nowrap; }
    .retro-th-dia      { background:var(--surf2); padding:3px 2px; text-align:center; min-width:30px; font-size:11px; font-weight:500; border-left:1px solid var(--brd); border-bottom:2px solid var(--brd); line-height:1.3; }
    .retro-celda       { width:30px; height:28px; text-align:center; font-size:10px; font-weight:700; cursor:pointer; border:1px solid rgba(0,0,0,.06); border-bottom:1px solid var(--brd); line-height:28px; padding:0; user-select:none; transition:transform .1s,box-shadow .1s; }
    .retro-celda:hover { transform:scale(1.2); z-index:3; position:relative; box-shadow:0 2px 8px rgba(0,0,0,.18); border-radius:3px; }
    .retro-celda:active{ transform:scale(.92); }
    .retro-leyenda     { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
    @media (max-width:600px) {
      .retro-th-alumno,.retro-td-alumno { min-width:110px; font-size:10px; padding-left:8px; padding-right:8px; }
      .retro-celda    { width:24px; height:24px; font-size:9px; line-height:24px; }
      .retro-th-dia   { min-width:24px; font-size:9px; }
    }
  `;
  document.head.appendChild(st);
}
