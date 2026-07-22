'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, MessageSquare, Send } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api, getApiError, refreshBadges } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { EmptyState } from '@/components/empty-state';
import { relativeTime } from '@/lib/format';
import type { Conversation, ConversationThread } from '@/lib/types';

/** Lista de conversaciones — la bandeja. */
function Inbox({
  conversations,
  activeId,
  onSelect,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col divide-y divide-navy-50">
      {conversations.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onSelect(c.id)}
            className={`focus-ring flex w-full items-start gap-3 p-3 text-left transition ${
              activeId === c.id ? 'bg-water-50' : 'hover:bg-navy-50'
            }`}
          >
            <Avatar
              src={c.other?.avatar_url}
              name={c.other?.username ?? '?'}
              className="h-10 w-10 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-navy-900">
                  {c.other?.name || c.other?.username || 'Usuario eliminado'}
                </span>
                <span className="shrink-0 text-[11px] text-navy-400">
                  {relativeTime(c.last_message_at)}
                </span>
              </p>
              <p className="mt-0.5 flex items-center gap-2">
                <span
                  className={`truncate text-xs ${
                    c.unread_count > 0
                      ? 'font-semibold text-navy-800'
                      : 'text-navy-400'
                  }`}
                >
                  {c.last_message?.body ?? 'Sin mensajes'}
                </span>
                {c.unread_count > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-water-600 px-1.5 text-[10px] font-bold text-white">
                    {c.unread_count}
                  </span>
                )}
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** El hilo abierto, con el compositor abajo. */
function Thread({
  thread,
  meId,
  onSent,
  onBack,
}: {
  thread: ConversationThread;
  meId: string;
  onSent: () => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Un chat se lee desde abajo: al abrirlo y al llegar algo nuevo.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [thread.messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !thread.conversation.other) return;

    setSending(true);
    try {
      await api.post('/api/messages', {
        recipient_id: thread.conversation.other.id,
        body,
      });
      setDraft('');
      onSent();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo enviar el mensaje'));
    } finally {
      setSending(false);
    }
  }

  const other = thread.conversation.other;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-navy-100 p-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver a la bandeja"
          className="focus-ring rounded-lg p-1.5 text-navy-500 hover:bg-navy-50 lg:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {other && (
          <Link
            href={`/profile/${other.id}`}
            className="focus-ring flex min-w-0 items-center gap-2 rounded-lg"
          >
            <Avatar
              src={other.avatar_url}
              name={other.username}
              className="h-9 w-9 shrink-0"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-navy-900">
                {other.name || other.username}
              </span>
              <span className="block truncate text-xs text-navy-400">
                @{other.username}
              </span>
            </span>
          </Link>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        <ul className="flex flex-col gap-2">
          {thread.messages.map((m) => {
            const mine = m.sender_id === meId;
            return (
              <li
                key={m.id}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                    mine
                      ? 'bg-navy-800 text-white'
                      : 'bg-navy-50 text-navy-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                  <p
                    className={`mt-0.5 text-[10px] ${
                      mine ? 'text-white/60' : 'text-navy-400'
                    }`}
                  >
                    {relativeTime(m.created_at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <div ref={endRef} />
      </div>

      <form
        onSubmit={send}
        className="flex items-end gap-2 border-t border-navy-100 p-3"
      >
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          maxLength={4000}
          placeholder="Escribí un mensaje…"
          className="flex-1 resize-none"
          onKeyDown={(e) => {
            // Enter envía; Shift+Enter hace salto de línea.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(e as unknown as FormEvent);
            }
          }}
        />
        <Button
          type="submit"
          size="sm"
          disabled={sending || !draft.trim()}
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

/**
 * `useSearchParams` obliga a que la página se resuelva en el cliente,
 * así que el contenido va dentro de un Suspense propio.
 */
export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="text-navy-400">Cargando…</p>
        </AppShell>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}

function MessagesContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<ConversationThread | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  const fetchInbox = useCallback(async (): Promise<Conversation[]> => {
    const res = await api.get('/api/messages');
    return res.data.conversations;
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchInbox()
      .then((list) => {
        if (cancelled) return;
        setConversations(list);
        // ?c= abre una conversación puntual (viene de "Contactar").
        const wanted = params.get('c');
        setActiveId(wanted ?? list[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setConversations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user, fetchInbox, params]);

  const loadThread = useCallback((id: string) => {
    api
      .get(`/api/messages/${id}`)
      .then((res) => {
        setThread(res.data);
        // El backend acaba de marcarlos leídos: que el badge se entere.
        refreshBadges();
      })
      .catch(() => setThread(null));
  }, []);

  useEffect(() => {
    if (activeId) loadThread(activeId);
  }, [activeId, loadThread]);

  if (loading || !user) {
    return (
      <AppShell>
        <p className="text-navy-400">Cargando…</p>
      </AppShell>
    );
  }

  const refreshAll = () => {
    if (activeId) loadThread(activeId);
    fetchInbox()
      .then(setConversations)
      .catch(() => undefined);
  };

  return (
    <AppShell width="wide">
      <h1 className="sr-only">Mensajes</h1>

      {conversations !== null && conversations.length === 0 ? (
        <EmptyState
          title="Todavía no tenés mensajes"
          subtitle="Buscá tripulantes o entrenadores y escribiles desde su perfil."
          icon={<MessageSquare className="h-10 w-10 text-navy-300" />}
          actions={[{ label: 'Buscar tripulación', href: '/talent' }]}
        />
      ) : (
        <div className="h-[calc(100vh-12rem)] overflow-hidden rounded-2xl border border-navy-100 bg-white lg:grid lg:grid-cols-[20rem_minmax(0,1fr)]">
          {/* En móvil se ve la bandeja o el hilo, nunca los dos. */}
          <div
            className={`h-full overflow-y-auto border-navy-100 lg:block lg:border-r ${
              thread ? 'hidden' : 'block'
            }`}
          >
            {conversations === null ? (
              <p className="p-3 text-sm text-navy-400">Cargando…</p>
            ) : (
              <Inbox
                conversations={conversations}
                activeId={activeId}
                onSelect={setActiveId}
              />
            )}
          </div>

          <div className={`h-full ${thread ? 'block' : 'hidden lg:block'}`}>
            {thread ? (
              <Thread
                thread={thread}
                meId={user.id}
                onSent={refreshAll}
                onBack={() => {
                  setThread(null);
                  setActiveId(null);
                }}
              />
            ) : (
              <p className="p-6 text-sm text-navy-400">
                Elegí una conversación.
              </p>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
