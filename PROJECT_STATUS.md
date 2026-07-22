# PROJECT_STATUS.md — Kairu
> Generado: 2026-04-28 | Branch: `main` | Último commit: `18f2a5d fix_fechas`

---

## Descripción general

**Kairu** es un sistema de gestión escolar institucional.
SPA en Vanilla JavaScript puro — sin framework, sin build system, sin npm.
Se sirve abriendo `index.html` en el navegador (Live Server o servidor estático).

**Backend**: Supabase (PostgreSQL + Auth + RLS). Cliente global `sb` en `js/config.js`.

---

## Estructura de carpetas

```
kairu_demo/
├── index.html              ← entrada única de la SPA
├── CLAUDE.md               ← instrucciones para Claude Code
├── PROJECT_STATUS.md       ← este archivo
├── css/
│   └── app.css             ← design system completo (variables, componentes)
└── js/
    ├── config.js           ←  17 líneas  — init Supabase client
    ├── auth.js             ← 174 líneas  — login / verificarSesion
    ├── main.js             ← 382 líneas  — goPage(), estado global, bottom nav
    ├── nav.js              ← 101 líneas  — sidebar renderNav() por rol
    ├── ui.js               ← 155 líneas  — showLoading, notificaciones, abrirNotif
    ├── setup.js            ←  80 líneas  — flujo de setup inicial de institución
    ├── dashboard.js        ← 1984 líneas — módulo Inicio (rDash)
    ├── agenda.js           ← 1080 líneas — módulo Agenda (rAgenda)
    ├── asistencia.js       ← 1173 líneas — módulo Asistencia (rAsist)
    ├── calificaciones.js   ← 1444 líneas — módulo Calificaciones (rNotas)
    ├── configuracion.js    ← 2270 líneas — módulo Configuración/Admin (rAdmin)
    ├── legajos.js          ← 1000 líneas — módulo Legajos/Resumen alumno (rLeg)
    ├── modulos.js          ←  860 líneas — módulos Objetivos (rObj) + EOE (rEOE)
    ├── problematicas.js    ←  994 líneas — módulo Problemáticas (rProb)
    └── reuniones.js        ←  158 líneas — módulo Reuniones (rReuniones) ⚠ básico
```

---

## Módulos — estado

| Página | Renderer | Archivo | Líneas | Estado |
|--------|----------|---------|--------|--------|
| `dash` | `rDash()` | dashboard.js | 1984 | ✅ Completo (dashboard comparativo por nivel para director_general) |
| `agenda` | `rAgenda()` | agenda.js | 1080 | ✅ Completo |
| `prob` | `rProb()` | problematicas.js | 994 | ✅ Completo (v3 grupal/curso) |
| `obj` | `rObj()` | modulos.js | 860 | ✅ Completo |
| `eoe` | `rEOE()` | modulos.js | ↑ | ✅ Completo |
| `asist` | `rAsist()` | asistencia.js | 1173 | ✅ Completo (multi-nivel) |
| `notas` | `rNotas()` | calificaciones.js | 1444 | ✅ Completo (multi-escala) |
| `leg` | `rLeg()` | legajos.js | 1000 | ✅ Completo |
| `admin` | `rAdmin()` | configuracion.js | 2270 | ✅ Completo (multi-tab) |
| `reuniones` | `rReuniones()` | reuniones.js | 158 | ⚠ Básico / pendiente expansión |

---

## Roles implementados

| Rol | Nav principal | Descripción |
|-----|--------------|-------------|
| `director_general` | Completo (todos los módulos) | Acceso total, gestión institucional |
| `directivo_nivel` | Completo (sin Institución) | Director de un nivel específico |
| `eoe` | Orientación + Recursos | Equipo de orientación escolar |
| `docente` | Mis clases + Institucional | Solo sus cursos asignados |
| `preceptor` | Mis cursos + Institucional | Cursos y configuración básica |
| `admin` | Solo Configuración | Usuario técnico/sistema |

---

## Esquema de base de datos

### Tablas principales

| Tabla | Descripción |
|-------|-------------|
| `usuarios` | Perfiles vinculados a Supabase Auth (`id`, `rol`, `nivel`, `institucion_id`, `nombre_completo`, `config_extra`) |
| `instituciones` | Datos de la institución |
| `cursos` | Cursos escolares (`nivel`, `nombre`, `division`, `ciclo_lectivo`) |
| `alumnos` | Alumnos (`curso_id`, `activo`) |
| `materias` | Materias por nivel/institución |
| `asignaciones` | Vínculo docente-curso-materia (`docente_id`, `curso_id`, `materia_id`, `anio_lectivo`) |
| `asistencia` | Registros diarios (`alumno_id`, `fecha`, `estado`, `hora_clase`) |
| `config_asistencia` | Configuración pedagógica por nivel e institución |
| `tipos_justificacion` | Tipos de justificación de ausencia |
| `problematicas` | Situaciones problemáticas (`modalidad`, `problematica_madre_id`) |
| `problematica_alumnos` | Alumnos de problemáticas grupales/curso |
| `intervenciones` | Bitácora de seguimiento de problemáticas |
| `objetivos` | Objetivos institucionales (`categoria`, `estado`, `tendencia`) |
| `objetivo_incidentes` | Incidentes registrados por objetivo |
| `eventos_institucionales` | Eventos de agenda (`nivel`, `convocados_ids[]`, `convocatoria_grupos[]`) |
| `notificaciones` | Notificaciones por usuario (`usuario_id`, `tipo`, `referencia_tabla`, `leida`) |
| `reuniones` | Reuniones y actividades institucionales |
| `reunion_invitados` | Invitados a reuniones (`usuario_id`, `estado`) |

### config_asistencia — columnas clave

| Columna | Nivel | Descripción |
|---------|-------|-------------|
| `umbral_alerta_1/2/3` | todos | % inasistencias para alertas |
| `justificadas_cuentan` | todos | si justificadas cuentan para regularidad |
| `escala` | primario c2, secundario | `'numerica'` o `'conceptual'` |
| `nota_minima` | primario c2, secundario | nota mínima aprobación |
| `nota_recuperacion` | primario c2 | nota mínima en instancias de recuperación (default 4) |
| `escala_ciclo1` | primario | siempre `'conceptual'` (1°-3°) |
| `aprobacion_ciclo1` | primario | mínimo aprobatorio D/R/**B**/MB/S |
| `dimensiones_informe` | inicial | jsonb array de dimensiones para informes narrativos |

### Estados de asistencia

| Estado | Valor | Cuenta como presente |
|--------|-------|---------------------|
| `presente` | 0 | ✅ sí |
| `tardanza` | 0.25 | ✅ sí |
| `media_falta` | 0.5 | ✅ sí |
| `justificado` | 0 | ❌ no (ausente justificado) |
| `ausente` | 1 | ❌ no |

**Fórmula**: `(presente + tardanza + media_falta) / total × 100`

---

## Patrones técnicos relevantes

- **Navegación**: `goPage(id)` en `main.js` — único punto de entrada
- **Estado global**: `USUARIO_ACTUAL`, `INSTITUCION_ACTUAL`, `EX`, `CUR_PAGE`, `sb`
- **Patrón módulo**: `rXxx()` → fetcha → `innerHTML` con template literals
- **Cache local**: `window._xxxCache` para evitar re-fetches en toggles acordeón
- **Acordeón**: `togEx(key, fn)` en `main.js`
- **Detección de migración**: `detectarMigracion()` cachea si columnas v2 existen
- **Notificaciones → nav**: `abrirNotif()` en `ui.js` usa `setTimeout` 600-800ms
- **Orden de scripts**: `config.js` → `main.js` / `auth.js` → módulos (todo global)

---

## Historial reciente de commits

```
18f2a5d  fix_fechas
62149e0  fix_fechas
ee62adb  fix_agenda
f0920ec  fecha_atras_niveles
d7124da  niveles_config
793a703  niveles_asistencias_calificaciones
986dfe6  niveles
9d158c4  problematicas_metricas
9844b05  modificaciones_varias_v2
bccac6f  modificaciones_varias
```

---

## Pendientes / deuda técnica

| Prioridad | Ítem | Detalle |
|-----------|------|---------|
| ⚠ Alta | Módulo Reuniones incompleto | `reuniones.js` tiene solo 158 líneas vs ~1000+ del resto — funcionalidad básica, sin gestión completa de invitados ni estados |
| ⚠ Alta | Reuniones no está en la nav | No figura en `NAV_CONFIG` de ningún rol ni en el mapa de renderers de `goPage()` — es inaccesible desde la interfaz |
| Media | Setup inicial | `setup.js` (80 líneas) — flujo de configuración inicial de institución, puede requerir expansión |
| Media | Sin tests automatizados | No hay suite de tests (esperado para Vanilla JS, pero relevante para regresiones) |
| Baja | Rol `admin` sin label | Definido en `NAV_CONFIG` pero ausente en `ROL_LABELS_ADM` de configuracion.js |

---

## Design system

Variables CSS en `css/app.css`. Tipografía: **DM Sans** + **DM Mono** (Google Fonts).
Paleta, componentes y reglas completas en `.claude/skills/kairu-design/SKILL.md`.

## TEST PR 26/5/2026