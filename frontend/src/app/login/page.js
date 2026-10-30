'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { brand } from '@/config/brand.config';
import { useAuth } from '@/components/Providers';

export default function LoginPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (session) router.replace('/'); }, [session, router]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError('Email o contraseña incorrectos.'); setBusy(false); }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 !p-6">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logoUrl} alt="" className="mx-auto h-16 w-16 rounded-2xl object-contain" />
          <h1 className="mt-3 text-xl font-bold">{brand.name}</h1>
          <p className="text-sm text-gray-500">{brand.description}</p>
        </div>
        <label className="block"><span className="label">Email</span>
          <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="block"><span className="label">Contraseña</span>
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  );
}
