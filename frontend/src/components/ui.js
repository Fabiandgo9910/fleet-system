'use client';
/** Piezas de interfaz reutilizables (diseño corporativo, claro/oscuro). */
import { useEffect, useState } from 'react';
import Icon from './Icon';
import { STATUS, elapsed } from '@/lib/format';

export const Skeleton = ({ className = '' }) => <div className={`skeleton ${className}`} aria-hidden="true" />;

/** Esqueleto de una lista de tarjetas (se muestra mientras cargan los datos). */
export const ListSkeleton = ({ rows = 4 }) => (
  <div className="space-y-3" aria-busy="true" aria-label="Cargando">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="card space-y-3">
        <div className="flex justify-between"><Skeleton className="h-5 w-28" /><Skeleton className="h-5 w-20" /></div>
        <Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" />
      </div>
    ))}
  </div>
);

export const StatusBadge = ({ status }) => {
  const s = STATUS[status] || STATUS.created;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.label}
    </span>
  );
};

/** Tiempo transcurrido que se actualiza solo cada 30 s. */
export function Elapsed({ from, to }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (to) return;
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [to]);
  return <>{elapsed(from, to)}</>;
}

export const Empty = ({ icon = 'list', title, children }) => (
  <div className="card flex flex-col items-center gap-2 py-12 text-center">
    <span className="grid h-12 w-12 place-items-center rounded-full bg-sunken text-faint"><Icon name={icon} className="h-6 w-6" /></span>
    {title && <p className="font-semibold">{title}</p>}
    <p className="max-w-sm text-sm text-muted">{children}</p>
  </div>
);

/** Mensaje de error elegante (errores de servidor o de red). */
export const ErrorBox = ({ error, className = '' }) => {
  if (!error) return null;
  return (
    <div role="alert" className={`flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300 ${className}`}>
      <Icon name="alert" className="mt-0.5 h-4 w-4" />
      <span>{error.message || String(error)}</span>
    </div>
  );
};

export const FieldError = ({ error }) =>
  error ? <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400"><Icon name="alert" className="h-3.5 w-3.5" />{error}</p> : null;

/** Campo de formulario: etiqueta, control, ayuda y error. */
export const Field = ({ label, error, hint, required, children }) => (
  <div>
    <label className="block">
      <span className="label">{label}{required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}</span>
      {children}
    </label>
    <FieldError error={error} />
    {!error && hint && <p className="mt-1.5 text-xs text-faint">{hint}</p>}
  </div>
);

/** Interruptor (checkbox con aspecto de switch). */
export const Switch = ({ label, description, ...props }) => (
  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-line bg-surface p-3">
    <span><span className="block text-sm font-medium">{label}</span>{description && <span className="block text-xs text-muted">{description}</span>}</span>
    <span className="relative inline-flex shrink-0">
      <input type="checkbox" className="peer sr-only" {...props} />
      <span className="h-6 w-11 rounded-full bg-faint/40 transition peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40" />
      <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
    </span>
  </label>
);

/** Ventana modal (hoja inferior en móvil, centrada en escritorio). Se cierra con Esc. */
export function Modal({ open, onClose, title, subtitle, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#050b16]/60 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="pop max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 shadow-2xl sm:rounded-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div><h2 className="text-lg font-semibold">{title}</h2>{subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}</div>
          <button className="rounded-lg p-1.5 text-faint hover:bg-sunken hover:text-ink" onClick={onClose} aria-label="Cerrar"><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Cabecera de página. */
export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div><h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>{subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}</div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

/** Anillo de progreso (como los indicadores del panel de referencia). */
export function Ring({ value = 0, size = 48, label }) {
  const r = 18, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 44 44" className="-rotate-90" width={size} height={size}>
        <circle cx="22" cy="22" r={r} fill="none" stroke="currentColor" className="text-line" strokeWidth="4" />
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--brand)" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * v) / 100} />
      </svg>
      <span className="absolute text-[11px] font-bold">{label ?? `${Math.round(v)}%`}</span>
    </div>
  );
}

/** Tarjeta de indicador (KPI). */
export const Kpi = ({ icon, label, value, hint, ring }) => (
  <div className="card flex items-center justify-between gap-3">
    <div className="min-w-0">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>}
    </div>
    {ring !== undefined ? <Ring value={ring} /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon name={icon} className="h-5 w-5" /></span>}
  </div>
);

/** Pestañas tipo segmento. */
export const Tabs = ({ tabs, value, onChange }) => (
  <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border border-line bg-sunken p-1" role="tablist">
    {tabs.map((t) => (
      <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
        className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-medium transition ${value === t.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
        {t.icon && <Icon name={t.icon} className="h-4 w-4" />}{t.label}
      </button>
    ))}
  </div>
);

/** Fila etiqueta / valor para fichas de detalle. */
export const Row = ({ label, children }) => (
  <div className="flex items-start justify-between gap-6 border-b border-line py-3 text-sm last:border-0">
    <span className="shrink-0 text-muted">{label}</span>
    <span className="text-right font-medium">{children}</span>
  </div>
);
