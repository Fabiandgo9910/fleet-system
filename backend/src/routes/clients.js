/**
 * HISTORIAL DE CLIENTES (solo administradores)
 * Devuelve cada cliente con sus servicios: batería montada, importe cobrado y fecha.
 * Filtros: q (nombre/teléfono), plate (matrícula), from/to (rango de fechas).
 */
import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { throwDb } from '../lib/errors.js';
import { adminOnly } from '../middleware/auth.js';

const router = Router();
router.use(adminOnly);
const clean = (s = '') => String(s).replace(/[,()%*\\"']/g, ' ').trim();

router.get('/', async (req, res) => {
  const f = z.object({
    q: z.string().max(80).optional(), plate: z.string().max(20).optional(),
    from: z.string().optional(), to: z.string().optional(),
  }).parse(req.query);
  const q = clean(f.q), plate = clean(f.plate);
  const hasServiceFilter = Boolean(plate || f.from || f.to);

  // 1) Servicios que cumplen los filtros.
  let sq = supabase.from('services')
    .select('id, code, status, client_id, client_name, client_phone, address, plate, battery_model, price, paid_cash, paid_card, created_at, finished_at, driver:profiles!driver_id(full_name)')
    .order('created_at', { ascending: false }).limit(1500);
  if (plate) sq = sq.ilike('plate', `%${plate}%`);
  if (f.from) sq = sq.gte('created_at', f.from);
  if (f.to) sq = sq.lte('created_at', f.to);
  if (q) sq = sq.or(`client_name.ilike.%${q}%,client_phone.ilike.%${q}%`);
  const { data: services, error } = await sq;
  throwDb(error);

  // 2) Fichas de cliente (para mostrar también los que aún no tienen servicios).
  let cq = supabase.from('clients').select('*').order('name').limit(500);
  if (q) cq = cq.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
  const { data: clients, error: ce } = await cq;
  throwDb(ce);

  const map = new Map(clients.map((c) => [c.id, { ...c, services: [] }]));
  for (const s of services) {
    if (!map.has(s.client_id)) continue; // ficha fuera del filtro de nombre
    map.get(s.client_id).services.push(s);
  }

  const out = [...map.values()]
    .filter((c) => !hasServiceFilter || c.services.length > 0) // con filtro de matrícula/fechas solo los que coinciden
    .map((c) => {
      const ok = c.services.filter((s) => s.status === 'finished_ok');
      return {
        ...c,
        total_services: c.services.length,
        total_ok: ok.length,
        total_spent: ok.reduce((a, s) => a + Number(s.paid_cash || 0) + Number(s.paid_card || 0), 0),
        last_service_at: c.services[0]?.created_at ?? null,
      };
    })
    .sort((a, b) => (b.last_service_at || '').localeCompare(a.last_service_at || ''));
  res.json(out);
});

export default router;
