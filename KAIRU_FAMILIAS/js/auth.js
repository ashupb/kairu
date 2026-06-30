// ── Estado global de sesión ────────────────────────────────────────
let USUARIO_FAMILIAR  = null;   // perfil completo del familiar logueado
let ALUMNO_ACTUAL     = null;   // alumno seleccionado actualmente
let INSTITUCION_ACTUAL = null;  // datos de la institución

// ── Arranque ──────────────────────────────────────────────────────
window.addEventListener('load', verificarSesion);

async function verificarSesion() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await cargarPerfilFamilia(session.user);
  } else {
    goPage('login');
  }
}

// ── Cargar perfil luego de autenticación ──────────────────────────
async function cargarPerfilFamilia(user) {
  try {
    const { data: perfil, error } = await sb
      .from('usuarios')
      .select('*, instituciones(nombre, portal_familias_activo, telefono, email_institucional, direccion)')
      .eq('id', user.id)
      .single();

    if (error || !perfil) throw new Error('perfil_no_encontrado');

    if (perfil.rol !== 'familia') {
      await sb.auth.signOut();
      mostrarErrorLogin('Esta cuenta no tiene acceso al portal de familias.');
      return;
    }

    if (!perfil.instituciones?.portal_familias_activo) {
      await sb.auth.signOut();
      mostrarErrorLogin('Este servicio no está disponible para tu institución.');
      return;
    }

    const { data: vinculos } = await sb
      .from('familia_alumno')
      .select('alumno_id')
      .eq('usuario_id', perfil.id);

    let alumnos = [];
    if (vinculos && vinculos.length > 0) {
      const alumnoIds = vinculos.map(v => v.alumno_id).filter(Boolean);
      const { data: alumnosData } = await sb
        .from('alumnos')
        .select('id, nombre, apellido, dni, curso_id, activo, cursos(id, nombre, division, nivel, preceptor_id, preceptor:preceptor_id(nombre_completo))')
        .in('id', alumnoIds);
      alumnos = (alumnosData || []).map(a => ({
        ...a,
        nombre_completo: `${a.nombre} ${a.apellido}`.trim(),
      }));
    }

    USUARIO_FAMILIAR   = { ...perfil, alumnos };
    ALUMNO_ACTUAL      = alumnos[0] || null;
    INSTITUCION_ACTUAL = perfil.instituciones;

    iniciarApp();

  } catch (e) {
    await sb.auth.signOut();
    mostrarErrorLogin('Ocurrió un error al iniciar sesión. Intentá de nuevo.');
  }
}

// ── Login ─────────────────────────────────────────────────────────
async function handleLoginSubmit(e) {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-btn');

  btn.disabled    = true;
  btn.textContent = 'Ingresando...';
  ocultarErrorLogin();

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    mostrarErrorLogin('Email o contraseña incorrectos.');
    btn.disabled    = false;
    btn.textContent = 'Ingresar';
    return;
  }

  await cargarPerfilFamilia(data.user);
  btn.disabled    = false;
  btn.textContent = 'Ingresar';
}

// ── Logout ────────────────────────────────────────────────────────
async function logout() {
  await sb.auth.signOut();
  USUARIO_FAMILIAR   = null;
  ALUMNO_ACTUAL      = null;
  INSTITUCION_ACTUAL = null;
  goPage('login');
}

// ── Toggle visibilidad contraseña ─────────────────────────────────
function togglePassFamilias() {
  const inp = document.getElementById('login-password');
  const eyeOpen   = document.getElementById('fam-ojo-abierto');
  const eyeClosed = document.getElementById('fam-ojo-cerrado');
  if (inp.type === 'password') {
    inp.type = 'text';
    eyeOpen.style.display   = '';
    eyeClosed.style.display = 'none';
  } else {
    inp.type = 'password';
    eyeOpen.style.display   = 'none';
    eyeClosed.style.display = '';
  }
}

// ── Helpers de error en login ─────────────────────────────────────
function mostrarErrorLogin(msg) {
  const el = document.getElementById('login-error');
  if (!el) return;
  el.textContent  = msg;
  el.style.display = 'block';
}

function ocultarErrorLogin() {
  const el = document.getElementById('login-error');
  if (el) el.style.display = 'none';
}
