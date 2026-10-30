'use client';
/** Mapa de servicios (administradores), actualizado en tiempo real. */
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { isAdmin, STATUS } from '@/lib/format';
import { useAuth } from '@/components/Providers';
import MapView from '@/components/MapView';

export default function MapPage() {
  const { profile } = useAuth();
  const [all, setAll] = useState(false);
  const { data } = useSWR(`/services?${all ? '' : 'status=created,assigned,accepted&'}limit=300`, fetcher);
  if (!isAdmin(profile.role)) return <p className="card">No tienes permiso para ver esta página.</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Mapa de servicios</h1>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={all} onChange={(e) => setAll(e.target.checked)} />Incluir finalizados</label>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {['created', 'assigned', 'accepted', ...(all ? ['finished_ok', 'finished_failed', 'cancelled'] : [])].map((k) => (
          <span key={k} className={`rounded-full px-2 py-1 ${STATUS[k].cls}`}>{STATUS[k].label}</span>
        ))}
      </div>
      <MapView services={data || []} />
    </div>
  );
}
