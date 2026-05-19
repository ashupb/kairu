// =====================================================
// AGENDA.JS — familias — Eventos institucionales v1
// =====================================================

let FAM_AGENDA_MES  = new Date().getMonth();
let FAM_AGENDA_ANIO = new Date().getFullYear();
let FAM_AGENDA_DIA  = _famHoyISO();
let _famAgEvs       = [];
let _famAgEvAbierto = null;

const FAM_NIVEL_CFG = {
  inicial:    { color: '#1a7a4a', bg: '#e8f5ee', label: '🌱 Inicial' },
  primario:   { color: '#1a5276', bg: '#eaf2fb', label: '📚 Primario' },
  secundario: { color: '#6c3483', bg: '#f5eef8', label: '🎓 Secundario' },
  todos:      { color: '#b8963e', bg: '#fdf6e8', label: '🏫 Toda la institución' },
};

const FAM_MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const FAM_DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

// ─── UTILIDADES ───────────────────────────────────────────────────
function _famHoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function _famIsoFecha(a, m, d) {
  return `${a}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function _famFmtLatam(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const meses = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${parseInt(d)} de ${meses[parseInt(m)-1]} de ${y}`;
}

function _famGetFeriadosAR(anio) {
  const _iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const map = new Map();
  const a=anio%19, b=Math.floor(anio/100), c=anio%100, dd=Math.floor(b/4), e=b%4;
  const f=Math.floor((b+8)/25), g=Math.floor((b-f+1)/3);
  const h=(19*a+b-dd-g+15)%30, ii=Math.floor(c/4), k=c%4;
  const l=(32+2*e+2*ii-h-k)%7, m2=Math.floor((a+11*h+22*l)/451);
  const pm=Math.floor((h+l-7*m2+114)/31), pd=((h+l-7*m2+114)%31)+1;
  const pascua = new Date(anio, pm-1, pd);
  const dp = (off, nom) => { const x=new Date(pascua); x.setDate(x.getDate()+off); map.set(_iso(x), nom); };
  dp(-48,'Carnaval'); dp(-47,'Carnaval'); dp(-2,'Viernes Santo');
  const af = (mes, dia, nom) => map.set(_iso(new Date(anio, mes-1, dia)), nom);
  af(1,1,'Año Nuevo'); af(3,24,'Día de la Memoria'); af(4,2,'Día de Malvinas');
  af(5,1,'Día del Trabajador'); af(5,25,'Revolución de Mayo');
  af(6,20,'Paso a la Inmortalidad del Gral. Belgrano'); af(7,9,'Día de la Independencia');
  af(12,8,'Inmaculada Concepción'); af(12,25,'Navidad');
  const tsl = (mes, dia, nom) => {
    const dt = new Date(anio, mes-1, dia);
    dt.setDate(dt.getDate() + [1,0,-1,-2,4,3,2][dt.getDay()]);
    map.set(_iso(dt), nom);
  };
  tsl(8,17,'Paso a la Inmortalidad del Gral. San Martín');
  tsl(10,12,'Día del Respeto a la Diversidad Cultural');
  tsl(11,20,'Día de la Soberanía Nacional');
  return map;
}

// ─── RENDER PRINCIPAL ─────────────────────────────────────────────
async function rAgenda() {
  const el = document.getElementById('page-agenda');
  el.innerHTML = `<div class="loading-wrap"><div class="spinner"></div></div>`;
  _famAgEstilos();

  const instId  = USUARIO_FAMILIAR?.institucion_id;
  const miNivel = ALUMNO_ACTUAL?.cursos?.nivel;
  if (!instId) return;

  const primerDia = new Date(FAM_AGENDA_ANIO, FAM_AGENDA_MES, 1);
  const ultimoDia = new Date(FAM_AGENDA_ANIO, FAM_AGENDA_MES + 1, 0);
  const desde = _famIsoFecha(FAM_AGENDA_ANIO, FAM_AGENDA_MES + 1, 1);
  const hasta  = _famIsoFecha(FAM_AGENDA_ANIO, FAM_AGENDA_MES + 1, ultimoDia.getDate());

  const alumnoId      = ALUMNO_ACTUAL?.id;
  const cursoIdAlumno = ALUMNO_ACTUAL?.cursos?.id;

  const [{ data: rawEvs }, { data: citasIndiv }] = await Promise.all([
    sb.from('eventos_institucionales')
      .select('id, nombre, fecha_inicio, fecha_fin, hora, hora_fin, lugar, nivel, descripcion, convocatoria_grupos, cursos_familias_ids')
      .eq('institucion_id', instId)
      .eq('es_cita_individual', false)
      .lte('fecha_inicio', hasta)
      .or(`fecha_fin.gte.${desde},fecha_inicio.gte.${desde}`)
      .order('fecha_inicio'),
    alumnoId
      ? sb.from('eventos_institucionales')
          .select('id, nombre, fecha_inicio, fecha_fin, hora, hora_fin, lugar, nivel, descripcion')
          .eq('alumno_id', alumnoId)
          .eq('es_cita_individual', true)
          .lte('fecha_inicio', hasta)
          .or(`fecha_fin.gte.${desde},fecha_inicio.gte.${desde}`)
      : Promise.resolve({ data: [] }),
  ]);

  // Solo eventos colectivos para familias (por convocatoria) + nivel + cursos específicos
  _famAgEvs = (rawEvs || []).filter(e => {
    const grupos = e.convocatoria_grupos || [];
    if (!grupos.some(g => ['familias', 'todos', 'comunidad'].includes(g))) return false;
    if (miNivel && e.nivel && e.nivel !== 'todos') {
      if (!e.nivel.split(',').map(n => n.trim()).includes(miNivel)) return false;
    }
    if (e.cursos_familias_ids?.length) {
      if (!cursoIdAlumno || !e.cursos_familias_ids.includes(cursoIdAlumno)) return false;
    }
    return true;
  });

  // Agregar citas individuales aceptadas al calendario
  if (citasIndiv?.length) {
    const { data: rsvps } = await sb
      .from('evento_respuestas')
      .select('evento_id')
      .eq('usuario_id', USUARIO_FAMILIAR.id)
      .eq('respuesta', 'acepta')
      .in('evento_id', citasIndiv.map(c => c.id));
    const aceptadasSet = new Set((rsvps || []).map(r => r.evento_id));
    const citasEnAgenda = citasIndiv
      .filter(c => aceptadasSet.has(c.id))
      .map(c => ({ ...c, _cita_confirmada: true }));
    _famAgEvs = [..._famAgEvs, ...citasEnAgenda];
  }

  // Si el día seleccionado cayó fuera del mes, resetear
  if (FAM_AGENDA_DIA < desde || FAM_AGENDA_DIA > hasta) {
    const hoy = _famHoyISO();
    FAM_AGENDA_DIA = (hoy >= desde && hoy <= hasta) ? hoy : desde;
  }

  const nc = FAM_NIVEL_CFG[miNivel || 'todos'];

  el.innerHTML = `
    <div class="fam-ag-wrap">

      <div class="fam-ag-header">
        <div class="fam-ag-title">
          <h2>${FAM_MESES[FAM_AGENDA_MES]} ${FAM_AGENDA_ANIO}</h2>
          <span class="fam-ag-nivel-badge" style="background:${nc.bg};color:${nc.color}">${nc.label}</span>
        </div>
        <div class="fam-ag-nav">
          <button class="fam-ag-nav-btn" onclick="famCambiarMes(-1)" title="Mes anterior">◀</button>
          <button class="fam-ag-nav-btn" onclick="famIrHoy()">Hoy</button>
          <button class="fam-ag-nav-btn" onclick="famCambiarMes(1)" title="Mes siguiente">▶</button>
        </div>
      </div>

      <div class="fam-ag-cal">
        ${_famBuildCalGrid(primerDia, ultimoDia)}
      </div>

      <div id="fam-ag-dia-lista"></div>
      <div id="fam-ag-detalle"></div>

    </div>`;

  _famRenderDiaLista(FAM_AGENDA_DIA);
}

// ─── GRILLA MENSUAL ───────────────────────────────────────────────
function _famBuildCalGrid(primerDia, ultimoDia) {
  if (!window._famFerCache) window._famFerCache = {};
  if (!window._famFerCache[FAM_AGENDA_ANIO])
    window._famFerCache[FAM_AGENDA_ANIO] = _famGetFeriadosAR(FAM_AGENDA_ANIO);
  const feriados = window._famFerCache[FAM_AGENDA_ANIO];
  const hoy = _famHoyISO();

  // Construir mapa dia → eventos (para eventos multi-día)
  const evPorDia = {};
  _famAgEvs.forEach(e => {
    let cur = e.fecha_inicio;
    const fin = e.fecha_fin || e.fecha_inicio;
    while (cur <= fin) {
      if (!evPorDia[cur]) evPorDia[cur] = [];
      if (!evPorDia[cur].find(x => x.id === e.id)) evPorDia[cur].push(e);
      const d = new Date(cur + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      cur = d.toISOString().split('T')[0];
    }
  });

  const inicioSem = primerDia.getDay();
  const totalDias = ultimoDia.getDate();

  let html = `
    <div class="fam-cal-head">
      ${FAM_DIAS.map(d => `<div class="fam-cal-th">${d}</div>`).join('')}
    </div>
    <div class="fam-cal-body">`;

  for (let i = 0; i < inicioSem; i++) html += `<div class="fam-cal-cell empty"></div>`;

  for (let dia = 1; dia <= totalDias; dia++) {
    const fechaStr = _famIsoFecha(FAM_AGENDA_ANIO, FAM_AGENDA_MES + 1, dia);
    const esHoy   = fechaStr === hoy;
    const esSel   = fechaStr === FAM_AGENDA_DIA;
    const evs     = evPorDia[fechaStr] || [];
    const ferNom  = feriados?.get(fechaStr);
    const maxChips = ferNom ? 1 : 2;

    const dotColors = [];
    if (ferNom) dotColors.push('#f9a825');
    evs.forEach(e => {
      const c = (FAM_NIVEL_CFG[e.nivel] || FAM_NIVEL_CFG.todos).color;
      if (!dotColors.includes(c)) dotColors.push(c);
    });

    html += `
      <div class="fam-cal-cell${esHoy?' hoy':''}${esSel?' sel':''}"
           onclick="famSelDia('${fechaStr}')">
        <div class="fam-cal-num${esHoy?' hoy':''}">${dia}</div>
        ${ferNom ? `<div class="fam-cal-chip fam-cal-chip-fer" title="${ferNom}">🇦🇷 ${ferNom.length>11?ferNom.slice(0,11)+'…':ferNom}</div>` : ''}
        ${evs.slice(0, maxChips).map(e => {
          const nc = e._cita_confirmada
            ? { color: '#1a7a4a', bg: '#e8f5ee' }
            : (FAM_NIVEL_CFG[e.nivel] || FAM_NIVEL_CFG.todos);
          const txt = e.nombre.length > 13 ? e.nombre.slice(0,13)+'…' : e.nombre;
          const prefix = e._cita_confirmada ? '✅ ' : (e.hora ? e.hora.slice(0,5)+' ' : '');
          return `<div class="fam-cal-chip" style="background:${nc.bg};color:${nc.color};border-color:${nc.color}50"
            title="${e.nombre}">${prefix}${txt}</div>`;
        }).join('')}
        ${evs.length > maxChips ? `<div class="fam-cal-mas">+${evs.length - maxChips} más</div>` : ''}
        <div class="fam-cal-dots">
          ${dotColors.slice(0,4).map(c => `<span class="fam-cal-dot" style="background:${c}"></span>`).join('')}
        </div>
      </div>`;
  }

  const resto = (inicioSem + totalDias) % 7;
  if (resto > 0) for (let i = 0; i < 7 - resto; i++) html += `<div class="fam-cal-cell empty"></div>`;

  return html + `</div>`;
}

// ─── SELECCIONAR DÍA ──────────────────────────────────────────────
function famSelDia(iso) {
  FAM_AGENDA_DIA = iso;
  document.querySelectorAll('.fam-cal-cell:not(.empty)').forEach(cell => {
    const onclick = cell.getAttribute('onclick') || '';
    cell.classList.toggle('sel', onclick.includes(`'${iso}'`));
  });
  _famRenderDiaLista(iso);
  const lista = document.getElementById('fam-ag-dia-lista');
  if (lista) lista.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─── LISTA DE EVENTOS DEL DÍA ─────────────────────────────────────
function _famRenderDiaLista(iso) {
  const el = document.getElementById('fam-ag-dia-lista');
  if (!el) return;

  if (!window._famFerCache) window._famFerCache = {};
  if (!window._famFerCache[FAM_AGENDA_ANIO])
    window._famFerCache[FAM_AGENDA_ANIO] = _famGetFeriadosAR(FAM_AGENDA_ANIO);
  const ferNom = window._famFerCache[FAM_AGENDA_ANIO]?.get(iso);

  const evsDelDia = _famAgEvs
    .filter(e => iso >= e.fecha_inicio && iso <= (e.fecha_fin || e.fecha_inicio))
    .sort((a, b) => (!a.hora ? 1 : !b.hora ? -1 : a.hora.localeCompare(b.hora)));

  const d = new Date(iso + 'T12:00:00');
  const tituloFecha = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  let html = `<div class="fam-ag-dia-titulo">${tituloFecha}</div>`;

  if (ferNom) {
    html += `
      <div class="fam-ag-item fam-ag-feriado">
        <div class="fam-ag-item-hora">🇦🇷</div>
        <div class="fam-ag-item-barra" style="background:#f9a825"></div>
        <div class="fam-ag-item-info">
          <div class="fam-ag-item-titulo">Feriado Nacional</div>
          <div class="fam-ag-item-meta">${ferNom}</div>
        </div>
        <div></div>
      </div>`;
  }

  if (!evsDelDia.length && !ferNom) {
    html += `<div class="fam-ag-empty">Sin eventos este día</div>`;
  } else {
    html += evsDelDia.map(e => {
      const nc = e._cita_confirmada
        ? { color: '#1a7a4a', bg: '#e8f5ee', label: '✅ Cita confirmada' }
        : (FAM_NIVEL_CFG[e.nivel] || FAM_NIVEL_CFG.todos);
      return `
        <div class="fam-ag-item" onclick="famVerEvento('${e.id}')">
          <div class="fam-ag-item-hora">${e.hora ? e.hora.slice(0,5) : '—'}</div>
          <div class="fam-ag-item-barra" style="background:${nc.color}"></div>
          <div class="fam-ag-item-info">
            <div class="fam-ag-item-titulo">${e.nombre}</div>
            <div class="fam-ag-item-meta">${nc.label}${e.lugar ? ' · 📍 '+e.lugar : ''}</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-text-faint);flex-shrink:0">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>`;
    }).join('');
  }

  el.innerHTML = html;
  document.getElementById('fam-ag-detalle').innerHTML = '';
  _famAgEvAbierto = null;
}

// ─── DETALLE DE EVENTO ────────────────────────────────────────────
async function famVerEvento(id) {
  const detEl = document.getElementById('fam-ag-detalle');
  if (!detEl) return;

  if (_famAgEvAbierto === id) {
    detEl.innerHTML = '';
    _famAgEvAbierto = null;
    return;
  }
  _famAgEvAbierto = id;

  let e = _famAgEvs.find(ev => ev.id === id);
  if (!e) {
    const { data } = await sb.from('eventos_institucionales').select('*').eq('id', id).single();
    e = data;
  }
  if (!e) return;

  const esCitaConfirmada = !!e._cita_confirmada;
  const nc = esCitaConfirmada
    ? { color: '#1a7a4a', bg: '#e8f5ee', label: '✅ Cita confirmada' }
    : (FAM_NIVEL_CFG[e.nivel] || FAM_NIVEL_CFG.todos);

  // Hora con rango si hay hora_fin
  const horaTxt = e.hora
    ? `${e.hora.slice(0,5)}${e.hora_fin ? ' — '+e.hora_fin.slice(0,5) : ''}`
    : '';

  let rsvpHtml = '';
  if (esCitaConfirmada) {
    // Cita individual confirmada: solo mostrar estado, sin botones RSVP
    rsvpHtml = `
      <div style="margin-top:14px;padding:10px 12px;background:#e8f5ee;border-radius:8px;font-size:13px;color:#1a7a4a;font-weight:600">
        ✅ Cita confirmada — te esperamos
      </div>`;
  } else {
    // Evento colectivo: RSVP normal
    let miRsvp = null;
    try {
      const { data: rsvpData } = await sb
        .from('evento_respuestas')
        .select('respuesta')
        .eq('evento_id', id)
        .eq('usuario_id', USUARIO_FAMILIAR.id)
        .maybeSingle();
      miRsvp = rsvpData?.respuesta || null;
    } catch(_) {}

    rsvpHtml = `
      <div style="margin-top:14px;padding-top:12px;border-top:1.5px solid var(--color-border,rgba(0,0,0,0.07))">
        <div style="font-size:11px;font-weight:600;color:var(--color-text-medium);margin-bottom:8px">¿Asistís?</div>
        <div style="display:flex;gap:8px">
          <button id="rsvp-asistire-${id}" onclick="_famRsvpEvento('${id}','asistire')"
            style="flex:1;padding:9px;border-radius:8px;border:1.5px solid ${miRsvp==='asistire'?'var(--color-green)':'rgba(0,0,0,0.12)'};
              background:${miRsvp==='asistire'?'#e8f5ee':'var(--color-white)'};
              color:${miRsvp==='asistire'?'var(--color-green)':'var(--color-text-medium)'};
              font-size:13px;font-weight:600;cursor:pointer;transition:all .15s">
            ✓ Asistiré
          </button>
          <button id="rsvp-no-${id}" onclick="_famRsvpEvento('${id}','no_asistire')"
            style="flex:1;padding:9px;border-radius:8px;border:1.5px solid ${miRsvp==='no_asistire'?'#d63b2f':'rgba(0,0,0,0.12)'};
              background:${miRsvp==='no_asistire'?'#fdf0ee':'var(--color-white)'};
              color:${miRsvp==='no_asistire'?'#d63b2f':'var(--color-text-medium)'};
              font-size:13px;font-weight:600;cursor:pointer;transition:all .15s">
            ✕ No asistiré
          </button>
        </div>
      </div>`;
  }

  detEl.innerHTML = `
    <div class="fam-ag-detalle-card" style="border-left:4px solid ${nc.color}">
      <div class="fam-ag-det-head">
        <div style="flex:1">
          <div class="fam-ag-det-nombre">${e.nombre}</div>
          <span class="fam-ag-det-nivel" style="background:${nc.bg};color:${nc.color}">${nc.label}</span>
        </div>
        <button onclick="document.getElementById('fam-ag-detalle').innerHTML='';_famAgEvAbierto=null;"
                class="fam-ag-det-close">✕</button>
      </div>
      <div class="fam-ag-det-grid">
        <div class="fam-ag-det-item">
          <div class="fam-ag-det-lb">Fecha</div>
          <div>${_famFmtLatam(e.fecha_inicio)}${e.fecha_fin && e.fecha_fin !== e.fecha_inicio ? ' → '+_famFmtLatam(e.fecha_fin) : ''}${horaTxt ? ' · '+horaTxt : ''}</div>
        </div>
        ${e.lugar ? `<div class="fam-ag-det-item"><div class="fam-ag-det-lb">Lugar</div><div>📍 ${e.lugar}</div></div>` : ''}
      </div>
      ${e.descripcion ? `<div class="fam-ag-det-desc">${e.descripcion}</div>` : ''}
      ${rsvpHtml}
    </div>`;
}

// ─── NAVEGACIÓN ───────────────────────────────────────────────────
function famCambiarMes(dir) {
  FAM_AGENDA_MES += dir;
  if (FAM_AGENDA_MES < 0)  { FAM_AGENDA_MES = 11; FAM_AGENDA_ANIO--; }
  if (FAM_AGENDA_MES > 11) { FAM_AGENDA_MES = 0;  FAM_AGENDA_ANIO++; }
  rAgenda();
}

function famIrHoy() {
  const hoy = new Date();
  FAM_AGENDA_MES  = hoy.getMonth();
  FAM_AGENDA_ANIO = hoy.getFullYear();
  FAM_AGENDA_DIA  = _famHoyISO();
  rAgenda();
}

// ─── RSVP EVENTO COLECTIVO ────────────────────────────────────────
async function _famRsvpEvento(eventoId, respuesta) {
  const btnA  = document.getElementById(`rsvp-asistire-${eventoId}`);
  const btnN  = document.getElementById(`rsvp-no-${eventoId}`);
  if (btnA) btnA.disabled = true;
  if (btnN) btnN.disabled = true;
  try {
    await sb.from('evento_respuestas').upsert(
      [{ evento_id: eventoId, usuario_id: USUARIO_FAMILIAR.id, respuesta }],
      { onConflict: 'evento_id,usuario_id' }
    );
    // Actualizar estilos sin re-fetch
    const esA = respuesta === 'asistire';
    if (btnA) {
      btnA.style.border    = `1.5px solid ${esA?'var(--color-green)':'rgba(0,0,0,0.12)'}`;
      btnA.style.background = esA ? '#e8f5ee' : 'var(--color-white)';
      btnA.style.color      = esA ? 'var(--color-green)' : 'var(--color-text-medium)';
    }
    if (btnN) {
      btnN.style.border    = `1.5px solid ${!esA?'#d63b2f':'rgba(0,0,0,0.12)'}`;
      btnN.style.background = !esA ? '#fdf0ee' : 'var(--color-white)';
      btnN.style.color      = !esA ? '#d63b2f' : 'var(--color-text-medium)';
    }
  } catch(_) {
    alert('No se pudo guardar tu respuesta. Intentá de nuevo.');
  }
  if (btnA) btnA.disabled = false;
  if (btnN) btnN.disabled = false;
}

// ─── ESTILOS ──────────────────────────────────────────────────────
function _famAgEstilos() {
  if (document.getElementById('fam-agenda-styles')) return;
  const st = document.createElement('style');
  st.id = 'fam-agenda-styles';
  st.textContent = `
    .fam-ag-wrap {
      padding: 14px 14px 60px;
      max-width: 960px;
      margin: 0 auto;
    }
    @media (min-width: 768px) {
      .fam-ag-wrap { padding: 20px 28px 60px; }
    }

    .fam-ag-header {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 10px; margin-bottom: 16px;
    }
    .fam-ag-title  { display: flex; flex-direction: column; gap: 5px; }
    .fam-ag-title h2 { font-size: 20px; font-weight: 700; color: var(--color-dark); margin: 0; }
    .fam-ag-nivel-badge {
      display: inline-block; font-size: 11px; font-weight: 600;
      padding: 3px 12px; border-radius: 20px; width: fit-content;
    }
    .fam-ag-nav { display: flex; gap: 6px; align-items: center; }
    .fam-ag-nav-btn {
      height: 34px; padding: 0 12px;
      border-radius: var(--radius-sm);
      border: 1.5px solid var(--color-text-faint);
      background: var(--color-white);
      color: var(--color-text-medium);
      font-size: 13px; font-weight: 500; cursor: pointer;
      transition: border-color .15s, color .15s;
    }
    .fam-ag-nav-btn:hover { border-color: var(--color-green); color: var(--color-green); }

    /* Calendario */
    .fam-ag-cal {
      background: var(--color-white);
      border-radius: var(--radius-card);
      border: 1.5px solid rgba(0,0,0,.07);
      overflow: hidden; margin-bottom: 20px;
    }
    .fam-cal-head {
      display: grid; grid-template-columns: repeat(7,1fr);
      background: var(--color-surface-2);
      border-bottom: 1.5px solid rgba(0,0,0,.06);
    }
    .fam-cal-th {
      padding: 8px 4px; text-align: center;
      font-size: 10px; font-weight: 700;
      color: var(--color-text-muted);
      text-transform: uppercase; letter-spacing: .04em;
    }
    .fam-cal-body { display: grid; grid-template-columns: repeat(7,1fr); }
    .fam-cal-cell {
      min-height: 90px; padding: 5px 4px 4px;
      border-right: 1px solid rgba(0,0,0,.05);
      border-bottom: 1px solid rgba(0,0,0,.05);
      cursor: pointer; position: relative;
      transition: background .12s;
    }
    .fam-cal-cell:hover:not(.empty) { background: var(--color-surface-2); }
    .fam-cal-cell.empty { background: var(--color-surface-2); opacity: .45; cursor: default; }
    .fam-cal-cell.hoy  { background: #f0f9f4; }
    body.dark .fam-cal-cell.hoy { background: #0d2015; }
    .fam-cal-cell.sel  { background: #e6f4ed; outline: 2px solid var(--color-green); outline-offset: -2px; }
    body.dark .fam-cal-cell.sel { background: rgba(34,153,87,.13); }

    .fam-cal-num {
      font-size: 12px; font-weight: 600; color: var(--color-dark);
      width: 22px; height: 22px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%; margin-bottom: 3px;
    }
    .fam-cal-num.hoy { background: var(--color-green); color: #fff; }

    .fam-cal-chip {
      font-size: 9px; font-weight: 600; line-height: 1.4;
      padding: 2px 4px; border-radius: 3px; border: 1px solid;
      margin-bottom: 2px; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis;
    }
    .fam-cal-chip-fer { background: #fff8e1; color: #b8740a; border-color: #f9a82560; }
    .fam-cal-mas { font-size: 9px; color: var(--color-text-muted); padding: 1px 2px; }

    /* Dots para mobile */
    .fam-cal-dots { display: none; gap: 3px; margin-top: 4px; flex-wrap: wrap; }
    .fam-cal-dot  { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }

    @media (max-width: 600px) {
      .fam-cal-cell  { min-height: 58px; padding: 4px 3px 3px; }
      .fam-cal-num   { font-size: 11px; width: 20px; height: 20px; }
      .fam-cal-chip,
      .fam-cal-mas   { display: none; }
      .fam-cal-dots  { display: flex; }
    }

    /* Título del día */
    .fam-ag-dia-titulo {
      font-size: 13px; font-weight: 600;
      color: var(--color-text-medium); text-transform: capitalize;
      padding-bottom: 10px;
      border-bottom: 1.5px solid rgba(0,0,0,.06);
      margin-bottom: 10px;
    }

    /* Items de evento */
    .fam-ag-item {
      display: grid;
      grid-template-columns: 42px 4px 1fr 20px;
      gap: 0 10px; align-items: center;
      padding: 12px 14px; margin-bottom: 7px;
      background: var(--color-white);
      border-radius: var(--radius-md);
      border: 1.5px solid rgba(0,0,0,.06);
      cursor: pointer; transition: background .1s;
    }
    .fam-ag-item:hover:not(.fam-ag-feriado) { background: var(--color-surface-2); }
    .fam-ag-feriado { cursor: default; }
    .fam-ag-item-hora {
      font-family: 'DM Mono', monospace;
      font-size: 11px; font-weight: 500;
      color: var(--color-text-muted); text-align: right;
    }
    .fam-ag-item-barra { border-radius: 2px; align-self: stretch; min-height: 32px; }
    .fam-ag-item-info  { display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
    .fam-ag-item-titulo {
      font-size: 13px; font-weight: 600; color: var(--color-dark); line-height: 1.3;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .fam-ag-item-meta  { font-size: 11px; color: var(--color-text-muted); }

    .fam-ag-empty {
      text-align: center; padding: 28px 0;
      color: var(--color-text-muted); font-size: 13px;
    }

    /* Detalle */
    .fam-ag-detalle-card {
      background: var(--color-white);
      border-radius: var(--radius-md);
      border: 1.5px solid rgba(0,0,0,.06);
      padding: 16px; margin-top: 4px;
    }
    .fam-ag-det-head {
      display: flex; justify-content: space-between;
      align-items: flex-start; gap: 8px; margin-bottom: 12px;
    }
    .fam-ag-det-nombre { font-size: 15px; font-weight: 700; color: var(--color-dark); margin-bottom: 5px; }
    .fam-ag-det-nivel  {
      display: inline-block; font-size: 10px; font-weight: 600;
      padding: 2px 10px; border-radius: 20px;
    }
    .fam-ag-det-close  { font-size: 18px; color: var(--color-text-muted); padding: 0 4px; line-height: 1; }
    .fam-ag-det-grid   { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    @media (max-width: 480px) { .fam-ag-det-grid { grid-template-columns: 1fr; } }
    .fam-ag-det-item   { display: flex; flex-direction: column; gap: 3px; }
    .fam-ag-det-lb     {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .05em; color: var(--color-text-muted);
    }
    .fam-ag-det-item > div:last-child { font-size: 13px; color: var(--color-dark); }
    .fam-ag-det-desc   {
      font-size: 13px; color: var(--color-text-medium); line-height: 1.6;
      border-top: 1px solid rgba(0,0,0,.06); padding-top: 12px;
    }

    /* Dark mode */
    body.dark .fam-ag-cal,
    body.dark .fam-ag-item,
    body.dark .fam-ag-detalle-card { background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.08); }
    body.dark .fam-ag-nav-btn  { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.1); }
    body.dark .fam-cal-head    { background: rgba(255,255,255,.03); }
  `;
  document.head.appendChild(st);
}
