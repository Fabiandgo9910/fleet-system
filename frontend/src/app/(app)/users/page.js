'use client';
/** Gestión de usuarios y roles (solo super_admin). */
import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { api, fetcher } from '@/lib/api';
import { ROLE_LABEL } from '@/lib/format';
import { useAuth, useConfirm, useToast } from '@/components/Providers';
import { ErrorBox, Field, ListSkeleton, Modal } from '@/components/ui';

const blank = { email: '', password: '', full_name: '', phone: '', role: 'driver' };

export default function UsersPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, isLoading } = useSWR(profile.role === 'super_admin' ? '/users' : null, fetcher);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blank);
  const [err, setErr] = useState(null);

  if (profile.role !== 'super_admin') return <p className="card">Solo el super administrador puede gestionar usuarios.</p>;

  const create = async (e) => {
    e.preventDefault(); setErr(null);
    try {
      await api('/users', { method: 'POST', body: f });
      toast('Usuario creado', 'success'); setOpen(false); setF(blank); mutate('/users'); mutate('/drivers');
    } catch (e2) { setErr(e2); }
  };

  const patch = async (u, body, msg) => {
    if (!(await confirm({ title: 'Confirmar cambio', message: `${u.full_name}: ${msg}`, confirmText: 'Aplicar' }))) return;
    try { await api(`/users/${u.id}`, { method: 'PATCH', body }); toast('Cambio guardado', 'success'); mutate('/users'); mutate('/drivers'); }
    catch (e2) { toast(e2.message, 'error'); }
  };

  const resetPassword = async (u) => {
    const pwd = window.prompt(`Nueva contraseña para ${u.full_name} (mínimo 8 caracteres):`);
    if (!pwd) return;
    try { await api(`/users/${u.id}/password`, { method: 'POST', body: { password: pwd } }); toast('Contraseña cambiada', 'success'); }
    catch (e2) { toast(e2.message, 'error'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-xl font-bold">Usuarios</h1><button className="btn-primary" onClick={() => setOpen(true)}>➕ Nuevo usuario</button></div>
      <ErrorBox error={error} />
      {isLoading ? <ListSkeleton /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data?.map((u) => (
            <div key={u.id} className={`card space-y-3 ${u.active ? '' : 'opacity-60'}`}>
              <div><p className="font-bold">{u.full_name}{u.id === profile.id && ' (tú)'}</p><p className="text-sm text-gray-500">{u.phone || 'Sin teléfono'}</p></div>
              <label><span className="label">Rol</span>
                <select className="input" value={u.role} disabled={u.id === profile.id}
                  onChange={(e) => patch(u, { role: e.target.value }, `cambiar rol a ${ROLE_LABEL[e.target.value]}`)}>
                  {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></label>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1" onClick={() => resetPassword(u)}>🔑 Contraseña</button>
                {u.id !== profile.id && (
                  <button className={`${u.active ? 'btn-danger' : 'btn-success'} flex-1`} onClick={() => patch(u, { active: !u.active }, u.active ? 'desactivar el acceso' : 'reactivar el acceso')}>
                    {u.active ? 'Desactivar' : 'Activar'}
                  </button>)}
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo usuario">
        <form onSubmit={create} className="space-y-3">
          <Field label="Nombre completo"><input className="input" required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
          <Field label="Email"><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Teléfono"><input className="input" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Contraseña inicial" hint="Mínimo 8 caracteres."><input className="input" type="text" minLength={8} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <Field label="Rol"><select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <ErrorBox error={err} />
          <button className="btn-primary w-full">Crear usuario</button>
        </form>
      </Modal>
    </div>
  );
}
