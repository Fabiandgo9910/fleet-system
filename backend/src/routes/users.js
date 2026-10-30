/** GESTIÓN DE USUARIOS Y ROLES (solo super_admin). */
import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { HttpError, throwDb } from '../lib/errors.js';
import { normalizePhone } from '../lib/phone.js';
import { requireRole, clearAuthCache } from '../middleware/auth.js';

const router = Router();
router.use(requireRole('super_admin'));

const roleEnum = z.enum(['super_admin', 'admin', 'driver', 'client']);

router.get('/', async (_req, res) => {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  throwDb(error);
  res.json(data);
});

/** Crea el usuario en Supabase Auth + su perfil (+ ficha de conductor si procede). */
router.post('/', async (req, res) => {
  const b = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(72),
    full_name: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(25).optional().or(z.literal('')),
    role: roleEnum,
  }).parse(req.body);

  const { data: auth, error: ae } = await supabase.auth.admin.createUser({
    email: b.email, password: b.password, email_confirm: true,
  });
  if (ae) throw new HttpError(400, ae.message.includes('already') ? 'Ese email ya existe.' : ae.message);

  const { error: pe } = await supabase.from('profiles').insert({
    id: auth.user.id, full_name: b.full_name, role: b.role, phone: b.phone ? normalizePhone(b.phone) : null,
  });
  if (pe) { await supabase.auth.admin.deleteUser(auth.user.id); throwDb(pe); } // rollback manual
  if (b.role === 'driver') await supabase.from('drivers').insert({ profile_id: auth.user.id });
  res.status(201).json({ id: auth.user.id });
});

/** Cambia rol, nombre, teléfono o activa/desactiva. */
router.patch('/:id', async (req, res) => {
  const b = z.object({
    full_name: z.string().trim().min(2).max(120).optional(),
    phone: z.string().trim().max(25).optional(),
    role: roleEnum.optional(),
    active: z.boolean().optional(),
  }).parse(req.body);

  // Seguridad: un super admin no puede quitarse a sí mismo el rol ni desactivarse.
  if (req.params.id === req.user.id && (b.role || b.active === false)) {
    throw new HttpError(400, 'No puedes cambiar tu propio rol ni desactivarte.');
  }
  const patch = { ...b, ...(b.phone !== undefined && { phone: b.phone ? normalizePhone(b.phone) : null }) };
  const { error } = await supabase.from('profiles').update(patch).eq('id', req.params.id);
  throwDb(error);
  if (b.role === 'driver') await supabase.from('drivers').upsert({ profile_id: req.params.id }, { onConflict: 'profile_id', ignoreDuplicates: true });
  clearAuthCache(); // los cambios de rol/estado se aplican al instante
  res.json({ ok: true });
});

/** Restablece la contraseña de un usuario. */
router.post('/:id/password', async (req, res) => {
  const { password } = z.object({ password: z.string().min(8).max(72) }).parse(req.body);
  const { error } = await supabase.auth.admin.updateUserById(req.params.id, { password });
  if (error) throw new HttpError(400, error.message);
  res.json({ ok: true });
});

export default router;
