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

## Fase 1 (completada)

1. **Registro de cuenta** — email, password, username.
2. **Login.**
3. **Recuperar contraseña.**
4. **Perfil personalizable** — avatar, username, nombre, bio. Editable **solo por el dueño**.
5. **Home** con feed de noticias/posts.

## Fase 2 (alcance actual): fotos, barcos y tripulaciones

1. **Fotos de perfil** — bucket de Supabase Storage `avatars` (lectura pública; solo autenticados suben; solo el dueño actualiza/borra sus archivos).
2. **Fotos de barcos** — bucket `boats` con las mismas políticas.
3. **Barcos** (tabla `boats`) — cada barco pertenece a un perfil (`owner_id`): nombre, número de vela, categoría/clase (ej: "Optimist", "Laser", "J/24", "Crucero"), foto.
4. **Tripulaciones** (tabla `crew_members`) — el dueño de un barco invita perfiles con un puesto (`role`: "Timonel", "Proa", "Táctico", "Trimmer", …). El invitado acepta o rechaza (`status`: `pending` / `accepted` / `rejected`). Una persona no puede ser invitada dos veces al mismo barco.

### Usernames

- En la base se guardan **sin `@`** — el `@` es solo presentación en el frontend.
- Formato: **minúsculas, números y guión bajo, 3-20 caracteres** (`^[a-z0-9_]{3,20}$`), con CHECK constraint en `profiles.username`.

## Fase 3 (alcance actual): sistema de administración

Diseño (respetarlo tal cual):

- **Dos conceptos separados:** el *rol de plataforma* (qué permisos tiene el usuario en el sistema) y el *tipo de cuenta* (`profiles.account_type`: qué es la entidad — `sailor` navegante individual, `club` u `federation` organizaciones).
- **Permisos granulares:** cada usuario tiene una **lista de permisos** en la tabla `user_permissions` (no un rol único). Catálogo inicial: `users.view`, `users.suspend`, `users.delete`, `users.grant_permissions`, `boats.view_all`, `boats.edit_all`, `boats.create_all`.
- Hoy hay **un solo administrador** (el dueño), pero el modelo soporta varios.
- **Suspensión:** `profiles.status` (`active`/`suspended`) + `suspended_at` y `suspended_reason`. Un usuario suspendido queda bloqueado de toda la API (403 "Cuenta suspendida") pero su perfil sigue siendo legible.
- **Actividad:** `profiles.last_active_at`, actualizado por el backend en requests autenticados (throttle ~5 min) para métricas de "activos hoy".
- **Enforcement siempre en el backend** con la service role key (`requirePermission`). El frontend recibe la lista de permisos solo para decidir qué UI mostrar — nunca es la autoridad.
- Escrituras directas de clientes a `user_permissions` bloqueadas por RLS; solo el backend (service role) la modifica.

## Convenciones

- **Puertos:** backend en `3001`, frontend en `3000`.
- **Auth:** Supabase Auth + JWT propio firmado con `JWT_SECRET`.
- **Seguridad:** todas las tablas con **Row Level Security (RLS)** habilitado.
- **TypeScript estricto** en todo el código (`strict: true`).
- **Git:** commits pequeños y descriptivos.
