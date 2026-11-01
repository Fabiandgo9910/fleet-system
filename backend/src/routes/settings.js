/**
 * AJUSTES DE LA EMPRESA
 * Por ahora: dirección del almacén (para incluirla en las rutas de los conductores).
 * Lectura: cualquier usuario con sesión. Escritura: administradores.
 */
import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { throwDb } from '../lib/errors.js';
import { adminOnly } from '../middleware/auth.js';

const router = Router();

router.get('/', async (_req, res) => {
  const { data, error } = await supabase.from('settings').select('key, value');
  throwDb(error);
  const out = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  res.json({ warehouse: out.warehouse ?? null });
});

router.put('/warehouse', adminOnly, async (req, res) => {
  const w = z.object({
    address: z.string().trim().min(5).max(300),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    place_id: z.string().max(300).nullable().optional(),
  }).parse(req.body);
  const { error } = await supabase.from('settings')
    .upsert({ key: 'warehouse', value: w, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  throwDb(error);
  res.json({ warehouse: w });
});

router.delete('/warehouse', adminOnly, async (_req, res) => {
  const { error } = await supabase.from('settings').delete().eq('key', 'warehouse');
  throwDb(error);
  res.json({ warehouse: null });
});

export default router;
