// =====================================================
// INFORMES_INICIAL.JS — Módulo Informes Nivel Inicial
// =====================================================
// Renderer: rInformes()
// Compila el informe narrativo final por alumno/semestre
// usando las observaciones de observaciones_iniciales.
// Solo accesible para nivel inicial.
// =====================================================

async function rInformes() {
  const pg     = document.getElementById('page-informes');
  if (!pg) return;

  // Redirigir si la institución no tiene nivel inicial
  const tieneInicial = (typeof esNivelInicial === 'function' && esNivelInicial())
    || INSTITUCION_ACTUAL?.nivel_inicial;
  if (!tieneInicial) {
    pg.innerHTML = `<div class="pg-t">Informes</div><div class="empty-state">Este módulo es exclusivo de nivel inicial.</div>`;
    return;
  }

  // Inyectar estilos del botón IA (una sola vez)
  if (!document.getElementById('ia-spark-styles')) {
    const st = document.createElement('style');
    st.id = 'ia-spark-styles';
    st.textContent = `
      .btn-ia-spark {
        width:36px;height:36px;border-radius:50%;border:none;flex-shrink:0;
        background:linear-gradient(135deg,#f59e0b,#fbbf24);
        color:#fff;font-size:15px;cursor:pointer;
        transition:transform .15s,opacity .15s;
        animation:ia-spark-pulse 2.5s ease-in-out infinite;
      }
      .btn-ia-spark:hover:not(:disabled) { transform:scale(1.12); }
      .btn-ia-spark:disabled {
        animation:none;background:#ccc;cursor:not-allowed;opacity:.55;
      }
      .btn-ia-spark.loading {
        animation:ia-spark-spin .8s linear infinite;
        background:linear-gradient(135deg,#d97706,#fbbf24);
      }
      @keyframes ia-spark-pulse {
        0%,100% { box-shadow:0 0 0 0 rgba(251,191,36,.6); }
        50%      { box-shadow:0 0 12px 5px rgba(251,191,36,.2); }
      }
      @keyframes ia-spark-spin {
        from { transform:rotate(0deg); }
        to   { transform:rotate(360deg); }
      }
    `;
    document.head.appendChild(st);
  }

  showLoading('informes');
  const instId    = USUARIO_ACTUAL.institucion_id;
  const rol       = USUARIO_ACTUAL.rol;
  const miId      = USUARIO_ACTUAL.id;
  const anio      = INSTITUCION_ACTUAL?.anio_lectivo || new Date().getFullYear();
  const esDocente = rol === 'docente';

  // Cargar salas
  let cursosQuery = sb.from('cursos')
    .select('id, nombre, division')
    .eq('institucion_id', instId)
    .eq('nivel', 'inicial')
    .eq('activo', true)
    .order('nombre');

  if (esDocente) {
    const { data: asigs } = await sb.from('asignaciones')
      .select('curso_id')
      .eq('docente_id', miId)
      .eq('anio_lectivo', anio);
    const ids = (asigs || []).map(a => a.curso_id);
    if (!ids.length) {
      pg.innerHTML = `<div class="pg-t">Informes</div><div class="empty-state">No tenés salas asignadas para este año.</div>`;
      return;
    }
    cursosQuery = cursosQuery.in('id', ids);
  }

  const { data: cursos } = await cursosQuery;

  if (!cursos?.length) {
    pg.innerHTML = `<div class="pg-t">Informes</div><div class="empty-state">No hay salas de nivel inicial registradas.</div>`;
    return;
  }

  // Cargar dimensiones
  const { data: cfgArr } = await sb.from('config_asistencia')
    .select('dimensiones_informe')
    .eq('institucion_id', instId)
    .eq('nivel', 'inicial')
    .single();
  const dimensiones = cfgArr?.dimensiones_informe || [];

  // Estado del selector
  const salaId   = window._infSalaId   || cursos[0].id;
  const semestre = window._infSemestre  || 1;
  window._infSalaId   = salaId;
  window._infSemestre = semestre;

  pg.innerHTML = `
    <div class="pg-t">Informes</div>

    <div class="card" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:18px;padding:14px 16px">
      <div style="flex:1;min-width:140px">
        <div style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;margin-bottom:4px">Sala</div>
        <select id="inf-sala" class="inp" style="width:100%;margin:0"
          onchange="window._infSalaId=this.value;window._infSemestre=document.getElementById('inf-sem').value*1;rInformes()">
          ${cursos.map(c => `<option value="${c.id}" ${c.id===salaId?'selected':''}>${c.nombre}${c.division?' '+c.division:''}</option>`).join('')}
        </select>
      </div>
      <div style="min-width:140px">
        <div style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;margin-bottom:4px">Semestre</div>
        <select id="inf-sem" class="inp" style="width:100%;margin:0"
          onchange="window._infSemestre=this.value*1;window._infSalaId=document.getElementById('inf-sala').value;rInformes()">
          <option value="1" ${semestre===1?'selected':''}>1° semestre</option>
          <option value="2" ${semestre===2?'selected':''}>2° semestre</option>
        </select>
      </div>
    </div>

    <div id="inf-lista"><div class="loading-state small"><div class="spinner"></div></div></div>
  `;

  await _renderListaInformes(salaId, semestre, anio, instId, dimensiones, esDocente);
}

async function _renderListaInformes(salaId, semestre, anio, instId, dimensiones, esDocente) {
  const cont = document.getElementById('inf-lista');
  if (!cont) return;

  // Fetch alumnos, observaciones e informes en paralelo
  const { data: alumnos } = await sb.from('alumnos')
    .select('id, nombre, apellido')
    .eq('curso_id', salaId)
    .eq('activo', true)
    .order('apellido').order('nombre');

  if (!alumnos?.length) {
    cont.innerHTML = `<div class="empty-state">No hay alumnos en esta sala.</div>`;
    return;
  }

  const alumnoIds = alumnos.map(a => a.id);

  const [obsRes, infRes] = await Promise.all([
    sb.from('observaciones_iniciales')
      .select('alumno_id, dimension, observacion')
      .eq('anio_lectivo', anio)
      .eq('semestre', semestre)
      .in('alumno_id', alumnoIds),
    sb.from('informes_iniciales')
      .select('alumno_id, texto_final, borrador_ia, estado')
      .eq('anio_lectivo', anio)
      .eq('semestre', semestre)
      .in('alumno_id', alumnoIds),
  ]);

  // Indexar
  const obsIdx = {};
  (obsRes.data || []).forEach(o => {
    if (!obsIdx[o.alumno_id]) obsIdx[o.alumno_id] = {};
    obsIdx[o.alumno_id][o.dimension] = o.observacion;
  });
  const infIdx = {};
  (infRes.data || []).forEach(i => { infIdx[i.alumno_id] = i; });

  const estadoLabel = { borrador: 'Borrador', finalizado: 'Finalizado', enviado: 'Enviado a familia' };
  const estadoColor = { borrador: 'var(--ambar)', finalizado: 'var(--verde)', enviado: 'var(--accent)' };

  cont.innerHTML = alumnos.map(al => {
    const inf      = infIdx[al.id];
    const obsAl    = obsIdx[al.id] || {};
    const estado   = inf?.estado || 'sin_iniciar';
    const isOpen   = EX === `inf-${al.id}`;
    const labelEst = estado === 'sin_iniciar' ? 'Sin iniciar' : (estadoLabel[estado] || estado);
    const colorEst = estado === 'sin_iniciar' ? 'var(--txt3)' : (estadoColor[estado] || 'var(--txt2)');
    const obsCount = Object.values(obsAl).filter(v => v?.trim()).length;

    return `
      <div class="card" style="margin-bottom:10px;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;cursor:pointer"
             onclick="togEx('inf-${al.id}', () => _renderListaInformes('${salaId}',${semestre},${anio},'${instId}',${JSON.stringify(dimensiones).replace(/"/g,"'")},${esDocente}))">
          <div>
            <div style="font-size:13px;font-weight:600">${al.apellido}, ${al.nombre}</div>
            <div style="font-size:11px;color:var(--txt2);margin-top:2px">${obsCount}/${dimensiones.length} obs. cargadas</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:11px;font-weight:600;color:${colorEst}">${labelEst}</span>
            <span style="font-size:18px;color:var(--txt3);transform:rotate(${isOpen?'90':'0'}deg);transition:.2s">›</span>
          </div>
        </div>
        ${isOpen ? _renderDetalleInforme(al, inf, obsAl, dimensiones, salaId, semestre, anio, instId, esDocente) : ''}
      </div>`;
  }).join('');
}

function _renderDetalleInforme(al, inf, obsAl, dimensiones, salaId, semestre, anio, instId, esDocente) {
  const textoFinal  = inf?.texto_final  || '';
  const borradorIA  = inf?.borrador_ia  || '';
  const estado      = inf?.estado       || 'borrador';
  const puedeIA     = ['director_general','directivo_nivel','docente'].includes(USUARIO_ACTUAL.rol);

  const tieneObs = dimensiones.some(d => obsAl[d]?.trim());

  // Resumen de observaciones como referencia
  const resumenObs = dimensiones.length
    ? `<div style="margin-bottom:20px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--txt2);margin-bottom:10px">
          Observaciones por dimensión (referencia)
        </div>
        ${dimensiones.map(d => `
          <div style="margin-bottom:10px">
            <div style="font-size:11px;font-weight:700;color:var(--txt2);margin-bottom:3px">${d}</div>
            <div style="font-size:12px;color:${obsAl[d]?.trim()?'var(--txt1)':'var(--txt3)'};font-style:${obsAl[d]?.trim()?'normal':'italic'};line-height:1.5">
              ${obsAl[d]?.trim() || 'Sin observación cargada'}
            </div>
          </div>`).join('')}
      </div>`
    : '';

  return `
    <div style="padding:0 16px 16px">
      <div style="height:1px;background:var(--brd);margin-bottom:16px"></div>

      ${resumenObs}

      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--txt2);margin-bottom:6px">
        Informe final
      </div>
      <textarea id="inf-txt-${al.id}" class="inp"
        style="width:100%;min-height:160px;resize:vertical;font-size:13px;line-height:1.6;box-sizing:border-box"
        placeholder="Redactá aquí el informe narrativo completo del alumno/a...">${_escInf(textoFinal)}</textarea>

      <div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${puedeIA ? `
        <button class="btn-ia-spark" id="btn-ia-inf-${al.id}"
          onclick="_generarInformeNarrativo('${al.id}','${_escInf(al.nombre)} ${_escInf(al.apellido)}','${salaId}',${semestre},${anio},'${instId}',${JSON.stringify(dimensiones).replace(/"/g,"'")})"
          title="${tieneObs ? 'Generar informe narrativo con IA' : 'Cargá al menos una observación antes de generar el informe'}"
          ${!tieneObs?'disabled':''}>✦</button>
        ` : ''}
        ${borradorIA ? `
        <button class="btn-sm" style="background:var(--surf2);color:var(--txt1)"
          onclick="document.getElementById('inf-txt-${al.id}').value=${JSON.stringify(borradorIA)};document.getElementById('borr-inf-${al.id}').style.display='none'">
          Usar borrador IA
        </button>` : ''}
      </div>

      ${borradorIA ? `
      <div id="borr-inf-${al.id}" class="card" style="margin-top:8px;padding:12px;background:var(--surf2);font-size:12px;color:var(--txt2);line-height:1.5;border-left:3px solid var(--accent)">
        <div style="font-size:10px;font-weight:700;color:var(--accent);margin-bottom:4px">BORRADOR IA</div>
        ${_escInf(borradorIA)}
      </div>` : ''}

      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
        <button class="btn-primary" style="flex:1"
          onclick="_guardarInforme('${al.id}','${instId}',${semestre},${anio},'${salaId}','${estado}',${JSON.stringify(dimensiones).replace(/"/g,"'")},${esDocente})">
          Guardar
        </button>
        <button class="btn-sm" style="background:var(--surf2);color:var(--txt2)"
          onclick="_descargarInforme('${al.id}','${_escInf(al.apellido)}, ${_escInf(al.nombre)}',${semestre},${anio})"
          title="Descargar como PDF">
          ↓ Descargar
        </button>
        ${estado !== 'finalizado' && estado !== 'enviado' ? `
        <button class="btn-sm" style="background:var(--verde-l);color:var(--verde)"
          onclick="_cambiarEstadoInforme('${al.id}','${instId}',${semestre},${anio},'finalizado','${salaId}',${JSON.stringify(dimensiones).replace(/"/g,"'")},${esDocente})">
          Finalizar
        </button>` : ''}
        ${estado === 'finalizado' ? `
        <button class="btn-sm" style="background:var(--accent);color:#fff"
          onclick="_cambiarEstadoInforme('${al.id}','${instId}',${semestre},${anio},'enviado','${salaId}',${JSON.stringify(dimensiones).replace(/"/g,"'")},${esDocente})">
          Enviado a familia
        </button>` : ''}
      </div>
    </div>`;
}

function _escInf(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

async function _generarInformeNarrativo(alumnoId, alumnoNombre, salaId, semestre, anio, instId, dimensiones) {
  const btn = document.getElementById(`btn-ia-inf-${alumnoId}`);
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.classList.add('loading');
  btn.textContent = '↻';

  try {
    // Obtener observaciones actuales
    const { data: obsData } = await sb.from('observaciones_iniciales')
      .select('dimension, observacion')
      .eq('alumno_id', alumnoId)
      .eq('anio_lectivo', anio)
      .eq('semestre', semestre);

    const obsPorDim = {};
    (obsData || []).forEach(o => { if (o.observacion?.trim()) obsPorDim[o.dimension] = o.observacion; });

    const salaLabel = document.getElementById('inf-sala')?.selectedOptions[0]?.text || '';

    const result = await llamarIA('informe_narrativo_inicial', {
      alumno_nombre: alumnoNombre,
      sala: salaLabel,
      semestre,
      anio_lectivo: anio,
      observaciones_por_dimension: obsPorDim,
    });

    if (result) {
      // Guardar borrador_ia
      await sb.from('informes_iniciales').upsert({
        alumno_id:      alumnoId,
        institucion_id: instId,
        anio_lectivo:   anio,
        semestre,
        borrador_ia:    result,
        creado_por:     USUARIO_ACTUAL.id,
        actualizado_en: new Date().toISOString(),
      }, { onConflict: 'alumno_id,anio_lectivo,semestre' });

      const { data: cfgArr } = await sb.from('config_asistencia')
        .select('dimensiones_informe').eq('institucion_id', instId).eq('nivel', 'inicial').single();
      const dims = cfgArr?.dimensiones_informe || [];
      await _renderListaInformes(salaId, semestre, anio, instId, dims, USUARIO_ACTUAL.rol === 'docente');
    }
  } catch (e) {
    mostrarToast('No se pudo generar el informe. Intentá más tarde.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); btn.textContent = '✦'; }
  }
}

async function _guardarInforme(alumnoId, instId, semestre, anio, salaId, estadoActual, dimensiones, esDocente) {
  const textoFinal = document.getElementById(`inf-txt-${alumnoId}`)?.value?.trim() || null;

  const { error } = await sb.from('informes_iniciales').upsert({
    alumno_id:      alumnoId,
    institucion_id: instId,
    anio_lectivo:   anio,
    semestre,
    texto_final:    textoFinal,
    estado:         estadoActual === 'sin_iniciar' ? 'borrador' : estadoActual,
    creado_por:     USUARIO_ACTUAL.id,
    actualizado_en: new Date().toISOString(),
  }, { onConflict: 'alumno_id,anio_lectivo,semestre' });

  if (error) {
    mostrarToast('Error al guardar. Intentá de nuevo.', 'error');
    return;
  }
  mostrarToast('Informe guardado.', 'ok');
  const { data: cfgArr } = await sb.from('config_asistencia')
    .select('dimensiones_informe').eq('institucion_id', instId).eq('nivel', 'inicial').single();
  const dims = cfgArr?.dimensiones_informe || [];
  await _renderListaInformes(salaId, semestre, anio, instId, dims, esDocente);
}

function _descargarInforme(alumnoId, alumnoNombre, semestre, anio) {
  const texto = document.getElementById(`inf-txt-${alumnoId}`)?.value?.trim() || '';
  if (!texto) { mostrarToast('Escribí el informe antes de descargar.', 'error'); return; }

  const semLabel  = semestre === 1 ? '1° semestre' : '2° semestre';
  const salaLabel = document.getElementById('inf-sala')?.selectedOptions[0]?.text || '';
  const instNombre = INSTITUCION_ACTUAL?.nombre || '';
  const textoHtml  = texto.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe — ${alumnoNombre}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Arial,sans-serif; margin:40px; color:#1a1a1a; line-height:1.7; font-size:14px; }
  .header { border-bottom:2px solid #1a6b3c; padding-bottom:16px; margin-bottom:28px; }
  .inst { font-size:11px; color:#555; text-transform:uppercase; letter-spacing:.08em; margin-bottom:6px; }
  h1 { font-size:20px; font-weight:700; margin-bottom:4px; }
  .meta { font-size:12px; color:#666; }
  .body { font-size:14px; line-height:1.8; white-space:pre-wrap; }
  .footer { margin-top:48px; border-top:1px solid #ddd; padding-top:12px; font-size:10px; color:#aaa; }
  @media print { body { margin:20mm 18mm; } }
</style>
</head>
<body>
  <div class="header">
    <div class="inst">${instNombre}</div>
    <h1>Informe pedagógico</h1>
    <div class="meta">${alumnoNombre} · ${salaLabel} · ${semLabel} ${anio}</div>
  </div>
  <div class="body">${textoHtml}</div>
  <div class="footer">Emitido el ${new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'})}</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=820,height=680');
  if (!win) { mostrarToast('Permitir ventanas emergentes para descargar.', 'error'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

async function _cambiarEstadoInforme(alumnoId, instId, semestre, anio, nuevoEstado, salaId, dimensiones, esDocente) {
  const textoFinal = document.getElementById(`inf-txt-${alumnoId}`)?.value?.trim() || null;

  const { error } = await sb.from('informes_iniciales').upsert({
    alumno_id:      alumnoId,
    institucion_id: instId,
    anio_lectivo:   anio,
    semestre,
    texto_final:    textoFinal,
    estado:         nuevoEstado,
    creado_por:     USUARIO_ACTUAL.id,
    actualizado_en: new Date().toISOString(),
  }, { onConflict: 'alumno_id,anio_lectivo,semestre' });

  if (error) {
    mostrarToast('Error al actualizar estado.', 'error');
    return;
  }
  const labelMap = { finalizado: 'Informe marcado como finalizado.', enviado: 'Informe marcado como enviado a familia.' };
  mostrarToast(labelMap[nuevoEstado] || 'Estado actualizado.', 'ok');
  const { data: cfgArr } = await sb.from('config_asistencia')
    .select('dimensiones_informe').eq('institucion_id', instId).eq('nivel', 'inicial').single();
  const dims = cfgArr?.dimensiones_informe || [];
  await _renderListaInformes(salaId, semestre, anio, instId, dims, esDocente);
}
