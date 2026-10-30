'use client';
/** Registro del service worker y suscripción a notificaciones push. */
import { api } from './api';
import { appConfig } from '@/config/brand.config';

const b64ToUint8 = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('/sw.js');
}

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** Pide permiso y guarda la suscripción en el backend. Devuelve true si quedó activa. */
export async function enablePush() {
  if (!pushSupported() || !appConfig.vapidPublicKey) return false;
  if ((await Notification.requestPermission()) !== 'granted') return false;
  const reg = (await registerSW()) && (await navigator.serviceWorker.ready);
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(appConfig.vapidPublicKey) }));
  await api('/notifications/push', { method: 'POST', body: sub.toJSON() });
  return true;
}
