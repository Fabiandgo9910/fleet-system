/**
 * NOTIFICACIONES
 * Cada notificación se entrega por 3 vías:
 *   1) Se guarda en BD (historial / campana).
 *   2) Socket.IO  -> instantánea si la app está abierta.
 *   3) Web Push   -> llega aunque la PWA esté cerrada o en segundo plano.
 */
import webpush from 'web-push';
import { env } from '../config/env.js';
import { supabase } from '../lib/supabase.js';
import { emitToUser } from '../realtime/socket.js';

const pushEnabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
if (pushEnabled) webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
else console.warn('⚠️  VAPID no configurado: las notificaciones push están desactivadas.');

/** Envía una notificación a una lista de usuarios. */
export async function notifyUsers(userIds, { title, body = '', url = '/' }) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;

  const { data: rows } = await supabase
    .from('notifications')
    .insert(ids.map((user_id) => ({ user_id, title, body, url })))
    .select();
  rows?.forEach((n) => emitToUser(n.user_id, 'notification:new', n));

  if (!pushEnabled) return;
  const { data: subs } = await supabase.from('push_subscriptions').select('*').in('user_id', ids);
  const payload = JSON.stringify({ title, body, url });
  await Promise.all((subs || []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
    } catch (e) {
      // 404/410 = suscripción caducada: se elimina para no reintentar eternamente.
      if ([404, 410].includes(e.statusCode)) await supabase.from('push_subscriptions').delete().eq('id', s.id);
    }
  }));
}

/** Notifica a todos los administradores activos (excepto a quien hizo la acción). */
export async function notifyAdmins(payload, exceptUserId) {
  const { data } = await supabase.from('profiles').select('id')
    .in('role', ['admin', 'super_admin']).eq('active', true);
  await notifyUsers((data || []).map((u) => u.id).filter((id) => id !== exceptUserId), payload);
}
