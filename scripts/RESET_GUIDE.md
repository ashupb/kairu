# Guía de reset y configuración de demo — Kairu

Proceso para limpiar datos de prueba y dejar la app lista para una demo o para que una institución real empiece a cargar sus datos.

---

## Cuándo usar cada script

| Script | Cuándo usarlo |
|---|---|
| `reset_total.sql` + `seed_demo.sql` | Empezar absolutamente desde cero (borra institución, usuarios, todo) |
| `reset_datos.sql` | Limpiar alumnos y actividades pero conservar la institución y los usuarios ya configurados |

---

## Proceso completo (desde cero)

### Paso 1 — Reset total

1. Ir a [Supabase](https://supabase.com) → proyecto Kairu → **SQL Editor**
2. Abrir y ejecutar `scripts/reset_total.sql`
3. Verificar que el resultado diga `Reset total completado` y que los NOTICE muestren `OK` para las tablas existentes

### Paso 2 — Seed de la institución

1. En el mismo SQL Editor, abrir y ejecutar `scripts/seed_demo.sql`
2. Verificar los NOTICE:
   - `Institución creada: <uuid>` — confirma que se creó la institución
   - `Perfil admin vinculado: <uuid>` — confirma que tu cuenta quedó vinculada

### Paso 3 — Verificar acceso

1. Abrir `index.html` en el navegador (o Live Server)
2. Ingresar con `aperezbenary@gmail.com` y la contraseña habitual
3. Deberías ver el dashboard con la institución "Institución Educativa Kairú"

---

## Proceso parcial (conservar institución y usuarios)

Usar cuando la institución ya tiene usuarios y configuración y solo se quieren limpiar los datos académicos (alumnos, asistencia, notas, actividades EOE).

1. Ir a Supabase → SQL Editor
2. Ejecutar `scripts/reset_datos.sql`
3. La app queda con la misma institución y usuarios, lista para recargar alumnos, cursos y materias

---

## Qué NO se borra nunca

- Las **cuentas de Supabase Auth** (email + contraseña) — nunca se tocan con estos scripts
- Los **buckets de Storage** (imágenes subidas) — borrar manualmente desde Supabase → Storage si es necesario

## Qué conserva reset_datos (no borra)

- `instituciones`
- `usuarios`
- `config_asistencia`
- `tipos_justificacion`, `tipos_problematicas`, `tipos_intervencion`
- `tipos_evaluacion`, `tipos_evento`, `tipos_instancia_evaluativa`
- `orientaciones`

---

## Solución de errores frecuentes

**"Usuario admin no encontrado"**
→ El email en el script no coincide con el registrado en Auth. Editar la línea `WHERE email = '...'` en `seed_demo.sql`.

**"duplicate key value violates unique constraint"**
→ Ya hay datos en alguna tabla. Correr `reset_total.sql` primero.

**Error en columna específica durante el seed**
→ La tabla puede tener una columna requerida no incluida en el INSERT. Revisar el schema en Supabase → Table Editor y ajustar el script.

---

## Configuración post-seed desde la app

Una vez ingresada como admin, completar desde **Configuración**:

- [ ] Ajustar escalas de calificación por nivel (primario: numérica, secundario: numérica)
- [ ] Agregar cursos para el ciclo lectivo 2026
- [ ] Agregar materias por nivel
- [ ] Agregar usuarios (docentes, preceptores, EOE)
- [ ] Asignar docentes a cursos y materias
- [ ] Cargar alumnos por curso
