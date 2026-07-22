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

## Perfil de navegante ampliado

Campos adicionales en `profiles` (todos nullable):

- **Datos náuticos:** `club` (texto libre por ahora; cuando existan cuentas `club`/`federation` migrará a una relación `club_id`), `sailing_class` (clase en la que navega, texto libre), `usual_role` (rol habitual a bordo), `location` (zona de navegación).
- **Redes / contacto:** `instagram` (solo el handle, sin `@` ni URL), `facebook` y `youtube` (URL o handle), `website` (URL completa con `http(s)://`, CHECK suave en DB).
- La **sanitización fuerte va en el backend** (PUT `/profile/:id`): trim, límites de longitud, normalización del handle de Instagram (quita `@`/URL) y validación de URLs; el frontend arma las URLs públicas a partir del dato crudo.
- **Estadísticas** públicas por `GET /profile/:id/stats`: `boats_owned`, `crews_joined` (aceptadas) y `member_since`.

## Sistema de regatas (alcance actual)

Modelo estándar de la vela (respetarlo tal cual):

- Una **regata** (`regattas`) es el **evento/campeonato** (ej: "Campeonato de Verano 2026"). **No tiene clase propia.**
- Un campeonato tiene varias **clases** (`regatta_classes`, flotas/divisiones: Snipe, ILCA, …). **Cada clase corre por separado**, con sus propias mangas, inscripciones, resultados, descartes (`discards_count`), cupo (`max_entries`) y **estado propio** (una clase puede estar en curso y otra ya terminada).
- Las **mangas** (`races`) y las **inscripciones** (`regatta_entries`) cuelgan de la **clase** (`regatta_class_id`), no de la regata. La numeración de mangas es **por clase** (cada clase arranca en 1).
- El `status` de `regattas` es un estado **paraguas informativo**; el que manda para inscripción y resultados es el **de cada clase**.
- Los barcos se **inscriben a una clase**. Solo pueden inscribirse barcos cuya **clase (`boats.category`) coincida** con `regatta_classes.sailing_class`.
- Cada manga produce una **posición** por barco (`race_results`). Puntaje **Low Point System**: posición = puntos (1º = 1 pt), gana quien **menos** suma.
- El resultado final es la **suma de puntos** de las mangas por barco, con **descartes** por clase: se descartan las N peores mangas (mayor puntaje). Los descartes **solo aplican a partir de un umbral** de mangas completadas (default: 4); con menos mangas no se descarta nada aunque `discards_count > 0`. Se expone **total bruto y neto** y qué mangas fueron descartadas.
- Códigos especiales de la vela (`DNF`, `DNS`, `DSQ`, `DNC`, `OCS`, `RET`) puntúan como **cantidad de inscriptos + 1**.
- **Estados de regata:** `upcoming` (creada) → `open` (inscripciones abiertas) → `in_progress` → `finished`, o `cancelled`.
- **Permisos** granulares nuevos: `regattas.create`, `regattas.edit`, `regattas.delete`, `regattas.manage_results`. Enforcement en el backend con service role; RLS bloquea escritura directa de clientes.
- La inscripción la hace el **owner** del barco; puede **retirarse** (`status='withdrawn'`).
- El **historial de regatas** de un navegante (estilo LinkedIn) alimenta la sección de logros del perfil: `GET /api/users/:id/regatta-history`.

## Sistema de clasificados (alcance actual)

- Los **clasificados** (`classifieds`) permiten publicar búsquedas u ofertas de `tripulante`, `profesor`, `barco` u `otro`, con título, descripción y ubicación. `location_worldwide` indica si el anuncio no está limitado a una zona.
- Cada clasificado vence automáticamente a los **30 días** mediante `expires_at`. Sus estados son `active`, `expired` y `archived`; `archived` significa que el autor lo archivó manualmente antes del vencimiento. `renewed_at` registra la última renovación.
- Los requisitos se modelan en `classified_requirements`, sin columnas específicas por tipo: cada fila tiene `requirement_type` (`sailing_class`, `experience_level`, `role`, `language` o `availability`) y `requirement_value`. No se puede repetir el mismo tipo y valor dentro de un clasificado.
- El matching genera sugerencias en `classified_matches`, con un `match_score` de 0 a 100, y garantiza una sola sugerencia por usuario y clasificado. El cálculo debe usar los datos náuticos del perfil (`sailing_class`, `usual_role` y, cuando exista, `language`) y otros criterios definidos por el backend.
- Un usuario puede expresar interés una sola vez por clasificado mediante `classified_interests`, opcionalmente con un mensaje. El autor puede leer quién se interesó; el interesado puede leer su propio registro.
- Lectura pública: solo clasificados activos y sus requisitos. Los clasificados vencidos o archivados, sus requisitos, intereses y matches quedan limitados por RLS a los perfiles autorizados. Las escrituras de requisitos y matches se realizan exclusivamente desde el backend con service role; la autoridad siempre es el backend.
- La función `public.expire_classifieds()` marca como `expired` los anuncios activos cuyo `expires_at` ya pasó. El backend debe invocarla al consultar el listado y, cuando Supabase Cron esté configurado, también una vez por noche.

## Convenciones

- **Puertos:** backend en `3001`, frontend en `3000`.
- **Auth:** Supabase Auth + JWT propio firmado con `JWT_SECRET`.
- **Seguridad:** todas las tablas con **Row Level Security (RLS)** habilitado.
- **TypeScript estricto** en todo el código (`strict: true`).
- **Git:** commits pequeños y descriptivos.
