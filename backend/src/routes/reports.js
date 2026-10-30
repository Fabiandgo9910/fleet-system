/** INFORMES: resumen por conductor y fechas. El conductor solo ve el suyo. */
import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { throwDb } from '../lib/errors.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireRole('super_admin', 'admin', 'driver'));

router.get('/summary', async (req, res) => {
  const q = z.object({
    from: z.string().optional(), to: z.string().optional(), driver_id: z.string().uuid().optional(),
  }).parse(req.query);
  const driver = req.user.role === 'driver' ? req.user.id : q.driver_id ?? null;

  const { data, error } = await supabase.rpc('report_summary', {
    p_from: q.from || null, p_to: q.to || null, p_driver: driver,
  });
  throwDb(error);

  // Totales generales sumando las filas por conductor.
  const keys = ['total_services', 'finished_ok', 'finished_failed', 'cancelled', 'batteries_sold', 'old_batteries', 'cash_total', 'card_total'];
  const totals = Object.fromEntries(keys.map((k) => [k, data.reduce((a, r) => a + Number(r[k]), 0)]));
  res.json({ drivers: data, totals });
});

export default router;
