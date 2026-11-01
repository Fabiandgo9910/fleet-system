'use client';
import Link from 'next/link';
import { money, timeOnly, ACTIVE_STATUSES, STATUS } from '@/lib/format';
import { singleRouteUrl } from '@/lib/maps';
import { StatusBadge, Elapsed } from './ui';
import Icon from './Icon';

const Meta = ({ icon, children }) => <span className="inline-flex items-center gap-1.5"><Icon name={icon} className="h-3.5 w-3.5 text-faint" />{children}</span>;

/** Tarjeta resumen de un servicio (lista principal). */
export default function ServiceCard({ s, showDriver, compact }) {
  const active = ACTIVE_STATUSES.includes(s.status);
  return (
    <div className="card relative overflow-hidden !p-0 transition hover:shadow-md">
      <span className={`absolute inset-y-0 left-0 w-1 ${STATUS[s.status].dot}`} />
      <Link href={`/services/${s.id}`} className="block space-y-2.5 py-3.5 pl-5 pr-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold tracking-tight">#{s.code}<span className="mx-2 text-faint">·</span><span className="font-mono tracking-wider">{s.plate}</span></span>
          <StatusBadge status={s.status} />
        </div>
        <p className="text-sm font-medium">{s.client_name}</p>
        <p className="flex items-start gap-1.5 text-sm text-muted"><Icon name="pin" className="mt-0.5 h-4 w-4 text-faint" />{s.address}</p>
        {!compact && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
            <Meta icon="battery">{s.battery_model}</Meta>
            <Meta icon="euro">{money(s.price)}</Meta>
            {s.arrival_time && <Meta icon="clock">Llegada {timeOnly(s.arrival_time)}</Meta>}
            <Meta icon="history"><Elapsed from={s.created_at} to={active ? null : s.finished_at} /></Meta>
            {showDriver && <Meta icon="truck">{s.driver?.full_name || 'Sin asignar'}</Meta>}
          </div>
        )}
      </Link>
      {(s.status === 'assigned' || s.status === 'accepted') && !showDriver && (
        <a href={singleRouteUrl(s)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 border-t border-line bg-sunken py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft">
          <Icon name="navigation" className="h-4 w-4" />Cómo llegar
        </a>
      )}
    </div>
  );
}
