/** Error HTTP controlado: se devuelve al cliente con su código y mensaje. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Traduce errores de Postgres/Supabase a mensajes claros para el usuario. */
export function throwDb(error) {
  if (!error) return;
  const map = {
    INVALID_STATUS: [409, 'El servicio ya no está en un estado que permita esta acción.'],
    SERVICE_NOT_FOUND: [404, 'Servicio no encontrado.'],
    DRIVER_NOT_FOUND: [404, 'Conductor no encontrado.'],
  };
  for (const [key, [status, msg]] of Object.entries(map)) {
    if (error.message?.includes(key)) throw new HttpError(status, msg);
  }
  console.error('[db]', error);
  throw new HttpError(500, 'Error de base de datos.');
}
