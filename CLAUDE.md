# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mantenimiento de este archivo

**Actualizar CLAUDE.md es parte del trabajo.** Cada vez que se realice un cambio significativo — nueva tabla, nuevo módulo, cambio de patrón, migración de base de datos, corrección de bug estructural — actualizar este archivo antes de cerrar la tarea. Lo mismo aplica cuando se compacta el contexto: revisar si la compactación omitió información relevante y reflejarla aquí.

El objetivo es que cualquier instancia nueva de Claude pueda arrancar desde este archivo sin necesidad de explorar el código.

## Proyecto

**Kairu** es un sistema de gestión escolar institucional. Es una SPA (Single Page Application) en Vanilla JavaScript puro — sin framework, sin build system, sin npm. Se sirve abriendo `index.html` directamente en el navegador o via servidor estático.

**Backend**: Supabase (PostgreSQL + Auth + RLS). El cliente global es `sb`, inicializado en `js/config.js`.

## Estructura del repositorio — DOS APPS en un mismo repo

```
kairu_demo/
├── index.html          ← App INTERNA (Kairu institucional)
├── js/                 ← Módulos de la app interna
├── css/
├── familias/           ← App FAMILIAS (portal para padres/tutores)
│   ├── index.html
│   ├── css/app.css
│   └── js/             ← auth.js, main.js, inicio.js, comunicados.js, etc.
├── KAIRU_FAMILIAS/     ← Carpeta legacy/espejo. NO usar para editar.
└── migrations/
```

### Reglas de edición — CRÍTICAS

- **App interna** → editar en `kairu_demo/` (raíz del repo)
- **App familias** → editar en `kairu_demo/familias/` — **NUNCA** en `Desktop/KAIRU_FAMILIAS/` (fuera del repo)
- `Desktop/KAIRU_FAMILIAS/` es una carpeta fuera del repo git. Si Claude editó ahí por error, copiar los cambios a `kairu_demo/familias/` antes de commitear.
- La carpeta `kairu_demo/KAIRU_FAMILIAS/` es un espejo legacy; si se edita `familias/`, sincronizar también esa carpeta.

### Deploy — Cloudflare Pages (automático en cada push)

| App | Cloudflare root directory | Rama |
|---|---|---|
| App interna | `/` (raíz del repo) | main |
| App familias | `/familias` | main |

**Workflow**: editar archivos → `git add . && git commit && git push` → Cloudflare deploya ambas automáticamente.

## Desarrollo

No hay comandos de build, lint ni tests. Para desarrollar:
- Abrir `index.html` en el navegador (Live Server de VSCode o similar)
- Las credenciales de Supabase están en `js/config.js` (interna) y `familias/js/config.js` (familias)
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
| `notas` | `rNotas()` | calificaciones.js — para nivel inicial deriva a `rNotasInicial()` (Áreas de desarrollo); para otros niveles: calificaciones numéricas/conceptuales |
| `informes` | `rInformes()` | informes_inicial.js — solo nivel inicial; compila el informe narrativo semestral |
| `leg` | `rLeg()` | legajos.js |
| `agenda` | `rAgenda()` | agenda.js |
| `eoe` | `rEOE()` | modulos.js |
| `admin` | `rAdmin()` (o `rAdmin` de ui.js) | configuracion.js |
| `tareas` | `rTareas()` | tareas.js — página completa de tareas personales (todos los roles) |

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

El rol `eoe` tiene acceso multi-nivel (igual que `director_general`) en asistencia y calificaciones, pero en modo **solo lectura** (sin botones de guardar/gestión del ciclo lectivo). En problemáticas puede agregar intervenciones tipificadas (`_EOE_TIPOS_INTERV`) pero NO puede cerrar/reabrir casos (`probPermisos().cerrar === false` para EOE). Cuando el tipo es "Derivación", el formulario embebe campos de derivación y guarda simultáneamente en `intervenciones` y `derivaciones`. En legajos puede ver y crear derivaciones (tab "Derivaciones" visible solo para EOE y directivos).

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
| `observaciones_iniciales` | Observaciones narrativas por dimensión, alumno y semestre (nivel inicial). `UNIQUE(alumno_id, anio_lectivo, semestre, dimension)`. Campos: `observacion` (texto docente), `borrador_ia` (borrador generado por IA). SQL: `migrations/observaciones_iniciales.sql` |
| `informes_iniciales` | Informe narrativo final por alumno y semestre (nivel inicial). `UNIQUE(alumno_id, anio_lectivo, semestre)`. Campo `estado`: `'borrador'` / `'finalizado'` / `'enviado'`. SQL: `migrations/observaciones_iniciales.sql` |
| `alertas_academicas` | Alertas al cierre de cuatrimestre. **Cols nuevas** (v15): `tipo`, `materias_ids[]`, `ciclo_lectivo`, `cuatrimestre`, `leida`, `resuelta`. Cols viejas intactas. |
| `cierres_periodo` | Registro del cierre de cuatrimestre/año por la institución |
| `problematicas` | Situaciones problemáticas con soporte grupal (`modalidad`, `problematica_madre_id`) |
| `problematica_alumnos` | Alumnos de una problematica grupal/curso (`problematica_id`, `alumno_id`) |
| `intervenciones` | Bitácora de seguimiento de problematicas |
| `notificaciones` | Notificaciones por usuario (`usuario_id`, `tipo`, `referencia_tabla`, `referencia_id`, `leida`, `mensaje`) |
| `derivaciones` | Derivaciones EOE (`alumno_id`, `problematica_id?`, `tipo_servicio`, `institucion_destino`, `profesional_destino?`, `fecha_derivacion`, `motivo`, `estado`, `respuesta?`, `creado_por`). Acceso: EOE (escritura), director/directivo (lectura). SQL: `migrations/derivaciones.sql` |
| `reuniones` | Reuniones institucionales y actividades EOE. **Cols v1** (`migrations/actividades_eoe.sql`): `tipo_actividad`, `problematica_id`, `destinatarios_tipo` ('curso'/'alumnos_individuales'/'nivel_completo'/'cursos_multiples'), `destinatarios_ids UUID[]`, `destinatarios_texto`. **Cols v2** (`migrations/actividades_eoe_v2.sql`): `objetivo_id` (FK objetivos), `en_agenda` bool, `objetivo_actividad`, `resultado`, `nivel_destinatario`. Filas con `tipo_actividad IS NOT NULL` = actividades EOE gestionadas desde `rEOE()`. |
| `actividad_encuentros` | Encuentros adicionales de una actividad EOE (`reunion_id`, `fecha DATE`, `hora TIME`, `tematica TEXT`, `orden INT`). SQL: `migrations/actividades_eoe_v2.sql`. |
| `reunion_invitados` | Invitados a reuniones/actividades (`reunion_id`, `usuario_id`, `estado`: 'pendiente'/'aceptada'/'rechazada') |
| `eventos_institucionales` | Eventos de agenda con `nivel`, `convocados_ids[]`, `convocatoria_grupos[]` |
| `config_asistencia` | Configuración por nivel e institución — ver columnas abajo |
| `tipos_justificacion` | Tipos de justificación de ausencia |
| `tipos_instancia_evaluativa` | Tipos de instancia evaluativa configurables por institución (`nombre`, `activo`, `es_recuperatorio`, `orden`). Gestionados desde configuracion.js. **Nota**: `instancias_evaluativas.tipo_id` apunta a esta tabla (FK corregida en v20). La tabla legacy `tipos_evaluacion` queda en desuso. |
| `instancias_evaluativas` | Instancias evaluativas de un curso × materia × período. FK `tipo_id` → `tipos_instancia_evaluativa`. Tiene columna denormalizada `es_recuperatorio`. |
| `tareas_usuario` | Tareas personales por usuario. RLS: `usuario_id = auth.uid()`. Campos: `texto`, `fecha_vencimiento DATE`, `estado` ('pendiente'/'completada'), `observacion`, `contexto_tipo` ('alumno'/'problematica'/'general'), `contexto_id UUID`, `contexto_label`. SQL: `migrations/tareas_usuario.sql`. Gestionadas desde `js/tareas.js`. |
| `mensajes_familia` | Canal directo bidireccional institución ↔ familia (uno por alumno, hilo cronológico). Reemplaza cuaderno de comunicaciones/WhatsApp. Campos: `enviado_por_id`/`enviado_por_tipo` ('institucion'/'familia'), `destinatario_id` (a quién va dirigido un mensaje de familia — ver routing abajo), `cuerpo`, `leido_familia`/`leido_institucion` (acuse de recibo explícito, no implícito al abrir), `requiere_respuesta`. SQL: `migrations/migration_v34_mensajes_familia.sql`. Lado institución: tab "Mensajes" en legajo de alumno (`js/legajos.js` → `_tabMensajes`). Lado familia: `familias/js/mensajes.js` (`rMensajes()`). |

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

### Mensajes familia — routing de destinatario
La familia nunca elige a quién le escribe; el routing lo resuelve la app:
- **Institución → familia**: cualquier actor con acceso al legajo puede escribir (`enviado_por_id` = quien escribe).
- **Familia → mensaje nuevo**: siempre va al `preceptor_id` del curso del alumno (`cursos.preceptor_id`). Si no hay preceptor asignado, no se puede iniciar conversación.
- **Familia → respuesta a un mensaje puntual**: va dirigido a quien envió ese mensaje (`destinatario_id` = `enviado_por_id` del mensaje original), no necesariamente al preceptor.
- El acuse de recibo (`leido_familia`/`leido_institucion`) es explícito: la familia debe tocar "Marcar como leído" o "Responder" — abrir el hilo no marca como leído automáticamente. Del lado institución, abrir el tab "Mensajes" del legajo sí marca como leídos los mensajes pendientes de la familia (comportamiento de bandeja estándar).

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

| Acción | Descripción | Roles permitidos |
|--------|-------------|-----------------|
| `sintesis_legajo` | Resumen narrativo del alumno para equipo docente | director_general, directivo_nivel |
| `observacion_pedagogica` | Redacción formal a partir de notas coloquiales del docente | director_general, directivo_nivel |
| `alerta_contexto` | Análisis contextualizado de situación del alumno con sugerencia de acción | director_general, directivo_nivel |
| `analisis_institucional` | Resumen ejecutivo mensual para directivos | director_general, directivo_nivel |
| `borrador_observacion_dimension` | Borrador de observación para una dimensión de desarrollo (nivel inicial) | director_general, directivo_nivel, docente |
| `informe_narrativo_inicial` | Informe narrativo integrador semestral (nivel inicial) | director_general, directivo_nivel, docente |

### Modelo de negocio — reglas críticas

El costo de la API lo paga la dueña del sistema (por tokens). Cada institución tiene una cuota mensual incluida en su plan.

**Detección de nivel inicial** (en nav.js, calificaciones.js, informes_inicial.js): usar `esNivelInicial()` definida en `nav.js`. Retorna `true` si `USUARIO_ACTUAL.nivel === 'inicial'` o si el usuario es `director_general` en una institución exclusivamente inicial (`nivel_inicial=true`, `nivel_primario=false`, `nivel_secundario=false`).

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