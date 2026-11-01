'use client';
/**
 * HISTORIAL: todos los servicios y el historial de clientes.
 * Filtros: rango de fechas, matrícula y nombre/teléfono del cliente.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useDebounce } from '@/lib/validate';
import { charged, dateTime, dayEnd, dayStart, isAdmin, money, STATUS } from '@/lib/format';
import { useAuth } from '@/components/Providers';
import ServiceCard from '@/components/ServiceCard';
import Icon from '@/components/Icon';
import { Empty, ErrorBox, ListSkeleton, PageHeader, Skeleton, StatusBadge, Tabs } from '@/components/ui';

const PAGE = 100;

function Filters({ f, set, tab, admin, drivers, onClear, dirty }) {
  return (
    <div className="card mb-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tab === 'services' || admin ? (
          <label><span className="label">Cliente (nombre o teléfono)</span>
            <div className="relative"><Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <input className="field !pl-9" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Buscar cliente…" /></div></label>
        ) : null}
        <label><span className="label">Matrícula</span>
          <div className="relative"><Icon name="car" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input className="field !pl-9 uppercase" value={f.plate} onChange={(e) => set({ plate: e.target.value })} placeholder="1234ABC" /></div></label>
        <label><span className="label">Desde</span><input type="date" className="field" value={f.from} max={f.to || undefined} onChange={(e) => set({ from: e.target.value })} /></label>
        <label><span className="label">Hasta</span><input type="date" className="field" value={f.to} min={f.from || undefined} onChange={(e) => set({ to: e.target.value })} /></label>
      </div>
      {tab === 'services' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label><span className="label">Estado</span>
            <select className="field" value={f.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="">Todos</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select></label>
          {admin && <label><span className="label">Conductor</span>
            <select className="field" value={f.driver} onChange={(e) => set({ driver: e.target.value })}>
              <option value="">Todos</option>{(drivers || []).map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select></label>}
        </div>
      )}
      {dirty && <button onClick={onClear} className="btn-ghost !min-h-8 !py-1 text-xs"><Icon name="x" className="h-3.5 w-3.5" />Limpiar filtros</button>}
    </div>
  );
}

const Charged = ({ s }) => {
  const c = charged(s);
  return c === null ? <span className="text-faint">—</span> : (
    <div><p className="font-semibold">{money(c)}</p><p className="text-xs text-muted">Ef. {money(s.paid_cash)} · Tj. {money(s.paid_card)}</p></div>
  );
};

function ServicesTab({ query, admin, limit, setLimit }) {
  const router = useRouter();
  const { data, error, isLoading } = useSWR(`/services?${query}&limit=${limit}`, fetcher);
  const total = (data || []).reduce((a, s) => a + (charged(s) || 0), 0);
  if (error) return <ErrorBox error={error} />;
  if (isLoading) return <ListSkeleton />;
  if (!data.length) return <Empty icon="search" title="Sin resultados">No hay servicios que coincidan con los filtros.</Empty>;
  return (
    <>
      <p className="mb-3 text-sm text-muted">{data.length}{data.length === limit ? '+' : ''} servicios · Total cobrado: <b className="text-ink">{money(total)}</b></p>
      {/* Tabla (escritorio) */}
      <div className="card hidden overflow-x-auto !p-0 md:block">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-line bg-sunken"><tr>
            <th className="th">Nº</th><th className="th">Fecha</th><th className="th">Cliente</th><th className="th">Matrícula</th>
            <th className="th">Batería</th><th className="th">Cobrado</th>{admin && <th className="th">Conductor</th>}<th className="th">Estado</th></tr></thead>
          <tbody className="divide-y divide-line">
            {data.map((s) => (
              <tr key={s.id} onClick={() => router.push(`/services/${s.id}`)} className="cursor-pointer hover:bg-sunken">
                <td className="td font-semibold">#{s.code}</td>
                <td className="td whitespace-nowrap text-muted">{dateTime(s.created_at)}</td>
                <td className="td"><p className="font-medium">{s.client_name}</p><p className="text-xs text-muted">{s.client_phone}</p></td>
                <td className="td font-mono tracking-wider">{s.plate}</td>
                <td className="td">{s.battery_model}</td>
                <td className="td"><Charged s={s} /></td>
                {admin && <td className="td text-muted">{s.driver?.full_name || '—'}</td>}
                <td className="td"><StatusBadge status={s.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Tarjetas (móvil) */}
      <div className="space-y-3 md:hidden">{data.map((s) => <ServiceCard key={s.id} s={s} showDriver={admin} />)}</div>
      {data.length === limit && <button className="btn-ghost mx-auto mt-4 flex" onClick={() => setLimit(limit + PAGE)}>Cargar más</button>}
    </>
  );
}

function ClientCard({ c }) {
  const [open, setOpen] = useState(false);
  const initials = c.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className="card !p-0">
      <button className="flex w-full items-center gap-4 p-4 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand">{initials}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{c.name}</p>
          <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted"><span>{c.phone}</span>{c.last_address && <span className="truncate">{c.last_address}</span>}</p>
        </div>
        <div className="hidden text-right sm:block"><p className="text-sm font-semibold">{money(c.total_spent)}</p><p className="text-xs text-muted">{c.total_services} servicio{c.total_services === 1 ? '' : 's'}</p></div>
        <Icon name="chevronDown" className={`h-5 w-5 text-faint transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-line bg-sunken/60 p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <a href={`tel:${c.phone}`} className="btn-ghost !min-h-8 !py-1 text-xs"><Icon name="phone" className="h-3.5 w-3.5" />Llamar</a>
            <a href={`https://wa.me/${c.phone.replace('+', '')}`} target="_blank" rel="noreferrer" className="btn-ghost !min-h-8 !py-1 text-xs"><Icon name="message" className="h-3.5 w-3.5" />WhatsApp</a>
            <span className="ml-auto self-center text-sm text-muted sm:hidden">{money(c.total_spent)} · {c.total_services} serv.</span>
          </div>
          {c.services.length === 0 ? <p className="text-sm text-muted">Este cliente aún no tiene servicios.</p> : (
            <div className="space-y-2">
              {c.services.map((s) => (
                <Link key={s.id} href={`/services/${s.id}`} className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-line bg-surface p-3 text-sm hover:border-brand">
                  <span className="font-semibold">#{s.code}</span>
                  <span className="text-muted">{dateTime(s.created_at)}</span>
                  <span className="font-mono tracking-wider">{s.plate}</span>
                  <span className="inline-flex items-center gap-1.5"><Icon name="battery" className="h-3.5 w-3.5 text-faint" />{s.battery_model}</span>
                  <span className="ml-auto flex items-center gap-3"><b>{charged(s) === null ? '—' : money(charged(s))}</b><StatusBadge status={s.status} /></span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ClientsTab({ query }) {
  const { data, error, isLoading } = useSWR(`/clients?${query}`, fetcher);
  if (error) return <ErrorBox error={error} />;
  if (isLoading) return <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>;
  if (!data.length) return <Empty icon="users" title="Sin resultados">No hay clientes que coincidan con los filtros.</Empty>;
  return (<>
    <p className="mb-3 text-sm text-muted">{data.length} cliente{data.length === 1 ? '' : 's'}</p>
    <div className="space-y-3">{data.map((c) => <ClientCard key={c.id} c={c} />)}</div>
  </>);
}

export default function HistoryPage() {
  const { profile } = useAuth();
  const admin = isAdmin(profile.role);
  const [tab, setTab] = useState('services');
  const [f, setF] = useState({ q: '', plate: '', from: '', to: '', status: '', driver: '' });
  const [limit, setLimit] = useState(PAGE);
  const set = (p) => { setF((x) => ({ ...x, ...p })); setLimit(PAGE); };
  const dq = useDebounce(f.q), dp = useDebounce(f.plate);
  const { data: drivers } = useSWR(admin ? '/drivers' : null, fetcher);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (dq.trim()) p.set('q', dq.trim());
    if (dp.trim()) p.set('plate', dp.trim());
    if (f.from) p.set('from', dayStart(f.from));
    if (f.to) p.set('to', dayEnd(f.to));
    if (tab === 'services') { if (f.status) p.set('status', f.status); if (f.driver) p.set('driver_id', f.driver); }
    return p.toString();
  }, [dq, dp, f.from, f.to, f.status, f.driver, tab]);

  const dirty = Object.values(f).some(Boolean);
  const tabs = [{ id: 'services', label: 'Servicios', icon: 'list' }, ...(admin ? [{ id: 'clients', label: 'Clientes', icon: 'users' }] : [])];

  return (
    <div>
      <PageHeader title="Historial" subtitle="Consulta y filtra todos los servicios y clientes" />
      {tabs.length > 1 && <div className="mb-4"><Tabs tabs={tabs} value={tab} onChange={setTab} /></div>}
      <Filters f={f} set={set} tab={tab} admin={admin} drivers={drivers} dirty={dirty} onClear={() => { setF({ q: '', plate: '', from: '', to: '', status: '', driver: '' }); setLimit(PAGE); }} />
      {tab === 'services' ? <ServicesTab query={query} admin={admin} limit={limit} setLimit={setLimit} /> : <ClientsTab query={query} />}
    </div>
  );
}
