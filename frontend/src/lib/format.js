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
  created:         { label: 'Creado',     cls: 'bg-slate-500/12 text-slate-600 dark:text-slate-300',     dot: 'bg-slate-400',   hex: '#64748b' },
  assigned:        { label: 'Asignado',   cls: 'bg-amber-500/14 text-amber-700 dark:text-amber-300',     dot: 'bg-amber-500',   hex: '#f59e0b' },
  accepted:        { label: 'Aceptado',   cls: 'bg-blue-500/12 text-blue-700 dark:text-blue-300',        dot: 'bg-blue-500',    hex: '#2563eb' },
  finished_ok:     { label: 'Finalizado', cls: 'bg-emerald-500/14 text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', hex: '#059669' },
  finished_failed: { label: 'Fallido',    cls: 'bg-red-500/12 text-red-700 dark:text-red-300',           dot: 'bg-red-500',     hex: '#dc2626' },
  cancelled:       { label: 'Cancelado',  cls: 'bg-zinc-500/14 text-zinc-600 dark:text-zinc-400',        dot: 'bg-zinc-400',    hex: '#a1a1aa' },
};

/** Eventos del historial de un servicio. */
export const EVENT = {
  created:         { label: 'Servicio creado',            icon: 'plus',        tone: 'text-slate-500' },
  assigned:        { label: 'Asignado a',                 icon: 'truck',       tone: 'text-amber-500' },
  unassigned:      { label: 'Retirado a',                 icon: 'undo',        tone: 'text-orange-500' },
  accepted:        { label: 'Aceptado por el conductor',  icon: 'check',       tone: 'text-blue-500' },
  rejected:        { label: 'Rechazado por el conductor', icon: 'ban',         tone: 'text-red-500' },
  finished_ok:     { label: 'Finalizado con éxito',       icon: 'checkCircle', tone: 'text-emerald-500' },
  finished_failed: { label: 'Finalizado como fallido',    icon: 'xCircle',     tone: 'text-red-500' },
  cancelled:       { label: 'Servicio cancelado',         icon: 'x',           tone: 'text-zinc-500' },
};
export const ACTIVE_STATUSES = ['created', 'assigned', 'accepted'];

export const ROLE_LABEL = { super_admin: 'Super admin', admin: 'Administrador', driver: 'Conductor', client: 'Cliente' };
export const isAdmin = (role) => role === 'admin' || role === 'super_admin';

/** "2025-01-31" -> ISO de inicio / fin de ese día (hora local). */
export const dayStart = (d) => (d ? new Date(`${d}T00:00:00`).toISOString() : '');
export const dayEnd = (d) => (d ? new Date(`${d}T23:59:59`).toISOString() : '');
export const todayISO = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };
/** Total cobrado (efectivo + tarjeta) de un servicio finalizado con éxito. */
export const charged = (s) => (s.status === 'finished_ok' ? Number(s.paid_cash || 0) + Number(s.paid_card || 0) : null);
