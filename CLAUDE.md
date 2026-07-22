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
1. `window.load` (main.js) → si el hash trae un token de invitación/recuperación (`window.__authLinkType`, capturado por un `<script>` inline en `index.html` **antes** de que supabase-js consuma el hash) → `mostrarSetPassword(tipo)` (pantalla set-password, ver abajo). Si no → `verificarSesion()` (auth.js) — chequea sesión Supabase existente
2. Login exitoso → popula `USUARIO_ACTUAL` y `INSTITUCION_ACTUAL` como globales. Si `perfil.debe_cambiar_password` es true (usuario creado con contraseña temporal) → `mostrarSetPassword('primer_ingreso')` en vez de entrar
3. `iniciarApp()` (main.js) → `goPage('dash')` → llama al renderer del módulo

### Autenticación — login, invitación y set-password (`js/auth.js` + `index.html`)

- **Login** (`login()`): el campo (`#inp-email`, rotulado "EMAIL") acepta email **o** username. Sin `@` resuelve el email con la RPC `get_email_by_username` (retrocompatibilidad de los usuarios de prueba viejos, que tienen username). Las **altas nuevas ya no generan username** — la identidad es el email.
- **Alta de usuarios — dos modos** (elegibles en el modal de Usuarios, ver sección Configuración → Usuarios): **invitación por email** (`invitar_usuario` en la edge function `admin-users` → `POST /auth/v1/invite`, Supabase manda el mail, el usuario define su contraseña desde el link) o **contraseña temporal** (`crear_usuario`, marca `debe_cambiar_password=true`, el admin comunica la contraseña y la app obliga a cambiarla al primer ingreso). La invitación **requiere SMTP propio configurado en Supabase** (ver `migrations/usuarios_perfil_invitacion.sql`, §5 del spec); mientras no lo esté, usar el modo temporal. Si un invite falla por SMTP puede dejar un usuario huérfano en Auth (reintentar en modo temporal o borrarlo desde el dashboard).
- **Pantalla set-password** (`#setpass-screen` en index.html, autocontenida y theme-aware; lógica en auth.js): tres contextos — `invite` (link de invitación), `recovery` (link de "¿olvidaste tu contraseña?") y `primer_ingreso` (contraseña temporal). En los tres ya hay sesión válida (del link o del login), así que `guardarNuevaContrasena()` sólo hace `sb.auth.updateUser({ password })`, limpia `debe_cambiar_password`, limpia el hash y llama `verificarSesion()`. El `redirect_to` que se manda a Supabase es `window.location.origin + window.location.pathname` (debe estar en el allowlist de Redirect URLs de Supabase). Depende del flujo implícito/hash (default de supabase-js): los links de email traen `#access_token=...&type=...`.
- **¿Olvidaste tu contraseña?** (`olvideContrasena()` en el login): pide el email con `prompt()` y llama `sb.auth.resetPasswordForEmail(email, { redirectTo })`.
- **Cambiar contraseña (logueado)**: botón en el panel de perfil de la topbar (`#perfil-panel`) → `cambiarMiContrasena()` (main.js) abre un `_crearModal` con dos campos y hace `sb.auth.updateUser({ password })`. Llama `inyectarEstilosAdmin()` primero porque los estilos del modal se inyectan recién al entrar a Configuración.

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

### Dashboard — director_general (dashboard.js → `rDashDirector()`)
El dashboard de `director_general` muestra estado comparativo institucional en vez de un solo nivel:
1. Saludo + barra de asistencia institucional (sin cambios respecto a otros roles)
2. `.niveles-grid` — 3 cards (`renderNivelCardDirector()`), una por nivel activo (inicial/primario/secundario), con borde superior del color de `NIVEL_CONFIG` (agenda.js): alumnos/docentes/situaciones del nivel, badge de estado (`ok`/`atención`/`alerta`), % asistencia hoy, y cobertura de notas cuatrimestre (primario/secundario) o estado de informes narrativos (inicial)
3. `renderAlertasInstitucionales()` — panel cruzado (máx. 4, ordenadas por severidad): cobertura crítica de notas con cierre próximo, alumnos sobre el umbral de inasistencia (reutiliza `alertas_asistencia`, ya precomputada), situaciones sin intervención en 7 días, y alumno con ≥2 de 3 indicadores de riesgo (problemática activa + inasistencias + nota bajo mínima)
4. Próximas actividades, alertas sin leer y pendientes de respuesta (sin cambios)
5. Objetivos institucionales vía `renderObjetivosDirectivo()` (compartida con `directivo_nivel` — dot de tendencia + badge de estado)
6. `#tareas-col` (panel de tareas de `tareas.js`, sin tocar) + resumen institucional (alumnos/docentes/situaciones totales) al pie, separado por `border-top`

Las funciones `renderObjetivosStrip`, `renderAlertasAsistDir` y `renderNivelPanelSituaciones` (antiguo panel por nivel, código muerto) fueron eliminadas al migrar a este diseño — no reintroducirlas.

**Nota de convención de color**: los niveles usan siempre los colores de `NIVEL_CONFIG` (agenda.js: inicial verde, primario azul, secundario violeta) para ser consistentes con la agenda y las próximas actividades en la misma pantalla — no inventar una paleta de color distinta por nivel en nuevas secciones del dashboard.

### Roles, permisos y administrador de plataforma (migración v38)

**Los roles son reales — ya no hay alias.** Hasta la v38, `js/auth.js` reescribía `secretario` y `vicedirector` a `directivo_nivel` al iniciar sesión (guardando el original en `rol_display`). **Eso se eliminó**: el rol real viaja en `USUARIO_ACTUAL.rol` y `rol_display` ya no existe. No reintroducir el alias.

- **`ROLES_DIRECTIVOS_NIVEL`** y **`esDirectivoNivel(rol)`** (`js/nav.js`) — `directivo_nivel`, `secretario` y `vicedirector` comparten permisos y alcance de nivel. **Toda comparación `rol === 'directivo_nivel'` debe usar `esDirectivoNivel(rol)`**; los arrays de permisos incluyen los tres roles. Si agregás un chequeo de rol nuevo, no compares contra `'directivo_nivel'` a secas.
- **`esSuperAdmin(rol)`** — `super_admin` es el administrador de plataforma (Kairú), **no un actor institucional**. Reemplaza al rol huérfano `admin` (que no era asignable y quedó eliminado). No aparece en listados de usuarios (`_renderUsuarios` filtra con `.neq('rol','super_admin')`), no es asignable desde el modal, y **no pasa por `roles_permisos`**: siempre tiene acceso total.
- **`super_admin` e `institucion_id`**: en la BD es `NULL` (la columna pasó a nullable). Como casi todos los módulos consultan `USUARIO_ACTUAL.institucion_id`, `_fijarInstitucionActiva()` (auth.js) apunta ese campo **en memoria** a la institución activa. La fila de `usuarios` sigue con NULL. El selector de la topbar (`#tb-inst-selector`, `_renderSelectorInstitucion()` en main.js → `cambiarInstitucionActiva()` en auth.js) cambia de institución y recuerda la última en `localStorage` (`kairu_super_inst`). `login()`/`verificarSesion()` **eximen al super_admin** de `iniciarSetupInstitucional()` — sin esa excepción quedaría bloqueado en la pantalla de configuración inicial.
- **Etiquetas**: `director_general` es **"Director/a General"** (antes decía "Administrador", que ahora es sólo `super_admin`).

**Plantillas de permisos por institución** (`js/permisos.js` + tabla `roles_permisos`):
- Matriz **rol × módulo** con `ver`/`editar`/`eliminar`, editable en Configuración → Usuarios → **Roles y Permisos** (`_renderRolesPermisos` en configuracion.js, sólo `director_general`/`super_admin`). Sin override por usuario: el rol define todo.
- Resolución en `_permResolver()`: `super_admin` → siempre true; si hay fila en `roles_permisos` → se usa; **si no hay fila → fallback a `permisosDefault()`**, que replica el comportamiento previo. Por eso, si la migración no corrió, la app se comporta igual que siempre.
- **Alcance real hoy: sólo `ver` está cableado** — filtra el menú en `renderNav()` (vía `_navQuitarSeccionesVacias`) y protege `goPage()`. `editar`/`eliminar` se persisten y se editan en la matriz, pero **los módulos siguen usando sus arrays de rol históricos**. Adoptarlos es incremental; no hacerlo en bloque.
- A `director_general` no se le pueden editar los permisos (`_rpBloqueado()`), para que la institución no se quede sin administrador.
- Semillas: la migración siembra cada institución existente y un **trigger** (`instituciones_seed_permisos`) siembra las nuevas. `ON CONFLICT DO NOTHING`: re-ejecutar no pisa lo que la institución haya editado.

**RLS y `is_super_admin()`**: la v38 **no reescribe** las ~80 policies existentes. Como las policies permisivas se combinan con **OR**, agrega una policy `<tabla>_super_admin` por tabla que sólo habilita al super admin — así ninguna policy existente se toca y cubre también las creadas a mano en el dashboard. `is_super_admin()` es **`SECURITY DEFINER`** (obligatorio: consultar `usuarios` desde una policy sin eso provoca recursión infinita de RLS — ver v31). **El loop sólo agrega la policy en tablas que YA tienen RLS activo**: habilitar RLS en una tabla que hoy está abierta dejaría afuera a todos los usuarios normales.

### Roles y permisos
Los roles son: `super_admin` (plataforma), `director_general`, `directivo_nivel`, `vicedirector`, `secretario`, `eoe`, `docente`, `preceptor`. Ver la sección anterior — `vicedirector` y `secretario` son roles reales con los permisos de `directivo_nivel` por defecto.

El nav lateral (`nav.js`) y bottom nav mobile (`main.js`) se configuran por rol en `NAV_CONFIG` y `BOTTOM_NAV_ITEMS`. Cada módulo tiene su propia función `xxxPermisos()` que retorna un objeto de booleanos.

Los usuarios `docente` y `preceptor` tienen acceso a asistencia y calificaciones solo para sus cursos asignados. Las asignaciones de docente están en la tabla `asignaciones` (columnas: `docente_id`, `curso_id`, `materia_id`, `anio_lectivo`) — **no** en `docente_cursos`.

El rol `eoe` tiene acceso multi-nivel (igual que `director_general`) en asistencia y calificaciones, pero en modo **solo lectura** (sin botones de guardar/gestión del ciclo lectivo). En problemáticas puede agregar intervenciones tipificadas (`_EOE_TIPOS_INTERV`) pero NO puede cerrar/reabrir casos (`probPermisos().cerrar === false` para EOE). Cuando el tipo es "Derivación", el formulario embebe campos de derivación y guarda simultáneamente en `intervenciones` y `derivaciones`. En legajos puede ver y crear derivaciones (tab "Derivaciones" visible solo para EOE y directivos).

### Configuración — subsecciones anidadas en el sidebar principal (`js/configuracion.js` + `js/nav.js`)

El módulo `admin` ya **no** tiene menú propio dentro de la página. El ítem "Configuración" del sidebar principal (`nav.js`) es **expandible**: al hacer clic despliega, dentro del mismo menú lateral, los grupos y subsecciones de Configuración — igual que cualquier otro nav item con secciones, sin un menú aparte al costado del contenido. `#page-admin` solo pinta el título y el contenido de la subsección activa (a todo el ancho).

- **`CONFIG_GRUPOS`** (`configuracion.js`) — array de grupos, en este orden: `Institución`, `Parámetros académicos`, `Usuarios`, `Portal Familiar` (Parámetros va justo debajo de Institución a pedido explícito, no alfabético ni por prioridad de rol). Cada grupo tiene `items`; cada item tiene `roles` (array de roles con acceso) y, o bien un `renderer` directo, o un array `tabs` (cada tab con su propio `renderer` y, opcionalmente, `soloInicial: true` para ocultarlo si la institución/usuario no opera en nivel inicial, evaluado con `_paramTieneInicial()`). Los `tabs` se usan cuando dos vistas conviven en una misma subsección (Materias/Asignaciones, Docentes/Suplencias, Escalas y notas/Dimensiones) y se renderizan como una barra de tabs dentro del contenido (`_dispatchAdminItem()`, `#adm-item-tabs`, clases `.adm-tabs-bar`/`.adm-tab`) — **no** como filas nuevas del sidebar.
- **`_configGruposVisibles()`** filtra `CONFIG_GRUPOS` por rol + accesos extra (`config_extra.tabs`) y es la fuente de datos tanto para `nav.js` (qué grupos/subsecciones listar) como para `_dispatchAdminItem()` (qué renderizar). Devuelve los grupos en el orden de `CONFIG_GRUPOS`.
- **Sidebar principal (`nav.js`)** — árbol de dos niveles de despliegue, todo dentro del mismo `#sb-nav`:
  - `NAV_CONFIG` marca la entrada de Configuración con `expandable: true` en **las 4 definiciones de rol** que la incluyen (director_general, directivo_nivel, preceptor, admin) — si se agrega Configuración a un rol nuevo, no olvidar el flag, si no el ítem se renderiza como uno normal y no se puede desplegar.
  - `_renderNavExpandable(nav, item)` pinta la entrada raíz como `.nav-it` con chevron (`.ni-chev`) leyendo `_navAdminOpen`, y por cada grupo visible un header `.nav-subsec` (clickeable, con su propio chevron `.ns-chev`) leyendo `_navAdminGruposAbiertos`. **Importante**: el render solo *lee* ese estado, nunca lo fuerza a `true` — si lo hiciera (como pasó en una versión anterior), el toggle de plegar quedaría roto porque cada re-render volvería a forzarlo abierto. Abrir el árbol/grupo es responsabilidad exclusiva de los puntos de navegación (`rAdmin()`, `_irAItemAdmin()`, y el propio `onclick` del header cuando se navega desde otra página) — ver el punto "Navegación" más abajo.
  - Si un grupo está abierto, sus items se pintan dentro de un `.nav-subit-wrap` (ver `.nav-subtree` para la guía visual vertical) como `.nav-it.nav-subit`, que al clic llama `_irAItemAdmin(grupoId, itemId)`.
  - Los demás grupos arrancan colapsados y se expanden/colapsan libremente al clic, sin afectarse entre sí (no es acordeón exclusivo, pueden quedar varios abiertos a la vez).
  - En mobile no hay tratamiento especial: es el mismo `#sidebar` que ya se abre como overlay (`toggleMobileSidebar()`).
- **Estado** (`configuracion.js`): `_admGrupo` (grupo activo), `_admItem` (subsección activa), `_admItemTab` (tab interno activo si el item tiene `tabs`). **Estado** (`nav.js`): `_navAdminOpen` (árbol de Configuración desplegado), `_navAdminGruposAbiertos` (Set de ids de grupo desplegados dentro del árbol).
- **Navegación**: `_irAItemAdmin(grupoId, itemId)` (configuracion.js, invocada desde nav.js) setea `_admGrupo`/`_admItem`, marca `_navAdminOpen = true` y agrega el grupo a `_navAdminGruposAbiertos` (ahí, no en el render — ver arriba), y si ya se está en `admin` solo redespacha contenido + re-renderiza nav; si no, delega en `goPage('admin')`. `rAdmin()` hace lo mismo (`_navAdminOpen`/`_navAdminGruposAbiertos`) al resolver el grupo/item por defecto en la primera entrada a la página. `_irATabAdmin(tabId)` cambia el tab interno dentro de una subsección. **Cuidado con el orden de render**: `goPage()` llama a `renderNav()` *antes* de invocar `rAdmin()`, es decir con `_admGrupo`/`_admItem` todavía sin resolver en la primera entrada a la página — por eso `rAdmin()` vuelve a llamar `renderNav()` después de fijar los defaults, para que el grupo/item correctos quede expandido y resaltado en el sidebar. Si se toca este flujo, mantener ese segundo `renderNav()`.
- **Accesos extra por usuario** (`usuarios.config_extra.tabs`, feature de `director_general` para dar acceso puntual a una subsección fuera del rol): ids de **item** (`materias`, `docentes`, `param_asistencia`, `param_periodos`, `param_otros`, etc.), no de tab interno ni de grupo. `_LEGACY_TAB_ALIAS` traduce los ids viejos pre-reorganización (`asignaciones`→`materias`, `suplencias`→`docentes`, `parametros`→los 3 ids de Parámetros, `param_calificaciones`→`param_periodos`+`param_otros`) para no romper accesos otorgados antes de este refactor. **No extender este override** — está decidido que los accesos pasarán a plantilla por rol (Roles y Permisos) y `config_extra` se va a eliminar; se muestra en el modal de usuario pero sólo se persiste en edición (no en el alta), comportamiento heredado que se deja como está.
- **Modal de usuario del staff** (`_abrirModalUsuario`/`_guardarUsuario`, grupo "Usuarios"): además de rol/nivel/cursos/activo/en licencia, edita el **perfil completo** — foto (`_muSubirAvatar`/`_muQuitarAvatar`/`_muPintarAvatar`, sube a `institucion-assets/avatars/`), `fecha_nacimiento`, `fecha_ingreso`. En el **alta** hay un toggle de modo (`_muModo`, `_muOnModoChange`): **invitación por email** (default) o **contraseña temporal** — ver la sección "Autenticación" arriba para el detalle del flujo. El email es **obligatorio** en el alta (identidad de ingreso; ya no hay username autogenerado). En edición el email es read-only y se puede resetear la contraseña.
- **Parámetros académicos** tiene **3 subsecciones** (migración `migrations/migration_v37_ciclo_parametros.sql`; antes eran 2, y antes de eso una sola card combinada `_renderParamNivel`/`_guardarConfigAsistencia`, ya inexistentes):
  - **Asistencia** (`param_asistencia` → `_renderParamAsistencia` → `_renderParamAsistNivel` + `_guardarAsistenciaCfg`): **solo** umbrales de alerta y "justificadas cuentan", por nivel. Ya **no** incluye las listas de tipos (se mudaron a "Otros Parámetros").
  - **Períodos y escalas** (`param_periodos` → `_renderParamPeriodos`, selector de nivel por chips → `_renderParamCalifNivel(nivel)`), **todo por nivel dentro de una sola vista** (no hay tabs). Por nivel renderiza, de arriba a abajo: escalas/notas (`_guardarCalifCfg`; inicial solo texto informativo), **períodos evaluativos** con inicio/fin **y `fecha_cierre_programada`** (input extra, alimenta el contador del inicio), y —solo primario/secundario (`usaCierres`)— **Cierre de período** (`_cerrarPeriodoEvaluativo`, ver abajo), **Intensificación** (institucional Res. 1650/2024, reutiliza `_nuevoPeriodoIntensif`/`_toggleActivoPeriodo`/`_eliminarPeriodoIntensif`, que ahora re-renderizan `_renderParamCalifNivel`) y —solo secundario— **Cierre anual/Promoción** (`_verCierreAnualConf`). Cuando el nivel es **inicial**, al final aparece la card de **Dimensiones** (reutiliza `_renderListaDims`/`_agregarDim`/`_quitarDim`, que ahora re-renderizan `_renderParamCalifNivel('inicial')`); ya no existe `_renderParamDimensiones` ni el tab suelto "Dimensiones (Inicial)".
  - **Otros Parámetros** (`param_otros` → `_renderParamOtros`): listas **globales** (no por nivel). Compone `_renderParamAsistOtros()` (justificación, eventos de agenda, problemática, intervención) + `_renderParamCalifTipos()` (tipos de instancia evaluativa) en sus propios divs. Cualquier alta/baja/edición de estos 5 tipos refresca ambos bloques vía `_refrescarTiposGlobales()`.
- **Cierre de período por nivel** (`_cerrarPeriodoEvaluativo(nivel, periodoId, mitad)` en configuracion.js): reemplaza al viejo `_cerrarCuatrimestreConf` (C1/C2 institucional, eliminado). Cierra el período configurado **de ese nivel**: confirma, y delega en el motor de calificaciones `_cerrarCuatrimestreTrayectoria(cuatrimestre, opts)` con `{nivelFiltro, periodoEvaluativoId, sinConfirm, sinReRender}`. **`mitad`** (1 ó 2) es el cuatrimestre al que pertenece el período según su orden dentro del nivel — se calcula igual que el motor (`i < Math.ceil(N/2) ? 1 : 2`), así el motor sigue razonando en C1/C2 (semántica intacta: Q1 = intensificación intra-año, Q2 = recursada al año siguiente) sin rediseñar la lógica académica. El motor ahora acepta `opts` (backward-compatible: sin opts = comportamiento anterior, usado por los botones C1/C2 de Calificaciones), scopea `cursos` por `nivelFiltro`, hace el chequeo de cierre existente **array-based + nivel-aware** (antes `.maybeSingle()`, que rompía con varias filas del mismo `tipo`), y guarda `nivel` + `periodo_evaluativo_id` en `cierres_periodo`.
- **Pendiente** (no implementado, ver el spec de reorganización si se retoma): ítem plano "Apps" (activación de módulos), "Roles y Permisos" (hoy sigue siendo el array `roles` hardcodeado en `CONFIG_GRUPOS`), y Organigrama. "Portal Familiar" quedó con una sola subsección ("Usuarios", = la vieja `_renderFamilias` sin cambios). La Apariencia institucional (logo + color) sí se implementó — ver más abajo.

### Ciclo Lectivo (slim) + activación del sistema por nivel (`js/configuracion.js`)

Configuración → Institución → **Ciclo Lectivo** (`_renderCicloLectivo`) quedó **solo con el calendario institucional**: fechas de inicio/fin del ciclo (`instituciones.fecha_inicio_ciclo`/`fecha_fin_ciclo`, sin cambios) + **Activación del sistema por nivel**. Se le **quitaron** intensificación, cierre de cuatrimestre y cierre anual (se mudaron a Parámetros → Períodos y escalas).

- **Activación por nivel**: antes `instituciones.fecha_activacion` era un único valor institucional (y no lo consumía ningún contador). Ahora es **`config_asistencia.fecha_activacion`** (columna nueva, una por institución+nivel). Cada nivel se activa/reactiva por separado (`_activarSistemaNivel`/`_reactivarSistemaNivel` → `_setActivacionNivel`, upsert en `config_asistencia`). La migración v37 copia el valor viejo de `instituciones.fecha_activacion` a los niveles existentes.
- **Contadores conectados de verdad**: los contadores de asistencia y las alertas por inasistencia de cada nivel **empiezan desde su activación**. En `asistencia.js`, `_asistDesde(nivel)` devuelve `CONFIG_ASIST[nivel].fecha_activacion` (o el 1-ene del ciclo como fallback) y reemplaza el viejo `${anio}-01-01` en `verCursoDirector`, `mostrarGrillaDirector`, `mostrarGrillaPreceptor` y `verificarAlertas`; en `verAlumnoAsist` el nivel se conoce recién tras el fetch, así que se recorta la ventana en memoria. En `dashboard.js`, la query anual (per-nivel) trae desde el 1-ene y se recorta a `config_asistencia.fecha_activacion`.
- **Contador de cierre programado** (`dashboard.js` → `_renderAvisoCierre`): aviso con cuenta regresiva cuando faltan ≤15 días para la `fecha_cierre_programada` de un período del nivel del usuario. Se pinta en el placeholder `#dash-aviso-cierre` (incluido en los dashboards de **directivo_nivel, docente y preceptor**) y se dispara una sola vez desde `rDash()` tras el despacho (no-op si el rol no tiene el placeholder). Filtra por `USUARIO_ACTUAL.nivel`.
- **Cumpleaños del equipo** (`dashboard.js` → `_renderAvisoCumples`): mismo patrón que el aviso de cierre — placeholder `#dash-cumples`, disparado desde `rDash()` con `.catch(() => {})`. Lista los cumpleaños del staff (`usuarios.fecha_nacimiento`, excluye rol `familia` e inactivos) de hoy y los próximos `_CUMPLES_VENTANA_DIAS` (7) días, máx. 6, ordenados por proximidad; el de hoy se marca con `.tag.tg` y avatar verde. A diferencia del aviso de cierre, el placeholder está en **los 5 dashboards** (director, directivo, eoe, docente, preceptor). Compara sólo día/mes (ignora el año) y **no muestra la edad** a propósito.

### Apariencia institucional — logo y color de marca (`js/configuracion.js` + `js/main.js`)

Dentro de Configuración → Institución → General hay una card "Apariencia" (`_renderInstitucion()`, debajo de "Datos de la institución") con dos ajustes que aplican **para todos los usuarios de la institución** — a diferencia de las Preferencias personales (ver más abajo, que son por navegador):

- **Logo** (`instituciones.logo_url`, columna que ya existía en el schema pero no se usaba en ningún lado hasta ahora): `_subirLogoInstitucion(input)` comprime la imagen a máx. 300px vía canvas (`_comprimirLogo`, PNG para preservar transparencia — no JPEG, a diferencia de `_avisosComprimir` en avisos.js que sí usa JPEG para fotos) y la sube al bucket de Supabase Storage `institucion-assets` (mismo patrón que el bucket `comunicados` de avisos.js: `path = institucion_id/archivo`, `sb.storage.from(bucket).upload()` + `.getPublicUrl()`). **El bucket `institucion-assets` hay que crearlo a mano una vez desde el dashboard de Supabase** (Storage → New bucket → público) — no existe todavía y no hay migración que lo cree, igual que `comunicados`. **Además del bucket, hace falta correr las políticas RLS de `storage.objects`** al final de `migrations/apariencia_institucional.sql` (INSERT/UPDATE/DELETE para `authenticated` en ese bucket): "Public bucket" en el dashboard solo habilita la *lectura* anónima vía `getPublicUrl()`, la subida sigue pasando por RLS y sin esas políticas falla con "row-level security policy" (bug real: el mensaje de error anterior decía genéricamente "el bucket tiene que existir", lo que llevaba a pensar que alcanzaba con crear el bucket — `_subirLogoInstitucion` ahora muestra el `e.message` real de Supabase en el alert para que esta causa no quede oculta). `_quitarLogoInstitucion()` solo borra la columna (no borra el archivo del bucket, huérfano intencional para no complicar). El logo se pinta en `#sb-inst-logo` (sidebar) reemplazando la inicial-avatar; `iniciarApp()` en main.js decide `<img>` vs. letra según `INSTITUCION_ACTUAL.logo_url` en cada arranque.
- **Color de marca** (`instituciones.tema_color`, columna nueva — ver `migrations/apariencia_institucional.sql`): `PALETA_TEMA_INSTITUCION` en main.js define 6 swatches curados (verde/azul/violeta/teal/naranja/rosa). Click en un swatch (`_seleccionarColorTema(hex)`) guarda directo en la BD (sin botón "Guardar" propio, mismo patrón que Orientaciones) y aplica el color al toque vía `_aplicarTemaInstitucion(hex)`.
- **Mecanismo de aplicación** (`main.js`): `_aplicarTemaInstitucion(hex)` calcula un tono más oscuro con `_shadeColor(hex, -0.15)` y pisa dos variables CSS en `:root` — `--acento` y `--acento-m` — que **por defecto apuntan a `--verde`/`--verde-m`** (ver `:root` en `css/app.css`). Se llama una vez en `iniciarApp()` con `INSTITUCION_ACTUAL.tema_color`.
- **Qué toca `--acento` y qué NO**: a propósito, `--acento` solo se usa en componentes de "marca" — `.btn-p`, `.chip.on`, `.tog.on`, `.tb-av` (avatar de perfil en la topbar), `.sb-inst-logo`, `.mc::after`, foco de `input`/`textarea`/`select`, `.adm-tab.on` (tabs internos de Configuración). **Nunca** se tocan los colores de estado/semánticos (`.tag.tg/.td`, `.nota-ok`, `.notif-dot.success`, `.re-aceptada`, badges de asistencia/calificaciones, toasts de confirmación) — esos siguen usando `var(--verde)` literal siempre, para no perder el significado "verde = éxito/positivo" aunque la institución elija otro color de marca. Tampoco se toca el login (`.btn-ing`, `.l-hint`, `.l-inst-*`) porque ahí todavía no hay institución identificada. Si se agrega un componente nuevo de UI que deba seguir la marca, usar `var(--acento)`; si es un estado/resultado, usar el color semántico que corresponda, nunca `--acento`.

### Topbar — hora, notificaciones, preferencias y perfil (`index.html` + `js/main.js`)

La topbar (`.tb-right`) tiene, en este orden de izquierda a derecha: **hora** (`#tb-clock`, se oculta en mobile), **notificaciones** (`.notif-btn`), **preferencias** (`.pref-btn`, ícono de sliders en SVG inline, no emoji) y **perfil** (`.tb-perfil-btn`, avatar circular con iniciales — `.tb-av`). Notificaciones y preferencias comparten la clase `.tb-icon-btn` (botón circular ~34px, mismo lenguaje visual); el perfil usa su propio círculo con `background:var(--acento)` para distinguirse como identidad, no como acción.

- Los tres paneles flotantes (`#notif-panel`, `#pref-panel`, `#perfil-panel`) son mutuamente excluyentes: abrir uno cierra los otros dos (`toggleNotifPanel()` en ui.js; `togglePrefPanel()`/`togglePerfilPanel()` en main.js). Los tres se cierran al clickear afuera (listener global en main.js).
- **Panel de perfil** (`#perfil-panel`, `togglePerfilPanel()`): avatar + nombre + rol (poblados en `iniciarApp()`, los mismos datos que antes vivían en el card `.sb-user` del sidebar) y el botón **"Cerrar sesión"** (`cerrarSesion()`, auth.js) — es el único lugar de la UI donde se cierra sesión ahora.
- **El sidebar quedó solo con el menú**: `.sb-top` (logo Kairú) + `.sb-inst-badge` (institución) + `.sb-nav` (el nav en sí). Se eliminaron `.sb-user` (avatar/nombre/rol) y `.sb-bottom` (botones "Instalar app"/"Cerrar sesión") — esa identidad y esas acciones ahora viven en la topbar (perfil) y en Preferencias. Esas clases ya no existen en `css/app.css`; no reintroducirlas.

### Preferencias personales — tema, tamaño de letra e instalar app (`js/main.js`)

El ícono de sliders en la topbar (`.pref-btn`) abre `#pref-panel`, mismo patrón de panel flotante que `#notif-panel` (`togglePrefPanel()`, cierre al clickear afuera). **Tema y tamaño de letra son preferencias por navegador/dispositivo** (localStorage, claves `kairu_tema` y `kairu_font_scale`), no por usuario en la BD — no sincronizan entre dispositivos a propósito (decisión tomada para mantenerlo simple).

- **Tema** (claro/oscuro): `_setTema(oscuro)` → `_aplicarModoOscuro()` (toggle de la clase `.dark` en `body`) + guarda en localStorage.
- **Tamaño de letra** (`FONT_SCALES = { chico: 0.9, normal: 1, grande: 1.15 }`): aplicado con **`document.documentElement.style.zoom`** (en `<html>`, no en `<body>`), no con `font-size`/`rem`. Se eligió `zoom` a propósito porque toda la hoja de estilos usa `px` fijos (no hay una base `rem` de la que escalar). **Cuidado con `vh`/`vw` bajo `zoom`**: cualquier `vh`/`vw` dentro del subárbol que se está escalando queda desalineado del viewport real (bug real encontrado en producción: el sidebar se veía cortado/roto al achicar la letra, porque `.sidebar{height:100vh}` — con `min-height:100vh` en `#shell` y `body` — recalculaba contra el viewport físico en vez de contra su contenedor ya escalado). El fix fue reemplazar esa cadena por porcentajes con altura **explícita** (no `min-height`) en cada eslabón: `html{height:100%}`, `body{height:100%}`, `#shell{height:100%}` (no `min-height` — un `min-height` no alcanza para que los hijos flex resuelvan `height:100%` de forma definida), `.sidebar{height:100%}`. El scroll de contenido largo lo sigue absorbiendo `.content{overflow-y:auto}` internamente, así que el shell puede quedar con altura fija sin romper páginas largas. Si se toca esta cadena de nuevo, verificar con Playwright que `sidebar.getBoundingClientRect().height === window.innerHeight` en zoom 0.9 y 1.15 antes de dar por buena una modificación — la sidebar mobile (`@media max-width:768px`, `position:fixed; height:100vh`) quedó sin tocar, no se verificó el mismo bug ahí.
- **Instalar app** (PWA): el botón que antes vivía fijo en el sidebar (`#btn-instalar-pwa`) ahora es una entrada condicional del panel de Preferencias, agregada por `_renderPrefPanel()` solo si `_pwaDisponible` es `true`. Ese flag (declarado en el script inline al final de `index.html`, junto a `_pwaPrompt`/`_yaInstalada`) se actualiza en los listeners `beforeinstallprompt`/`appinstalled` y en `instalarPWA()`, llamando a `_renderPrefPanel()` si existe para refrescar el panel en caliente. Como el botón ya no es un elemento fijo del DOM, no usar un patrón de `document.getElementById('btn-instalar-pwa').hidden = ...` — el estado disponible/no-disponible siempre pasa por `_pwaDisponible`.
- **Al cargar la página**: `_cargarPreferencias()` se ejecuta al parsear `main.js` (no espera a `iniciarApp()`/login) para que el tema y tamaño ya se vean correctos incluso en la pantalla de login, sin flash del estado por defecto.
- Si se necesitara en el futuro que estas preferencias sincronicen entre dispositivos, habría que migrar a una columna en `usuarios` — hoy es explícitamente solo-localStorage.

## Base de datos — tablas clave

| Tabla | Descripción |
|---|---|
| `usuarios` | Perfiles (vinculados a Supabase Auth por `id`). **Cols de perfil** (`migrations/usuarios_perfil_invitacion.sql`): `avatar_url` (foto; respaldo `avatar_iniciales`; se sube a `institucion-assets/avatars/<institucion_id>/<ts>.png` reutilizando el bucket y las RLS del logo), `fecha_nacimiento`, `fecha_ingreso`, `debe_cambiar_password` (bool; true = creado con contraseña temporal, la app obliga a definir una propia al primer ingreso). Las altas nuevas ya **no** generan `username` (queda para los usuarios de prueba viejos) |
| `instituciones` | Datos institucionales. `logo_url` (ya existía en el schema, sin usar hasta la sección "Apariencia"; escrita/leída desde `js/configuracion.js`). `tema_color` (nuevo, hex del color de marca — ver sección "Apariencia institucional"). `fecha_activacion` **quedó en desuso** (la activación pasó a `config_asistencia.fecha_activacion` por nivel — ver "Ciclo Lectivo slim"); `fecha_inicio_ciclo`/`fecha_fin_ciclo` siguen vigentes |
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
| `cierres_periodo` | Registro del cierre de período por la institución. Se indexa por `tipo` (text: `cuatrimestre_1`/`cuatrimestre_2`; la col `cuatrimestre` int del schema original quedó en desuso). **Cols v37**: `nivel`, `periodo_evaluativo_id` (referencia al período real cerrado desde el cierre por nivel). Puede haber varias filas del mismo `tipo`, una por nivel |
| `periodos_evaluativos` | Períodos evaluativos por institución+nivel(+`anio`), con `nombre`/`fecha_inicio`/`fecha_fin`. **Col v37**: `fecha_cierre_programada` (fecha de cierre administrativo; alimenta el contador de ≤15 días del inicio). Gestionados desde Parámetros → Períodos y escalas |
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
| `roles_permisos` | Plantillas de permisos por institución (`migrations/migration_v38_roles_permisos.sql`). `UNIQUE(institucion_id, rol, modulo_id)`, con `ver`/`editar`/`eliminar`. `modulo_id` = id del nav (`prob`, `asist`, `admin`, …). Sembrada por `seed_roles_permisos()` + trigger en `instituciones`. Ver "Roles, permisos y administrador de plataforma" |
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
| `fecha_activacion` | todos | **(v37)** timestamptz de activación del sistema **por nivel**; los contadores de asistencia y las alertas por inasistencia del nivel arrancan desde acá (fallback: 1-ene del ciclo). Ver "Ciclo Lectivo slim" |

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