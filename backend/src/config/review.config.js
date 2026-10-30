/**
 * CONFIGURACIÓN DE LA RESEÑA POR WHATSAPP
 * ----------------------------------------------------------------
 * Edita aquí (o mejor, en las variables de entorno) cuándo y qué se envía
 * al cliente tras finalizar un servicio con éxito.
 *
 *  - delayMinutes : minutos de espera tras finalizar (por defecto 10)
 *  - reviewUrl    : enlace directo a la reseña (Google, Trustpilot...)
 *  - template     : plantilla de WhatsApp aprobada en Meta. Recibe 2 variables:
 *                   {{1}} = nombre del cliente, {{2}} = enlace de reseña.
 *  - messageText  : texto de referencia (solo se usa si provider = 'log').
 */
import { env } from './env.js';

export const reviewConfig = {
  enabled: env.REVIEW_ENABLED,
  delayMinutes: env.REVIEW_DELAY_MINUTES,
  reviewUrl: env.REVIEW_URL,
  maxAttempts: 3, // reintentos si WhatsApp falla
  template: { name: env.WHATSAPP_TEMPLATE_NAME, language: env.WHATSAPP_TEMPLATE_LANG },
  messageText: (name) =>
    `Hola ${name}, gracias por confiar en ${env.COMPANY_NAME}. ` +
    `¿Nos dejas una reseña? Nos ayuda mucho: ${env.REVIEW_URL}`,
};
