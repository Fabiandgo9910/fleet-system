import { env } from '../config/env.js';

/**
 * Normaliza un teléfono a formato internacional "+34600111222".
 *  - "600 111 222"   -> "+34600111222"  (9 dígitos: añade prefijo por defecto)
 *  - "0034600111222" -> "+34600111222"
 *  - "+34 600..."    -> "+34600..."
 */
export function normalizePhone(raw = '') {
  let p = String(raw).replace(/[^\d+]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (!p.startsWith('+')) p = p.length === 9 ? `+${env.DEFAULT_COUNTRY_CODE}${p}` : `+${p}`;
  return p;
}
