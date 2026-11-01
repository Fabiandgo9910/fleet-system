'use client';
/**
 * SERVICIOS ACTIVOS (operación diaria).
 * El histórico completo (finalizados, cancelados, filtros) está en /history.
 * El backend ya filtra por rol (conductor: solo los suyos).
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { isAdmin, money, todayISO } from '@/lib/format';
import { useAuth } from '@/components/Providers';
import ServiceCard from '@/components/ServiceCard';
import RouteButton from '@/components/RouteButton';
import Icon from '@/components/Icon';
import { Empty, ErrorBox, Kpi, ListSkeleton, PageHeader, Skeleton } from '@/components/ui';

function AdminKpis({ active }) {
  const since = useMemo(() => todayISO(), []);
  const { data } = useSWR(`/reports/summary?from=${encodeURIComponent(since)}`, fetcher);
  const t = data?.totals;
  const done = t ? t.finished_ok + t.finished_failed : 0;
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi icon="grid" label="Servicios activos" value={active.length} hint="Creados, asignados o en curso" />
      <Kpi icon="alert" label="Sin asignar" value={active.filter((s) => s.status === 'created').length} hint="Esperando conductor" />
      <Kpi icon="euro" label="Cobrado hoy" value={t ? money(t.cash_total + t.card_total) : '—'} hint={t ? `Efectivo ${money(t.cash_total)}` : ''} />
      <Kpi label="Tasa de éxito hoy" value={t ? `${t.finished_ok}/${done || 0}` : '—'} hint="Finalizados con éxito" ring={done ? (t.finished_ok / done) * 100 : 0} />
    </div>
  );
}

function DriverKpis() {
  const { data } = useSWR('/me', fetcher);
  if (!data) return <div className="mb-5 grid grid-cols-3 gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;
  const d = data.driver || {};
  return (
    <div className="mb-5 grid grid-cols-3 gap-3">
      <Kpi icon="battery" label="Mi stock" value={d.battery_stock ?? 0} hint="baterías" />
      <Kpi icon="cash" label="Efectivo" value={money(d.cash_collected)} hint="por entregar" />
      <Kpi icon="refresh" label="Viejas" value={d.old_batteries_received ?? 0} hint="recogidas" />
    </div>
  );
}

export default function ServicesPage() {
  const { profile } = useAuth();
  const admin = isAdmin(profile.role);
  const [status, setStatus] = useState('all');
  const [driverId, setDriverId] = useState('');
  const { data, error, isLoading } = useSWR('/services?status=created,assigned,accepted&limit=300', fetcher);
  const { data: drivers } = useSWR(admin ? '/drivers' : null, fetcher);

  const list = data || [];
  const accepted = list.filter((s) => s.status === 'accepted');
  const filtered = list.filter((s) => (status === 'all' || s.status === status) && (!driverId || s.driver_id === driverId));
  const chips = [
    ['all', 'Todos', list.length], ['created', 'Sin asignar', list.filter((s) => s.status === 'created').length],
    ['assigned', 'Asignados', list.filter((s) => s.status === 'assigned').length], ['accepted', 'Aceptados', accepted.length],
  ].filter(([id]) => admin || id !== 'created');

  return (
    <div>
      <PageHeader title="Servicios" subtitle="Servicios activos en este momento"
        actions={<>
          <Link href="/history" className="btn-ghost"><Icon name="history" className="h-4 w-4" />Historial</Link>
          {admin && <Link href="/services/new" className="btn-primary"><Icon name="plus" className="h-4 w-4" />Nuevo servicio</Link>}
        </>} />

      {admin ? <AdminKpis active={list} /> : profile.role === 'driver' && <DriverKpis />}

      {profile.role === 'driver' && accepted.length > 0 && (
        <div className="card mb-5 space-y-3">
          <div><p className="font-semibold">Ruta de tus servicios aceptados</p>
            <p className="text-sm text-muted">{accepted.length === 1 ? '1 servicio' : `${accepted.length} servicios`} · orden más corto desde tu ubicación</p></div>
          <RouteButton services={accepted} label={accepted.length === 1 ? 'Abrir ruta en Google Maps' : `Ruta más corta para ${accepted.length} servicios`} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {chips.map(([id, label, n]) => (
          <button key={id} onClick={() => setStatus(id)} className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${status === id ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-muted hover:text-ink'}`}>
            {label}<span className={`rounded-full px-1.5 text-xs ${status === id ? 'bg-white/20' : 'bg-sunken'}`}>{n}</span>
          </button>
        ))}
        {admin && (
          <select className="field !w-auto !py-1.5 text-sm sm:ml-auto" value={driverId} onChange={(e) => setDriverId(e.target.value)} aria-label="Filtrar por conductor">
            <option value="">Todos los conductores</option>
            {(drivers || []).map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>
        )}
      </div>

      <ErrorBox error={error} className="mb-4" />
      {isLoading ? <ListSkeleton /> : filtered.length === 0 ? (
        <Empty icon="checkCircle" title="Todo al día">No hay servicios activos con este filtro.</Empty>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">{filtered.map((s) => <ServiceCard key={s.id} s={s} showDriver={admin} />)}</div>
      )}
    </div>
  );
}
