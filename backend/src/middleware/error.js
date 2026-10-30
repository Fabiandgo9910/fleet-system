import { ZodError } from 'zod';
import { HttpError } from '../lib/errors.js';

/** Manejador global de errores: ningún detalle interno llega al cliente. */
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Datos inválidos.',
      details: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error('[error]', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
}
