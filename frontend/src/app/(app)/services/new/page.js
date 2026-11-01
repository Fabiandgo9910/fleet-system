'use client';
/** Alta de servicio (administradores): validación por campo, dirección con desplegable y confirmación. */
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { appConfig } from '@/config/brand.config';
import { isAdmin, money } from '@/lib/format';
import { rules, useForm, when } from '@/lib/validate';
import { useAuth, useConfirm, useToast } from '@/components/Providers';
import AddressInput from '@/components/AddressInput';
import Icon from '@/components/Icon';
import { ErrorBox, Field, PageHeader, Switch } from '@/components/ui';

const initial = {
  client_name: '', client_phone: '', address: '', lat: null, lng: null, place_id: null,
  plate: '', battery_model: '', price: '', arrival_time: '', leaves_old_battery: false, notes: '', driver_id: '',
  add_stock: false, stock_driver: '', stock_qty: '1',
};

// Reglas de cada campo (se muestran en cuanto el usuario sale del campo o intenta enviar).
const schema = {
  client_name: [rules.required('Escribe el nombre del cliente.'), rules.minLen(2), rules.maxLen(120)],
  client_phone: [rules.required('Escribe el teléfono del cliente.'), rules.phone()],
  address: [rules.required('Escribe la dirección exacta.'),
    rules.custom((_v, all) => (appConfig.maps.apiKey && all.lat == null ? 'Elige una dirección de la lista desplegable.' : null))],
  plate: [rules.required('Escribe la matrícula.'), rules.plate()],
  battery_model: [rules.required('Indica la batería a montar.'), rules.maxLen(120)],
  price: [rules.required('Indica el importe a cobrar.'), rules.number(), rules.min(0), rules.max(100000), rules.decimals(2)],
  notes: [rules.maxLen(1000)],
  stock_driver: [when((a) => a.add_stock, rules.required('Elige el conductor que recibe las baterías.'))],
  stock_qty: [when((a) => a.add_stock, rules.required('Indica la cantidad.'), rules.integer(), rules.min(1), rules.max(500))],
};

export default function NewServicePage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { profile } = useAuth();
  const { data: drivers } = useSWR('/drivers', fetcher);
  const form = useForm(initial, schema);
  const v = form.values;

  if (!isAdmin(profile.role)) return <p className="card">No tienes permiso para ver esta página.</p>;
  const err = form.error;
  const cls = (n) => `field ${err(n) ? 'field-error' : ''}`;
  const activeDrivers = (drivers || []).filter((d) => d.active);

  const submit = form.submit(async (val) => {
    const driver = drivers?.find((d) => d.id === val.driver_id);
    const ok = await confirm({
      title: 'Crear servicio',
      message: `Cliente: ${val.client_name}\nDirección: ${val.address}\nMatrícula: ${val.plate.toUpperCase()}\nBatería: ${val.battery_model}\nA cobrar: ${money(val.price)}\n` +
        (driver ? `\nSe asignará a ${driver.full_name} y recibirá una notificación.` : '\nQuedará sin asignar.'),
      confirmText: 'Crear servicio',
    });
    if (!ok) return;
    const created = await api('/services', {
      method: 'POST',
      body: {
        client_name: val.client_name.trim(), client_phone: val.client_phone.trim(), address: val.address.trim(),
        lat: val.lat, lng: val.lng, place_id: val.place_id,
        plate: val.plate.trim(), battery_model: val.battery_model.trim(), price: Number(String(val.price).replace(',', '.')),
        leaves_old_battery: val.leaves_old_battery, notes: val.notes.trim() || null,
        arrival_time: val.arrival_time ? new Date(val.arrival_time).toISOString() : null,
        driver_id: val.driver_id || null,
        stock_add: val.add_stock ? { driver_id: val.stock_driver, quantity: Number(val.stock_qty) } : null,
      },
    });
    toast(`Servicio #${created.code} creado correctamente.`, 'success');
    router.push(`/services/${created.id}`);
  });

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-3xl">
      <PageHeader title="Nuevo servicio" subtitle="Los campos marcados con * son obligatorios" />

      <div className="space-y-4">
        <section className="card space-y-4">
          <h2 className="flex items-center gap-2 font-semibold"><Icon name="user" className="h-[18px] w-[18px] text-brand" />Cliente</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" required error={err('client_name')}><input className={cls('client_name')} autoComplete="off" {...form.bind('client_name')} /></Field>
            <Field label="Teléfono" required error={err('client_phone')} hint="Se guarda en formato internacional.">
              <input className={cls('client_phone')} type="tel" inputMode="tel" {...form.bind('client_phone')} /></Field>
          </div>
          <Field label="Dirección exacta" required error={err('address')}>
            <AddressInput name="address" value={v.address} picked={v.lat != null} error={err('address')}
              onBlur={() => form.bind('address').onBlur()}
              onTyping={(address) => form.setValues((x) => ({ ...x, address, lat: null, lng: null, place_id: null }))}
              onPick={(p) => form.setValues((x) => ({ ...x, ...p }))} />
          </Field>
        </section>

        <section className="card space-y-4">
          <h2 className="flex items-center gap-2 font-semibold"><Icon name="battery" className="h-[18px] w-[18px] text-brand" />Servicio</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Matrícula del coche" required error={err('plate')}><input className={`${cls('plate')} font-mono uppercase tracking-wider`} {...form.bind('plate')} /></Field>
            <Field label="Batería a montar" required error={err('battery_model')}><input className={cls('battery_model')} placeholder="Ej. 70Ah 720A" {...form.bind('battery_model')} /></Field>
            <Field label="A cobrar (€)" required error={err('price')}><input className={cls('price')} inputMode="decimal" placeholder="0,00" {...form.bind('price')} /></Field>
            <Field label="Hora de llegada prevista"><input className="field" type="datetime-local" {...form.bind('arrival_time')} /></Field>
          </div>
          <Switch label="El cliente deja la batería vieja" {...form.bind('leaves_old_battery', { checkbox: true })} />
          <Field label="Notas (opcional)" error={err('notes')}><textarea className={cls('notes')} rows={2} {...form.bind('notes')} /></Field>
        </section>

        <section className="card space-y-4">
          <h2 className="flex items-center gap-2 font-semibold"><Icon name="truck" className="h-[18px] w-[18px] text-brand" />Asignación</h2>
          <Field label="Conductor" hint="Si eliges uno, recibirá la notificación al instante.">
            <select className="field" {...form.bind('driver_id')}>
              <option value="">Sin asignar por ahora</option>
              {activeDrivers.map((d) => <option key={d.id} value={d.id}>{d.full_name} · stock {d.driver?.battery_stock ?? 0}</option>)}
            </select>
          </Field>
          <Switch label="Añadir baterías al stock de un conductor" description="Útil si el conductor necesita reponer antes de salir."
            {...form.bind('add_stock', { checkbox: true })} />
          {v.add_stock && (
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <Field label="Conductor" required error={err('stock_driver')}>
                <select className={cls('stock_driver')} {...form.bind('stock_driver')}>
                  <option value="">Elegir…</option>{activeDrivers.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                </select></Field>
              <Field label="Cantidad" required error={err('stock_qty')}><input className={cls('stock_qty')} inputMode="numeric" {...form.bind('stock_qty')} /></Field>
            </div>
          )}
        </section>

        <ErrorBox error={form.formError} />
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancelar</button>
          <button className="btn-primary min-w-40" disabled={form.busy}>{form.busy ? 'Creando…' : 'Crear servicio'}</button>
        </div>
      </div>
    </form>
  );
}
