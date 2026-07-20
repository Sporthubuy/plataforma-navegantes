import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../lib/async-handler';
import { isNonEmptyString } from '../lib/validation';
import { normalizeUsername } from './users';

const router = Router();

const MEMBER_WITH_USER =
  'id, boat_id, role, status, invited_at, responded_at, user:profiles(id, username, name, avatar_url)';

/**
 * POST /api/crew/invite — requiere auth.
 * Body: { boat_id, username, role }. Solo el dueño del barco invita.
 */
router.post(
  '/invite',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { boat_id, username, role } = req.body ?? {};

    if (!isNonEmptyString(boat_id)) {
      return res.status(400).json({ error: 'boat_id es obligatorio' });
    }
    if (!isNonEmptyString(username)) {
      return res.status(400).json({ error: 'username es obligatorio' });
    }
    if (!isNonEmptyString(role)) {
      return res.status(400).json({ error: 'El puesto (role) es obligatorio' });
    }

    const { data: boat, error: boatError } = await supabaseAdmin
      .from('boats')
      .select('id, owner_id')
      .eq('id', boat_id)
      .maybeSingle();

    if (boatError) throw boatError;
    if (!boat) {
      return res.status(404).json({ error: 'Barco no encontrado' });
    }
    if (boat.owner_id !== req.user!.id) {
      return res
        .status(403)
        .json({ error: 'Solo el dueño del barco puede invitar tripulantes' });
    }

    const normalized = normalizeUsername(username);
    const { data: invitee, error: inviteeError } = await supabaseAdmin
      .from('profiles')
      .select('id, username')
      .eq('username', normalized)
      .maybeSingle();

    if (inviteeError) throw inviteeError;
    if (!invitee) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (invitee.id === req.user!.id) {
      return res
        .status(422)
        .json({ error: 'No puedes invitarte a ti mismo' });
    }

    const { data: existing } = await supabaseAdmin
      .from('crew_members')
      .select('id, status')
      .eq('boat_id', boat.id)
      .eq('user_id', invitee.id)
      .maybeSingle();

    if (existing) {
      const detail =
        existing.status === 'accepted'
          ? 'Ya es tripulante de este barco'
          : existing.status === 'pending'
            ? 'Ya tiene una invitación pendiente a este barco'
            : 'Ya fue invitado a este barco';
      return res.status(409).json({ error: detail });
    }

    const { data, error } = await supabaseAdmin
      .from('crew_members')
      .insert({ boat_id: boat.id, user_id: invitee.id, role: role.trim() })
      .select(MEMBER_WITH_USER)
      .single();

    if (error) {
      if (error.code === '23505') {
        return res
          .status(409)
          .json({ error: 'Ya existe una invitación para este usuario' });
      }
      throw error;
    }
    return res.status(201).json({ crew_member: data });
  })
);

/**
 * GET /api/crew/invitations — requiere auth.
 * Mis invitaciones pendientes con datos del barco y su dueño.
 */
router.get(
  '/invitations',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('crew_members')
      .select(
        'id, role, invited_at, boat:boats(id, name, sail_number, category, photo_url, owner:profiles(id, username, name, avatar_url))'
      )
      .eq('user_id', req.user!.id)
      .eq('status', 'pending')
      .order('invited_at', { ascending: false });

    if (error) throw error;
    return res.json({ invitations: data ?? [] });
  })
);

/** Acepta o rechaza una invitación; solo el usuario invitado. */
async function respondInvitation(
  req: Request,
  res: Response,
  status: 'accepted' | 'rejected'
) {
  const { data: invitation, error } = await supabaseAdmin
    .from('crew_members')
    .select('id, user_id, status')
    .eq('id', req.params.id)
    .maybeSingle();

  if (error) throw error;
  if (!invitation) {
    return res.status(404).json({ error: 'Invitación no encontrada' });
  }
  if (invitation.user_id !== req.user!.id) {
    return res
      .status(403)
      .json({ error: 'Solo el usuario invitado puede responder' });
  }
  if (invitation.status !== 'pending') {
    return res.status(409).json({ error: 'La invitación ya fue respondida' });
  }

  const { data, error: updateError } = await supabaseAdmin
    .from('crew_members')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', invitation.id)
    .select(MEMBER_WITH_USER)
    .single();

  if (updateError) throw updateError;
  return res.json({ crew_member: data });
}

router.put(
  '/invitations/:id/accept',
  requireAuth,
  asyncHandler((req, res) => respondInvitation(req, res, 'accepted'))
);

router.put(
  '/invitations/:id/reject',
  requireAuth,
  asyncHandler((req, res) => respondInvitation(req, res, 'rejected'))
);

/**
 * DELETE /api/crew/:id — el dueño del barco quita a un tripulante,
 * o el propio tripulante se sale del barco.
 */
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { data: member, error } = await supabaseAdmin
      .from('crew_members')
      .select('id, user_id, boat:boats(owner_id)')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!member) {
      return res.status(404).json({ error: 'Tripulante no encontrado' });
    }

    const boatOwner = (member.boat as { owner_id?: string } | null)?.owner_id;
    const isSelf = member.user_id === req.user!.id;
    const isOwner = boatOwner === req.user!.id;

    if (!isSelf && !isOwner) {
      return res.status(403).json({
        error: 'Solo el dueño del barco o el propio tripulante pueden hacer esto',
      });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('crew_members')
      .delete()
      .eq('id', member.id);

    if (deleteError) throw deleteError;
    return res.status(204).send();
  })
);

export default router;
