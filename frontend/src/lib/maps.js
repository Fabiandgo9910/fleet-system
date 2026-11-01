'use client';
/**
 * UTILIDADES DE GOOGLE MAPS
 *  - loadMaps()        carga el script de Google una sola vez
 *  - buildRouteUrl()   URL de Google Maps con la ruta para varios servicios
 */
import { appConfig } from '@/config/brand.config';

/**
 * Carga Google Maps con el "bootstrap loader" oficial de Google: define
 * google.maps.importLibrary(...) de inmediato (encola las llamadas hasta que
 * el script termina de cargar). Se instala una sola vez.
 */
export function loadMaps() {
  if (typeof window === 'undefined') return Promise.reject(new Error('solo navegador'));
  if (!appConfig.maps.apiKey) return Promise.reject(new Error('Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'));
  if (!window.google?.maps?.importLibrary) {
    ((g) => { var h, a, k, p = 'The Google Maps JavaScript API', c = 'google', l = 'importLibrary', q = '__ib__', m = document, b = window;
      b = b[c] || (b[c] = {}); var d = b.maps || (b.maps = {}), r = new Set(), e = new URLSearchParams(),
        u = () => h || (h = new Promise(async (f, n) => { await (a = m.createElement('script'));
          e.set('libraries', [...r] + ''); for (k in g) e.set(k.replace(/[A-Z]/g, (t) => '_' + t[0].toLowerCase()), g[k]);
          e.set('callback', c + '.maps.' + q); a.src = `https://maps.${c}apis.com/maps/api/js?` + e; d[q] = f;
          a.onerror = () => (h = n(Error(p + ' could not load.'))); a.nonce = m.querySelector('script[nonce]')?.nonce || '';
          m.head.append(a); }));
      d[l] ? console.warn(p + ' only loads once. Ignoring:', g) : (d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)));
    })({ key: appConfig.maps.apiKey, v: 'weekly' });
  }
  return Promise.resolve(window.google.maps);
}

const rad = (d) => (d * Math.PI) / 180;
/** Distancia en km entre dos puntos (fórmula de Haversine). */
function km(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/**
 * Construye la URL de Google Maps con la ruta.
 *  - Ordena las paradas por "vecino más cercano" desde la posición del conductor.
 *  - Si se pasa `warehouse`, el almacén es la PRIMERA parada (se recogen las
 *    baterías allí) y el orden de los servicios se calcula desde el almacén.
 * Google admite hasta 9 paradas intermedias en este formato de enlace.
 */
export function buildRouteUrl(services, origin = null, warehouse = null) {
  let pending = services.filter((s) => s.lat != null && s.lng != null);
  const ordered = [];
  let current = origin;
  if (warehouse) { ordered.push(warehouse); current = warehouse; }
  while (pending.length) {
    if (!current) { current = pending.shift(); ordered.push(current); continue; }
    pending.sort((a, b) => km(current, a) - km(current, b));
    current = pending.shift();
    ordered.push(current);
  }
  const point = (s) => `${s.lat},${s.lng}`;
  const params = new URLSearchParams({ api: '1', travelmode: 'driving', destination: point(ordered[ordered.length - 1]) });
  if (origin) params.set('origin', `${origin.lat},${origin.lng}`);
  const middle = ordered.slice(0, -1).slice(0, 9);
  if (middle.length) params.set('waypoints', middle.map(point).join('|'));
  return `https://www.google.com/maps/dir/?${params}`;
}

/** Enlace a un solo servicio (con o sin paso por el almacén). */
export function singleRouteUrl(s, warehouse = null, origin = null) {
  if (warehouse && s.lat != null) return buildRouteUrl([s], origin, warehouse);
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${
    s.lat != null ? `${s.lat},${s.lng}` : encodeURIComponent(s.address)}`;
}

/** Pide la ubicación actual (puede fallar si el usuario no da permiso). */
export const getPosition = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });
