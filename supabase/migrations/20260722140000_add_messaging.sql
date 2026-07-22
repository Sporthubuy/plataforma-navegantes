-- Mensajería directa entre navegantes.
--
-- Cierra el circuito del buscador: hoy encontrás a alguien y no tenés
-- cómo escribirle. Un mensaje es además la notificación, así que no
-- hace falta un sistema de avisos aparte.
--
-- Es 1 a 1 a propósito: los grupos exigen invitaciones, nombres y roles,
-- y nada de eso hace falta para "¿te sumás al barco?".

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  -- Par ordenado: user_a siempre es el uuid menor. Junto con el UNIQUE
  -- de abajo garantiza UNA sola conversación por pareja, sin importar
  -- quién escribió primero.
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  -- Denormalizado para poder ordenar la bandeja sin tocar messages.
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create index conversations_user_a_idx on public.conversations (user_a, last_message_at desc);
create index conversations_user_b_idx on public.conversations (user_b, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  -- null = sin leer. Es lo que alimenta el badge de la campana.
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx
  on public.messages (conversation_id, created_at desc);
-- Contar sin leer sin recorrer toda la tabla.
create index messages_unread_idx
  on public.messages (conversation_id, sender_id)
  where read_at is null;

-- Cada mensaje sube la conversación al tope de la bandeja.
create or replace function public.trg_touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return null;
end;
$$;

create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.trg_touch_conversation();

-- ============================================================
-- RLS
-- ============================================================
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Solo los dos participantes ven la conversación. Las escrituras van
-- por el backend con service role, que valida quién es quién.
create policy "conversations_select_own"
  on public.conversations for select
  using (auth.uid() = user_a or auth.uid() = user_b);

create policy "messages_select_own"
  on public.messages for select
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.user_a or auth.uid() = c.user_b)
    )
  );

comment on table public.conversations is
  'Conversación 1 a 1. user_a < user_b garantiza una sola por pareja.';
comment on column public.messages.read_at is
  'null = sin leer. Alimenta el contador de la campana.';
