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

    if (perfil.rol === 'familia') {
      mostrarErrorLogin('Esta cuenta solo tiene acceso al portal de familias.');
      await sb.auth.signOut();
      resetBtn();
      return;
    }

    if (perfil.en_licencia) {
      mostrarErrorLogin('Usuario con licencia. Contactá con la institución para habilitar este usuario.');
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
        .select('id, nombre, logo_url, nivel_inicial, nivel_primario, nivel_secundario, anio_lectivo')
        .eq('id', perfil.institucion_id)
        .single();
      instData = inst;
    }

    // 4. Guardar estado global
    USUARIO_ACTUAL     = { ...data.user, ...perfil };
    INSTITUCION_ACTUAL = instData;
    if (['secretario','vicedirector'].includes(USUARIO_ACTUAL.rol)) {
      USUARIO_ACTUAL.rol_display = USUARIO_ACTUAL.rol;
      USUARIO_ACTUAL.rol = 'directivo_nivel';
    }

    // Creado con contraseña temporal → obligar a definir una propia antes de entrar.
    // El gate se basa en user_metadata (no en la columna usuarios) porque el
    // propio usuario puede limpiarlo vía updateUser sin depender de RLS — ver
    // guardarNuevaContrasena(). La columna queda como respaldo/visibilidad.
    if (_debeCambiarPassword(data.user, perfil)) {
      resetBtn();
      mostrarSetPassword('primer_ingreso');
      return;
    }

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
      .select('id, nombre, logo_url, nivel_inicial, nivel_primario, nivel_secundario, anio_lectivo')
      .eq('id', perfil.institucion_id)
      .single();
    instData = inst;
  }

  if (perfil && perfil.rol === 'familia') {
    await sb.auth.signOut();
    document.getElementById('login-screen').style.display = 'flex';
    mostrarErrorLogin('Esta cuenta solo tiene acceso al portal de familias.');
    return;
  }

  if (perfil && perfil.en_licencia) {
    await sb.auth.signOut();
    document.getElementById('login-screen').style.display = 'flex';
    mostrarErrorLogin('Usuario con licencia. Contactá con la institución para habilitar este usuario.');
    return;
  }

  if (perfil && perfil.activo) {
    USUARIO_ACTUAL     = { ...session.user, ...perfil };
    INSTITUCION_ACTUAL = instData;
    if (['secretario','vicedirector'].includes(USUARIO_ACTUAL.rol)) {
      USUARIO_ACTUAL.rol_display = USUARIO_ACTUAL.rol;
      USUARIO_ACTUAL.rol = 'directivo_nivel';
    }

    // Creado con contraseña temporal → obligar a definir una propia antes de entrar.
    if (_debeCambiarPassword(session.user, perfil)) {
      mostrarSetPassword('primer_ingreso');
      return;
    }

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

// ── SET-PASSWORD ─────────────────────────────────────
// Pantalla "Definí tu contraseña": se usa en tres contextos —
//   'invite'          → link de invitación por email (usuario nuevo)
//   'recovery'        → link de "¿olvidaste tu contraseña?"
//   'primer_ingreso'  → usuario creado con contraseña temporal (debe_cambiar_password)
// En los tres casos ya hay una sesión válida (del link o del login), así que
// alcanza con sb.auth.updateUser({ password }).
let _setpassContexto = null;

// Fuente de verdad del "debe cambiar contraseña": user_metadata (la columna
// usuarios.debe_cambiar_password es respaldo). El metadata se limpia con
// updateUser sin depender de RLS, evitando que el usuario quede atrapado.
function _debeCambiarPassword(authUser, perfil) {
  if (authUser?.user_metadata?.debe_cambiar_password === true) return true;
  // Respaldo: sólo si el metadata no dice explícitamente false (para no
  // re-gatear a un usuario que ya limpió el metadata pero cuya columna no se
  // pudo actualizar por RLS).
  if (authUser?.user_metadata?.debe_cambiar_password === false) return false;
  return perfil?.debe_cambiar_password === true;
}

function mostrarSetPassword(tipo) {
  _setpassContexto = tipo;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('shell').style.display        = 'none';
  const scr = document.getElementById('setpass-screen');
  if (scr) scr.style.display = 'flex';

  const title = document.getElementById('setpass-title');
  const sub   = document.getElementById('setpass-sub');
  if (tipo === 'recovery') {
    if (title) title.textContent = 'Restablecé tu contraseña';
    if (sub)   sub.textContent   = 'Ingresá una nueva contraseña para tu cuenta.';
  } else if (tipo === 'primer_ingreso') {
    if (title) title.textContent = 'Cambiá tu contraseña';
    if (sub)   sub.textContent   = 'Tu cuenta usa una contraseña temporal. Por seguridad, definí una propia para continuar.';
  } else {
    if (title) title.textContent = 'Definí tu contraseña';
    if (sub)   sub.textContent   = 'Creá una contraseña para activar tu cuenta.';
  }
}

function _setpassError(msg) {
  const el = document.getElementById('setpass-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function _resetSetpassBtn() {
  const btn = document.getElementById('btn-setpass');
  if (btn) btn.disabled = false;
  const t = document.getElementById('btn-setpass-text');
  if (t) t.textContent = 'Guardar contraseña';
}

async function guardarNuevaContrasena() {
  const p1 = document.getElementById('setpass-1')?.value || '';
  const p2 = document.getElementById('setpass-2')?.value || '';
  const el = document.getElementById('setpass-error');
  if (el) el.style.display = 'none';

  if (p1.length < 6) { _setpassError('La contraseña debe tener al menos 6 caracteres.'); return; }
  if (p1 !== p2)     { _setpassError('Las contraseñas no coinciden.'); return; }

  const btn = document.getElementById('btn-setpass');
  const t   = document.getElementById('btn-setpass-text');
  if (btn) btn.disabled = true;
  if (t) t.textContent = 'Guardando...';

  try {
    // Debe existir sesión: viene del link (invite/recovery, que supabase-js
    // detecta en el hash) o del login (primer ingreso con contraseña temporal).
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      _setpassError('El enlace expiró o no es válido. Volvé a pedir uno desde "¿Olvidaste tu contraseña?".');
      _resetSetpassBtn();
      return;
    }

    // Limpiar la marca de contraseña temporal en el metadata (confiable, no
    // depende de RLS) en la misma llamada que actualiza la contraseña.
    const { error } = await sb.auth.updateUser({ password: p1, data: { debe_cambiar_password: false } });
    if (error) { _setpassError(error.message || 'No se pudo guardar la contraseña.'); _resetSetpassBtn(); return; }

    // Respaldo best-effort en la columna (si RLS lo permite; si no, no importa
    // porque el gate ya se basa en el metadata ya limpiado arriba).
    try { await sb.from('usuarios').update({ debe_cambiar_password: false }).eq('id', session.user.id); } catch (_) {}

    // Limpiar el token del hash del link y arrancar la app normalmente.
    if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
    if (typeof window !== 'undefined') window.__authLinkType = null;

    const scr = document.getElementById('setpass-screen');
    if (scr) scr.style.display = 'none';
    document.getElementById('setpass-1').value = '';
    document.getElementById('setpass-2').value = '';
    _resetSetpassBtn();

    await verificarSesion();
  } catch (e) {
    _setpassError('Error de conexión. Intentá de nuevo.');
    _resetSetpassBtn();
  }
}

// ── OLVIDÉ MI CONTRASEÑA ─────────────────────────────
async function olvideContrasena() {
  const prefill = document.getElementById('inp-email')?.value?.trim() || '';
  const email = prompt(
    'Ingresá tu email y te enviaremos un enlace para restablecer la contraseña:',
    prefill.includes('@') ? prefill : ''
  );
  if (email === null) return;                 // canceló
  const mail = email.trim();
  if (!mail.includes('@')) { alert('Ingresá un email válido.'); return; }

  try {
    const { error } = await sb.auth.resetPasswordForEmail(mail, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) throw error;
    alert('Si el email está registrado, vas a recibir un enlace para restablecer tu contraseña.\n\n(Requiere el SMTP configurado en Supabase.)');
  } catch (e) {
    alert('No se pudo enviar el email: ' + (e.message || 'error desconocido'));
  }
}