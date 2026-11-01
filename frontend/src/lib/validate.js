'use client';
/**
 * VALIDACIÓN DE FORMULARIOS (sin dependencias)
 *  - rules: reglas reutilizables. Cada una devuelve un mensaje de error o null.
 *  - useForm: gestiona valores, errores por campo y envío.
 *
 * Uso:
 *   const form = useForm({ email: '' }, { email: [rules.required(), rules.email()] });
 *   <input {...form.bind('email')} />  <FieldError error={form.error('email')} />
 *   form.submit(async (values) => { ... })
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const empty = (v) => v === undefined || v === null || String(v).trim() === '';

export const rules = {
  required: (msg = 'Este campo es obligatorio.') => (v) => (empty(v) ? msg : null),
  minLen: (n, msg) => (v) => (!empty(v) && String(v).trim().length < n ? msg || `Escribe al menos ${n} caracteres.` : null),
  maxLen: (n, msg) => (v) => (String(v ?? '').length > n ? msg || `Máximo ${n} caracteres.` : null),
  email: (msg = 'Introduce un email válido.') => (v) => (!empty(v) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim()) ? msg : null),
  phone: (msg = 'Teléfono no válido (mínimo 9 dígitos).') => (v) => {
    if (empty(v)) return null;
    const d = String(v).replace(/\D/g, '');
    return d.length < 9 || d.length > 15 || !/^[\d\s+().-]+$/.test(String(v)) ? msg : null;
  },
  plate: (msg = 'Matrícula no válida (4 a 10 letras o números).') => (v) =>
    (!empty(v) && !/^[A-Za-z0-9][A-Za-z0-9 -]{2,9}[A-Za-z0-9]$/.test(String(v).trim()) ? msg : null),
  number: (msg = 'Introduce un número válido.') => (v) => (!empty(v) && !Number.isFinite(Number(v)) ? msg : null),
  min: (n, msg) => (v) => (!empty(v) && Number(v) < n ? msg || `El valor mínimo es ${n}.` : null),
  max: (n, msg) => (v) => (!empty(v) && Number(v) > n ? msg || `El valor máximo es ${n}.` : null),
  integer: (msg = 'Debe ser un número entero.') => (v) => (!empty(v) && !Number.isInteger(Number(v)) ? msg : null),
  decimals: (n = 2) => (v) => (!empty(v) && !new RegExp(`^-?\\d+([.,]\\d{1,${n}})?$`).test(String(v).trim()) ? `Máximo ${n} decimales.` : null),
  match: (other, msg = 'No coincide.') => (v, all) => (v !== all[other] ? msg : null),
  custom: (fn) => fn, // (value, allValues) => mensaje | null
};

export function useForm(initial, schema = {}) {
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const initialRef = useRef(initial);

  /** Calcula todos los errores a partir de los valores actuales. */
  const compute = useCallback((vals) => {
    const out = {};
    for (const [name, list] of Object.entries(schema)) {
      for (const rule of list) {
        const msg = rule(vals[name], vals);
        if (msg) { out[name] = msg; break; } // solo el primer error de cada campo
      }
    }
    return out;
  }, [schema]); // eslint-disable-line react-hooks/exhaustive-deps

  const errors = compute(values);
  const show = (name) => (submitted || touched[name]) && errors[name];

  const set = (name, value) => { setValues((v) => ({ ...v, [name]: value })); setFormError(null); };

  return {
    values, setValues, set, errors, busy, formError, setFormError,
    error: (name) => show(name) || null,
    /** Props listos para un <input>/<select>/<textarea>. */
    bind: (name, { checkbox = false } = {}) => ({
      name,
      ...(checkbox ? { checked: Boolean(values[name]) } : { value: values[name] ?? '' }),
      onChange: (e) => set(name, checkbox ? e.target.checked : e.target.value),
      onBlur: () => setTouched((t) => ({ ...t, [name]: true })),
      'aria-invalid': show(name) ? 'true' : undefined,
    }),
    reset: (vals) => { setValues(vals ?? initialRef.current); setTouched({}); setSubmitted(false); setFormError(null); },
    /** Valida; si hay errores los muestra y no envía. Si todo está bien ejecuta fn(values). */
    submit: (fn) => async (e) => {
      e?.preventDefault();
      setSubmitted(true);
      const errs = compute(values);
      if (Object.keys(errs).length) {
        // Lleva el foco al primer campo con error.
        const first = Object.keys(errs)[0];
        document.querySelector(`[name="${first}"]`)?.focus();
        return;
      }
      setBusy(true); setFormError(null);
      try { await fn(values); }
      catch (err) { setFormError(err); }
      finally { setBusy(false); }
    },
  };
}

/** Retrasa un valor (para buscadores: evita una petición por cada tecla). */
export function useDebounce(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Aplica unas reglas solo cuando se cumple una condición sobre el resto del formulario. */
export const when = (pred, ...list) => (v, all) => {
  if (!pred(all)) return null;
  for (const r of list) { const m = r(v, all); if (m) return m; }
  return null;
};
