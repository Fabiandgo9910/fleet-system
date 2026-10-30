/**
 * AUTENTICACIÓN Y ROLES
 *  1) El frontend inicia sesión con Supabase Auth y obtiene un JWT.
 *  2) Cada petición llega con "Authorization: Bearer <jwt>".
 *  3) Aquí se verifica el JWT con Supabase y se carga el perfil (rol).
 * Se cachea el perfil 30 s para no consultar la BD en cada petición.
 */
import { supabase } from '../lib/supabase.js';
import { HttpError } from '../lib/errors.js';

export const ADMIN_ROLES = ['super_admin', 'admin'];
const cache = new Map(); // token -> { profile, expires }
const TTL_MS = 30_000;

/** Limpia la caché (se llama al modificar usuarios para aplicar cambios al instante). */
export const clearAuthCache = () => cache.clear();

/** Valida un token y devuelve el perfil activo. Lo usan Express y Socket.IO. */
export async function verifyToken(token) {
  if (!token) throw new HttpError(401, 'No autenticado.');
  const hit = cache.get(token);
  if (hit && hit.expires > Date.now()) return hit.profile;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, 'Sesión inválida o caducada.');

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', data.user.id).maybeSingle();
  if (!profile) throw new HttpError(403, 'Tu usuario no tiene perfil. Contacta con el administrador.');
  if (!profile.active) throw new HttpError(403, 'Tu usuario está desactivado.');

  profile.email = data.user.email;
  cache.set(token, { profile, expires: Date.now() + TTL_MS });
  if (cache.size > 500) cache.clear(); // evita crecer sin límite
  return profile;
}

/** Middleware Express: exige sesión válida y deja el perfil en req.user. */
export async function authenticate(req, _res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /i, '');
  req.user = await verifyToken(token);
  next();
}

/** Middleware Express: exige uno de los roles indicados. */
export const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) throw new HttpError(403, 'No tienes permisos para esto.');
  next();
};
export const adminOnly = requireRole(...ADMIN_ROLES);
