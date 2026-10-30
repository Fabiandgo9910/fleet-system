/**
 * PLANIFICADOR DE RESEÑAS
 * Cada 30 s busca servicios finalizados con éxito hace >= delayMinutes y sin
 * reseña enviada, y les manda el WhatsApp. Está basado en la BD (no en
 * temporizadores en memoria), así que si el servidor se reinicia o se
 * "duerme" (plan gratuito) no se pierde ningún envío pendiente.
 */
import { supabase } from '../lib/supabase.js';
import { reviewConfig } from '../config/review.config.js';
import { sendReviewMessage } from '../services/whatsapp.js';

let running = false;

async function tick() {
  if (running || !reviewConfig.enabled) return;
  running = true;
  try {
    const cutoff = new Date(Date.now() - reviewConfig.delayMinutes * 60_000).toISOString();
    const { data: due } = await supabase.from('services')
      .select('id, client_name, client_phone, review_attempts')
      .eq('status', 'finished_ok').is('review_sent_at', null)
      .lt('review_attempts', reviewConfig.maxAttempts)
      .lte('finished_at', cutoff).limit(20);

    for (const s of due || []) {
      try {
        await sendReviewMessage({ phone: s.client_phone, name: s.client_name });
        await supabase.from('services')
          .update({ review_sent_at: new Date().toISOString(), review_error: null }).eq('id', s.id);
      } catch (e) {
        await supabase.from('services')
          .update({ review_attempts: s.review_attempts + 1, review_error: String(e.message).slice(0, 300) })
          .eq('id', s.id);
        console.error('[review]', s.id, e.message);
      }
    }
  } catch (e) {
    console.error('[review:tick]', e.message);
  } finally {
    running = false;
  }
}

export function startReviewScheduler() {
  const timer = setInterval(tick, 30_000);
  tick(); // ejecuta una vez al arrancar (recupera pendientes tras un reinicio)
  return () => clearInterval(timer);
}
