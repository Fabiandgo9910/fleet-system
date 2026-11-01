/**
 * SERVICIOS (corazón del sistema)
 * Flujo de estados:
 *   created -> assigned -> accepted -> finished_ok | finished_failed
 *   El conductor puede RECHAZAR (assigned/accepted -> created, con nota).
 *   El admin puede reasignar, quitar la asignación o cancelar.
 * Cada acción queda registrada en service_events (historial del servicio).
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
/** Quita caracteres que rompen los filtros de PostgREST (comas, paréntesis, comodines). */
const clean = (s = '') => String(s).replace(/[,()%*\\"']/g, ' ').trim();

// ---------- Validaciones de entrada ----------
const note = z.string().trim().min(5, 'Escribe al menos 5 caracteres.').max(500);
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
  note: z.string().trim().max(500).optional(),
}).refine((b) => b.success || (b.note && b.note.length >= 5), {
  path: ['note'], message: 'Indica el motivo del fallo (mínimo 5 caracteres).',
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
async function transition(id, from, patch, match = {}) {
  const { data, error } = await supabase.from('services')
    .update(patch).eq('id', id).in('status', from).match(match).select('id').maybeSingle();
  throwDb(error);
  if (!data) throw new HttpError(409, 'El servicio cambió de estado. Actualiza e inténtalo de nuevo.');
}

/** Registra un evento en el historial del servicio (nunca rompe el flujo). */
async function logEvent(serviceId, type, userId, { note = null, target = null } = {}) {
  const { error } = await supabase.from('service_events')
    .insert({ service_id: serviceId, type, user_id: userId, target_user_id: target, note });
  if (error) console.error('[events]', error.message);
}

/** Avisa en tiempo real a admins, al conductor actual y a otros usuarios indicados. */
async function broadcast(id, alsoUsers = []) {
  const { data } = await supabase.from('services').select(SELECT).eq('id', id).single();
  emitToAdmins('service:changed', data);
  new Set([data.driver_id, ...alsoUsers].filter(Boolean)).forEach((uid) => emitToUser(uid, 'service:changed', data));
  return data;
}

const label = (s) => `#${s.code} · ${s.address}`;

// ---------- Listado con filtros (servicios y historial) ----------
router.get('/', async (req, res) => {
  const q = z.object({
    status: z.string().optional(),            // "created,assigned"
    driver_id: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    plate: z.string().max(20).optional(),     // búsqueda parcial por matrícula
    q: z.string().max(80).optional(),         // nombre o teléfono del cliente
    limit: z.coerce.number().int().min(1).max(1000).default(200),
  }).parse(req.query);

  let query = supabase.from('services').select(SELECT)
    .order('created_at', { ascending: false }).limit(q.limit);

  if (req.user.role === 'driver') query = query.eq('driver_id', req.user.id);
  else if (req.user.role === 'client') query = query.eq('client_phone', req.user.phone ?? '__none__');
  else if (q.driver_id) query = query.eq('driver_id', q.driver_id);

  if (q.status) query = query.in('status', q.status.split(','));
  if (q.from) query = query.gte('created_at', q.from);
  if (q.to) query = query.lte('created_at', q.to);
  if (q.plate && clean(q.plate)) query = query.ilike('plate', `%${clean(q.plate)}%`);
  if (q.q && clean(q.q)) {
    const t = clean(q.q);
    query = query.or(`client_name.ilike.%${t}%,client_phone.ilike.%${t}%`);
  }

  const { data, error } = await query;
  throwDb(error);
  res.json(data);
});

/** Detalle + historial de eventos del servicio. */
router.get('/:id', async (req, res) => {
  const s = await getVisible(req.params.id, req.user);
  const { data: events } = await supabase.from('service_events')
    .select('id, type, note, created_at, user:profiles!user_id(full_name), target:profiles!target_user_id(full_name)')
    .eq('service_id', s.id).order('created_at');
  res.json({ ...s, events: isAdmin(req.user) ? events || [] : (events || []).filter((e) => e.type !== 'unassigned') });
});

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

  await logEvent(created.id, 'created', req.user.id);
  if (b.driver_id) await logEvent(created.id, 'assigned', req.user.id, { target: b.driver_id });

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
    await notifyUsers([b.driver_id], { title: 'Nuevo servicio asignado', body: label(full), url: `/services/${full.id}` });
  }
  res.status(201).json(full);
});

// ---------- Asignar / reasignar (admin) ----------
router.post('/:id/assign', adminOnly, async (req, res) => {
  const { driver_id } = z.object({ driver_id: z.string().uuid() }).parse(req.body);
  await assertDriver(driver_id);
  const before = await getVisible(req.params.id, req.user);
  if (before.driver_id === driver_id && before.status === 'assigned') throw new HttpError(409, 'Ya está asignado a ese conductor.');

  await transition(req.params.id, ['created', 'assigned', 'accepted'], {
    driver_id, status: 'assigned', assigned_at: new Date().toISOString(), accepted_at: null,
  });
  const previous = before.driver_id && before.driver_id !== driver_id ? before.driver_id : null;
  if (previous) await logEvent(req.params.id, 'unassigned', req.user.id, { target: previous });
  await logEvent(req.params.id, 'assigned', req.user.id, { target: driver_id });

  const full = await broadcast(req.params.id, previous ? [previous] : []); // el anterior lo ve desaparecer
  // Conductor anterior: aviso claro de que se le ha quitado.
  if (previous) {
    await notifyUsers([previous], {
      title: 'Servicio desasignado',
      body: `Se te ha quitado el servicio ${label(full)}. Ya no debes realizarlo.`, url: '/',
    });
  }
  // Conductor nuevo: aviso de servicio nuevo.
  await notifyUsers([driver_id], { title: 'Nuevo servicio asignado', body: label(full), url: `/services/${full.id}` });
  res.json(full);
});

// ---------- Quitar la asignación sin reasignar (admin) ----------
router.post('/:id/unassign', adminOnly, async (req, res) => {
  const before = await getVisible(req.params.id, req.user);
  if (!before.driver_id) throw new HttpError(409, 'El servicio no tiene conductor asignado.');
  await transition(before.id, ['assigned', 'accepted'], { driver_id: null, status: 'created', assigned_at: null, accepted_at: null });
  await logEvent(before.id, 'unassigned', req.user.id, { target: before.driver_id });
  const full = await broadcast(before.id, [before.driver_id]);
  await notifyUsers([before.driver_id], {
    title: 'Servicio desasignado', body: `Se te ha quitado el servicio ${label(full)}.`, url: '/',
  });
  res.json(full);
});

// ---------- Aceptar (conductor) ----------
router.post('/:id/accept', requireRole('driver'), async (req, res) => {
  const s = await getVisible(req.params.id, req.user);
  await transition(s.id, ['assigned'], { status: 'accepted', accepted_at: new Date().toISOString() }, { driver_id: req.user.id });
  await logEvent(s.id, 'accepted', req.user.id);
  const full = await broadcast(s.id);
  await notifyAdmins({ title: 'Servicio aceptado', body: `${req.user.full_name} · ${label(full)}`, url: `/services/${s.id}` });
  res.json(full);
});

// ---------- Rechazar (conductor, con nota obligatoria) ----------
router.post('/:id/reject', requireRole('driver'), async (req, res) => {
  const { note: reason } = z.object({ note }).parse(req.body);
  const s = await getVisible(req.params.id, req.user);
  // Vuelve a "Creado" sin conductor para que el admin lo reasigne.
  await transition(s.id, ['assigned', 'accepted'],
    { status: 'created', driver_id: null, assigned_at: null, accepted_at: null }, { driver_id: req.user.id });
  await logEvent(s.id, 'rejected', req.user.id, { note: reason, target: req.user.id });
  const full = await broadcast(s.id, [req.user.id]);
  await notifyAdmins({
    title: 'Servicio rechazado',
    body: `${req.user.full_name} rechazó ${label(full)}. Motivo: ${reason}`, url: `/services/${s.id}`,
  });
  res.json(full);
});

// ---------- Finalizar (conductor del servicio o admin) ----------
router.post('/:id/finish', requireRole('driver', 'admin', 'super_admin'), async (req, res) => {
  const b = finishSchema.parse(req.body);
  const s = await getVisible(req.params.id, req.user);
  // La RPC hace todo en una transacción: estado + stock + efectivo + baterías viejas.
  const { error } = await supabase.rpc('finish_service', {
    p_service_id: s.id, p_success: b.success, p_cash: b.cash, p_card: b.card,
    p_old: b.old_battery_received, p_note: b.success ? null : b.note,
  });
  throwDb(error);
  await logEvent(s.id, b.success ? 'finished_ok' : 'finished_failed', req.user.id, { note: b.success ? null : b.note });
  const full = await broadcast(s.id);
  if (s.driver_id) { emitToAdmins('driver:changed', { id: s.driver_id }); emitToUser(s.driver_id, 'driver:changed', {}); }
  await notifyAdmins({
    title: b.success ? 'Servicio finalizado' : 'Servicio fallido',
    body: `${full.driver?.full_name ?? ''} · ${label(full)}${b.success ? '' : `. Motivo: ${b.note}`}`,
    url: `/services/${s.id}`,
  }, req.user.id);
  res.json(full);
});

// ---------- Cancelar (admin) ----------
router.post('/:id/cancel', adminOnly, async (req, res) => {
  const s = await getVisible(req.params.id, req.user);
  await transition(s.id, ['created', 'assigned', 'accepted'], { status: 'cancelled' });
  await logEvent(s.id, 'cancelled', req.user.id);
  const full = await broadcast(s.id);
  if (s.driver_id) await notifyUsers([s.driver_id], { title: 'Servicio cancelado', body: label(full), url: '/' });
  res.json(full);
});

export default router;
