// =====================================================
// AUTH.JS — Login y sesión real con Supabase
// =====================================================

let USUARIO_ACTUAL    = null;  // datos del usuario logueado
let INSTITUCION_ACTUAL = null; // datos de su institución

// ── LOGIN ────────────────────────────────────────────
async function login() {
  const username = document.getElementById('inp-email').value.trim();
  const pass     = document.getElementById('inp-pass').value;
  const btn      = document.getElementById('btn-login');

  if (!username || !pass) {
    mostrarErrorLogin('Completá usuario y contraseña.');
    return;
  }

  btn.disabled = true;
  document.getElementById('btn-login-text').textContent = 'Ingresando...';
  ocultarErrorLogin();

  try {
    // 1. Resolver email: si tiene @ es email directo, sino buscar por username
    // Usamos RPC para bypassear RLS (el login corre sin sesión activa)
    let emailParaAuth = username;
    if (!username.includes('@')) {
      const { data: emailEncontrado, error: errUser } = await sb
        .rpc('get_email_by_username', { p_username: username });

      if (errUser || !emailEncontrado) {
        mostrarErrorLogin('Usuario o contraseña incorrectos.');
        resetBtn();
        return;
      }
      emailParaAuth = emailEncontrado;
    }

    // 2. Autenticar con Supabase Auth
    const { data, error } = await sb.auth.signInWithPassword({ email: emailParaAuth, password: pass });

    if (error) {
      mostrarErrorLogin('Email o contraseña incorrectos.');
      resetBtn();
      return;
    }

    // 2. Traer perfil
    const { data: perfil, error: errPerfil } = await sb
      .from('usuarios')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (errPerfil || !perfil) {
      mostrarErrorLogin('Tu usuario no está configurado. Contactá al administrador.');
      await sb.auth.signOut();
      resetBtn();
      return;
    }

    if (!perfil.activo) {
      mostrarErrorLogin('Tu cuenta está desactivada. Contactá al administrador.');
      await sb.auth.signOut();
      resetBtn();
      return;
    }

    // 3. Traer institución por separado (falla silenciosa si hay problema)
    let instData = null;
    if (perfil.institucion_id) {
      const { data: inst } = await sb
        .from('instituciones')
        .select('id, nombre, logo_url')
        .eq('id', perfil.institucion_id)
        .single();
      instData = inst;
    }

    // 4. Guardar estado global
    USUARIO_ACTUAL     = { ...data.user, ...perfil };
    INSTITUCION_ACTUAL = instData;

    // Si aún no tiene institución asignada → pantalla de configuración inicial
    if (!USUARIO_ACTUAL.institucion_id) {
      iniciarSetupInstitucional();
      return;
    }

    iniciarApp();

  } catch (e) {
    mostrarErrorLogin('Error de conexión. Verificá tu internet.');
    resetBtn();
  }
}

// ── CERRAR SESIÓN ────────────────────────────────────
async function cerrarSesion() {
  await sb.auth.signOut();
  USUARIO_ACTUAL     = null;
  INSTITUCION_ACTUAL = null;
  document.getElementById('shell').style.display       = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('inp-email').value = ''; // campo usuario
  document.getElementById('inp-pass').value  = '';
  resetBtn();
}

// ── VERIFICAR SESIÓN AL CARGAR ───────────────────────
async function verificarSesion() {
  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
    document.getElementById('login-screen').style.display = 'flex';
    return;
  }

  const { data: perfil } = await sb
    .from('usuarios')
    .select('*')
    .eq('id', session.user.id)
    .single();

  let instData = null;
  if (perfil?.institucion_id) {
    const { data: inst } = await sb
      .from('instituciones')
      .select('id, nombre, logo_url')
      .eq('id', perfil.institucion_id)
      .single();
    instData = inst;
  }

  if (perfil && perfil.activo) {
    USUARIO_ACTUAL     = { ...session.user, ...perfil };
    INSTITUCION_ACTUAL = instData;

    // Si aún no tiene institución asignada → pantalla de configuración inicial
    if (!USUARIO_ACTUAL.institucion_id) {
      iniciarSetupInstitucional();
      return;
    }

    iniciarApp();
  } else {
    await sb.auth.signOut();
    document.getElementById('login-screen').style.display = 'flex';
  }
}

// ── ESCUCHAR CAMBIOS DE SESIÓN ───────────────────────
sb.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    USUARIO_ACTUAL     = null;
    INSTITUCION_ACTUAL = null;
    document.getElementById('shell').style.display       = 'none';
    document.getElementById('login-screen').style.display = 'flex';
  }
});

// ── HELPERS ──────────────────────────────────────────
function mostrarErrorLogin(msg) {
  const el = document.getElementById('login-error');
  el.textContent   = msg;
  el.style.display = 'block';
}
function ocultarErrorLogin() {
  document.getElementById('login-error').style.display = 'none';
}
function resetBtn() {
  const btn = document.getElementById('btn-login');
  btn.disabled = false;
  document.getElementById('btn-login-text').textContent = 'Ingresar';
}