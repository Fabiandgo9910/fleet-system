/** CONDUCTORES: stock, efectivo y baterías viejas (solo administradores). */
import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { throwDb } from '../lib/errors.js';
import { adminOnly } from '../middleware/auth.js';
import { emitToAdmins, emitToUser } from '../realtime/socket.js';

const router = Router();
router.use(adminOnly);

router.get('/', async (_req, res) => {
  const { data, error } = await supabase.from('profiles')
    .select('id, full_name, phone, active, driver:drivers(battery_stock, cash_collected, old_batteries_received)')
    .eq('role', 'driver').order('full_name');
  throwDb(error);
  res.json(data);
});

/** Ajusta el stock (+ añade / - resta). */
router.post('/:id/stock', async (req, res) => {
  const { delta, reason } = z.object({
    delta: z.number().int().min(-500).max(500).refine((n) => n !== 0, 'No puede ser 0'),
    reason: z.string().max(200).optional(),
  }).parse(req.body);
  const { data, error } = await supabase.rpc('adjust_stock', {
    p_driver: req.params.id, p_delta: delta, p_reason: reason || 'admin_adjust', p_actor: req.user.id,
  });
  throwDb(error);
  emitToAdmins('driver:changed', { id: req.params.id });
  emitToUser(req.params.id, 'driver:changed', {});
  res.json({ battery_stock: data });
});

/** El conductor entrega el efectivo: se registra y se reinicia a 0. */
router.post('/:id/settle', async (req, res) => {
  const { data, error } = await supabase.rpc('settle_cash', { p_driver: req.params.id, p_actor: req.user.id });
  throwDb(error);
  emitToAdmins('driver:changed', { id: req.params.id });
  emitToUser(req.params.id, 'driver:changed', {});
  res.json({ settled: data });
});

export default router;
