/** Aplicación Express: seguridad, rendimiento y rutas. */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';
import me from './routes/me.js';
import services from './routes/services.js';
import drivers from './routes/drivers.js';
import users from './routes/users.js';
import reports from './routes/reports.js';
import notifications from './routes/notifications.js';
import clients from './routes/clients.js';
import settings from './routes/settings.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // detrás del proxy de Render: IP real para el rate-limit
  app.disable('x-powered-by');

  app.use(helmet());                       // cabeceras de seguridad
  app.use(compression());                  // respuestas comprimidas (más rápido)
  app.use(cors({ origin: env.allowedOrigins, credentials: true }));
  app.use(express.json({ limit: '50kb' })); // cuerpos pequeños: evita abusos

  // Health check (Render + UptimeRobot): sin autenticación ni rate-limit.
  app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

  // Límite de peticiones por IP en toda la API.
  app.use('/api', rateLimit({ windowMs: 60_000, limit: env.RATE_LIMIT_MAX, standardHeaders: true, legacyHeaders: false }));
  app.use('/api', authenticate); // todo lo que sigue exige sesión válida

  app.use('/api/me', me);
  app.use('/api/services', services);
  app.use('/api/drivers', drivers);
  app.use('/api/users', users);
  app.use('/api/reports', reports);
  app.use('/api/notifications', notifications);
  app.use('/api/clients', clients);
  app.use('/api/settings', settings);

  app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  app.use(errorHandler);
  return app;
}
