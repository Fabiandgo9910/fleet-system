'use client';
/**
 * PROVEEDORES GLOBALES
 *  - AuthProvider    : sesión de Supabase + perfil/rol desde la API
 *  - SocketProvider  : conexión Socket.IO en tiempo real (actualiza listas solos)
 *  - ToastProvider   : avisos breves ("Guardado", nuevas notificaciones...)
 *  - ConfirmProvider : cuadros de confirmación con promesas: await confirm({...})
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { mutate } from 'swr';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { registerSW } from '@/lib/push';
import { appConfig } from '@/config/brand.config';

// ------------------------------------------------------------------ Toast
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = 'info') => {
    const id = Math.random();
    setItems((l) => [...l, { id, message, type }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 4500);
  }, []);
  const colors = { info: 'bg-gray-900', success: 'bg-emerald-600', error: 'bg-red-600' };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm text-white shadow-lg ${colors[t.type]}`}>
            {t.message}
          </div>
        ))}
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
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold">{state.title || '¿Confirmar?'}</h2>
            <div className="mt-2 whitespace-pre-line text-sm text-gray-600">{state.message}</div>
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
  const hasSession = Boolean(session);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!hasSession) return;
    const socket = io(appConfig.apiUrl, {
      transports: ['websocket'],               // directo por WebSocket: menor latencia
      // Función: en cada (re)conexión pide el token vigente (se renueva solo).
      auth: (cb) => supabase.auth.getSession().then(({ data }) => cb({ token: data.session?.access_token })),
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    // Cualquier cambio en servicios -> SWR revalida las listas abiertas.
    const refreshServices = () => mutate((k) => typeof k === 'string' && k.startsWith('/services'));
    const refreshDrivers = () => mutate((k) => typeof k === 'string' && (k.startsWith('/drivers') || k.startsWith('/me') || k.startsWith('/reports')));
    socket.on('service:changed', refreshServices);
    socket.on('driver:changed', refreshDrivers);
    socket.on('notification:new', (n) => {
      toast(`${n.title}${n.body ? ' — ' + n.body : ''}`, 'info');
      mutate('/notifications');
      navigator.vibrate?.(200);
    });
    // Al volver a abrir la app o recuperar conexión: se refresca todo.
    socket.on('connect', () => { refreshServices(); refreshDrivers(); mutate('/notifications'); });
    const onVisible = () => { if (document.visibilityState === 'visible') { refreshServices(); refreshDrivers(); } };
    document.addEventListener('visibilitychange', onVisible);

    return () => { document.removeEventListener('visibilitychange', onVisible); socket.disconnect(); };
  }, [hasSession, toast]);
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
