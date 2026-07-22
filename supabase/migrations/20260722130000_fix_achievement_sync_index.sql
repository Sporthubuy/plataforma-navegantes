-- El índice de idempotencia era parcial (WHERE regatta_class_id is not
-- null) y ON CONFLICT no puede apoyarse en un índice parcial sin repetir
-- su cláusula, cosa que el cliente de Supabase no expone.
--
-- Un índice completo hace exactamente lo mismo: en Postgres los NULL son
-- distintos entre sí por defecto, así que los logros manuales (que van
-- con regatta_class_id null) siguen pudiendo repetirse sin chocar.

drop index if exists public.regatta_achievements_sync_idx;

create unique index regatta_achievements_sync_idx
  on public.regatta_achievements (user_id, regatta_class_id);
