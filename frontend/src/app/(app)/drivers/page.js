'use client';
/** Conductores: stock, efectivo pendiente de entregar y baterías viejas. */
import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { api, fetcher } from '@/lib/api';
import { isAdmin, money } from '@/lib/format';
import { useAuth, useConfirm, useToast } from '@/components/Providers';
import { Empty, ErrorBox, ListSkeleton, Modal } from '@/components/ui';

export default function DriversPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, isLoading } = useSWR('/drivers', fetcher);
  const [stockFor, setStockFor] = useState(null);
  const [delta, setDelta] = useState('');
  const [err, setErr] = useState(null);

  if (!isAdmin(profile.role)) return <p className="card">No tienes permiso para ver esta página.</p>;

  const settle = async (d) => {
    const cash = d.driver?.cash_collected ?? 0;
    if (!(await confirm({
      title: 'Recibir efectivo',
      message: `${d.full_name} te entrega ${money(cash)}.\nSu contador de efectivo volverá a 0.`,
      confirmText: 'Confirmar entrega',
    }))) return;
    try { await api(`/drivers/${d.id}/settle`, { method: 'POST' }); toast('Efectivo reiniciado', 'success'); mutate('/drivers'); }
    catch (e) { toast(e.message, 'error'); }
  };

  const saveStock = async (e) => {
    e.preventDefault(); setErr(null);
    const n = Number(delta);
    const ok = await confirm({ title: 'Ajustar stock', message: `${n > 0 ? 'Añadir' : 'Quitar'} ${Math.abs(n)} batería(s) a ${stockFor.full_name}.`, confirmText: 'Confirmar' });
    if (!ok) return;
    try { await api(`/drivers/${stockFor.id}/stock`, { method: 'POST', body: { delta: n } }); toast('Stock actualizado', 'success'); setStockFor(null); setDelta(''); mutate('/drivers'); }
    catch (e2) { setErr(e2); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Conductores</h1>
      <ErrorBox error={error} />
      {isLoading ? <ListSkeleton rows={3} /> : !data?.length ? <Empty>Aún no hay conductores. Créalos desde Usuarios.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((d) => (
            <div key={d.id} className={`card space-y-3 ${d.active ? '' : 'opacity-60'}`}>
              <div><p className="font-bold">{d.full_name}{!d.active && ' (inactivo)'}</p><p className="text-sm text-gray-500">{d.phone || 'Sin teléfono'}</p></div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-gray-50 p-2"><p className="text-xs text-gray-500">🔋 Stock</p><p className={`text-lg font-bold ${(d.driver?.battery_stock ?? 0) <= 0 ? 'text-red-600' : ''}`}>{d.driver?.battery_stock ?? 0}</p></div>
                <div className="rounded-xl bg-gray-50 p-2"><p className="text-xs text-gray-500">💶 Efectivo</p><p className="text-lg font-bold">{money(d.driver?.cash_collected)}</p></div>
                <div className="rounded-xl bg-gray-50 p-2"><p className="text-xs text-gray-500">♻️ Viejas</p><p className="text-lg font-bold">{d.driver?.old_batteries_received ?? 0}</p></div>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1" onClick={() => { setStockFor(d); setDelta(''); setErr(null); }}>🔋 Ajustar stock</button>
                <button className="btn-primary flex-1" disabled={!(d.driver?.cash_collected > 0)} onClick={() => settle(d)}>💶 Recibir efectivo</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={Boolean(stockFor)} onClose={() => setStockFor(null)} title={`Stock de ${stockFor?.full_name ?? ''}`}>
        <form onSubmit={saveStock} className="space-y-3">
          <label><span className="label">Cantidad (positivo suma, negativo resta)</span>
            <input className="input" type="number" step="1" required autoFocus value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="Ej. 10 o -2" /></label>
          <ErrorBox error={err} />
          <button className="btn-primary w-full" disabled={!delta || Number(delta) === 0}>Guardar</button>
        </form>
      </Modal>
    </div>
  );
}
