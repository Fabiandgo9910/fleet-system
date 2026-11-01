'use client';
/**
 * SONIDO DE ALERTA (sintetizado con Web Audio: no necesita archivos)
 * Suena como una campana de 3 toques que se va apagando poco a poco (~4 s).
 * Los navegadores solo permiten audio tras una interacción del usuario, por eso
 * se "desbloquea" con el primer toque/clic en la app.
 */
let ctx = null;
const KEY = 'sound_enabled';

export const soundEnabled = () => typeof localStorage === 'undefined' || localStorage.getItem(KEY) !== '0';
export const setSoundEnabled = (on) => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch {} };

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** Llamar una vez al montar la app: desbloquea el audio con el primer gesto. */
export function installAudioUnlock() {
  const unlock = () => { const c = getCtx(); if (c?.state === 'suspended') c.resume(); };
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));
}

/** Un toque de campana: fundamental + armónicos con caída exponencial larga. */
function bell(c, start, base, decay) {
  [[1, 0.55], [2.01, 0.28], [3.02, 0.14], [4.2, 0.07]].forEach(([mult, vol]) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = base * mult;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.012); // ataque rápido
    gain.gain.exponentialRampToValueAtTime(0.0001, start + decay); // se apaga despacio
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + decay + 0.05);
  });
}

/** Reproduce la alerta (si el usuario no la silenció). */
export function playAlert({ force = false } = {}) {
  if (!force && !soundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  const t = c.currentTime + 0.02;
  bell(c, t, 880, 1.6);          // toque 1
  bell(c, t + 0.75, 988, 1.8);   // toque 2
  bell(c, t + 1.5, 1174, 3.2);   // toque 3: el más largo, se apaga lentamente
}

/** Vibración intensa (móviles Android). */
export const vibrateAlert = () => navigator.vibrate?.([300, 120, 300, 120, 300, 200, 700]);
