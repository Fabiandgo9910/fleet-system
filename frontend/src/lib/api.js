'use client';
/** Cliente de la API: añade el JWT automáticamente y normaliza los errores. */
import { supabase } from './supabase';
import { appConfig } from '@/config/brand.config';

export async function api(path, { method = 'GET', body } = {}) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${appConfig.apiUrl}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(data.session && { Authorization: `Bearer ${data.session.access_token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.details?.join(' · ') || json.error || 'Error de red');
  return json;
}

/** Fetcher para SWR: useSWR('/services', fetcher) */
export const fetcher = (path) => api(path);
