'use client';
/** Mapa de servicios (administradores), actualizado en tiempo real. */
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { isAdmin, STATUS } from '@/lib/format';
import { useAuth } from '@/components/Providers';
import MapView from '@/components/MapView';
import { PageHeader, Switch } from '@/components/ui';

export default function MapPage() {
  const { profile } = useAuth();
  const [all, setAll] = useState(false);
  const { data } = useSWR(`/services?${all ? '' : 'status=created,assigned,accepted&'}limit=300`, fetcher);
  const { data: settings } = useSWR('/settings', fetcher);
  if (!isAdmin(profile.role)) return <p className="card">No tienes permiso para ver esta página.</p>;
  const keys = ['created', 'assigned', 'accepted', ...(all ? ['finished_ok', 'finished_failed', 'cancelled'] : [])];
  return (
    <div className="space-y-3">
      <PageHeader title="Mapa de servicios" subtitle="Ubicación de cada servicio en tiempo real" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs">
          {keys.map((k) => <span key={k} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${STATUS[k].cls}`}><span className={`h-1.5 w-1.5 rounded-full ${STATUS[k].dot}`} />{STATUS[k].label}</span>)}
          {settings?.warehouse && <span className="inline-flex items-center gap-1.5 rounded-full bg-nav px-2.5 py-1 font-semibold text-white">A · Almacén</span>}
        </div>
        <div className="w-full sm:w-64"><Switch label="Incluir finalizados" checked={all} onChange={(e) => setAll(e.target.checked)} /></div>
      </div>
      <MapView services={data || []} warehouse={settings?.warehouse} />
    </div>
  );
}
