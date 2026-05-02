# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mantenimiento de este archivo

**Actualizar CLAUDE.md es parte del trabajo.** Cada vez que se realice un cambio significativo — nueva tabla, nuevo módulo, cambio de patrón, migración de base de datos, corrección de bug estructural — actualizar este archivo antes de cerrar la tarea. Lo mismo aplica cuando se compacta el contexto: revisar si la compactación omitió información relevante y reflejarla aquí.

El objetivo es que cualquier instancia nueva de Claude pueda arrancar desde este archivo sin necesidad de explorar el código.

## Proyecto

**Kairu** es un sistema de gestión escolar institucional. Es una SPA (Single Page Application) en Vanilla JavaScript puro — sin framework, sin build system, sin npm. Se sirve abriendo `index.html` directamente en el navegador o via servidor estático.

**Backend**: Supabase (PostgreSQL + Auth + RLS). El cliente global es `sb`, inicializado en `js/config.js`.

## Desarrollo

No hay comandos de build, lint ni tests. Para desarrollar:
- Abrir `index.html` en el navegador (Live Server de VSCode o similar)
- Las credenciales de Supabase están en `js/config.js`
- Los cambios en JS se ven al recargar la página

## Arquitectura

### Flujo de arranque
1. `window.load` → `verificarSesion()` (auth.js) — chequea sesión Supabase existente
2. Login exitoso → popula `USUARIO_ACTUAL` y `INSTITUCION_ACTUAL` como globales
3. `iniciarApp()` (main.js) → `goPage('dash')` → llama al renderer del módulo

### Navegación
`goPage(id)` en `main.js` es el único punto de navegación. Activa el `<div class="page" id="page-{id}">` correspondiente y llama al renderer:

| id | renderer | archivo |
|---|---|---|
| `dash` | `rDash()` | dashboard.js |
| `prob` | `rProb()` | problematicas.js |
| `obj` | `rObj()` | modulos.js |
| `asist` | `rAsist()` | asistencia.js |
| `notas` | `rNotas()` | calificaciones.js — incluye sección Intensificación/Recursada y botones de cierre de cuatrimestre (solo directivos) |
| `leg` | `rLeg()` | legajos.js |
| `agenda` | `rAgenda()` | agenda.js |
| `eoe` | `rEOE()` | modulos.js |
| `admin` | `rAdmin()` (o `rAdmin` de ui.js) | configuracion.js |

### Estado global (main.js)
- `USUARIO_ACTUAL` — perfil completo del usuario logueado (incluye `id`, `rol`, `institucion_id`, `nivel`, `nombre_completo`)
- `INSTITUCION_ACTUAL` — datos de la institución
- `EX` — ID del item actualmente expandido (patrón acordeón). `togEx(key, fn)` lo togglea y llama fn para re-renderizar
- `CUR_PAGE` — página activa actual
- `sb` — cliente Supabase (definido en config.js, disponible globalmente)

### Patrón de módulo
Cada módulo sigue este patrón:
1. `rXxx()` — función principal: llama `showLoading()`, fetcha datos, renderiza innerHTML del `page-xxx`
2. Sub-renderers por rol (ej: `rAsistDirector()`, `rAsistDocente()`, `rAsistPreceptor()`)
3. Cache local en `window._xxxCache` para evitar re-fetches en toggles
4. El HTML se construye con template literals y se asigna a `innerHTML`

### Roles y permisos
Los roles son: `director_general`, `directivo_nivel`, `eoe`, `docente`, `preceptor`.

El nav lateral (`nav.js`) y bottom nav mobile (`main.js`) se configuran por rol en `NAV_CONFIG` y `BOTTOM_NAV_ITEMS`. Cada módulo tiene su propia función `xxxPermisos()` que retorna un objeto de booleanos.

Los usuarios `docente` y `preceptor` tienen acceso a asistencia y calificaciones solo para sus cursos asignados. Las asignaciones de docente están en la tabla `asignaciones` (columnas: `docente_id`, `curso_id`, `materia_id`, `anio_lectivo`) — **no** en `docente_cursos`.

## Base de datos — tablas clave

| Tabla | Descripción |
|---|---|
| `usuarios` | Perfiles (vinculados a Supabase Auth por `id`) |
| `instituciones` | Datos institucionales |
| `cursos` | Cursos con `nivel` (inicial/primario/secundario), `nombre`, `division` |
| `alumnos` | Alumnos con `curso_id`, `activo` |
| `materias` | Materias |
| `asignaciones` | Vínculo docente-curso-materia (`docente_id`, `curso_id`, `materia_id`, `anio_lectivo`) |
| `asistencia` | Registros diarios (`alumno_id`, `fecha`, `estado`, `hora_clase`, `periodo_intensif_id`, `materia_estado_id`) |
| `periodos_intensificacion` | 4 períodos de intensificación por ciclo lectivo (`tipo`: inicio_c1/fin_c1/diciembre/febrero, `activo`) |
| `materias_estado_alumno` | Estado de cada materia por alumno con trayectoria histórica (`ciclo_lectivo_origen`, `ciclo_lectivo_cursado`, `estado`, `nota_intensif_1`, `nota_intensif_2`) |
| `alertas_academicas` | Alertas al cierre de cuatrimestre. **Cols nuevas** (v15): `tipo`, `materias_ids[]`, `ciclo_lectivo`, `cuatrimestre`, `leida`, `resuelta`. Cols viejas intactas. |
| `cierres_periodo` | Registro del cierre de cuatrimestre/año por la institución |
| `problematicas` | Situaciones problemáticas con soporte grupal (`modalidad`, `problematica_madre_id`) |
| `problematica_alumnos` | Alumnos de una problematica grupal/curso (`problematica_id`, `alumno_id`) |
| `intervenciones` | Bitácora de seguimiento de problematicas |
| `notificaciones` | Notificaciones por usuario (`usuario_id`, `tipo`, `referencia_tabla`, `referencia_id`, `leida`) |
| `eventos_institucionales` | Eventos de agenda con `nivel`, `convocados_ids[]`, `convocatoria_grupos[]` |
| `config_asistencia` | Configuración por nivel e institución — ver columnas abajo |
| `tipos_justificacion` | Tipos de justificación de ausencia |

### config_asistencia — columnas relevantes

| Columna | Nivel | Descripción |
|---|---|---|
| `umbral_alerta_1/2/3` | todos | % de inasistencias para alertas |
| `justificadas_cuentan` | todos | si justificadas cuentan para regularidad |
| `escala` | primario (ciclo 2), secundario | `'numerica'` o `'conceptual'` |
| `nota_minima` | primario (ciclo 2), secundario | nota mínima de aprobación |
| `nota_recuperacion` | primario (ciclo 2) | nota mínima en instancias de recuperación (default 4) |
| `escala_ciclo1` | primario | siempre `'conceptual'` (1°-3° grado) |
| `aprobacion_ciclo1` | primario | valor mínimo aprobatorio: D/R/**B**/MB/S (default B) |
| `dimensiones_informe` | inicial | jsonb array con dimensiones de desarrollo para informes narrativos |

**Inicial**: no usa escala ni nota_minima (null). Usa informes narrativos con `dimensiones_informe`.
**Primario primer ciclo** (1°-3°): escala conceptual, evaluación cuatrimestral, promoción automática en 1° y 2°.
**Primario segundo ciclo** (4°-6°): escala numérica, evaluación cuatrimestral, recuperación dic/mar.

### Estados de asistencia
```
presente:    valor 0    → cuenta como presente en el %
tardanza:    valor 0.25 → cuenta como presente en el %
media_falta: valor 0.5  → cuenta como presente en el %
justificado: valor 0    → NO cuenta como presente (es ausente con justificación)
ausente:     valor 1    → NO cuenta como presente
```
**Fórmula correcta**: `(presente + tardanza + media_falta) / total * 100`

### Problematicas grupales (v3)
- `modalidad`: `'individual'` | `'grupal'` | `'curso'`
- `problematica_madre_id`: FK a la misma tabla (null en madres e individuales)
- Las madres tienen `alumno_id = null`; las hijas tienen el alumno individual
- La lista principal filtra con `.is('problematica_madre_id', null)` para mostrar solo madres

## Patrones importantes

### Detección de migración
Varios módulos usan una función `detectarMigracion()` que cachea si ciertas columnas v2 existen en el schema (para compatibilidad con instancias que no las tienen). Ejemplo en problematicas.js, asistencia.js.

### Notificaciones → navegación
`abrirNotif()` en `ui.js` navega a la página del módulo y usa `setTimeout` (600–800ms) para abrir el item específico una vez que la lista está renderizada.

### Agenda — filtro por rol
- `director_general` y `directivo_nivel`: ven todos los eventos de la institución (filtrable por nivel)
- Otros roles: ven solo eventos de su nivel, o donde están en `convocados_ids[]` o en `convocatoria_grupos[]`
- Mapping de rol a grupo en `_ROL_A_GRUPO` (agenda.js)

### Carga de scripts
El orden de `<script>` en `index.html` importa porque todo es global. `config.js` va primero (define `sb`), `main.js` y `auth.js` después, luego los módulos.

## Integración de IA

Kairu integra IA mediante una Supabase Edge Function que llama a la API de Anthropic.

### Infraestructura

- **Edge Function**: `supabase/functions/ai-assistant/index.ts`
- **URL**: `https://vxsgzutluqfonhakiltz.supabase.co/functions/v1/ai-assistant`
- **Modelo**: `claude-haiku-4-5` (bajo costo)
- **Secret**: `ANTHROPIC_API_KEY` configurado en Supabase → Settings → Edge Functions → Secrets
- **Helper global**: `llamarIA(action, payload)` al final de `js/main.js` — fetch autenticado con token de sesión del usuario

La función recibe `{ action, payload }` y devuelve `{ result }`.

### Acciones disponibles

| Acción | Descripción |
|--------|-------------|
| `sintesis_legajo` | Resumen narrativo del alumno para equipo docente |
| `observacion_pedagogica` | Redacción formal a partir de notas coloquiales del docente |
| `alerta_contexto` | Análisis contextualizado de situación del alumno con sugerencia de acción |
| `analisis_institucional` | Resumen ejecutivo mensual para directivos |

### Modelo de negocio — reglas críticas

El costo de la API lo paga la dueña del sistema (por tokens). Cada institución tiene una cuota mensual incluida en su plan.

**Reglas que no se deben romper:**
- **Nunca** llamar `llamarIA()` en eventos automáticos, loops o carga de página
- **Solo** en acciones explícitas del usuario (botón "Generar con IA")
- Los botones IA son visibles **únicamente** para `director_general` y `directivo_nivel`
- El botón debe deshabilitarse mientras espera (evitar doble llamada)
- Siempre mostrar spinner/texto de carga mientras espera
- Siempre manejar error con mensaje amigable: "No se pudo generar el texto. Intentá más tarde."

### Tabla de consumo (pendiente de crear en Supabase)

```sql
CREATE TABLE ia_uso (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  institucion_id uuid REFERENCES instituciones(id),
  usuario_id uuid REFERENCES usuarios(id),
  accion text NOT NULL,
  tokens_input integer,
  tokens_output integer,
  created_at timestamptz DEFAULT now()
);
```

Después de cada llamada exitosa, insertar un registro con `data.usage.input_tokens` y `data.usage.output_tokens` que devuelve la Edge Function.

### Implementaciones pendientes (en orden)

**Prioridad 1 — legajos.js**
Botón "✨ Generar resumen IA" en la vista detalle del alumno (`rLeg`):
1. Deshabilitar botón + mostrar spinner "Generando resumen..."
2. Recopilar datos ya en pantalla (nombre, curso, asistencia, calificaciones, intervenciones, observaciones)
3. Llamar `llamarIA("sintesis_legajo", payload)`
4. Mostrar resultado en panel expandible con fondo suave debajo de los datos del alumno
5. Botón "Copiar" para copiar al portapapeles

**Prioridad 2 — dashboard.js**
En la sección de alertas del dashboard, agregar link pequeño "Ver análisis IA →" por cada alumno en alerta.
Al hacer clic (nunca automático) → modal con resultado de `llamarIA("alerta_contexto", payload)`.

**Prioridad 3 — dashboard.js**
Nueva tarjeta "Análisis institucional del mes" al final del dashboard, solo para `director_general`.
Botón "✨ Generar análisis" — una vez por día (guardar timestamp en `localStorage`).
Llama `llamarIA("analisis_institucional", payload)` con métricas agregadas del mes.

---

## Design System

Ver `.claude/skills/kairu-design/SKILL.md` para la guía completa de:
- Paleta de colores y variables CSS
- Tipografía (DM Sans + DM Mono)
- Componentes base (botones, inputs, badges, cards, sidebar, bottom nav)
- Reglas de logo y microcopia

**Usar siempre las variables CSS definidas ahí. No inventar colores ni fuentes.**