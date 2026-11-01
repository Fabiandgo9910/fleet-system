'use client';
/** Ajustes de la empresa: dirección del almacén (se puede incluir en las rutas de los conductores). */
import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { api, fetcher } from '@/lib/api';
import { isAdmin } from '@/lib/format';
import { appConfig } from '@/config/brand.config';
import { useAuth, useConfirm, useToast } from '@/components/Providers';
import AddressInput from '@/components/AddressInput';
import Icon from '@/components/Icon';
import { ErrorBox, Field, PageHeader, Skeleton } from '@/components/ui';

export default function SettingsPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, isLoading } = useSWR('/settings', fetcher);
  const [w, setW] = useState({ address: '', lat: null, lng: null, place_id: null });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!isAdmin(profile.role)) return <p className="card">No tienes permiso para ver esta página.</p>;
  const current = data?.warehouse;
  const fieldError = touched && (!w.address.trim() ? 'Escribe la dirección del almacén.' : w.lat == null ? 'Elige una dirección de la lista desplegable.' : null);

  const save = async (e) => {
    e.preventDefault(); setTouched(true); setError(null);
    if (!w.address.trim() || w.lat == null) return;
    if (!(await confirm({ title: 'Guardar almacén', message: `${w.address}\n\nLos conductores podrán incluirlo como primera parada de su ruta.`, confirmText: 'Guardar' }))) return;
    setBusy(true);
    try { await api('/settings/warehouse', { method: 'PUT', body: w }); toast('Almacén guardado.', 'success'); setW({ address: '', lat: null, lng: null, place_id: null }); setTouched(false); mutate('/settings'); }
    catch (err) { setError(err); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!(await confirm({ title: 'Quitar almacén', message: 'Los conductores ya no verán la opción "Pasar por almacén".', confirmText: 'Quitar', danger: true }))) return;
    try { await api('/settings/warehouse', { method: 'DELETE' }); toast('Almacén eliminado.', 'success'); mutate('/settings'); } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Ajustes" subtitle="Configuración general de la empresa" />
      <section className="card space-y-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon name="warehouse" /></span>
          <div><h2 className="font-semibold">Dirección del almacén</h2>
            <p className="text-sm text-muted">Los conductores verán el interruptor «Pasar por almacén». Si lo activan, el almacén será la primera parada y el resto de la ruta se calcula desde allí.</p></div>
        </div>

        {isLoading ? <Skeleton className="h-16" /> : current && (
          <div className="flex items-center gap-3 rounded-lg border border-line bg-sunken p-3">
            <Icon name="pin" className="text-brand" /><p className="min-w-0 flex-1 text-sm font-medium">{current.address}</p>
            <button className="btn-soft-danger !min-h-8 !py-1 text-xs" onClick={remove}>Quitar</button>
          </div>
        )}

        <form onSubmit={save} noValidate className="space-y-4">
          <Field label={current ? 'Cambiar dirección' : 'Dirección del almacén'} required error={fieldError}>
            <AddressInput name="warehouse" value={w.address} picked={w.lat != null} error={fieldError} onBlur={() => setTouched(true)}
              onTyping={(address) => setW({ address, lat: null, lng: null, place_id: null })} onPick={(p) => setW(p)} />
          </Field>
          {!appConfig.maps.apiKey && <ErrorBox error={{ message: 'Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: sin ella no se puede buscar la dirección.' }} />}
          <ErrorBox error={error} />
          <button className="btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar almacén'}</button>
        </form>
      </section>
    </div>
  );
}
