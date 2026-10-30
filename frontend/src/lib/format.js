import { brand } from '@/config/brand.config';

export const money = (n) =>
  new Intl.NumberFormat(brand.locale, { style: 'currency', currency: brand.currency }).format(Number(n || 0));

export const dateTime = (iso) =>
  iso ? new Intl.DateTimeFormat(brand.locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : '—';

export const timeOnly = (iso) =>
  iso ? new Intl.DateTimeFormat(brand.locale, { timeStyle: 'short' }).format(new Date(iso)) : '—';

/** "1 h 25 min" / "12 min" entre una fecha y ahora (o una fecha final). */
export function elapsed(fromIso, toIso) {
  if (!fromIso) return '—';
  const mins = Math.max(0, Math.floor(((toIso ? new Date(toIso) : new Date()) - new Date(fromIso)) / 60000));
  const h = Math.floor(mins / 60);
  return h ? `${h} h ${mins % 60} min` : `${mins} min`;
}

/** Textos y colores de cada estado (un único sitio para cambiarlos). */
export const STATUS = {
  created:         { label: 'Creado',               cls: 'bg-gray-100 text-gray-700' },
  assigned:        { label: 'Asignado',             cls: 'bg-amber-100 text-amber-800' },
  accepted:        { label: 'Aceptado',             cls: 'bg-blue-100 text-blue-800' },
  finished_ok:     { label: 'Finalizado con éxito', cls: 'bg-emerald-100 text-emerald-800' },
  finished_failed: { label: 'Finalizado fallido',   cls: 'bg-red-100 text-red-800' },
  cancelled:       { label: 'Cancelado',            cls: 'bg-zinc-200 text-zinc-600' },
};
export const ACTIVE_STATUSES = ['created', 'assigned', 'accepted'];

export const ROLE_LABEL = { super_admin: 'Super admin', admin: 'Administrador', driver: 'Conductor', client: 'Cliente' };
export const isAdmin = (role) => role === 'admin' || role === 'super_admin';
