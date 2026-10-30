'use client';
/** Estructura de la app: cabecera con marca + campana + menú (inferior en móvil). */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { brand } from '@/config/brand.config';
import { fetcher, api } from '@/lib/api';
import { enablePush, pushSupported } from '@/lib/push';
import { isAdmin, ROLE_LABEL, dateTime } from '@/lib/format';
import { useAuth, useToast } from './Providers';

function navFor(role) {
  const items = [{ href: '/', label: 'Servicios', icon: '📋' }];
  if (isAdmin(role)) items.push(
    { href: '/services/new', label: 'Nuevo', icon: '➕' },
    { href: '/map', label: 'Mapa', icon: '🗺️' },
    { href: '/drivers', label: 'Conductores', icon: '🚚' },
  );
  if (role !== 'client') items.push({ href: '/reports', label: 'Informes', icon: '📊' });
  if (role === 'super_admin') items.push({ href: '/users', label: 'Usuarios', icon: '👥' });
  return items;
}

function Bell() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState('granted');
  const { data = [] } = useSWR('/notifications', fetcher);
  const unread = data.filter((n) => !n.read).length;

  useEffect(() => { if (pushSupported()) setPerm(Notification.permission); }, []);

  const toggle = async () => {
    setOpen((o) => !o);
    if (!open && unread) { await api('/notifications/read-all', { method: 'POST' }); mutate('/notifications'); }
  };
  const activate = async () => {
    const ok = await enablePush().catch(() => false);
    setPerm(Notification.permission);
    toast(ok ? 'Notificaciones activadas en este dispositivo' : 'No se pudieron activar las notificaciones', ok ? 'success' : 'error');
  };

  return (
    <div className="relative">
      <button onClick={toggle} className="relative rounded-full p-2 text-xl hover:bg-gray-100" aria-label="Notificaciones">
        🔔
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-red-600 px-1 text-center text-[11px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border bg-white shadow-xl">
          {pushSupported() && perm !== 'granted' && (
            <button onClick={activate} className="w-full bg-brand-soft p-3 text-left text-sm font-semibold text-brand">
              🔔 Activar avisos aunque la app esté cerrada
            </button>
          )}
          <div className="max-h-96 overflow-y-auto">
            {data.length === 0 && <p className="p-4 text-center text-sm text-gray-500">Sin notificaciones</p>}
            {data.map((n) => (
              <button key={n.id} onClick={() => { setOpen(false); router.push(n.url || '/'); }} className="block w-full border-b p-3 text-left last:border-0 hover:bg-gray-50">
                <p className="text-sm font-semibold">{n.title}</p>
                {n.body && <p className="text-sm text-gray-600">{n.body}</p>}
                <p className="mt-1 text-xs text-gray-400">{dateTime(n.created_at)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Shell({ children }) {
  const { profile, signOut } = useAuth();
  const path = usePathname();
  const items = navFor(profile.role);
  const active = (href) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col">
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logoUrl} alt="" className="h-9 w-9 rounded-lg object-contain" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight">{brand.name}</p>
            <p className="truncate text-xs text-gray-500">{profile.full_name} · {ROLE_LABEL[profile.role]}</p>
          </div>
          <Bell />
          <button onClick={signOut} className="btn-ghost !min-h-9 !px-3 !py-1.5 text-xs">Salir</button>
        </div>
        {/* Menú superior (pantallas anchas) */}
        <nav className="hidden gap-1 px-4 pb-2 md:flex">
          {items.map((i) => (
            <Link key={i.href} href={i.href} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active(i.href) ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {i.icon} {i.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1 px-4 py-4 pb-28 md:pb-8">{children}</main>

      {/* Menú inferior (móvil / PWA instalada) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active(i.href) ? 'text-brand' : 'text-gray-500'}`}>
            <span className="text-xl leading-none">{i.icon}</span>{i.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
