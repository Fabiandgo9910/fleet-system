'use client';
import Link from 'next/link';
import { money, timeOnly, ACTIVE_STATUSES } from '@/lib/format';
import { singleRouteUrl } from '@/lib/maps';
import { StatusBadge, Elapsed } from './ui';

/** Tarjeta resumen de un servicio (lista principal). */
export default function ServiceCard({ s, showDriver }) {
  const active = ACTIVE_STATUSES.includes(s.status);
  return (
    <div className="card space-y-2">
      <Link href={`/services/${s.id}`} className="block space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold">#{s.code} · {s.plate}</span>
          <StatusBadge status={s.status} />
        </div>
        <p className="text-sm font-medium">{s.client_name}</p>
        <p className="text-sm text-gray-600">📍 {s.address}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>🔋 {s.battery_model}</span>
          <span>💶 {money(s.price)}</span>
          {s.arrival_time && <span>🕒 Llegada {timeOnly(s.arrival_time)}</span>}
          <span>⏱️ <Elapsed from={s.created_at} to={active ? null : s.finished_at} /></span>
          {showDriver && <span>🚚 {s.driver?.full_name || 'Sin asignar'}</span>}
        </div>
      </Link>
      {(s.status === 'assigned' || s.status === 'accepted') && !showDriver && (
        <a href={singleRouteUrl(s)} target="_blank" rel="noreferrer" className="btn-ghost w-full">🧭 Cómo llegar</a>
      )}
    </div>
  );
}
