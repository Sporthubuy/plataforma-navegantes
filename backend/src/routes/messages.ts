/**
 * Mensajería directa 1 a 1.
 *
 * La conversación se identifica por la pareja de usuarios, no por un id
 * que haya que crear antes: escribirle a alguien por primera vez y
 * responderle son la misma operación.
 */

import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../lib/async-handler';
import { isNonEmptyString } from '../lib/validation';

const router = Router();

const MAX_BODY = 4000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const PARTICIPANT_FIELDS = 'id, username, name, avatar_url';

/** Ordena la pareja: user_a es siempre el uuid menor (lo exige el CHECK). */
function orderedPair(x: string, y: string): { user_a: string; user_b: string } {
  return x < y ? { user_a: x, user_b: y } : { user_a: y, user_b: x };
}

/**
 * Devuelve la conversación con ese usuario, creándola si es la primera
 * vez. Absorbe la carrera de dos primeros mensajes simultáneos: si el
 * insert choca con el UNIQUE, se relee la que ganó.
 */
async function findOrCreateConversation(me: string, other: string) {
  const pair = orderedPair(me, other);

  const { data: existing } = await supabaseAdmin
    .from('conversations')
    .select('id, user_a, user_b')
    .eq('user_a', pair.user_a)
    .eq('user_b', pair.user_b)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from('conversations')
    .insert(pair)
    .select('id, user_a, user_b')
    .single();

  if (error?.code === '23505') {
    const { data: raced } = await supabaseAdmin
      .from('conversations')
      .select('id, user_a, user_b')
      .eq('user_a', pair.user_a)
      .eq('user_b', pair.user_b)
      .single();
    return raced;
  }
  if (error) throw error;
  return data;
}

/** La conversación si el usuario participa; si no, responde 403/404. */
async function conversationForUser(
  conversationId: string,
  userId: string,
  res: import('express').Response
) {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('id, user_a, user_b')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    res.status(404).json({ error: 'Conversación no encontrada' });
    return null;
  }
  if (data.user_a !== userId && data.user_b !== userId) {
    res.status(403).json({ error: 'No participás de esta conversación' });
    return null;
  }
  return data;
}

/**
 * GET /api/messages/unread — cuántos mensajes sin leer tengo.
 * La usa el badge de la campana, así que tiene que ser barata.
 */
router.get(
  '/unread',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!.id;

    const { data: convs } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .or(`user_a.eq.${me},user_b.eq.${me}`);

    const ids = (convs ?? []).map((c) => c.id);
    if (ids.length === 0) return res.json({ unread: 0 });

    const { count } = await supabaseAdmin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', ids)
      .neq('sender_id', me)
      .is('read_at', null);

    return res.json({ unread: count ?? 0 });
  })
);

/**
 * GET /api/messages — bandeja de entrada: una fila por conversación con
 * el otro participante, el último mensaje y los sin leer.
 */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!.id;

    const { data: convs, error } = await supabaseAdmin
      .from('conversations')
      .select('id, user_a, user_b, last_message_at')
      .or(`user_a.eq.${me},user_b.eq.${me}`)
      .order('last_message_at', { ascending: false });

    if (error) throw error;
    if (!convs || convs.length === 0) return res.json({ conversations: [] });

    const ids = convs.map((c) => c.id);
    const otherIds = convs.map((c) => (c.user_a === me ? c.user_b : c.user_a));

    const [{ data: profiles }, { data: messages }] = await Promise.all([
      supabaseAdmin.from('profiles').select(PARTICIPANT_FIELDS).in('id', otherIds),
      // Todos los mensajes de mis conversaciones: son pocas y así se
      // resuelve el último y los sin leer sin N consultas.
      supabaseAdmin
        .from('messages')
        .select('id, conversation_id, sender_id, body, read_at, created_at')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false }),
    ]);

    type MessageRow = NonNullable<typeof messages>[number];

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const lastByConv = new Map<string, MessageRow>();
    const unreadByConv = new Map<string, number>();

    for (const m of messages ?? []) {
      if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m);
      if (m.sender_id !== me && m.read_at === null) {
        unreadByConv.set(
          m.conversation_id,
          (unreadByConv.get(m.conversation_id) ?? 0) + 1
        );
      }
    }

    return res.json({
      conversations: convs.map((c) => {
        const otherId = c.user_a === me ? c.user_b : c.user_a;
        return {
          id: c.id,
          last_message_at: c.last_message_at,
          other: profileById.get(otherId) ?? null,
          last_message: lastByConv.get(c.id) ?? null,
          unread_count: unreadByConv.get(c.id) ?? 0,
        };
      }),
    });
  })
);

/**
 * POST /api/messages — escribirle a alguien.
 * Body: { recipient_id, body }. Crea la conversación si no existía.
 */
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const { recipient_id, body } = req.body ?? {};

    if (!isNonEmptyString(recipient_id)) {
      return res.status(400).json({ error: 'Falta el destinatario' });
    }
    if (recipient_id === me) {
      return res.status(422).json({ error: 'No podés escribirte a vos mismo' });
    }
    if (!isNonEmptyString(body)) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
    }
    if (body.trim().length > MAX_BODY) {
      return res
        .status(422)
        .json({ error: `El mensaje no puede superar los ${MAX_BODY} caracteres` });
    }

    // Un destinatario inexistente o suspendido no debe recibir nada.
    const { data: recipient } = await supabaseAdmin
      .from('profiles')
      .select('id, status')
      .eq('id', recipient_id)
      .maybeSingle();

    if (!recipient) {
      return res.status(404).json({ error: 'El destinatario no existe' });
    }
    if (recipient.status !== 'active') {
      return res.status(422).json({ error: 'Esa cuenta no está activa' });
    }

    const conversation = await findOrCreateConversation(me, recipient_id);
    if (!conversation) {
      return res.status(500).json({ error: 'No se pudo abrir la conversación' });
    }

    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: me,
        body: body.trim(),
      })
      .select('id, conversation_id, sender_id, body, read_at, created_at')
      .single();

    if (error) throw error;
    return res
      .status(201)
      .json({ message: data, conversation_id: conversation.id });
  })
);

/**
 * GET /api/messages/:conversationId — el hilo. Marca como leídos los
 * mensajes del otro: abrir la conversación es haberla leído.
 *
 * `?after=<ISO>` devuelve solo lo posterior a esa fecha, para que el
 * refresco periódico del hilo abierto no vuelva a traer todo.
 */
router.get(
  '/:conversationId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const conversation = await conversationForUser(
      req.params.conversationId,
      me,
      res
    );
    if (!conversation) return;

    const rawLimit = Number(req.query.limit);
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
        : DEFAULT_LIMIT;

    const after = typeof req.query.after === 'string' ? req.query.after : '';
    const incremental = after !== '' && !Number.isNaN(Date.parse(after));

    let query = supabaseAdmin
      .from('messages')
      .select('id, conversation_id, sender_id, body, read_at, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (incremental) query = query.gt('created_at', after);

    const { data: messages, error } = await query;
    if (error) throw error;

    const otherId =
      conversation.user_a === me ? conversation.user_b : conversation.user_a;
    const { data: other } = await supabaseAdmin
      .from('profiles')
      .select(PARTICIPANT_FIELDS)
      .eq('id', otherId)
      .maybeSingle();

    // Marcar leído no debe hacer fallar la lectura del hilo.
    await supabaseAdmin
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversation.id)
      .neq('sender_id', me)
      .is('read_at', null);

    return res.json({
      conversation: { id: conversation.id, other: other ?? null },
      // Se devuelven en orden cronológico: es como se lee un chat.
      messages: (messages ?? []).reverse(),
    });
  })
);

export default router;
