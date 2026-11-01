'use client';
/** Conductores: stock, efectivo pendiente de entregar y baterías viejas. */
import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { api, fetcher } from '@/lib/api';
import { isAdmin, money } from '@/lib/format';
import { rules, useForm } from '@/lib/validate';
import { useAuth, useConfirm, useToast } from '@/components/Providers';
import Icon from '@/components/Icon';
import { Empty, ErrorBox, Field, ListSkeleton, Modal, PageHeader } from '@/components/ui';

const Stat = ({ icon, label, value, warn }) => (
  <div className="rounded-lg bg-sunken p-3 text-center">
    <Icon name={icon} className="mx-auto h-4 w-4 text-faint" />
    <p className={`mt-1 text-lg font-semibold ${warn ? 'text-red-500' : ''}`}>{value}</p>
    <p className="text-[11px] text-muted">{label}</p>
  </div>
);

export default function DriversPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, isLoading } = useSWR('/drivers', fetcher);
  const [stockFor, setStockFor] = useState(null);
  const form = useForm({ delta: '' }, {
    delta: [rules.required('Indica la cantidad.'), rules.integer('Debe ser un número entero.'), rules.min(-500), rules.max(500),
      rules.custom((v) => (Number(v) === 0 ? 'La cantidad no puede ser 0.' : null))],
  });

  if (!isAdmin(profile.role)) return <p className="card">No tienes permiso para ver esta página.</p>;

  const settle = async (d) => {
    const cash = d.driver?.cash_collected ?? 0;
    if (!(await confirm({ title: 'Recibir efectivo', message: `${d.full_name} te entrega ${money(cash)}.\nSu contador de efectivo volverá a 0.`, confirmText: 'Confirmar entrega' }))) return;
    try { await api(`/drivers/${d.id}/settle`, { method: 'POST' }); toast('Efectivo recibido y contador reiniciado.', 'success'); mutate('/drivers'); }
    catch (e) { toast(e.message, 'error'); }
  };

  const save = form.submit(async ({ delta }) => {
    const n = Number(delta);
    const ok = await confirm({ title: 'Ajustar stock', message: `${n > 0 ? 'Añadir' : 'Quitar'} ${Math.abs(n)} batería${Math.abs(n) === 1 ? '' : 's'} a ${stockFor.full_name}.`, confirmText: 'Confirmar' });
    if (!ok) return;
    await api(`/drivers/${stockFor.id}/stock`, { method: 'POST', body: { delta: n } });
    toast('Stock actualizado.', 'success'); setStockFor(null); mutate('/drivers');
  });

  return (
    <div>
      <PageHeader title="Conductores" subtitle="Stock, efectivo y baterías viejas de cada conductor" />
      <ErrorBox error={error} className="mb-4" />
      {isLoading ? <ListSkeleton rows={3} /> : !data?.length ? <Empty icon="truck" title="Aún no hay conductores">Créalos desde la sección Usuarios.</Empty> : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((d) => (
            <div key={d.id} className={`card space-y-4 ${d.active ? '' : 'opacity-60'}`}>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand">{d.full_name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span>
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{d.full_name}{!d.active && ' (inactivo)'}</p><p className="text-sm text-muted">{d.phone || 'Sin teléfono'}</p></div>
                {d.phone && <a href={`tel:${d.phone}`} className="rounded-lg p-2 text-muted hover:bg-sunken" aria-label="Llamar"><Icon name="phone" /></a>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Stat icon="battery" label="Stock" value={d.driver?.battery_stock ?? 0} warn={(d.driver?.battery_stock ?? 0) <= 0} />
                <Stat icon="cash" label="Efectivo" value={money(d.driver?.cash_collected)} />
                <Stat icon="refresh" label="Viejas" value={d.driver?.old_batteries_received ?? 0} />
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1" onClick={() => { setStockFor(d); form.reset(); }}><Icon name="battery" className="h-4 w-4" />Ajustar stock</button>
                <button className="btn-primary flex-1" disabled={!(d.driver?.cash_collected > 0)} onClick={() => settle(d)}><Icon name="cash" className="h-4 w-4" />Recibir efectivo</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={Boolean(stockFor)} onClose={() => setStockFor(null)} title="Ajustar stock" subtitle={stockFor?.full_name}>
        <form onSubmit={save} noValidate className="space-y-4">
          <Field label="Cantidad" required error={form.error('delta')} hint="Positivo suma, negativo resta. Ej. 10 o -2.">
            <input className={`field ${form.error('delta') ? 'field-error' : ''}`} inputMode="numeric" autoFocus {...form.bind('delta')} />
          </Field>
          <ErrorBox error={form.formError} />
          <button className="btn-primary w-full" disabled={form.busy}>Guardar</button>
        </form>
      </Modal>
    </div>
  );
}
