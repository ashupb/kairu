// =====================================================
// AVISOS.JS — Comunicados institucionales a familias
// =====================================================

let _AVISOS_DATA = [];

async function rAvisos() {
  const el = document.getElementById('page-avisos');
  if (!el) return;

  showLoading('avisos');

  const perms = _avisosPermisos();

  try {
    const { data, error } = await sb
      .from('comunicados')
      .select('id, titulo, cuerpo, nivel, imagen_url, created_at, usuarios(nombre_completo), comunicado_imagenes(id, imagen_url, orden)')
      .eq('institucion_id', USUARIO_ACTUAL.institucion_id)
      .eq('tipo', 'institucional')
      .order('created_at', { ascending: false })
      .limit(40);

    if (error) throw error;

    const comunicados = (data || []).map(c => ({
      ...c,
      comunicado_imagenes: (c.comunicado_imagenes || []).sort((a, b) => a.orden - b.orden),
    }));
    _AVISOS_DATA = comunicados;

    el.innerHTML = `
      <div style="max-width:860px;margin:0 auto;padding:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px">
          <h2 style="font-size:18px;font-weight:700;color:var(--txt)">Comunicados institucionales</h2>
          ${perms.crear ? `<button class="btn-p" onclick="_avisosAbrirForm()">+ Nuevo comunicado</button>` : ''}
        </div>

        <div id="av-form-wrap"></div>

        <div id="av-lista">
          ${_avisosListaHtml(comunicados, perms)}
        </div>
      </div>`;

  } catch (e) {
    el.innerHTML = `
      <div style="padding:60px;text-align:center;color:var(--txt3)">
        No se pudieron cargar los comunicados. Intentá de nuevo.
      </div>`;
  }
}

// ── Permisos ──────────────────────────────────────────
function _avisosPermisos() {
  const rol = USUARIO_ACTUAL?.rol;
  return {
    crear: ['director_general', 'directivo_nivel'].includes(rol),
  };
}

// ── Formulario nuevo comunicado ───────────────────────
function _avisosAbrirForm() {
  const wrap = document.getElementById('av-form-wrap');
  if (!wrap) return;
  if (wrap.innerHTML) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-t">Nuevo comunicado</div>

      <div style="margin-bottom:12px">
        <label style="font-size:11px;font-weight:600;color:var(--txt2);display:block;margin-bottom:5px;letter-spacing:.05em">
          NIVEL DESTINATARIO
        </label>
        <select id="av-nivel">
          <option value="">Todos los niveles de la institución</option>
          <option value="inicial">Solo Inicial</option>
          <option value="primario">Solo Primario</option>
          <option value="secundario">Solo Secundario</option>
        </select>
      </div>

      <div style="margin-bottom:12px">
        <label style="font-size:11px;font-weight:600;color:var(--txt2);display:block;margin-bottom:5px;letter-spacing:.05em">
          TÍTULO *
        </label>
        <input type="text" id="av-titulo" placeholder="Ej: Festejo del Día del Maestro" maxlength="120">
      </div>

      <div style="margin-bottom:12px">
        <label style="font-size:11px;font-weight:600;color:var(--txt2);display:block;margin-bottom:5px;letter-spacing:.05em">
          MENSAJE *
        </label>
        <textarea id="av-cuerpo" rows="4" placeholder="Escribí el mensaje para las familias..." style="resize:vertical"></textarea>
      </div>

      <div style="margin-bottom:16px">
        <label style="font-size:11px;font-weight:600;color:var(--txt2);display:block;margin-bottom:5px;letter-spacing:.05em">
          IMÁGENES (opcional — podés seleccionar varias)
        </label>
        <input type="file" id="av-imagen" accept="image/*" multiple
          onchange="_avisosPreview(this)"
          style="font-size:12px;width:100%;padding:0">
        <div id="av-preview-wrap" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"></div>
      </div>

      <div class="acc">
        <button class="btn-p" id="av-btn-pub" onclick="_avisosGuardar()">Publicar comunicado</button>
        <button class="btn-s" onclick="document.getElementById('av-form-wrap').innerHTML=''">Cancelar</button>
      </div>
    </div>`;

  document.getElementById('av-titulo')?.focus();
}

function _avisosPreview(input) {
  const wrap = document.getElementById('av-preview-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  Array.from(input.files || []).forEach(file => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:var(--rad)';
    wrap.appendChild(img);
  });
}

// ── Guardar nuevo comunicado ──────────────────────────
async function _avisosGuardar() {
  const btn    = document.getElementById('av-btn-pub');
  const titulo = document.getElementById('av-titulo')?.value.trim();
  const cuerpo = document.getElementById('av-cuerpo')?.value.trim();
  const nivel  = document.getElementById('av-nivel')?.value || null;
  const files  = Array.from(document.getElementById('av-imagen')?.files || []);

  if (!titulo || !cuerpo) {
    alert('El título y el mensaje son obligatorios.');
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Publicando…';

  try {
    const { data: inserted, error } = await sb
      .from('comunicados')
      .insert({
        institucion_id: USUARIO_ACTUAL.institucion_id,
        autor_id:       USUARIO_ACTUAL.id,
        tipo:           'institucional',
        nivel:          nivel || null,
        titulo,
        cuerpo,
        requiere_firma: false,
      })
      .select('id')
      .single();
    if (error) throw error;

    // Subir imágenes si las hay
    for (let i = 0; i < files.length; i++) {
      try {
        const blob = await _avisosComprimir(files[i]);
        const path = `${USUARIO_ACTUAL.institucion_id}/${Date.now()}_${i}.jpg`;
        const { error: storErr } = await sb.storage
          .from('comunicados')
          .upload(path, blob, { contentType: 'image/jpeg' });
        if (storErr) continue;
        const { data: urlData } = sb.storage.from('comunicados').getPublicUrl(path);
        await sb.from('comunicado_imagenes').insert({
          comunicado_id: inserted.id,
          imagen_url:    urlData.publicUrl,
          orden:         i,
        });
      } catch (_) { /* imagen individual falla sin tirar todo */ }
    }

    await rAvisos();

  } catch (e) {
    alert('No se pudo publicar el comunicado. Intentá de nuevo.');
    if (btn) { btn.disabled = false; btn.textContent = 'Publicar comunicado'; }
  }
}

// ── Compresión de imagen (Canvas API, sin dependencias) ──
async function _avisosComprimir(file, maxPx = 1200, q = 0.78) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        const r = Math.min(maxPx / width, maxPx / height);
        width  = Math.round(width  * r);
        height = Math.round(height * r);
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(resolve, 'image/jpeg', q);
    };
    img.src = url;
  });
}

// ── Lista de comunicados publicados ──────────────────
function _avisosListaHtml(lista, perms = { crear: false }) {
  if (!lista.length) return `
    <div style="text-align:center;padding:60px 20px;color:var(--txt3)">
      <div style="font-size:36px;margin-bottom:10px">📢</div>
      <div style="font-size:14px">No hay comunicados publicados aún.</div>
    </div>`;

  const NIVEL_LABEL = { inicial: 'Inicial', primario: 'Primario', secundario: 'Secundario' };

  return lista.map(c => {
    const nivelTxt   = c.nivel ? (NIVEL_LABEL[c.nivel] || c.nivel) : 'Todos los niveles';
    const nivelClass = c.nivel ? 'tp' : 'tgr';
    const fecha      = _avisosFechaLabel(c.created_at);
    const autor      = c.usuarios?.nombre_completo || '';
    const excerpt    = c.cuerpo?.length > 140
      ? c.cuerpo.slice(0, 140).trimEnd() + '…'
      : (c.cuerpo || '');

    // Imágenes: nueva tabla primero, fallback a imagen_url
    const imgs = c.comunicado_imagenes?.length
      ? c.comunicado_imagenes
      : (c.imagen_url ? [{ id: null, imagen_url: c.imagen_url }] : []);
    const thumbUrl = imgs[0]?.imagen_url || null;

    return `
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:10px" id="av-card-${c.id}">
        ${thumbUrl
          ? `<img src="${thumbUrl}" alt="" loading="lazy"
               style="width:100%;height:180px;object-fit:cover;display:block">`
          : ''}
        <div style="padding:14px 16px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
            <span class="tag ${nivelClass}">${nivelTxt}</span>
            <span style="font-size:11px;color:var(--txt3)">${fecha}</span>
            ${autor ? `<span style="font-size:11px;color:var(--txt3);margin-left:auto">${autor}</span>` : ''}
            ${imgs.length > 1 ? `<span style="font-size:11px;color:var(--txt3)">📷 ${imgs.length}</span>` : ''}
          </div>
          <div style="font-size:14px;font-weight:700;color:var(--txt);margin-bottom:5px;line-height:1.3">${c.titulo}</div>
          <div style="font-size:12px;color:var(--txt2);line-height:1.5">${excerpt}</div>
        </div>
        ${perms.crear ? `
          <div style="padding:10px 16px 12px;border-top:1px solid var(--brd);display:flex;gap:8px">
            <button class="btn-s" style="font-size:12px" onclick="_avisosEditar('${c.id}')">✎ Editar</button>
            <button class="btn-s" style="font-size:12px;color:#d63b2f;border-color:#d63b2f" onclick="_avisosEliminar('${c.id}')">✕ Eliminar</button>
          </div>
          <div id="av-edit-${c.id}"></div>
        ` : ''}
      </div>`;
  }).join('');
}

// ── Editar comunicado ────────────────────────────────
function _avisosEditar(id) {
  const wrap = document.getElementById(`av-edit-${id}`);
  if (!wrap) return;
  if (wrap.innerHTML) { wrap.innerHTML = ''; return; }

  const c = _AVISOS_DATA.find(x => x.id === id);
  if (!c) return;

  // Imágenes actuales (nueva tabla + fallback legacy)
  const imgs = c.comunicado_imagenes?.length
    ? c.comunicado_imagenes
    : (c.imagen_url ? [{ id: null, imagen_url: c.imagen_url }] : []);

  const imgsHtml = imgs.length ? `
    <div style="margin-bottom:12px">
      <label style="font-size:11px;font-weight:600;color:var(--txt2);display:block;margin-bottom:5px;letter-spacing:.05em">IMÁGENES ACTUALES</label>
      <div id="av-e-imgs-list-${id}" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px">
        ${imgs.map(img => img.id ? `
          <div id="av-img-${img.id}" style="position:relative">
            <img src="${img.imagen_url}" alt=""
              style="width:80px;height:80px;object-fit:cover;border-radius:var(--rad);display:block">
            <button onclick="_avisosEliminarImagen('${img.id}','${img.imagen_url}','${id}')"
              style="position:absolute;top:2px;right:2px;background:#d63b2f;border:none;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0">✕</button>
          </div>` : `
          <img src="${img.imagen_url}" alt=""
            style="width:80px;height:80px;object-fit:cover;border-radius:var(--rad)">
        `).join('')}
      </div>
      <label style="font-size:11px;font-weight:600;color:var(--txt2);display:block;margin-bottom:5px;letter-spacing:.05em">AGREGAR MÁS IMÁGENES</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="file" id="av-e-imgs-nuevas-${id}" accept="image/*" multiple style="font-size:12px;flex:1;padding:0">
        <button class="btn-s" id="av-e-btn-imgs-${id}" style="font-size:12px;white-space:nowrap"
          onclick="_avisosAgregarImagenes('${id}')">Agregar</button>
      </div>
    </div>` : `
    <div style="margin-bottom:12px">
      <label style="font-size:11px;font-weight:600;color:var(--txt2);display:block;margin-bottom:5px;letter-spacing:.05em">IMÁGENES</label>
      <div id="av-e-imgs-list-${id}" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px"></div>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="file" id="av-e-imgs-nuevas-${id}" accept="image/*" multiple style="font-size:12px;flex:1;padding:0">
        <button class="btn-s" id="av-e-btn-imgs-${id}" style="font-size:12px;white-space:nowrap"
          onclick="_avisosAgregarImagenes('${id}')">Agregar</button>
      </div>
    </div>`;

  wrap.innerHTML = `
    <div style="padding:0 16px 16px;border-top:1px solid var(--brd)">
      <div style="padding-top:12px;margin-bottom:10px">
        <label style="font-size:11px;font-weight:600;color:var(--txt2);display:block;margin-bottom:5px;letter-spacing:.05em">NIVEL DESTINATARIO</label>
        <select id="av-e-nivel-${id}">
          <option value="">Todos los niveles de la institución</option>
          <option value="inicial">Solo Inicial</option>
          <option value="primario">Solo Primario</option>
          <option value="secundario">Solo Secundario</option>
        </select>
      </div>
      <div style="margin-bottom:10px">
        <label style="font-size:11px;font-weight:600;color:var(--txt2);display:block;margin-bottom:5px;letter-spacing:.05em">TÍTULO *</label>
        <input type="text" id="av-e-titulo-${id}" maxlength="120">
      </div>
      <div style="margin-bottom:14px">
        <label style="font-size:11px;font-weight:600;color:var(--txt2);display:block;margin-bottom:5px;letter-spacing:.05em">MENSAJE *</label>
        <textarea id="av-e-cuerpo-${id}" rows="4" style="resize:vertical"></textarea>
      </div>
      ${imgsHtml}
      <div class="acc">
        <button class="btn-p" id="av-e-btn-${id}" onclick="_avisosGuardarEdicion('${id}')">Guardar cambios</button>
        <button class="btn-s" onclick="document.getElementById('av-edit-${id}').innerHTML=''">Cancelar</button>
      </div>
    </div>`;

  const nivelSel = document.getElementById(`av-e-nivel-${id}`);
  const tituloIn = document.getElementById(`av-e-titulo-${id}`);
  const cuerpoIn = document.getElementById(`av-e-cuerpo-${id}`);
  if (nivelSel) nivelSel.value = c.nivel || '';
  if (tituloIn) { tituloIn.value = c.titulo; tituloIn.focus(); }
  if (cuerpoIn) cuerpoIn.value = c.cuerpo || '';
}

async function _avisosGuardarEdicion(id) {
  const titulo = document.getElementById(`av-e-titulo-${id}`)?.value.trim();
  const cuerpo = document.getElementById(`av-e-cuerpo-${id}`)?.value.trim();
  const nivel  = document.getElementById(`av-e-nivel-${id}`)?.value || null;
  const btn    = document.getElementById(`av-e-btn-${id}`);

  if (!titulo || !cuerpo) { alert('El título y el mensaje son obligatorios.'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  try {
    const { error } = await sb
      .from('comunicados')
      .update({ titulo, cuerpo, nivel: nivel || null })
      .eq('id', id);
    if (error) throw error;
    await rAvisos();
  } catch (e) {
    alert('No se pudo guardar. Intentá de nuevo.');
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar cambios'; }
  }
}

// ── Agregar imágenes desde el form de edición ────────
async function _avisosAgregarImagenes(comunicadoId) {
  const input = document.getElementById(`av-e-imgs-nuevas-${comunicadoId}`);
  const btn   = document.getElementById(`av-e-btn-imgs-${comunicadoId}`);
  if (!input?.files?.length) return;

  if (btn) { btn.disabled = true; btn.textContent = 'Subiendo…'; }

  const c        = _AVISOS_DATA.find(x => x.id === comunicadoId);
  const baseOrden = c?.comunicado_imagenes?.length || 0;
  const container = document.getElementById(`av-e-imgs-list-${comunicadoId}`);

  for (let i = 0; i < input.files.length; i++) {
    try {
      const blob = await _avisosComprimir(input.files[i]);
      const path = `${USUARIO_ACTUAL.institucion_id}/${Date.now()}_${i}.jpg`;
      const { error: storErr } = await sb.storage
        .from('comunicados')
        .upload(path, blob, { contentType: 'image/jpeg' });
      if (storErr) continue;
      const { data: urlData } = sb.storage.from('comunicados').getPublicUrl(path);
      const imagenUrl = urlData.publicUrl;

      const { data: ins } = await sb
        .from('comunicado_imagenes')
        .insert({ comunicado_id: comunicadoId, imagen_url: imagenUrl, orden: baseOrden + i })
        .select('id')
        .single();

      if (ins && c) {
        c.comunicado_imagenes = c.comunicado_imagenes || [];
        c.comunicado_imagenes.push({ id: ins.id, imagen_url: imagenUrl, orden: baseOrden + i });
      }

      if (container && ins) {
        const div = document.createElement('div');
        div.id = `av-img-${ins.id}`;
        div.style.position = 'relative';
        div.innerHTML = `
          <img src="${imagenUrl}" alt=""
            style="width:80px;height:80px;object-fit:cover;border-radius:var(--rad);display:block">
          <button onclick="_avisosEliminarImagen('${ins.id}','${imagenUrl}','${comunicadoId}')"
            style="position:absolute;top:2px;right:2px;background:#d63b2f;border:none;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0">✕</button>`;
        container.appendChild(div);
      }
    } catch (_) { /* imagen individual falla sin tirar todo */ }
  }

  input.value = '';
  if (btn) { btn.disabled = false; btn.textContent = 'Agregar'; }
}

// ── Eliminar una imagen individual (desde edición) ───
async function _avisosEliminarImagen(imagenId, imagenUrl, comunicadoId) {
  const { error } = await sb.from('comunicado_imagenes').delete().eq('id', imagenId);
  if (error) { alert('No se pudo eliminar la imagen.'); return; }

  const match = imagenUrl.match(/\/comunicados\/(.+)$/);
  if (match) await sb.storage.from('comunicados').remove([match[1]]).catch(() => {});

  document.getElementById(`av-img-${imagenId}`)?.remove();

  const c = _AVISOS_DATA.find(x => x.id === comunicadoId);
  if (c) c.comunicado_imagenes = c.comunicado_imagenes.filter(i => i.id !== imagenId);
}

// ── Eliminar comunicado completo ─────────────────────
async function _avisosEliminar(id) {
  if (!confirm('¿Eliminar este comunicado? Esta acción no se puede deshacer.')) return;

  const c = _AVISOS_DATA.find(x => x.id === id);

  try {
    const { error } = await sb.from('comunicados').delete().eq('id', id);
    if (error) throw error;

    // Eliminar imágenes de Storage (la tabla se borra por CASCADE)
    const paths = [];
    (c?.comunicado_imagenes || []).forEach(img => {
      const m = img.imagen_url.match(/\/comunicados\/(.+)$/);
      if (m) paths.push(m[1]);
    });
    if (c?.imagen_url) {
      const m = c.imagen_url.match(/\/comunicados\/(.+)$/);
      if (m) paths.push(m[1]);
    }
    if (paths.length) await sb.storage.from('comunicados').remove(paths).catch(() => {});

    await rAvisos();
  } catch (e) {
    alert('No se pudo eliminar. Intentá de nuevo.');
  }
}

function _avisosFechaLabel(isoStr) {
  if (!isoStr) return '';
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7)  return `Hace ${diff} días`;
  const d = new Date(isoStr);
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
}
