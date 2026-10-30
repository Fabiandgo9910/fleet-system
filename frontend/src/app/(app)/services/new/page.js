'use client';
/** Alta de servicio (administradores): dirección con desplegable + asignación + stock. */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { appConfig } from '@/config/brand.config';
import { isAdmin, money } from '@/lib/format';
import { useAuth, useConfirm, useToast } from '@/components/Providers';
import AddressInput from '@/components/AddressInput';
import { ErrorBox, Field } from '@/components/ui';

const empty = {
  client_name: '', client_phone: '', address: '', lat: null, lng: null, place_id: null,
  plate: '', battery_model: '', price: '', leaves_old_battery: false, arrival_time: '', notes: '', driver_id: '',
};

export default function NewServicePage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { profile } = useAuth();
  const { data: drivers } = useSWR('/drivers', fetcher);
  const [f, setF] = useState(empty);
  const [addStock, setAddStock] = useState({ on: false, driver_id: '', quantity: 1 });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!isAdmin(profile.role)) return <p className="card">No tienes permiso para ver esta página.</p>;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const picked = f.lat != null;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (appConfig.maps.apiKey && !picked) return setError(new Error('Elige una dirección de la lista desplegable.'));
    const driver = drivers?.find((d) => d.id === f.driver_id);
    const ok = await confirm({
      title: 'Crear servicio',
      message: `Cliente: ${f.client_name}\nDirección: ${f.address}\nMatrícula: ${f.plate.toUpperCase()}\nBatería: ${f.battery_model}\nA cobrar: ${money(f.price)}\n` +
        (driver ? `Se asignará a: ${driver.full_name} (le llegará una notificación)` : 'Quedará sin asignar'),
      confirmText: 'Crear servicio',
    });
    if (!ok) return;

    setBusy(true);
    try {
      const created = await api('/services', {
        method: 'POST',
        body: {
          client_name: f.client_name, client_phone: f.client_phone, address: f.address,
          lat: f.lat, lng: f.lng, place_id: f.place_id,
          plate: f.plate, battery_model: f.battery_model, price: Number(f.price || 0),
          leaves_old_battery: f.leaves_old_battery, notes: f.notes || null,
          arrival_time: f.arrival_time ? new Date(f.arrival_time).toISOString() : null,
          driver_id: f.driver_id || null,
          stock_add: addStock.on && addStock.driver_id ? { driver_id: addStock.driver_id, quantity: Number(addStock.quantity) } : null,
        },
      });
      toast(`Servicio #${created.code} creado`, 'success');
      router.push(`/services/${created.id}`);
    } catch (err) { setError(err); setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-bold">Nuevo servicio</h1>

      <section className="card space-y-3">
        <h2 className="font-semibold">Cliente</h2>
        <Field label="Nombre"><input className="input" required value={f.client_name} onChange={set('client_name')} /></Field>
        <Field label="Teléfono"><input className="input" type="tel" inputMode="tel" required value={f.client_phone} onChange={set('client_phone')} /></Field>
        <Field label="Dirección exacta">
          <AddressInput value={f.address} picked={picked}
            onTyping={(address) => setF({ ...f, address, lat: null, lng: null, place_id: null })}
            onPick={(p) => setF({ ...f, ...p })} />
        </Field>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Servicio</h2>
        <Field label="Matrícula del coche"><input className="input uppercase" required value={f.plate} onChange={set('plate')} /></Field>
        <Field label="Batería a montar"><input className="input" required value={f.battery_model} onChange={set('battery_model')} placeholder="Ej. 70Ah 720A" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="A cobrar (€)"><input className="input" type="number" inputMode="decimal" min="0" step="0.01" required value={f.price} onChange={set('price')} /></Field>
          <Field label="Hora de llegada"><input className="input" type="datetime-local" value={f.arrival_time} onChange={set('arrival_time')} /></Field>
        </div>
        <label className="flex items-center gap-3 rounded-xl border p-3">
          <input type="checkbox" className="h-5 w-5" checked={f.leaves_old_battery} onChange={set('leaves_old_battery')} />
          <span className="text-sm font-medium">El cliente deja la batería vieja</span>
        </label>
        <Field label="Notas (opcional)"><textarea className="input" rows={2} value={f.notes} onChange={set('notes')} /></Field>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Asignación</h2>
        <Field label="Conductor" hint="Si eliges uno, recibirá la notificación al instante.">
          <select className="input" value={f.driver_id} onChange={set('driver_id')}>
            <option value="">Sin asignar por ahora</option>
            {(drivers || []).filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.full_name} · stock {d.driver?.battery_stock ?? 0}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-3 rounded-xl border p-3">
          <input type="checkbox" className="h-5 w-5" checked={addStock.on} onChange={(e) => setAddStock({ ...addStock, on: e.target.checked, driver_id: addStock.driver_id || f.driver_id })} />
          <span className="text-sm font-medium">Añadir baterías al stock de un conductor</span>
        </label>
        {addStock.on && (
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <select className="input" required value={addStock.driver_id} onChange={(e) => setAddStock({ ...addStock, driver_id: e.target.value })}>
                <option value="">Conductor…</option>
                {(drivers || []).map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select>
            </div>
            <input className="input" type="number" min="1" max="500" required value={addStock.quantity} onChange={(e) => setAddStock({ ...addStock, quantity: e.target.value })} aria-label="Cantidad" />
          </div>
        )}
      </section>

      <ErrorBox error={error} />
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creando…' : 'Crear servicio'}</button>
    </form>
  );
}
