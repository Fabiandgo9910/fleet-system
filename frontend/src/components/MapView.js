'use client';
/** Mapa de Google con un marcador por servicio, coloreado por estado. */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadMaps } from '@/lib/maps';
import { appConfig } from '@/config/brand.config';
import { STATUS } from '@/lib/format';
import { Skeleton } from './ui';

const PIN_COLORS = { created: '#6b7280', assigned: '#f59e0b', accepted: '#2563eb', finished_ok: '#059669', finished_failed: '#dc2626', cancelled: '#a1a1aa' };

export default function MapView({ services }) {
  const router = useRouter();
  const el = useRef(null);
  const state = useRef({}); // { map, info, markers, lib }
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  // 1) Crear el mapa una sola vez.
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const maps = await loadMaps();
        const { Map, InfoWindow } = await maps.importLibrary('maps');
        const marker = await maps.importLibrary('marker');
        if (cancel) return;
        state.current = {
          map: new Map(el.current, { center: appConfig.maps.defaultCenter, zoom: 11, mapId: appConfig.maps.mapId, streetViewControl: false, mapTypeControl: false }),
          info: new InfoWindow(), markers: [], marker,
        };
        setReady(true);
      } catch (e) { setError(e.message); }
    })();
    return () => { cancel = true; };
  }, []);

  // 2) Redibujar marcadores cuando cambian los servicios (también en tiempo real).
  useEffect(() => {
    if (!ready) return;
    const { map, info, markers, marker } = state.current;
    markers.forEach((m) => (m.map = null));
    state.current.markers = [];
    const bounds = new window.google.maps.LatLngBounds();

    services.filter((s) => s.lat != null).forEach((s) => {
      const pin = new marker.PinElement({ background: PIN_COLORS[s.status], borderColor: '#fff', glyphColor: '#fff', glyph: String(s.code) });
      const m = new marker.AdvancedMarkerElement({ map, position: { lat: s.lat, lng: s.lng }, content: pin.element, title: s.address });
      m.addListener('gmp-click', () => {
        // Contenido creado con textContent: evita inyección de HTML.
        const box = document.createElement('div');
        box.style.cssText = 'font:14px system-ui;max-width:220px';
        const add = (txt, bold) => { const p = document.createElement('div'); p.textContent = txt; if (bold) p.style.fontWeight = '700'; box.appendChild(p); };
        add(`#${s.code} · ${STATUS[s.status].label}`, true);
        add(s.client_name); add(s.address); add(`🚚 ${s.driver?.full_name || 'Sin asignar'}`);
        const a = document.createElement('a');
        a.textContent = 'Ver servicio →'; a.href = '#'; a.style.cssText = 'color:#2563eb;font-weight:600';
        a.onclick = (ev) => { ev.preventDefault(); router.push(`/services/${s.id}`); };
        box.appendChild(a);
        info.setContent(box); info.open({ map, anchor: m });
      });
      state.current.markers.push(m);
      bounds.extend({ lat: s.lat, lng: s.lng });
    });
    if (state.current.markers.length) map.fitBounds(bounds, 60);
    if (state.current.markers.length === 1) map.setZoom(15);
  }, [services, ready, router]);

  return (
    <div className="relative h-[calc(100dvh-15rem)] min-h-80 overflow-hidden rounded-2xl border bg-gray-100">
      {!ready && !error && <Skeleton className="absolute inset-0 !rounded-none" />}
      {error && <p className="p-4 text-sm text-red-600">{error}</p>}
      <div ref={el} className="h-full w-full" />
    </div>
  );
}
