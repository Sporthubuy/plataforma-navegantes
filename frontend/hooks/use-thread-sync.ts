'use client';

import { useEffect, useRef } from 'react';
import { api, refreshBadges } from '@/lib/api';
import type { DirectMessage } from '@/lib/types';

/**
 * Cada cuánto se pregunta por mensajes nuevos con la pestaña a la vista.
 * Cinco segundos se siente inmediato en una conversación y, al pedir
 * solo lo posterior al último mensaje, cada consulta devuelve vacío
 * casi siempre.
 */
const POLL_MS = 5000;

/**
 * Mantiene el hilo abierto al día.
 *
 * No usa Supabase Realtime porque la app firma su propio JWT (no hay
 * sesión de Supabase en el navegador), así que una suscripción directa
 * sería rechazada por RLS. Llegar ahí implica rehacer la autenticación,
 * no agregar un socket.
 *
 * Solo consulta con la pestaña visible: una conversación que nadie está
 * mirando no necesita refrescarse, y además evita marcar como leído lo
 * que el usuario todavía no vio.
 */
export function useThreadSync(
  conversationId: string | null,
  /** Fecha del último mensaje que ya se tiene. */
  lastMessageAt: string | null,
  onNewMessages: (messages: DirectMessage[]) => void
) {
  // En refs para que cambiarlos no reinicie el temporizador.
  const lastRef = useRef(lastMessageAt);
  const callbackRef = useRef(onNewMessages);

  useEffect(() => {
    lastRef.current = lastMessageAt;
  }, [lastMessageAt]);

  useEffect(() => {
    callbackRef.current = onNewMessages;
  }, [onNewMessages]);

  useEffect(() => {
    if (!conversationId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function check() {
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        const res = await api.get(`/api/messages/${conversationId}`, {
          params: lastRef.current ? { after: lastRef.current } : {},
        });
        const incoming: DirectMessage[] = res.data.messages ?? [];
        if (cancelled || incoming.length === 0) return;

        lastRef.current = incoming[incoming.length - 1].created_at;
        callbackRef.current(incoming);
        // El backend acaba de marcarlos leídos.
        refreshBadges();
      } catch {
        // Un fallo puntual de red no debe cortar el ciclo.
      }
    }

    function schedule() {
      timer = setTimeout(async () => {
        await check();
        if (!cancelled) schedule();
      }, POLL_MS);
    }

    // Volver a la pestaña no debería esperar al próximo ciclo.
    function onVisible() {
      if (document.visibilityState === 'visible') void check();
    }

    document.addEventListener('visibilitychange', onVisible);
    schedule();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [conversationId]);
}
