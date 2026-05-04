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

    if (!perfil || !["director_general", "directivo_nivel"].includes(perfil.rol)) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Acción: crear usuario ──────────────────────────
    if (action === "crear_usuario") {
      if (payload.institucion_id !== perfil.institucion_id) {
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
      await fetch(`${SUPABASE_URL}/rest/v1/usuarios`, {
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
          username:        meta.username,
          rol:             meta.rol,
          nivel:           meta.nivel || null,
          activo:          meta.activo,
          dni:             meta.dni || null,
          institucion_id:  meta.institucion_id,
          cursos_ids:      payload.cursos_ids?.length ? payload.cursos_ids : [],
        }),
      });

      return new Response(
        JSON.stringify({ id: authData.id }),
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

      if (!target || target.institucion_id !== perfil.institucion_id) {
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

      if (!target || target.institucion_id !== perfil.institucion_id) {
        return new Response(JSON.stringify({ error: "Usuario no encontrado o de otra institución" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${payload.usuario_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "apikey": SERVICE_KEY,
        },
        body: JSON.stringify({ password: payload.password }),
      });
      const updateData = await updateRes.json();
      if (!updateRes.ok || updateData.error || !updateData.id) {
        throw new Error(updateData.error?.message || updateData.msg || "Error al actualizar contraseña");
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
