/**
 * TIEMPO REAL (Socket.IO)
 * Salas:  user:<id>  -> eventos personales (notificaciones, servicios del conductor)
 *         admins     -> todos los administradores
 * Eventos emitidos:
 *   service:changed   (servicio creado/actualizado)
 *   driver:changed    (stock/efectivo de un conductor)
 *   notification:new  (notificación personal)
 */
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { verifyToken, ADMIN_ROLES } from '../middleware/auth.js';

let io;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.allowedOrigins, credentials: true },
    perMessageDeflate: false, // menos CPU; los mensajes son pequeños
    pingInterval: 25_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 1e5,   // 100 KB: evita abusos
  });

  // Autenticación: el cliente envía su JWT en el handshake.
  io.use(async (socket, next) => {
    try {
      socket.data.user = await verifyToken(socket.handshake.auth?.token);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user.id}`);
    if (ADMIN_ROLES.includes(user.role)) socket.join('admins');
  });
  return io;
}

export const emitToUser = (userId, event, payload) => io?.to(`user:${userId}`).emit(event, payload);
export const emitToAdmins = (event, payload) => io?.to('admins').emit(event, payload);
