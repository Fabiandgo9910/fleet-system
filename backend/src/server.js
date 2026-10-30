/** Punto de entrada: HTTP + Socket.IO + planificador de reseñas. */
import http from 'node:http';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { initSocket } from './realtime/socket.js';
import { startReviewScheduler } from './jobs/reviewScheduler.js';

const server = http.createServer(createApp());
initSocket(server);
const stopScheduler = startReviewScheduler();

server.listen(env.PORT, () => console.log(`🚀 API lista en el puerto ${env.PORT}`));

// Apagado ordenado (Render envía SIGTERM al redesplegar).
const shutdown = () => { stopScheduler(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 5000); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
