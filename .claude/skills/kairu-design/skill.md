---
name: kairu-design
description: Sistema de diseño de Kairu Soluciones Integrales. Usar SIEMPRE cuando se trabaje en la interfaz de Kairu — componentes UI, CSS, estilos, colores, tipografía, layouts, modales, tablas, formularios, badges, botones, sidebar, nav mobile. Aplica automáticamente cuando el usuario pide mejorar, crear o modificar cualquier elemento visual del proyecto Kairu.
---

# Kairu Design System — Brand Book v2.0

## Stack técnico
- Vanilla JS + HTML/CSS (sin frameworks)
- Sin Tailwind — CSS nativo con variables CSS
- Hosting: Cloudflare Pages

---

## Colores

### Variables CSS a usar SIEMPRE

```css
:root {
  /* Primarios */
  --color-dark:        #1B2B22;  /* Sidebar, textos principales, fondos premium */
  --color-green:       #229957;  /* Acento principal, CTAs, highlights */
  --color-bg:          #F4F6F2;  /* Fondo base app */
  --color-white:       #FFFFFF;  /* Cards, formularios, superficies */
  --color-mint:        #E6F5EE;  /* Fondos de badges positivos */

  /* Textos / neutros */
  --color-text-medium: #4A6355;  /* Texto secundario, subtítulos */
  --color-text-muted:  #7D9487;  /* Labels, placeholders, hints */
  --color-text-faint:  #B0C4BA;  /* Textos deshabilitados, separadores */
  --color-surface-2:   #F7F9F6;  /* Cards secundarias, fondos de tabla */

  /* Estados */
  --color-success:     #229957;  --color-success-bg: #E6F5EE;
  --color-warning:     #C4860A;  --color-warning-bg: #FEF7E8;
  --color-danger:      #D63B2F;  --color-danger-bg:  #FEF0EF;
  --color-info:        #1A6C9E;  --color-info-bg:    #EAF3FB;

  /* Niveles educativos */
  --color-inicial:     #8B5CF6;
  --color-primaria:    #1A6C9E;
  --color-secundaria:  #229957;
}
```

---

## Tipografía

**Familias:**
- `'DM Sans', sans-serif` — interfaz principal (toda la UI)
- `'DM Mono', monospace` — labels de sistema, códigos, timestamps, badges, metadatos

**Escala:**

| Token    | Familia  | Size / Weight | Letter-spacing | Uso |
|----------|----------|---------------|----------------|-----|
| Display  | DM Sans  | 32px / 800    | -0.03em        | Títulos de pantalla |
| H1       | DM Sans  | 22px / 700    | -0.02em        | Encabezados de sección |
| H2       | DM Sans  | 18px / 600    | -0.01em        | Subtítulos de cards |
| Body     | DM Sans  | 14px / 400    | 0              | Texto y contenido |
| Small    | DM Sans  | 12px / 400    | 0              | Descripciones, hints |
| Label    | DM Mono  | 10px / 500    | 0.12em         | Labels de formulario |
| Data     | DM Mono  | 12px / 400    | 0.04em         | Datos técnicos, timestamps |

---

## Border Radius

```css
--radius-sm:   6px;   /* Botones pequeños */
--radius-tag:  8px;   /* Tags, inputs */
--radius-md:   10px;  /* Inputs principales */
--radius-card: 14px;  /* Cards */
--radius-pill: 20px;  /* Badges / pills */
--radius-full: 9999px;
```

---

## Espaciado

Escala: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 60 · 80`

Uso frecuente en Kairu:
- Gap entre elementos de form: `8px`
- Padding interno de cards: `20–24px`
- Padding de sección: `80px 60px`
- Separador entre secciones del sidebar: `4px`

---

## Componentes

### Botón primario
```css
.btn-primary {
  background: var(--color-green);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  padding: 10px 20px;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(34,153,87,0.35);
  cursor: pointer;
}
```

### Botón secundario
```css
.btn-secondary {
  background: var(--color-surface-2);
  color: var(--color-dark);
  border: 1px solid rgba(0,0,0,0.10);
  border-radius: var(--radius-sm);
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
```

### Botón destructivo
```css
.btn-danger {
  background: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid rgba(214,59,47,0.15);
  border-radius: var(--radius-sm);
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
```

### Input / Campo de formulario
```css
.form-label {
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  color: var(--color-text-muted);
  letter-spacing: 0.1em;
  margin-bottom: 5px;
  display: block;
}

.form-input {
  border: 1.5px solid rgba(0,0,0,0.10);
  border-radius: var(--radius-tag);
  padding: 10px 14px;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  color: var(--color-dark);
  background: #fff;
  width: 100%;
  transition: border-color 0.12s, box-shadow 0.12s;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-green);
  box-shadow: 0 0 0 3px rgba(34,153,87,0.10);
}
```

### Badge / Status pill
```css
.badge {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  font-weight: 500;
  display: inline-block;
}
.badge-success  { background: var(--color-success-bg); color: var(--color-success); border: 1px solid rgba(34,153,87,0.16); }
.badge-warning  { background: var(--color-warning-bg); color: var(--color-warning); border: 1px solid rgba(196,134,10,0.16); }
.badge-danger   { background: var(--color-danger-bg);  color: var(--color-danger);  border: 1px solid rgba(214,59,47,0.16); }
.badge-info     { background: var(--color-info-bg);    color: var(--color-info);    border: 1px solid rgba(26,108,158,0.16); }
```

### Card
```css
.card {
  background: #fff;
  border-radius: var(--radius-card);
  border: 1px solid rgba(0,0,0,0.06);
  padding: 20px 24px;
}
```

### Sidebar (estructura Kairu)
```css
.sidebar {
  position: fixed;
  left: 0; top: 0; bottom: 0;
  width: 220px;
  background: var(--color-dark);
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 100;
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 10px;
  color: rgba(255,255,255,0.45);
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.12s;
}

.sidebar-link:hover,
.sidebar-link.active {
  background: rgba(255,255,255,0.1);
  color: #fff;
}
```

### Nav mobile (bottom bar)
```css
.bottom-nav {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: 60px;
  background: var(--color-dark);
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 8px;
  z-index: 100;
  border-top: 1px solid rgba(255,255,255,0.08);
}

.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  color: rgba(255,255,255,0.4);
  font-size: 10px;
  font-family: 'DM Sans', sans-serif;
  padding: 6px 12px;
  border-radius: 10px;
  transition: all 0.12s;
}

.bottom-nav-item.active {
  color: var(--color-green);
  background: rgba(34,153,87,0.12);
}
```

---

## Roles de usuario y acceso visual

Kairu tiene 4 roles con distintos accesos:

| Rol        | Color referencia | Módulos principales |
|------------|-----------------|---------------------|
| Director   | --color-dark    | Todo el sistema |
| Preceptor  | --color-info    | Asistencia, Alumnos, Calificaciones (lectura) |
| Docente    | --color-green   | Calificaciones por materia, Asistencia horaria |
| EOE        | #8B5CF6         | Legajos, Intervenciones |

---

## Niveles educativos

| Nivel      | Color           | Variable CSS          |
|------------|-----------------|----------------------|
| Inicial    | #8B5CF6         | --color-inicial      |
| Primaria   | #1A6C9E         | --color-primaria     |
| Secundaria | #229957         | --color-secundaria   |

---

## Tonos de escritura (microcopia)

**Sí:**
- "Ingresar" (no "Acceder al sistema →")
- "Usuario o contraseña incorrectos" (no "Credenciales inválidas")
- "¿Eliminás este registro? Esta acción no se puede deshacer." (tuteamos)
- "Cargando alumnos..." (no "Por favor aguardá mientras el sistema procesa")

**Reglas:**
- Tuteo siempre
- Sin jerga técnica
- Conciso y directo
- Labels en DM Mono, todo en mayúsculas con letter-spacing

---

## Logo / Isotipo

El isotipo de Kairu es un SVG inline:
```html
<svg width="32" height="32" viewBox="0 0 48 48" fill="none">
  <circle cx="24" cy="24" r="22" stroke="#229957" stroke-width="2.5"/>
  <rect x="13" y="13" width="6" height="22" fill="#1B2B22"/>
  <polygon points="19,24 19,13 33,13 25.5,24" fill="#1B2B22"/>
  <polygon points="19,24 19,35 33,35 25.5,24" fill="#1B2B22"/>
  <rect x="33" y="32" width="4" height="4" fill="#229957"/>
</svg>
```

Variantes de color del isotipo:
- Sobre oscuro (#1B2B22): circle stroke `#229957`, formas K en `#fff`
- Sobre claro (#F4F6F2): circle stroke `#1B2B22`, formas K en `#1B2B22`
- Sobre verde (#229957): circle stroke `rgba(255,255,255,0.6)`, formas K en `#fff`

---

## Nombre del producto

- Nombre oficial: **Kairu** (no Kairos, no EduGestión)
- Subtítulo: *Soluciones Integrales*
- En código monoespaciado: `[KAIRU]`
- Tagline de producto: Sin tagline definido — usar descripción directa de funcionalidad

---

## Anti-patrones a evitar

- ❌ No usar Inter, Roboto, Arial — solo DM Sans y DM Mono
- ❌ No usar gradientes de colores ajenos a la paleta
- ❌ No usar sombras excesivas (máximo `box-shadow: 0 2px 8px rgba(...)`)
- ❌ No rotar ni distorsionar el logo
- ❌ No usar border-radius mayor a 20px en cards (rompe el look institucional)
- ❌ No usar colores fuera de la paleta definida para estados