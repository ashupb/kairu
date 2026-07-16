import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function construirPromptLegajo(p: any): string {
  const asistenciaTexto = (p.asistencia_pct !== null && p.asistencia_pct !== undefined)
    ? `${p.asistencia_pct}% de asistencia${p.dias_total ? ` (${p.dias_ausentes ?? 0} inasistencias en ${p.dias_total} días)` : ''}. `
      + `Faltas computables para regularidad: ${p.faltas_computables ?? 0}${p.umbral_regularidad ? ` de ${p.umbral_regularidad}` : ''}.`
      + (p.alerta_asistencia ? ` El sistema tiene activa la alerta de asistencia: "${p.alerta_asistencia}".` : '')
    : 'Sin registros de asistencia cargados.';

  const calificacionesTexto = Array.isArray(p.calificaciones) && p.calificaciones.length
    ? p.calificaciones.map((c: any) => `• ${c.materia}: promedio ${c.promedio}`).join('\n')
    : 'Sin calificaciones registradas.';

  const situacionesTexto = Array.isArray(p.situaciones_activas) && p.situaciones_activas.length
    ? p.situaciones_activas.map((s: any) => `• ${s.tipo} — urgencia ${s.urgencia} — ${s.estado} (${s.seguimiento})`).join('\n')
    : 'Sin situaciones problemáticas activas.';

  const eoeTexto = Array.isArray(p.intervenciones_eoe) && p.intervenciones_eoe.length
    ? p.intervenciones_eoe.join('\n')
    : 'Sin intervenciones EOE registradas.';

  const obsTexto = Array.isArray(p.observaciones) && p.observaciones.length
    ? p.observaciones.join(' | ')
    : 'Sin observaciones registradas.';

  const alertaTexto = p.semaforo === 'rojo' ? 'ALERTA CRÍTICA'
    : p.semaforo === 'amarillo' ? 'Requiere atención'
    : 'Sin alertas';

  return `Sos un asistente especializado en gestión escolar argentina.
Generá un informe de trazabilidad del siguiente alumno para el equipo docente.
Comenzá el informe con el título exacto: "Resumen del estudiante ${p.alumno} de ${p.curso}"

DATOS:
Alumno: ${p.alumno} | Curso: ${p.curso} (${p.nivel}) | Estado de alerta: ${alertaTexto}

ASISTENCIA:
${asistenciaTexto}

CALIFICACIONES:
${calificacionesTexto}

SITUACIONES PROBLEMÁTICAS ACTIVAS:
${situacionesTexto}

INTERVENCIONES EOE:
${eoeTexto}

OBSERVACIONES:
${obsTexto}

Redactá el informe en 3 o 4 párrafos cubriendo: rendimiento académico, asistencia y regularidad, situaciones problemáticas e intervenciones (si existen), y una síntesis con recomendación.
Tono formal y objetivo, español rioplatense. Usá los datos provistos — no inventes información. Si un dato no está disponible, mencionalo brevemente. Si hay una alerta de asistencia activa, reflejala como tal y no la minimices ni la contradigas. No uses asteriscos ni markdown. Máximo 300 palabras.`;
}

function construirPromptObservacion(p: any): string {
  return `Sos un asistente especializado en redacción pedagógica formal para escuelas argentinas.
Un docente escribió las siguientes notas informales sobre un alumno. Redactalas como una observación pedagógica formal para el legajo escolar.

Docente: ${p.docente}
Materia: ${p.materia}
Alumno: ${p.alumno}
Período: ${p.periodo}
Notas del docente: "${p.notas_docente}"

Redactá una observación pedagógica formal en 2-3 oraciones.
Tono profesional, objetivo, en español rioplatense. Empezá directamente con la observación, sin encabezado.`;
}

function construirPromptAlerta(p: any): string {
  return `Sos un asistente de análisis escolar. Analizá la situación del siguiente alumno y generá una alerta contextualizada con sugerencia de acción.

Alumno: ${p.nombre}
Curso: ${p.curso}
Asistencia actual: ${p.porcentaje_asistencia}%
Tendencia asistencia: ${p.tendencia_asistencia}
Promedio general: ${p.promedio_general}
Materias con bajo rendimiento: ${p.materias_bajas || "ninguna"}
Intervenciones previas: ${p.intervenciones || "ninguna"}

Generá un análisis breve (máximo 3 oraciones) que describa la situación y sugiera una acción concreta (ej: "Se sugiere contactar a la familia", "Se recomienda derivación EOE", etc.).
Tono directo y profesional.`;
}

function construirPromptBorradorDimension(p: any): string {
  const obsBase = p.observaciones_previas
    ? `\nNotas del docente como punto de partida: "${p.observaciones_previas}"`
    : '';
  return `Sos un asistente pedagógico para docentes de nivel inicial argentino.
Redactá una observación narrativa breve (3-5 oraciones) para la dimensión indicada, en tono profesional, positivo y constructivo. Usá lenguaje apropiado para un informe de jardín de infantes. No uses calificaciones numéricas ni comparaciones con otros niños. Basate en los datos provistos.

Alumno/a: ${p.alumno_nombre}
Sala: ${p.sala}
Semestre: ${p.semestre}° semestre, ${p.anio_lectivo}
Dimensión: ${p.dimension}
Asistencia: ${p.asistencia_resumen || 'Sin datos de asistencia'}${obsBase}

Redactá solo la observación, sin encabezado ni firma. Empezá directamente con el texto.`;
}

function construirPromptInformeNarrativo(p: any): string {
  const dims = Object.entries(p.observaciones_por_dimension || {})
    .map(([dim, obs]) => `${dim}:\n${obs}`)
    .join('\n\n');

  return `Sos un asistente pedagógico para docentes de nivel inicial argentino.
A partir de las observaciones por dimensión provistas, redactá un informe narrativo integrador de 2-3 párrafos, cohesivo y fluido, que sintetice el desarrollo del niño/niña durante el semestre. Tono profesional, positivo y constructivo. Lenguaje apropiado para familias argentinas. No repitas mecánicamente cada dimensión — integrá la información de forma natural.

Alumno/a: ${p.alumno_nombre}
Sala: ${p.sala}
Semestre: ${p.semestre}° semestre, ${p.anio_lectivo}
Asistencia: ${p.asistencia_resumen || 'Sin datos de asistencia'}

OBSERVACIONES POR DIMENSIÓN:
${dims || 'Sin observaciones registradas.'}

Redactá el informe directamente, sin encabezado ni firma.`;
}

function construirPromptAnalisis(p: any): string {
  return `Sos un asistente de gestión institucional escolar argentina.
Generá un análisis ejecutivo del estado institucional del mes para el equipo directivo.

Institución: ${p.institucion}
Período: ${p.periodo}
Total alumnos: ${p.total_alumnos}
Asistencia promedio institucional: ${p.asistencia_promedio}%
Cursos con mayor ausentismo: ${p.cursos_ausentismo || "sin datos"}
Promedio general de calificaciones: ${p.promedio_calificaciones}
Materias con más bajas notas: ${p.materias_bajas || "sin datos"}
Incidentes registrados: ${p.incidentes || 0}
Intervenciones EOE activas: ${p.intervenciones_activas || 0}

Redactá un resumen ejecutivo en 3 párrafos: situación académica general, situación de asistencia, y aspectos a atender con urgencia.
Tono formal, directo, en español rioplatense. Máximo 250 palabras.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!ANTHROPIC_KEY) throw new Error("API key no configurada");

    // Verificar JWT
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

    // Verificar rol
    const perfilRes = await fetch(
      `${SUPABASE_URL}/rest/v1/usuarios?id=eq.${userData.id}&select=rol,institucion_id`,
      { headers: { "Authorization": `Bearer ${jwt}`, "apikey": SERVICE_KEY } }
    );
    const perfilArr = await perfilRes.json();
    const perfil = Array.isArray(perfilArr) ? perfilArr[0] : null;

    if (!perfil) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, payload } = await req.json();

    // Acciones exclusivas de directivos
    const accionesDirectivo = ["sintesis_legajo", "observacion_pedagogica", "alerta_contexto", "analisis_institucional"];
    // Acciones disponibles también para docentes (nivel inicial)
    const accionesDocente   = ["borrador_observacion_dimension", "informe_narrativo_inicial"];

    const esDirectivo = ["director_general", "directivo_nivel"].includes(perfil.rol);
    const esDocente   = perfil.rol === "docente";

    if (accionesDirectivo.includes(action) && !esDirectivo) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (accionesDocente.includes(action) && !esDirectivo && !esDocente) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!accionesDirectivo.includes(action) && !accionesDocente.includes(action)) {
      throw new Error("Acción no reconocida");
    }

    let prompt = "";
    if (action === "sintesis_legajo") {
      prompt = construirPromptLegajo(payload);
    } else if (action === "observacion_pedagogica") {
      prompt = construirPromptObservacion(payload);
    } else if (action === "alerta_contexto") {
      prompt = construirPromptAlerta(payload);
    } else if (action === "analisis_institucional") {
      prompt = construirPromptAnalisis(payload);
    } else if (action === "borrador_observacion_dimension") {
      prompt = construirPromptBorradorDimension(payload);
    } else if (action === "informe_narrativo_inicial") {
      prompt = construirPromptInformeNarrativo(payload);
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Error en API de Anthropic");
    }

    // Registrar uso sin bloquear la respuesta
    fetch(`${SUPABASE_URL}/rest/v1/ia_uso`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "apikey": SERVICE_KEY,
      },
      body: JSON.stringify({
        institucion_id: perfil.institucion_id,
        usuario_id: userData.id,
        accion: action,
        tokens_input: data.usage?.input_tokens ?? null,
        tokens_output: data.usage?.output_tokens ?? null,
      }),
    }).catch(() => {});

    return new Response(
      JSON.stringify({ result: data.content[0].text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
