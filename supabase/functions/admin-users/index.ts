import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!SERVICE_KEY) throw new Error("Service key no configurada");

    const { action, payload } = await req.json();

    // ── Verificar JWT del usuario ──────────────────────
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { "Authorization": `Bearer ${jwt}`, "apikey": SERVICE_KEY },
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userData = await userRes.json();
    if (!userData.id) {
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const perfilRes = await fetch(
      `${SUPABASE_URL}/rest/v1/usuarios?id=eq.${userData.id}&select=rol,institucion_id`,
      { headers: { "Authorization": `Bearer ${jwt}`, "apikey": SERVICE_KEY } }
    );
    const perfilArr = await perfilRes.json();
    const perfil = Array.isArray(perfilArr) ? perfilArr[0] : null;

    const ADMIN_ROLES   = ["super_admin", "director_general", "directivo_nivel", "secretario", "vicedirector"];
    const FAMILIA_ROLES = [...ADMIN_ROLES, "preceptor"];
    const FAMILIA_ACTIONS = ["crear_usuario_familia", "actualizar_usuario_familia", "dar_acceso_portal"];

    const rolesPermitidos = FAMILIA_ACTIONS.includes(action) ? FAMILIA_ROLES : ADMIN_ROLES;
    if (!perfil || !rolesPermitidos.includes(perfil.rol)) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // El administrador de plataforma no pertenece a ninguna institución
    // (institucion_id NULL): queda exento de los chequeos de "misma
    // institución", que si no fallarían siempre para él.
    const esSuper = perfil.rol === "super_admin";
    // Institución sobre la que opera: la propia, o la que manda el super_admin
    // (la activa que eligió en el selector de la topbar).
    const instOperativa = esSuper ? (payload.institucion_id ?? null) : perfil.institucion_id;

    // ── Acción: crear usuario ──────────────────────────
    if (action === "crear_usuario") {
      if (!esSuper && payload.institucion_id !== perfil.institucion_id) {
        return new Response(JSON.stringify({ error: "Institución inválida" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "apikey": SERVICE_KEY,
        },
        body: JSON.stringify({
          email: payload.email,
          password: payload.password,
          email_confirm: true,
          user_metadata: payload.user_metadata,
        }),
      });
      const authData = await createRes.json();
      if (!createRes.ok || authData.error || !authData.id) {
        throw new Error(authData.error?.message || authData.msg || "Error al crear usuario en Auth");
      }

      // Upsert explícito en usuarios — no depende del trigger handle_new_user
      const meta = payload.user_metadata;
      const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/usuarios`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "apikey": SERVICE_KEY,
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          id:              authData.id,
          email:           payload.email,
          nombre_completo: meta.nombre_completo,
          username:        meta.username || null,
          rol:             meta.rol,
          nivel:           meta.nivel || null,
          activo:          meta.activo,
          dni:             meta.dni || null,
          institucion_id:  meta.institucion_id,
          cursos_ids:      payload.cursos_ids?.length ? payload.cursos_ids : [],
          avatar_url:       meta.avatar_url || null,
          fecha_nacimiento: meta.fecha_nacimiento || null,
          fecha_ingreso:    meta.fecha_ingreso || null,
          // Creado con contraseña temporal → debe definir la suya al primer ingreso.
          debe_cambiar_password: meta.debe_cambiar_password === true,
        }),
      });
      if (!upsertRes.ok) {
        const upsertErr = await upsertRes.json().catch(() => ({}));
        throw new Error("Error al crear perfil de usuario: " + (upsertErr.message || upsertErr.details || upsertErr.hint || upsertRes.status));
      }

      return new Response(
        JSON.stringify({ id: authData.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Acción: invitar usuario por email ──────────────
    // Crea el usuario en Auth SIN contraseña y dispara el email de invitación
    // (GoTrue POST /auth/v1/invite). El usuario define su contraseña desde el
    // link → pantalla set-password. Requiere SMTP configurado en Supabase; si
    // no lo está, el alta debe usar la acción crear_usuario (contraseña temporal).
    if (action === "invitar_usuario") {
      if (!esSuper && payload.institucion_id !== perfil.institucion_id) {
        return new Response(JSON.stringify({ error: "Institución inválida" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const redirect = payload.redirect_to ? `?redirect_to=${encodeURIComponent(payload.redirect_to)}` : "";
      const inviteRes = await fetch(`${SUPABASE_URL}/auth/v1/invite${redirect}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "apikey": SERVICE_KEY,
        },
        body: JSON.stringify({
          email: payload.email,
          data:  payload.user_metadata,
        }),
      });
      const inviteData = await inviteRes.json();
      if (!inviteRes.ok || inviteData.error || !inviteData.id) {
        throw new Error(inviteData.error?.message || inviteData.msg || inviteData.error_description || "Error al enviar la invitación");
      }

      // Upsert explícito en usuarios (mismo criterio que crear_usuario). El
      // usuario invitado NO lleva debe_cambiar_password: define su contraseña
      // desde el link de invitación.
      const meta = payload.user_metadata;
      const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/usuarios`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "apikey": SERVICE_KEY,
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          id:               inviteData.id,
          email:            payload.email,
          nombre_completo:  meta.nombre_completo,
          username:         meta.username || null,
          rol:              meta.rol,
          nivel:            meta.nivel || null,
          activo:           meta.activo,
          dni:              meta.dni || null,
          institucion_id:   meta.institucion_id,
          cursos_ids:       payload.cursos_ids?.length ? payload.cursos_ids : [],
          avatar_url:       meta.avatar_url || null,
          fecha_nacimiento: meta.fecha_nacimiento || null,
          fecha_ingreso:    meta.fecha_ingreso || null,
          debe_cambiar_password: false,
        }),
      });
      if (!upsertRes.ok) {
        const upsertErr = await upsertRes.json().catch(() => ({}));
        throw new Error("Error al crear perfil de usuario: " + (upsertErr.message || upsertErr.details || upsertErr.hint || upsertRes.status));
      }

      return new Response(
        JSON.stringify({ id: inviteData.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Acción: actualizar usuario ─────────────────────
    if (action === "actualizar_usuario") {
      const targetRes = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?id=eq.${payload.usuario_id}&select=institucion_id`,
        { headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY } }
      );
      const targetArr = await targetRes.json();
      const target = Array.isArray(targetArr) ? targetArr[0] : null;

      if (!target || (!esSuper && target.institucion_id !== perfil.institucion_id)) {
        return new Response(JSON.stringify({ error: "Usuario no encontrado o de otra institución" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?id=eq.${payload.usuario_id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "apikey": SERVICE_KEY,
          },
          body: JSON.stringify(payload.campos),
        }
      );

      if (!updateRes.ok) {
        const errData = await updateRes.json();
        throw new Error(errData.message || errData.msg || "Error al actualizar usuario");
      }

      return new Response(
        JSON.stringify({ ok: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Acción: actualizar contraseña ──────────────────
    if (action === "actualizar_contrasena") {
      const targetRes = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?id=eq.${payload.usuario_id}&select=institucion_id`,
        { headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY } }
      );
      const targetArr = await targetRes.json();
      const target = Array.isArray(targetArr) ? targetArr[0] : null;

      if (!target || (!esSuper && target.institucion_id !== perfil.institucion_id)) {
        return new Response(JSON.stringify({ error: "Usuario no encontrado o de otra institución" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Al regenerar una contraseña se marca debe_cambiar_password TAMBIÉN en
      // user_metadata: el gate de la app lee el metadata primero y, si quedó en
      // false por un cambio anterior, la columna sola no volvería a forzarlo.
      const forzarCambio = payload.debe_cambiar_password === true;
      const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${payload.usuario_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "apikey": SERVICE_KEY,
        },
        body: JSON.stringify(
          forzarCambio
            ? { password: payload.password, user_metadata: { debe_cambiar_password: true } }
            : { password: payload.password }
        ),
      });
      const updateData = await updateRes.json();
      if (!updateRes.ok || updateData.error || !updateData.id) {
        throw new Error(updateData.error?.message || updateData.msg || "Error al actualizar contraseña");
      }

      if (forzarCambio) {
        await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=eq.${payload.usuario_id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "apikey": SERVICE_KEY,
          },
          body: JSON.stringify({ debe_cambiar_password: true }),
        });
      }

      return new Response(
        JSON.stringify({ ok: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Acción: dar acceso al portal a un contacto del legajo ─────────
    // Busca por EMAIL antes de crear: un tutor con varios hijos debe tener UNA
    // sola cuenta vinculada a todos, no una por alumno. Devuelve `creado` para
    // que la app sepa si mostrar la contraseña o sólo avisar del vínculo.
    if (action === "dar_acceso_portal") {
      const email = String(payload.email || "").trim().toLowerCase();
      if (!email || !payload.alumno_id) {
        return new Response(JSON.stringify({ error: "Faltan datos (email o alumno)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const instDestino = esSuper ? (payload.institucion_id ?? null) : perfil.institucion_id;

      // ¿Ya existe un usuario con ese email?
      const buscRes = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=id,rol`,
        { headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY } }
      );
      const buscArr = await buscRes.json();
      const existente = Array.isArray(buscArr) ? buscArr[0] : null;

      let usuarioId: string;
      let creado = false;

      if (existente) {
        usuarioId = existente.id;
      } else {
        const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "apikey": SERVICE_KEY,
          },
          body: JSON.stringify({
            email,
            password: payload.password,
            email_confirm: true,
            user_metadata: { debe_cambiar_password: true },
          }),
        });
        const authData = await createRes.json();
        if (!createRes.ok || !authData.id) {
          throw new Error(authData.error?.message || authData.msg || "Error al crear el usuario");
        }
        usuarioId = authData.id;
        creado    = true;

        const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/usuarios`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "apikey": SERVICE_KEY,
            "Prefer": "resolution=merge-duplicates",
          },
          body: JSON.stringify({
            id:              usuarioId,
            email,
            nombre_completo: payload.nombre_completo || email,
            rol:             "familia",
            activo:          true,
            institucion_id:  instDestino,
            debe_cambiar_password: true,
          }),
        });
        if (!upsertRes.ok) {
          const err = await upsertRes.json().catch(() => ({}));
          throw new Error("Error al crear el perfil: " + (err.message || err.details || upsertRes.status));
        }
      }

      // Vínculo con el alumno (idempotente: si ya estaba, no duplica)
      const linkRes = await fetch(`${SUPABASE_URL}/rest/v1/familia_alumno`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "apikey": SERVICE_KEY,
          "Prefer": "resolution=ignore-duplicates",
        },
        body: JSON.stringify([{ usuario_id: usuarioId, alumno_id: payload.alumno_id }]),
      });
      if (!linkRes.ok) {
        const err = await linkRes.json().catch(() => ({}));
        throw new Error("Error al vincular al estudiante: " + (err.message || err.details || linkRes.status));
      }

      return new Response(
        JSON.stringify({ id: usuarioId, creado }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Acción: crear usuario familia ─────────────────
    if (action === "crear_usuario_familia") {
      const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "apikey": SERVICE_KEY,
        },
        body: JSON.stringify({
          email:         payload.email,
          password:      payload.password,
          email_confirm: true,
          // Contraseña temporal generada por la escuela → debe cambiarla.
          user_metadata: { debe_cambiar_password: true },
        }),
      });
      const authData = await createRes.json();
      if (!createRes.ok || !authData.id) {
        throw new Error(authData.error?.message || authData.msg || "Error al crear usuario en Auth");
      }

      const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/usuarios`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "apikey": SERVICE_KEY,
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          id:              authData.id,
          email:           payload.email,
          nombre_completo: payload.nombre_completo,
          rol:             "familia",
          activo:          true,
          institucion_id:  instOperativa,
          debe_cambiar_password: true,
        }),
      });
      if (!upsertRes.ok) {
        const err = await upsertRes.json().catch(() => ({}));
        throw new Error("Error al crear perfil: " + (err.message || err.details || upsertRes.status));
      }

      if (payload.alumno_ids?.length) {
        const links = payload.alumno_ids.map((aid: string) => ({
          usuario_id: authData.id,
          alumno_id:  aid,
        }));
        const linkRes = await fetch(`${SUPABASE_URL}/rest/v1/familia_alumno`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "apikey": SERVICE_KEY,
            "Prefer": "resolution=ignore-duplicates",
          },
          body: JSON.stringify(links),
        });
        if (!linkRes.ok) {
          const err = await linkRes.json().catch(() => ({}));
          throw new Error("Error al vincular alumnos: " + (err.message || err.details || linkRes.status));
        }
      }

      return new Response(
        JSON.stringify({ id: authData.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Acción: actualizar usuario familia ────────────
    if (action === "actualizar_usuario_familia") {
      const targetRes = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?id=eq.${payload.usuario_id}&select=institucion_id,rol`,
        { headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY } }
      );
      const targetArr = await targetRes.json();
      const target = Array.isArray(targetArr) ? targetArr[0] : null;
      if (!target || (!esSuper && target.institucion_id !== perfil.institucion_id) || target.rol !== "familia") {
        return new Response(JSON.stringify({ error: "Usuario no encontrado o no válido" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (payload.nombre_completo) {
        await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=eq.${payload.usuario_id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "apikey": SERVICE_KEY,
          },
          body: JSON.stringify({ nombre_completo: payload.nombre_completo }),
        });
      }

      // Reemplazar vínculos alumno
      await fetch(`${SUPABASE_URL}/rest/v1/familia_alumno?usuario_id=eq.${payload.usuario_id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY },
      });
      if (payload.alumno_ids?.length) {
        const links = payload.alumno_ids.map((aid: string) => ({
          usuario_id: payload.usuario_id,
          alumno_id:  aid,
        }));
        await fetch(`${SUPABASE_URL}/rest/v1/familia_alumno`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "apikey": SERVICE_KEY,
            "Prefer": "resolution=ignore-duplicates",
          },
          body: JSON.stringify(links),
        });
      }

      if (payload.password) {
        await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${payload.usuario_id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "apikey": SERVICE_KEY,
          },
          body: JSON.stringify({ password: payload.password }),
        });
      }

      return new Response(
        JSON.stringify({ ok: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Acción no reconocida");

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
