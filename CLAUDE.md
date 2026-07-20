# CLAUDE.md

Contexto del proyecto para Claude Code. Léelo antes de cualquier tarea y respeta el stack, la estructura y las convenciones aquí definidas.

## Proyecto

Plataforma web estilo red social para **navegantes** (nombre aún por definir).

- **Enfoque:** Mobile-first, diseño responsive. Diseña primero para pantallas pequeñas y escala hacia arriba.

## Stack

| Capa | Tecnología | Ubicación |
|------|-----------|-----------|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS | `/frontend` |
| Backend | Node.js + Express + TypeScript | `/backend` |
| Base de datos y auth | Supabase | gestionada por CLI |

### Supabase

- Gestionada **por CLI**, no por el dashboard.
- **Todos los cambios de schema van por migraciones.** Nunca modificar el schema desde el dashboard.
- Las migraciones viven versionadas en el repositorio.

## Fase 1 (alcance actual)

Lo que estamos construyendo ahora:

1. **Registro de cuenta** — email, password, username.
2. **Login.**
3. **Recuperar contraseña.**
4. **Perfil personalizable** — avatar, username, nombre, bio. Editable **solo por el dueño**.
5. **Home** con feed de noticias/posts.

## Convenciones

- **Puertos:** backend en `3001`, frontend en `3000`.
- **Auth:** Supabase Auth + JWT propio firmado con `JWT_SECRET`.
- **Seguridad:** todas las tablas con **Row Level Security (RLS)** habilitado.
- **TypeScript estricto** en todo el código (`strict: true`).
- **Git:** commits pequeños y descriptivos.
