import { Router } from 'express';
import { supabase } from '../lib/supabase.js';

const router = Router();

/** Perfil del usuario actual (+ stock/efectivo si es conductor). */
router.get('/', async (req, res) => {
  const out = { ...req.user };
  if (req.user.role === 'driver') {
    const { data } = await supabase.from('drivers').select('*').eq('profile_id', req.user.id).maybeSingle();
    out.driver = data;
  }
  res.json(out);
});

export default router;
