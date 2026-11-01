/**
 * CONFIGURACIÓN DE MARCA (white-label)
 * ----------------------------------------------------------------
 * Para un cliente nuevo basta con cambiar las variables NEXT_PUBLIC_* en
 * Vercel (o editar los valores por defecto de aquí). Define nombre, descripción,
 * logo y color principal de toda la aplicación (web + PWA instalada).
 */
export const brand = {
  name: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Mi Empresa',
  shortName: process.env.NEXT_PUBLIC_COMPANY_SHORT_NAME || 'MiEmpresa',
  description: process.env.NEXT_PUBLIC_COMPANY_DESCRIPTION || 'Gestión de servicios y flota',
  logoUrl: process.env.NEXT_PUBLIC_LOGO_URL || '/icons/icon-192.png', // ruta en /public o URL
  primaryColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR || '#e2590c',
  locale: process.env.NEXT_PUBLIC_LOCALE || 'es-ES',
  currency: process.env.NEXT_PUBLIC_CURRENCY || 'EUR',
};

export const appConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  maps: {
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID',
    country: process.env.NEXT_PUBLIC_MAPS_COUNTRY || 'es',
    defaultCenter: {
      lat: Number(process.env.NEXT_PUBLIC_MAP_DEFAULT_LAT || 40.4168),
      lng: Number(process.env.NEXT_PUBLIC_MAP_DEFAULT_LNG || -3.7038),
    },
  },
};
