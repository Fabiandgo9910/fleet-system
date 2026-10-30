/**
 * ENVÍO DE WHATSAPP (WhatsApp Business Cloud API de Meta)
 * Los mensajes iniciados por la empresa DEBEN usar una plantilla aprobada.
 * Proveedores (WHATSAPP_PROVIDER):
 *   log       -> solo escribe en consola (pruebas, por defecto)
 *   cloud_api -> envío real
 *   disabled  -> no hace nada
 */
import { env } from '../config/env.js';
import { reviewConfig } from '../config/review.config.js';

export async function sendReviewMessage({ phone, name }) {
  if (env.WHATSAPP_PROVIDER === 'disabled') return;
  if (env.WHATSAPP_PROVIDER === 'log') {
    console.log(`[whatsapp:log] -> ${phone}: ${reviewConfig.messageText(name)}`);
    return;
  }

  const res = await fetch(
    `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone.replace('+', ''), // Meta espera solo dígitos
        type: 'template',
        template: {
          name: reviewConfig.template.name,
          language: { code: reviewConfig.template.language },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: name },                  // {{1}}
              { type: 'text', text: reviewConfig.reviewUrl }, // {{2}}
            ],
          }],
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${await res.text()}`);
}
