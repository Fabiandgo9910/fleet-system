'use client';
/** Zona privada: exige sesión y muestra la estructura (Shell). */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import { Skeleton } from '@/components/ui';
import { useAuth } from '@/components/Providers';

export default function AppLayout({ children }) {
  const router = useRouter();
  const { session, profile, loading, failed, signOut } = useAuth();

  useEffect(() => { if (session === null) router.replace('/login'); }, [session, router]);

  if (failed) return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="card max-w-sm space-y-3 text-center">
        <p className="text-sm text-red-700">{failed}</p>
        <button className="btn-primary w-full" onClick={signOut}>Volver al inicio de sesión</button>
      </div>
    </main>
  );
  if (loading || !profile) return (
    <div className="mx-auto max-w-5xl space-y-4 p-4" aria-busy="true">
      <Skeleton className="h-12 w-full" /><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" />
    </div>
  );
  return <Shell>{children}</Shell>;
}
