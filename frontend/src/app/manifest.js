import { brand } from '@/config/brand.config';

/** Manifiesto PWA (hace la web instalable). Se genera desde la marca. */
export default function manifest() {
  return {
    name: brand.name,
    short_name: brand.shortName,
    description: brand.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f7f9',
    theme_color: brand.primaryColor,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
