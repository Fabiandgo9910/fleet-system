'use client';
/**
 * PROVEEDORES GLOBALES
 *  - AuthProvider    : sesión de Supabase + perfil/rol desde la API
 *  - SocketProvider  : conexión Socket.IO en tiempo real (actualiza listas solos)
 *  - ToastProvider   : avisos breves (con sonido y vibración para notificaciones)
 *  - ConfirmProvider : cuadros de confirmación con promesas: await confirm({...})
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { mutate } from 'swr';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { registerSW } from '@/lib/push';
import { installAudioUnlock, playAlert, vibrateAlert } from '@/lib/sound';
import { appConfig } from '@/config/brand.config';
import Icon from './Icon';

// ------------------------------------------------------------------ Toast
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

const TOAST_STYLE = {
  info:    { icon: 'info',        bar: 'bg-slate-400' },
  success: { icon: 'checkCircle', bar: 'bg-emerald-500' },
  error:   { icon: 'alert',       bar: 'bg-red-500' },
  alert:   { icon: 'bell',        bar: 'bg-brand' },
};

function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const remove = (id) => setItems((l) => l.filter((t) => t.id !== id));
  /** push(mensaje, tipo, { title, duration, onClick }) */
  const push = useCallback((message, type = 'info', opts = {}) => {
    const id = Math.random();
    setItems((l) => [...l.slice(-3), { id, message, type, ...opts }]);
    setTimeout(() => remove(id), opts.duration ?? (type === 'alert' ? 9000 : 4500));
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-3 pt-[calc(env(safe-area-inset-top)+12px)]" aria-live="polite">
        {items.map((t) => {
          const st = TOAST_STYLE[t.type] || TOAST_STYLE.info;
          return (
            <div key={t.id} onClick={() => { t.onClick?.(); remove(t.id); }}
              className={`pop pointer-events-auto flex w-full max-w-md cursor-pointer overflow-hidden rounded-xl border border-line bg-surface shadow-xl ${t.type === 'alert' ? 'ring-2 ring-brand/40' : ''}`}>
              <span className={`w-1.5 ${st.bar}`} />
              <div className="flex flex-1 items-start gap-3 p-3.5">
                <Icon name={st.icon} className={`mt-0.5 h-5 w-5 ${t.type === 'alert' ? 'ring-bell text-brand' : t.type === 'error' ? 'text-red-500' : t.type === 'success' ? 'text-emerald-500' : 'text-muted'}`} />
                <div className="min-w-0 flex-1">
                  {t.title && <p className="text-sm font-semibold">{t.title}</p>}
                  <p className="text-sm text-muted">{t.message}</p>
                </div>
                <button className="text-faint hover:text-ink" onClick={(e) => { e.stopPropagation(); remove(t.id); }} aria-label="Cerrar"><Icon name="x" className="h-4 w-4" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------------------------------------------------------------- Confirm
const ConfirmCtx = createContext(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const confirm = useCallback((opts) => new Promise((resolve) => setState({ ...opts, resolve })), []);
  const close = (v) => { state.resolve(v); setState(null); };
  useEffect(() => {
    if (!state) return;
    const onKey = (e) => e.key === 'Escape' && close(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#050b16]/60 p-3 backdrop-blur-[2px] sm:items-center" role="alertdialog" aria-modal="true">
          <div className="pop w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${state.danger ? 'bg-red-500/12 text-red-500' : 'bg-brand-soft text-brand'}`}>
                <Icon name={state.danger ? 'alert' : 'info'} />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold">{state.title || '¿Confirmar?'}</h2>
                <div className="mt-1.5 whitespace-pre-line text-sm text-muted">{state.message}</div>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => close(false)}>{state.cancelText || 'Cancelar'}</button>
              <button className={`${state.danger ? 'btn-danger' : 'btn-primary'} flex-1`} onClick={() => close(true)} autoFocus>
                {state.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

// ------------------------------------------------------------------- Auth
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = cargando
  const [profile, setProfile] = useState(null);
  const [failed, setFailed] = useState(null); // mensaje si el perfil no se pudo cargar

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Cada vez que hay sesión, se carga el perfil (rol) desde nuestra API.
  const userId = session?.user?.id;
  const loadProfile = useCallback(async () => {
    try { setProfile(await api('/me')); setFailed(null); }
    catch (e) { setProfile(null); setFailed(e.message); } // p. ej. usuario desactivado
  }, []);
  useEffect(() => {
    if (userId) loadProfile(); else { setProfile(null); setFailed(null); }
  }, [userId, loadProfile]);

  const signOut = async () => { await supabase.auth.signOut(); setProfile(null); };
  const loading = session === undefined || (Boolean(session) && !profile && !failed);
  return <AuthCtx.Provider value={{ session, profile, failed, loading, signOut, reloadProfile: loadProfile }}>{children}</AuthCtx.Provider>;
}

// ----------------------------------------------------------------- Socket
function SocketBridge() {
  const { session } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const hasSession = Boolean(session);

  useEffect(() => { installAudioUnlock(); }, []);

  useEffect(() => {
    if (!hasSession) return;
    const socket = io(appConfig.apiUrl, {
      transports: ['websocket'],               // directo por WebSocket: menor latencia
      // Función: en cada (re)conexión pide el token vigente (se renueva solo).
      auth: (cb) => supabase.auth.getSession().then(({ data }) => cb({ token: data.session?.access_token })),
      reconnectionDelayMax: 5000,
    });

    // Cualquier cambio en servicios -> SWR revalida las listas abiertas.
    const refreshServices = () => mutate((k) => typeof k === 'string' && (k.startsWith('/services') || k.startsWith('/clients')));
    const refreshDrivers = () => mutate((k) => typeof k === 'string' && (k.startsWith('/drivers') || k.startsWith('/me') || k.startsWith('/reports')));
    socket.on('service:changed', refreshServices);
    socket.on('driver:changed', refreshDrivers);
    socket.on('notification:new', (n) => {
      playAlert();      // campana de 3 toques que se apaga despacio
      vibrateAlert();   // vibración intensa
      toast(n.body || '', 'alert', { title: n.title, onClick: () => router.push(n.url || '/') });
      mutate('/notifications');
    });
    // Al volver a abrir la app o recuperar conexión: se refresca todo.
    socket.on('connect', () => { refreshServices(); refreshDrivers(); mutate('/notifications'); });
    const onVisible = () => { if (document.visibilityState === 'visible') { refreshServices(); refreshDrivers(); } };
    document.addEventListener('visibilitychange', onVisible);

    return () => { document.removeEventListener('visibilitychange', onVisible); socket.disconnect(); };
  }, [hasSession, toast, router]);
  return null;
}

export default function Providers({ children }) {
  useEffect(() => { registerSW().catch(() => {}); }, []); // PWA: service worker
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <SocketBridge />
          {children}
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
