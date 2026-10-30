'use client';
/** Piezas de interfaz pequeñas y reutilizables. */
import { useEffect, useState } from 'react';
import { STATUS, elapsed } from '@/lib/format';

export const Skeleton = ({ className = '' }) => <div className={`skeleton ${className}`} aria-hidden="true" />;

/** Esqueleto de una lista de tarjetas (se muestra mientras cargan los datos). */
export const ListSkeleton = ({ rows = 4 }) => (
  <div className="space-y-3" aria-busy="true" aria-label="Cargando">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="card space-y-3">
        <div className="flex justify-between"><Skeleton className="h-5 w-24" /><Skeleton className="h-5 w-20" /></div>
        <Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" />
      </div>
    ))}
  </div>
);

export const StatusBadge = ({ status }) => {
  const s = STATUS[status] || STATUS.created;
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
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

export const Empty = ({ children }) => (
  <div className="card py-10 text-center text-gray-500">{children}</div>
);

export const ErrorBox = ({ error }) =>
  error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error.message || String(error)}</div> : null;

/** Ventana modal (se ve como hoja inferior en móvil). */
export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="rounded-full p-2 text-gray-500 hover:bg-gray-100" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Field = ({ label, children, hint }) => (
  <label className="block">
    <span className="label">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
  </label>
);
