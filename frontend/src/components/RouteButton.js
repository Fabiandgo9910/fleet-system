'use client';
/**
 * Botón de ruta en Google Maps (uno o varios servicios).
 * Si hay almacén configurado muestra el interruptor "Pasar por almacén":
 * el almacén pasa a ser la primera parada y la ruta se ordena desde allí.
 */
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { buildRouteUrl, getPosition, singleRouteUrl } from '@/lib/maps';
import { useToast } from './Providers';
import Icon from './Icon';
import { Switch } from './ui';

export default function RouteButton({ services, label, className = 'btn-primary w-full' }) {
  const toast = useToast();
  const { data } = useSWR('/settings', fetcher);
  const warehouse = data?.warehouse || null;
  const [via, setVia] = useState(false);
  const [busy, setBusy] = useState(false);

  // Recuerda la preferencia en este dispositivo.
  useEffect(() => { try { setVia(localStorage.getItem('via_warehouse') === '1'); } catch {} }, []);
  const changeVia = (v) => { setVia(v); try { localStorage.setItem('via_warehouse', v ? '1' : '0'); } catch {} };

  const open = async () => {
    setBusy(true);
    // Se abre la pestaña ya (en el clic) para que el navegador no la bloquee.
    const win = window.open('', '_blank');
    const origin = await getPosition();
    const wh = via && warehouse ? warehouse : null;
    const url = services.length === 1
      ? singleRouteUrl(services[0], wh, origin)
      : buildRouteUrl(services, origin, wh);
    if (services.length > 1 && !services.some((s) => s.lat != null)) {
      win?.close(); setBusy(false);
      return toast('Estos servicios no tienen ubicación en el mapa.', 'error');
    }
    if (win) win.location.href = url; else window.location.href = url;
    if (!origin) toast('Sin permiso de ubicación: la ruta se calcula desde la primera parada.', 'info');
    setBusy(false);
  };

  return (
    <div className="space-y-2">
      {warehouse && (
        <Switch label="Pasar por almacén" description={warehouse.address} checked={via} onChange={(e) => changeVia(e.target.checked)} />
      )}
      <button className={className} onClick={open} disabled={busy}>
        <Icon name={services.length > 1 ? 'route' : 'navigation'} className="h-4 w-4" />{label}
      </button>
    </div>
  );
}
