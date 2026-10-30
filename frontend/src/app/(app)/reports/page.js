'use client';
/** Informes: resumen filtrable por fechas y detalle por conductor. */
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { isAdmin, money } from '@/lib/format';
import { useAuth } from '@/components/Providers';
import ServiceCard from '@/components/ServiceCard';
import { Empty, ErrorBox, ListSkeleton, Skeleton } from '@/components/ui';

const iso = (d) => d.toISOString().slice(0, 10);
const monthStart = () => { const d = new Date(); d.setDate(1); return iso(d); };

const Stat = ({ label, value }) => (
  <div className="card !p-3 text-center"><p className="text-xs text-gray-500">{label}</p><p className="text-lg font-bold">{value}</p></div>
);

function DriverRow({ r, from, to }) {
  const [open, setOpen] = useState(false);
  const qs = new URLSearchParams({ driver_id: r.driver_id, ...(from && { from: new Date(`${from}T00:00:00`).toISOString() }), ...(to && { to: new Date(`${to}T23:59:59`).toISOString() }) });
  const { data, isLoading } = useSWR(open ? `/services?${qs}&limit=500` : null, fetcher);
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between"><p className="font-bold">{r.full_name}</p><p className="text-sm text-gray-500">{r.total_services} servicios</p></div>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>🔋 Vendidas: <b>{r.batteries_sold}</b></div><div>♻️ Viejas: <b>{r.old_batteries}</b></div>
        <div>💶 Efectivo: <b>{money(r.cash_total)}</b></div><div>💳 Tarjeta: <b>{money(r.card_total)}</b></div>
        <div>✔ Éxito: <b>{r.finished_ok}</b></div><div>✖ Fallidos: <b>{r.finished_failed}</b></div><div>🚫 Cancelados: <b>{r.cancelled}</b></div>
      </div>
      <button className="btn-ghost w-full" onClick={() => setOpen(!open)}>{open ? 'Ocultar detalle' : 'Ver detalle de servicios'}</button>
      {open && (isLoading ? <ListSkeleton rows={2} /> : data?.length ? <div className="space-y-3">{data.map((s) => <ServiceCard key={s.id} s={s} />)}</div> : <Empty>Sin servicios en este periodo.</Empty>)}
    </div>
  );
}

export default function ReportsPage() {
  const { profile } = useAuth();
  const admin = isAdmin(profile.role);
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(iso(new Date()));
  const [driverId, setDriverId] = useState('');
  const { data: drivers } = useSWR(admin ? '/drivers' : null, fetcher);

  const key = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set('from', new Date(`${from}T00:00:00`).toISOString());
    if (to) p.set('to', new Date(`${to}T23:59:59`).toISOString());
    if (driverId) p.set('driver_id', driverId);
    return `/reports/summary?${p}`;
  }, [from, to, driverId]);
  const { data, error, isLoading } = useSWR(key, fetcher);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Informes</h1>
      <div className="card grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label><span className="label">Desde</span><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label><span className="label">Hasta</span><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        {admin && <label><span className="label">Conductor</span>
          <select className="input" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">Todos</option>{(drivers || []).map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select></label>}
      </div>
      <ErrorBox error={error} />
      {isLoading ? <><Skeleton className="h-24 w-full" /><ListSkeleton rows={2} /></> : data && (<>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="💶 Efectivo" value={money(data.totals.cash_total)} /><Stat label="💳 Tarjeta" value={money(data.totals.card_total)} />
          <Stat label="💰 Total cobrado" value={money(data.totals.cash_total + data.totals.card_total)} /><Stat label="📋 Servicios" value={data.totals.total_services} />
          <Stat label="🔋 Baterías vendidas" value={data.totals.batteries_sold} /><Stat label="♻️ Viejas recogidas" value={data.totals.old_batteries} />
          <Stat label="✔ Con éxito" value={data.totals.finished_ok} /><Stat label="✖ Fallidos / 🚫 Cancel." value={`${data.totals.finished_failed} / ${data.totals.cancelled}`} />
        </div>
        {data.drivers.length === 0 ? <Empty>Sin datos.</Empty> : <div className="space-y-3">{data.drivers.map((r) => <DriverRow key={r.driver_id} r={r} from={from} to={to} />)}</div>}
      </>)}
    </div>
  );
}
