/**
 * Cliente de Supabase con la clave SERVICE ROLE (acceso total, salta RLS).
 * SOLO vive en el backend. persistSession=false: no guarda sesiones en memoria.
 */
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
