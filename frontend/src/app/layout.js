import './globals.css';
import { brand } from '@/config/brand.config';
import Providers from '@/components/Providers';

// Metadatos y datos de instalación (PWA) tomados de la configuración de marca.
export const metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.description,
  applicationName: brand.name,
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: brand.shortName, statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
  formatDetection: { telephone: false },
};

export const viewport = {
  themeColor: brand.primaryColor,
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // usa toda la pantalla en móviles con notch
};

export default function RootLayout({ children }) {
  return (
    // El color de marca se inyecta como variable CSS: todo el diseño lo usa.
    <html lang={brand.locale.split('-')[0]} style={{ '--brand': brand.primaryColor }}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
