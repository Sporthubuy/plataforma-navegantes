import { Router } from 'express';
import { supabaseAdmin, supabaseAnon } from '../lib/supabase';
import { signToken } from '../lib/jwt';
import { asyncHandler } from '../lib/async-handler';
import {
  isValidEmail,
  isValidPassword,
  isValidUsername,
} from '../lib/validation';
import { getUserPermissions } from '../middleware/permissions';

const router = Router();

/**
 * POST /api/auth/register
 * Crea el usuario en Supabase Auth y su fila en `profiles`.
 * Si falla el insert del perfil, hace rollback del usuario auth.
 */
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password, username, name } = req.body ?? {};

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }
    if (!isValidPassword(password)) {
      return res
        .status(400)
        .json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    if (!isValidUsername(username)) {
      return res.status(400).json({
        error:
          'Username inválido (3-20 caracteres: minúsculas, números o guion bajo)',
      });
    }

    // ¿Username ya en uso?
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'El username ya está en uso' });
    }

    // 1. Crear usuario en Supabase Auth.
    const { data: created, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !created?.user) {
      return res.status(400).json({
        error: authError?.message ?? 'No se pudo crear el usuario',
      });
    }

    const userId = created.user.id;

    // 2. Crear la fila en profiles.
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        username,
        name: typeof name === 'string' && name.trim() ? name.trim() : null,
      });

    // 3. Rollback si falla el insert del perfil.
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      const isDuplicate = profileError.code === '23505';
      return res.status(isDuplicate ? 409 : 500).json({
        error: isDuplicate
          ? 'El username ya está en uso'
          : 'No se pudo crear el perfil',
      });
    }

    const token = signToken(userId);
    return res.status(201).json({
      token,
      user: { id: userId, email, username },
    });
  })
);

/**
 * POST /api/auth/login
 * Verifica credenciales con Supabase Auth y devuelve JWT + datos del usuario.
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};

    if (!isValidEmail(email) || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email o contraseña inválidos' });
    }

    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const userId = data.user.id;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, username, name, bio, avatar_url, account_type, status')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.status === 'suspended') {
      return res.status(403).json({ error: 'Cuenta suspendida' });
    }

    const permissions = await getUserPermissions(userId);

    const token = signToken(userId);
    return res.json({
      token,
      user: {
        id: userId,
        email: data.user.email,
        ...profile,
      },
      permissions,
    });
  })
);

/**
 * POST /api/auth/forgot-password
 * Envía un correo de recuperación de contraseña.
 * Responde siempre 200 para no revelar si el email existe.
 */
router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { email } = req.body ?? {};

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    await supabaseAnon.auth.resetPasswordForEmail(email);

    return res.json({
      message:
        'Si el email existe, recibirás instrucciones para recuperar tu contraseña',
    });
  })
);

export default router;
