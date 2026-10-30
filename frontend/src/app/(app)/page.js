'use client';
/** Lista de servicios. El backend ya filtra por rol (conductor: solo los suyos). */
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { buildRouteUrl, getPosition } from '@/lib/maps';
import { isAdmin, money } from '@/lib/format';
import { useAuth, useToast } from '@/components/Providers';
import ServiceCard from '@/components/ServiceCard';
import { ListSkeleton, Empty, ErrorBox, Skeleton } from '@/components/ui';

const TABS = [
  { id: 'active', label: 'Activos', status: 'created,assigned,accepted' },
  { id: 'done', label: 'Finalizados', status: 'finished_ok,finished_failed,cancelled' },
  { id: 'all', label: 'Todos', status: '' },
];

/** Convierte "2025-01-31" en ISO de inicio/fin del día local. */
const dayStart = (d) => (d ? new Date(`${d}T00:00:00`).toISOString() : '');
const dayEnd = (d) => (d ? new Date(`${d}T23:59:59`).toISOString() : '');

function DriverStats() {
  const { data } = useSWR('/me', fetcher);
  if (!data) return <Skeleton className="h-20 w-full" />;
  const d = data.driver || {};
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {[['🔋 Stock', d.battery_stock ?? 0], ['💶 Efectivo', money(d.cash_collected)], ['♻️ Viejas', d.old_batteries_received ?? 0]].map(([l, v]) => (
        <div key={l} className="card !p-3"><p className="text-xs text-gray-500">{l}</p><p className="text-lg font-bold">{v}</p></div>
      ))}
    </div>
  );
}

export default function ServicesPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const admin = isAdmin(profile.role);
  const [tab, setTab] = useState('active');
  const [driverId, setDriverId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const key = useMemo(() => {
    const p = new URLSearchParams();
    const st = TABS.find((t) => t.id === tab).status;
    if (st) p.set('status', st);
    if (driverId) p.set('driver_id', driverId);
    if (from) p.set('from', dayStart(from));
    if (to) p.set('to', dayEnd(to));
    return `/services?${p}`;
  }, [tab, driverId, from, to]);

  const { data, error, isLoading } = useSWR(key, fetcher);
  const { data: drivers } = useSWR(admin ? '/drivers' : null, fetcher);

  // Ruta combinada para el conductor con varios servicios aceptados.
  const accepted = (data || []).filter((s) => s.status === 'accepted');
  const openRoute = async () => {
    const origin = await getPosition();
    if (!origin) toast('Sin ubicación: la ruta se calcula desde la primera parada.', 'info');
    window.open(buildRouteUrl(accepted, origin), '_blank');
  };

  return (
    <div className="space-y-4">
      {profile.role === 'driver' && <DriverStats />}

      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`btn whitespace-nowrap ${tab === t.id ? 'bg-brand text-white' : 'border bg-white text-gray-700'}`}>{t.label}</button>
        ))}
      </div>

      {admin && (
        <div className="card grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label><span className="label">Conductor</span>
            <select className="input" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
              <option value="">Todos</option>
              {(drivers || []).map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select></label>
          <label><span className="label">Desde</span><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label><span className="label">Hasta</span><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      )}

      {profile.role === 'driver' && accepted.length > 1 && (
        <button onClick={openRoute} className="btn-primary w-full">🧭 Ruta más corta para {accepted.length} servicios</button>
      )}

      <ErrorBox error={error} />
      {isLoading ? <ListSkeleton /> : data?.length === 0 ? <Empty>No hay servicios para mostrar.</Empty> : (
        <div className="space-y-3">{data?.map((s) => <ServiceCard key={s.id} s={s} showDriver={admin} />)}</div>
      )}
    </div>
  );
}
