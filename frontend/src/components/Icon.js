/**
 * ICONOS PROPIOS (SVG de trazo, 24x24). Un único estilo para toda la app:
 * trazo de 1.75 px, esquinas redondeadas. Uso: <Icon name="truck" className="h-5 w-5" />
 */
const P = {
  grid: <><rect x="3" y="3" width="7.5" height="9" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="5" rx="1.5" /><rect x="13.5" y="11" width="7.5" height="10" rx="1.5" /><rect x="3" y="15" width="7.5" height="6" rx="1.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  map: <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 7zM9 4v13M15 7v12.5" />,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7.5V12l3 2" /></>,
  truck: <><path d="M2.5 6.5h11v9.5h-11zM13.5 9.5h4.2l3 3.2V16h-7.2" /><circle cx="7" cy="17.5" r="1.9" /><circle cx="17" cy="17.5" r="1.9" /></>,
  chart: <path d="M3 3v18h18M8 16.5v-5M13 16.5V7.5M18 16.5v-8" />,
  users: <><circle cx="9" cy="8" r="3.3" /><path d="M2.8 19.5c0-3.4 2.8-5.5 6.2-5.5s6.2 2.1 6.2 5.5" /><circle cx="17.2" cy="9" r="2.4" /><path d="M17.6 14.2c2.2.3 3.6 2 3.6 5" /></>,
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c0-3.8 3.4-6 7.5-6s7.5 2.2 7.5 6" /></>,
  sliders: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9M4 12h3M11 12h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /><circle cx="9" cy="12" r="0.01" /></>,
  bell: <path d="M6 9a6 6 0 0 1 12 0c0 6.5 2.5 8 2.5 8h-17S6 15.5 6 9M10.2 20.5a2 2 0 0 0 3.6 0" />,
  logout: <path d="M9 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3H9M16 16.5 20.5 12 16 7.5M20.5 12H9" />,
  phone: <path d="M21.5 16.9v2.6a1.9 1.9 0 0 1-2.1 1.9 18.8 18.8 0 0 1-8.2-2.9 18.5 18.5 0 0 1-5.7-5.7A18.8 18.8 0 0 1 2.6 4.6 1.9 1.9 0 0 1 4.5 2.5h2.6A1.9 1.9 0 0 1 9 4.1c.1.9.4 1.8.7 2.6a1.9 1.9 0 0 1-.4 2L8.2 9.8a15 15 0 0 0 6 6l1.1-1.1a1.9 1.9 0 0 1 2-.4c.8.3 1.7.6 2.6.7a1.9 1.9 0 0 1 1.6 1.9z" />,
  pin: <><path d="M19.5 10c0 5.5-7.5 11-7.5 11S4.5 15.5 4.5 10a7.5 7.5 0 0 1 15 0z" /><circle cx="12" cy="10" r="2.6" /></>,
  battery: <><rect x="2.5" y="7" width="16" height="10" rx="2" /><path d="M21.5 11v2M10.5 9.5l-2 2.5h3.5l-2 2.5" /></>,
  euro: <path d="M18.5 6.2A7 7 0 0 0 13.6 4 7.5 7.5 0 0 0 6 12a7.5 7.5 0 0 0 7.6 8 7 7 0 0 0 4.9-2.2M3.5 10h10M3.5 14h8.5" />,
  cash: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 12h.01M18 12h.01" /></>,
  card: <><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19M6 15h4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 2" /></>,
  check: <path d="m5 12.5 4.5 4.5L19.5 7" />,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8.2 12.4 2.7 2.7 5-5.3" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  xCircle: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>,
  alert: <path d="M10.3 4 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0zM12 9.5v4M12 17h.01" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.8h.01" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20.5 20.5-4.7-4.7" /></>,
  calendar: <><rect x="3" y="4.5" width="18" height="16.5" rx="2" /><path d="M16 2.5v4M8 2.5v4M3 10h18" /></>,
  filter: <path d="M3 5h18l-7 8.5V20l-4-2v-4.5z" />,
  warehouse: <path d="M3 21V9.5L12 4l9 5.5V21M3 21h18M8 21v-6.5h8V21M8 17.7h8" />,
  route: <><circle cx="6" cy="18.5" r="2" /><circle cx="18" cy="5.5" r="2" /><path d="M8 18.5h6.5a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7H16" /></>,
  refresh: <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1M20.5 4v5h-5" />,
  car: <><path d="M4.5 17H3v-4l2-5.5h14L21 13v4h-1.5M4.5 17h15" /><circle cx="7.5" cy="14" r="1" /><circle cx="16.5" cy="14" r="1" /></>,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  more: <><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>,
  message: <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 20.5l1.6-5.2A8.5 8.5 0 1 1 21 11.5z" />,
  volume: <path d="M11 5 6.5 9H3v6h3.5L11 19zM15.5 8.8a4.5 4.5 0 0 1 0 6.4M18.5 5.8a8.5 8.5 0 0 1 0 12.4" />,
  volumeOff: <path d="M11 5 6.5 9H3v6h3.5L11 19zM16 9.5l5 5M21 9.5l-5 5" />,
  note: <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M8.5 13h7M8.5 17h4.5" />,
  ban: <><circle cx="12" cy="12" r="9" /><path d="m5.7 5.7 12.6 12.6" /></>,
  undo: <path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />,
  flag: <path d="M5 21V4M5 4.5h12.5l-2.2 4 2.2 4H5" />,
  navigation: <path d="M3.5 11 21 3l-8 17.5-2-7.5z" />,
  moon: <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a6.8 6.8 0 0 0 11 11z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  eye: <><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  eyeOff: <path d="M3 3l18 18M10.6 6a10 10 0 0 1 1.4-.1c6.5 0 10 6.1 10 6.1a17 17 0 0 1-3.2 3.9M6.6 6.9A16.6 16.6 0 0 0 2 12s3.5 6.5 10 6.5c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2" />,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M16 7l3 3M14 9l2 2" /></>,
  box: <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  trend: <path d="m3 17 6-6 4 4 8-8M15 7h6v6" />,
};

export default function Icon({ name, className = 'h-5 w-5', strokeWidth = 1.75 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true">
      {P[name] || P.info}
    </svg>
  );
}
