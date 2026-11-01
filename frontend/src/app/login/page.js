'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { brand } from '@/config/brand.config';
import { rules, useForm } from '@/lib/validate';
import { useAuth } from '@/components/Providers';
import { ErrorBox, Field } from '@/components/ui';
import Icon from '@/components/Icon';

export default function LoginPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [show, setShow] = useState(false);
  const form = useForm({ email: '', password: '' }, {
    email: [rules.required('Escribe tu email.'), rules.email()],
    password: [rules.required('Escribe tu contraseña.')],
  });

  useEffect(() => { if (session) router.replace('/'); }, [session, router]);

  const submit = form.submit(async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(/network|fetch/i.test(error.message) ? 'No hay conexión. Inténtalo de nuevo.' : 'Email o contraseña incorrectos.');
  });

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Panel de marca (solo escritorio) */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-nav p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logoUrl} alt="" className="h-11 w-11 rounded-xl bg-white/10 object-contain p-1.5" />
          <span className="text-lg font-semibold">{brand.name}</span>
        </div>
        <div className="relative max-w-md">
          <p className="eyebrow !text-brand">Gestión de flota</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-tight">Cada servicio, cada conductor, bajo control.</h2>
          <p className="mt-4 text-slate-400">{brand.description}</p>
        </div>
        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} {brand.name}</p>
      </section>

      <section className="flex items-center justify-center p-5">
        <form onSubmit={submit} noValidate className="w-full max-w-sm space-y-5">
          <div className="lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brand.logoUrl} alt="" className="h-12 w-12 rounded-xl object-contain" />
          </div>
          <div><h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1><p className="mt-1 text-sm text-muted">Accede con tu cuenta de {brand.name}.</p></div>
          <Field label="Email" required error={form.error('email')}>
            <input className={`field ${form.error('email') ? 'field-error' : ''}`} type="email" autoComplete="username" inputMode="email" {...form.bind('email')} />
          </Field>
          <Field label="Contraseña" required error={form.error('password')}>
            <div className="relative">
              <input className={`field !pr-11 ${form.error('password') ? 'field-error' : ''}`} type={show ? 'text' : 'password'} autoComplete="current-password" {...form.bind('password')} />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-faint hover:text-ink" aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                <Icon name={show ? 'eyeOff' : 'eye'} className="h-[18px] w-[18px]" />
              </button>
            </div>
          </Field>
          <ErrorBox error={form.formError} />
          <button className="btn-primary w-full !min-h-11" disabled={form.busy}>{form.busy ? 'Entrando…' : 'Entrar'}</button>
        </form>
      </section>
    </main>
  );
}
