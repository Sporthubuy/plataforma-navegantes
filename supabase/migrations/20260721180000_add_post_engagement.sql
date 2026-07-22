-- Engagement de posts: "me gusta" y "guardados".
-- Ambas son relaciones usuario↔post con UNIQUE, así el toggle es idempotente.

-- ============================================================
-- post_likes
-- ============================================================
create table public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index post_likes_post_id_idx on public.post_likes (post_id);
create index post_likes_user_id_idx on public.post_likes (user_id);

alter table public.post_likes enable row level security;

-- Los likes son públicos (se muestran contadores).
create policy "post_likes_select_public"
  on public.post_likes for select using (true);

-- Cada usuario da/quita solo su propio like.
create policy "post_likes_insert_own"
  on public.post_likes for insert
  with check (auth.uid() = user_id);

create policy "post_likes_delete_own"
  on public.post_likes for delete
  using (auth.uid() = user_id);

-- ============================================================
-- post_saves (guardados: privados)
-- ============================================================
create table public.post_saves (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index post_saves_post_id_idx on public.post_saves (post_id);
create index post_saves_user_id_idx on public.post_saves (user_id);

alter table public.post_saves enable row level security;

-- A diferencia de los likes, lo guardado solo lo ve su dueño.
create policy "post_saves_select_own"
  on public.post_saves for select
  using (auth.uid() = user_id);

create policy "post_saves_insert_own"
  on public.post_saves for insert
  with check (auth.uid() = user_id);

create policy "post_saves_delete_own"
  on public.post_saves for delete
  using (auth.uid() = user_id);

comment on table public.post_likes is
  'Me gusta de un post. Público: alimenta el contador visible en el feed.';
comment on table public.post_saves is
  'Posts guardados por un usuario. Privado: solo su dueño los lee.';
