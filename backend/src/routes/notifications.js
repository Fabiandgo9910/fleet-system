/** NOTIFICACIONES del usuario + suscripción Web Push. */
import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { throwDb } from '../lib/errors.js';

const router = Router();

router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('notifications').select('*')
    .eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(50);
  throwDb(error);
  res.json(data);
});

router.post('/read-all', async (req, res) => {
  await supabase.from('notifications').update({ read: true }).eq('user_id', req.user.id).eq('read', false);
  res.json({ ok: true });
});

/** Guarda la suscripción push del dispositivo. */
router.post('/push', async (req, res) => {
  const sub = z.object({
    endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }),
  }).parse(req.body);
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: req.user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    { onConflict: 'endpoint' },
  );
  throwDb(error);
  res.status(201).json({ ok: true });
});

router.delete('/push', async (req, res) => {
  const { endpoint } = z.object({ endpoint: z.string() }).parse(req.body);
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', req.user.id);
  res.json({ ok: true });
});

export default router;
