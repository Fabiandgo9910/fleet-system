/**
 * SERVICIOS (corazón del sistema)
 * Flujo de estados:
 *   created -> assigned -> accepted -> finished_ok | finished_failed
 *   (cancelled posible desde created/assigned/accepted)
 * Permisos: admin hace todo; el conductor solo ve y gestiona SUS servicios;
 * el cliente solo ve los suyos (por teléfono) en modo lectura.
 */
import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { HttpError, throwDb } from '../lib/errors.js';
import { normalizePhone } from '../lib/phone.js';
import { adminOnly, requireRole, ADMIN_ROLES } from '../middleware/auth.js';
import { notifyUsers, notifyAdmins } from '../services/notify.js';
import { emitToAdmins, emitToUser } from '../realtime/socket.js';

const router = Router();
// Incluye los datos del conductor en cada servicio.
const SELECT = '*, driver:profiles!driver_id(id, full_name, phone)';
const isAdmin = (u) => ADMIN_ROLES.includes(u.role);

// ---------- Validaciones de entrada ----------
const createSchema = z.object({
  client_name: z.string().trim().min(2).max(120),
  client_phone: z.string().trim().min(6).max(25),
  address: z.string().trim().min(5).max(300),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  place_id: z.string().max(300).nullable().optional(),
  plate: z.string().trim().min(3).max(15).transform((s) => s.toUpperCase()),
  battery_model: z.string().trim().min(1).max(120),
  price: z.number().min(0).max(100000),
  leaves_old_battery: z.boolean().default(false),
  arrival_time: z.string().datetime({ offset: true }).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  driver_id: z.string().uuid().nullable().optional(),
  // Opcional: añadir baterías al stock de un conductor al crear el servicio.
  stock_add: z.object({ driver_id: z.string().uuid(), quantity: z.number().int().min(1).max(500) })
    .nullable().optional(),
});
const finishSchema = z.object({
  success: z.boolean(),
  cash: z.number().min(0).max(100000).default(0),
  card: z.number().min(0).max(100000).default(0),
  old_battery_received: z.boolean().default(false),
});

// ---------- Utilidades ----------
/** Trae un servicio con su conductor; lanza 404 si no existe o no es visible. */
async function getVisible(id, user) {
  const { data } = await supabase.from('services').select(SELECT).eq('id', id).maybeSingle();
  if (!data) throw new HttpError(404, 'Servicio no encontrado.');
  const ok = isAdmin(user)
    || (user.role === 'driver' && data.driver_id === user.id)
    || (user.role === 'client' && data.client_phone === user.phone);
  if (!ok) throw new HttpError(404, 'Servicio no encontrado.');
  return data;
}

/** Comprueba que el id corresponde a un conductor activo. */
async function assertDriver(id) {
  const { data } = await supabase.from('profiles').select('id')
    .eq('id', id).eq('role', 'driver').eq('active', true).maybeSingle();
  if (!data) throw new HttpError(400, 'El conductor indicado no existe o está inactivo.');
}

/** Cambia el estado SOLO si el actual es uno de los permitidos (evita carreras). */
async function transition(id, from, patch) {
  const { data, error } = await supabase.from('services')
    .update(patch).eq('id', id).in('status', from).select('id').maybeSingle();
  throwDb(error);
  if (!data) throw new HttpError(409, 'El servicio cambió de estado. Actualiza e inténtalo de nuevo.');
}

/** Avisa en tiempo real a admins y al conductor implicado. */
async function broadcast(id) {
  const { data } = await supabase.from('services').select(SELECT).eq('id', id).single();
  emitToAdmins('service:changed', data);
  if (data.driver_id) emitToUser(data.driver_id, 'service:changed', data);
  return data;
}

const label = (s) => `#${s.code} · ${s.address}`;

// ---------- Listado con filtros ----------
router.get('/', async (req, res) => {
  const q = z.object({
    status: z.string().optional(),            // "created,assigned"
    driver_id: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(500).default(200),
  }).parse(req.query);

  let query = supabase.from('services').select(SELECT)
    .order('created_at', { ascending: false }).limit(q.limit);

  if (req.user.role === 'driver') query = query.eq('driver_id', req.user.id);
  else if (req.user.role === 'client') query = query.eq('client_phone', req.user.phone ?? '__none__');
  else if (q.driver_id) query = query.eq('driver_id', q.driver_id);

  if (q.status) query = query.in('status', q.status.split(','));
  if (q.from) query = query.gte('created_at', q.from);
  if (q.to) query = query.lte('created_at', q.to);

  const { data, error } = await query;
  throwDb(error);
  res.json(data);
});

router.get('/:id', async (req, res) => res.json(await getVisible(req.params.id, req.user)));

// ---------- Crear (admin) ----------
router.post('/', adminOnly, async (req, res) => {
  const b = createSchema.parse(req.body);
  if (b.driver_id) await assertDriver(b.driver_id);
  if (b.stock_add) await assertDriver(b.stock_add.driver_id);

  // El cliente se crea/actualiza automáticamente a partir del servicio (clave: teléfono).
  const phone = normalizePhone(b.client_phone);
  const { data: client, error: ce } = await supabase.from('clients')
    .upsert({ name: b.client_name, phone, last_address: b.address }, { onConflict: 'phone' })
    .select().single();
  throwDb(ce);

  const { data: created, error } = await supabase.from('services').insert({
    client_id: client.id, client_name: b.client_name, client_phone: phone,
    address: b.address, lat: b.lat ?? null, lng: b.lng ?? null, place_id: b.place_id ?? null,
    plate: b.plate, battery_model: b.battery_model, price: b.price,
    leaves_old_battery: b.leaves_old_battery, arrival_time: b.arrival_time ?? null,
    notes: b.notes ?? null, created_by: req.user.id,
    driver_id: b.driver_id ?? null,
    status: b.driver_id ? 'assigned' : 'created',
    assigned_at: b.driver_id ? new Date().toISOString() : null,
  }).select().single();
  throwDb(error);

  if (b.stock_add) {
    const { error: se } = await supabase.rpc('adjust_stock', {
      p_driver: b.stock_add.driver_id, p_delta: b.stock_add.quantity,
      p_reason: 'service_create', p_actor: req.user.id, p_service: created.id,
    });
    throwDb(se);
    emitToAdmins('driver:changed', { id: b.stock_add.driver_id });
    emitToUser(b.stock_add.driver_id, 'driver:changed', {});
  }

  const full = await broadcast(created.id);
  if (b.driver_id) {
    await notifyUsers([b.driver_id], { title: '🔔 Nuevo servicio', body: label(full), url: `/services/${full.id}` });
  }
  res.status(201).json(full);
});

// ---------- Asignar / reasignar (admin) ----------
router.post('/:id/assign', adminOnly, async (req, res) => {
  const { driver_id } = z.object({ driver_id: z.string().uuid() }).parse(req.body);
  await assertDriver(driver_id);
  const before = await getVisible(req.params.id, req.user);
  await transition(req.params.id, ['created', 'assigned', 'accepted'], {
    driver_id, status: 'assigned', assigned_at: new Date().toISOString(), accepted_at: null,
  });
  const full = await broadcast(req.params.id);
  if (before.driver_id && before.driver_id !== driver_id) {
    emitToUser(before.driver_id, 'service:changed', full); // para que desaparezca de su lista
    await notifyUsers([before.driver_id], { title: 'Servicio reasignado', body: label(full), url: '/' });
  }
  await notifyUsers([driver_id], { title: '🔔 Nuevo servicio', body: label(full), url: `/services/${full.id}` });
  res.json(full);
});

// ---------- Aceptar (conductor) ----------
router.post('/:id/accept', requireRole('driver'), async (req, res) => {
  const s = await getVisible(req.params.id, req.user);
  await transition(s.id, ['assigned'], { status: 'accepted', accepted_at: new Date().toISOString() });
  const full = await broadcast(s.id);
  await notifyAdmins({ title: '✅ Servicio aceptado', body: `${req.user.full_name} · ${label(full)}`, url: `/services/${s.id}` });
  res.json(full);
});

// ---------- Finalizar (conductor del servicio o admin) ----------
router.post('/:id/finish', requireRole('driver', 'admin', 'super_admin'), async (req, res) => {
  const b = finishSchema.parse(req.body);
  const s = await getVisible(req.params.id, req.user);
  // La RPC hace todo en una transacción: estado + stock + efectivo + baterías viejas.
  const { error } = await supabase.rpc('finish_service', {
    p_service_id: s.id, p_success: b.success, p_cash: b.cash, p_card: b.card, p_old: b.old_battery_received,
  });
  throwDb(error);
  const full = await broadcast(s.id);
  if (s.driver_id) { emitToAdmins('driver:changed', { id: s.driver_id }); emitToUser(s.driver_id, 'driver:changed', {}); }
  await notifyAdmins({
    title: b.success ? '💰 Servicio finalizado' : '⚠️ Servicio fallido',
    body: `${full.driver?.full_name ?? ''} · ${label(full)}`, url: `/services/${s.id}`,
  }, req.user.id);
  res.json(full);
});

// ---------- Cancelar (admin) ----------
router.post('/:id/cancel', adminOnly, async (req, res) => {
  const s = await getVisible(req.params.id, req.user);
  await transition(s.id, ['created', 'assigned', 'accepted'], { status: 'cancelled' });
  const full = await broadcast(s.id);
  if (s.driver_id) await notifyUsers([s.driver_id], { title: '🚫 Servicio cancelado', body: label(full), url: '/' });
  res.json(full);
});

export default router;
