'use client';
/**
 * ESTRUCTURA DE LA APP
 *  - Escritorio: barra lateral oscura con la marca + cabecera superior.
 *  - Móvil / PWA: cabecera compacta + barra inferior (4 accesos + "Más").
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { brand } from '@/config/brand.config';
import { fetcher, api } from '@/lib/api';
import { enablePush, pushSupported } from '@/lib/push';
import { playAlert, setSoundEnabled, soundEnabled } from '@/lib/sound';
import { isAdmin, ROLE_LABEL, dateTime } from '@/lib/format';
import { useAuth, useToast } from './Providers';
import Icon from './Icon';
import { Modal } from './ui';

/** Menú de la app. `roles` limita quién lo ve (admin = admin + super_admin). */
const NAV = [
  { href: '/', label: 'Servicios', icon: 'grid', group: 'Operación' },
  { href: '/services/new', label: 'Nuevo servicio', short: 'Nuevo', icon: 'plus', group: 'Operación', roles: ['admin'] },
  { href: '/map', label: 'Mapa', icon: 'map', group: 'Operación', roles: ['admin'] },
  { href: '/history', label: 'Historial', icon: 'history', group: 'Gestión' },
  { href: '/drivers', label: 'Conductores', icon: 'truck', group: 'Gestión', roles: ['admin'] },
  { href: '/reports', label: 'Informes', icon: 'chart', group: 'Gestión', roles: ['admin', 'driver'] },
  { href: '/users', label: 'Usuarios', icon: 'users', group: 'Administración', roles: ['super_admin'] },
  { href: '/settings', label: 'Ajustes', icon: 'sliders', group: 'Administración', roles: ['admin'] },
];

const allowed = (item, role) => !item.roles || item.roles.some((r) => (r === 'admin' ? isAdmin(role) : r === role));
const TITLES = [['/services/new', 'Nuevo servicio'], ['/services/', 'Detalle del servicio'], ['/history', 'Historial'], ['/map', 'Mapa'],
  ['/drivers', 'Conductores'], ['/reports', 'Informes'], ['/users', 'Usuarios'], ['/settings', 'Ajustes']];
const initials = (n = '') => n.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function ThemeButton({ className = '' }) {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.dataset.theme === 'dark'); }, []);
  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
    setDark(!dark);
  };
  return (
    <button onClick={toggle} className={`rounded-lg p-2 text-muted hover:bg-sunken hover:text-ink ${className}`} aria-label={dark ? 'Tema claro' : 'Tema oscuro'} title={dark ? 'Tema claro' : 'Tema oscuro'}>
      <Icon name={dark ? 'sun' : 'moon'} />
    </button>
  );
}

function Bell() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState('granted');
  const [sound, setSound] = useState(true);
  const { data = [] } = useSWR('/notifications', fetcher);
  const unread = data.filter((n) => !n.read).length;

  useEffect(() => { if (pushSupported()) setPerm(Notification.permission); setSound(soundEnabled()); }, []);

  const toggle = async () => {
    setOpen((o) => !o);
    if (!open && unread) { await api('/notifications/read-all', { method: 'POST' }); mutate('/notifications'); }
  };
  const activate = async () => {
    const ok = await enablePush().catch(() => false);
    setPerm(Notification.permission);
    toast(ok ? 'Avisos activados en este dispositivo.' : 'No se pudieron activar los avisos. Revisa los permisos del navegador.', ok ? 'success' : 'error');
  };
  const toggleSound = () => { setSoundEnabled(!sound); setSound(!sound); if (!sound) playAlert({ force: true }); };

  return (
    <div className="relative">
      <button onClick={toggle} className="relative rounded-lg p-2 text-muted hover:bg-sunken hover:text-ink" aria-label="Notificaciones">
        <Icon name="bell" />
        {unread > 0 && <span className="absolute right-0.5 top-0.5 grid min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] font-bold leading-[18px] text-white">{unread}</span>}
      </button>
      {open && (<>
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
        <div className="pop absolute right-0 z-50 mt-2 w-[min(92vw,24rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Notificaciones</p>
            <div className="flex gap-1">
              <button onClick={() => playAlert({ force: true })} className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-sunken">Probar sonido</button>
              <button onClick={toggleSound} className="rounded-md p-1.5 text-muted hover:bg-sunken" aria-label={sound ? 'Silenciar' : 'Activar sonido'}><Icon name={sound ? 'volume' : 'volumeOff'} className="h-4 w-4" /></button>
            </div>
          </div>
          {pushSupported() && perm !== 'granted' && (
            <button onClick={activate} className="flex w-full items-center gap-2 bg-brand-soft px-4 py-3 text-left text-sm font-semibold text-brand">
              <Icon name="bell" className="h-4 w-4" /> Activar avisos aunque la app esté cerrada
            </button>
          )}
          <div className="max-h-[22rem] overflow-y-auto">
            {data.length === 0 && <p className="p-8 text-center text-sm text-muted">Sin notificaciones</p>}
            {data.map((n) => (
              <button key={n.id} onClick={() => { setOpen(false); router.push(n.url || '/'); }} className="flex w-full gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-sunken">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-brand'}`} />
                <span className="min-w-0"><span className="block text-sm font-semibold">{n.title}</span>
                  {n.body && <span className="block text-sm text-muted">{n.body}</span>}
                  <span className="mt-1 block text-xs text-faint">{dateTime(n.created_at)}</span></span>
              </button>
            ))}
          </div>
        </div>
      </>)}
    </div>
  );
}

export default function Shell({ children }) {
  const { profile, signOut } = useAuth();
  const path = usePathname();
  const [more, setMore] = useState(false);
  const items = NAV.filter((i) => allowed(i, profile.role));
  const active = (href) => (href === '/' ? path === '/' : path.startsWith(href));
  const title = TITLES.find(([p]) => path.startsWith(p))?.[1] || 'Servicios';
  const groups = [...new Set(items.map((i) => i.group))];
  const primary = items.slice(0, 4);
  const rest = items.slice(4);

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* ---------- Barra lateral (escritorio) ---------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-nav text-slate-300 lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logoUrl} alt="" className="h-9 w-9 rounded-lg bg-white/10 object-contain p-1" />
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{brand.name}</p><p className="truncate text-[11px] text-slate-400">{brand.description}</p></div>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
          {groups.map((g) => (
            <div key={g}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">{g}</p>
              {items.filter((i) => i.group === g).map((i) => (
                <Link key={i.href} href={i.href} className={`mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${active(i.href) ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'hover:bg-white/5 hover:text-white'}`}>
                  <Icon name={i.icon} className="h-[18px] w-[18px]" />{i.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="m-3 flex items-center gap-3 rounded-xl bg-white/5 p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">{initials(profile.full_name)}</span>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{profile.full_name}</p><p className="text-[11px] text-slate-400">{ROLE_LABEL[profile.role]}</p></div>
          <button onClick={signOut} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Cerrar sesión" title="Cerrar sesión"><Icon name="logout" className="h-[18px] w-[18px]" /></button>
        </div>
      </aside>

      {/* ---------- Cabecera ---------- */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brand.logoUrl} alt="" className="h-8 w-8 rounded-lg object-contain" />
            <p className="truncate text-sm font-semibold">{brand.name}</p>
          </div>
          <p className="hidden flex-1 text-sm font-medium text-muted lg:block">{title}</p>
          <ThemeButton />
          <Bell />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 pb-28 lg:pb-10">{children}</main>

      {/* ---------- Barra inferior (móvil) ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {primary.map((i) => (
          <Link key={i.href} href={i.href} className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${active(i.href) ? 'text-brand' : 'text-faint'}`}>
            {active(i.href) && <span className="absolute inset-x-6 top-0 h-0.5 rounded-b bg-brand" />}
            <Icon name={i.icon} className="h-[22px] w-[22px]" />{i.short || i.label}
          </Link>
        ))}
        <button onClick={() => setMore(true)} className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-faint">
          <Icon name="more" className="h-[22px] w-[22px]" />Más
        </button>
      </nav>

      <Modal open={more} onClose={() => setMore(false)} title={profile.full_name} subtitle={ROLE_LABEL[profile.role]}>
        <div className="space-y-1">
          {rest.map((i) => (
            <Link key={i.href} href={i.href} onClick={() => setMore(false)} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-sunken">
              <Icon name={i.icon} className="text-muted" />{i.label}<Icon name="chevronRight" className="ml-auto h-4 w-4 text-faint" />
            </Link>
          ))}
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400">
            <Icon name="logout" />Cerrar sesión
          </button>
        </div>
      </Modal>
    </div>
  );
}
