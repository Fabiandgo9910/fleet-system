/**
 * CONFIGURACIÓN CENTRALIZADA.
 * Todo valor configurable sale de variables de entorno. Se validan al arrancar:
 * si falta algo obligatorio, el servidor NO inicia y explica qué falta
 * (mejor fallar pronto que fallar en producción a mitad de un servicio).
 */
import 'dotenv/config';
import { z } from 'zod';

// Convierte "true"/"false" (texto) en booleano real.
const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(4000),
  ALLOWED_ORIGINS: z.string().min(1),
  RATE_LIMIT_MAX: z.coerce.number().default(300),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_SUBJECT: z.string().default('mailto:admin@example.com'),

  COMPANY_NAME: z.string().default('Mi Empresa'),
  DEFAULT_COUNTRY_CODE: z.string().default('34'),

  REVIEW_ENABLED: bool.default('true'),
  REVIEW_DELAY_MINUTES: z.coerce.number().min(0).default(10),
  REVIEW_URL: z.string().default(''),
  WHATSAPP_PROVIDER: z.enum(['log', 'cloud_api', 'disabled']).default('log'),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  WHATSAPP_TOKEN: z.string().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(''),
  WHATSAPP_TEMPLATE_NAME: z.string().default('solicitud_resena'),
  WHATSAPP_TEMPLATE_LANG: z.string().default('es'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas o ausentes:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
};
