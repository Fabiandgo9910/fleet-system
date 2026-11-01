'use client';
/** Informes: resumen filtrable por fechas y detalle por conductor. */
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { dayEnd, dayStart, isAdmin, money } from '@/lib/format';
import { useAuth } from '@/components/Providers';
import ServiceCard from '@/components/ServiceCard';
import Icon from '@/components/Icon';
import { Empty, ErrorBox, Kpi, ListSkeleton, PageHeader, Skeleton } from '@/components/ui';

const iso = (d) => d.toISOString().slice(0, 10);
const monthStart = () => { const d = new Date(); d.setDate(1); return iso(d); };

function DriverRow({ r, from, to }) {
  const [open, setOpen] = useState(false);
  const qs = new URLSearchParams({ driver_id: r.driver_id, ...(from && { from: dayStart(from) }), ...(to && { to: dayEnd(to) }) });
  const { data, isLoading } = useSWR(open ? `/services?${qs}&limit=500` : null, fetcher);
  const cell = (icon, label, value) => <div className="flex items-center gap-2 text-sm"><Icon name={icon} className="h-4 w-4 text-faint" /><span className="text-muted">{label}</span><b className="ml-auto sm:ml-1">{value}</b></div>;
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between"><p className="font-semibold">{r.full_name}</p><p className="text-sm text-muted">{r.total_services} servicios</p></div>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
        {cell('battery', 'Vendidas', r.batteries_sold)}{cell('refresh', 'Viejas', r.old_batteries)}
        {cell('cash', 'Efectivo', money(r.cash_total))}{cell('card', 'Tarjeta', money(r.card_total))}
        {cell('checkCircle', 'Éxito', r.finished_ok)}{cell('xCircle', 'Fallidos', r.finished_failed)}{cell('ban', 'Cancelados', r.cancelled)}
      </div>
      <button className="btn-ghost w-full" onClick={() => setOpen(!open)}>{open ? 'Ocultar detalle' : 'Ver detalle de servicios'}<Icon name="chevronDown" className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} /></button>
      {open && (isLoading ? <ListSkeleton rows={2} /> : data?.length ? <div className="grid gap-3 lg:grid-cols-2">{data.map((s) => <ServiceCard key={s.id} s={s} compact />)}</div> : <Empty>Sin servicios en este periodo.</Empty>)}
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
    if (from) p.set('from', dayStart(from));
    if (to) p.set('to', dayEnd(to));
    if (driverId) p.set('driver_id', driverId);
    return `/reports/summary?${p}`;
  }, [from, to, driverId]);
  const { data, error, isLoading } = useSWR(key, fetcher);
  const invalid = from && to && from > to;

  return (
    <div>
      <PageHeader title="Informes" subtitle="Resumen de cobros, baterías y servicios por periodo" />
      <div className="card mb-5 grid gap-3 sm:grid-cols-3">
        <label><span className="label">Desde</span><input type="date" className="field" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
        <label><span className="label">Hasta</span><input type="date" className="field" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
        {admin && <label><span className="label">Conductor</span>
          <select className="field" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">Todos</option>{(drivers || []).map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select></label>}
      </div>
      {invalid && <ErrorBox error={{ message: 'La fecha "Desde" no puede ser posterior a "Hasta".' }} className="mb-4" />}
      <ErrorBox error={error} className="mb-4" />
      {isLoading ? <><div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div><ListSkeleton rows={2} /></> : data && (<>
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon="euro" label="Total cobrado" value={money(data.totals.cash_total + data.totals.card_total)} />
          <Kpi icon="cash" label="Efectivo" value={money(data.totals.cash_total)} />
          <Kpi icon="card" label="Tarjeta" value={money(data.totals.card_total)} />
          <Kpi icon="list" label="Servicios" value={data.totals.total_services} />
          <Kpi icon="battery" label="Baterías vendidas" value={data.totals.batteries_sold} />
          <Kpi icon="refresh" label="Viejas recogidas" value={data.totals.old_batteries} />
          <Kpi icon="checkCircle" label="Con éxito" value={data.totals.finished_ok} />
          <Kpi icon="xCircle" label="Fallidos / cancel." value={`${data.totals.finished_failed} / ${data.totals.cancelled}`} />
        </div>
        {data.drivers.length === 0 ? <Empty icon="chart">Sin datos en este periodo.</Empty> : <div className="space-y-3">{data.drivers.map((r) => <DriverRow key={r.driver_id} r={r} from={from} to={to} />)}</div>}
      </>)}
    </div>
  );
}
