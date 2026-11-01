'use client';
/** Gestión de usuarios y roles (solo super_admin). */
import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { api, fetcher } from '@/lib/api';
import { ROLE_LABEL } from '@/lib/format';
import { rules, useForm } from '@/lib/validate';
import { useAuth, useConfirm, useToast } from '@/components/Providers';
import Icon from '@/components/Icon';
import { ErrorBox, Field, ListSkeleton, Modal, PageHeader } from '@/components/ui';

const blank = { email: '', password: '', full_name: '', phone: '', role: 'driver' };
const pwdRules = [rules.required('Escribe la contraseña.'), rules.minLen(8, 'Mínimo 8 caracteres.'), rules.maxLen(72, 'Máximo 72 caracteres.')];

export default function UsersPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, isLoading } = useSWR(profile.role === 'super_admin' ? '/users' : null, fetcher);
  const [open, setOpen] = useState(false);
  const [pwdFor, setPwdFor] = useState(null);

  const form = useForm(blank, {
    full_name: [rules.required('Escribe el nombre completo.'), rules.minLen(2), rules.maxLen(120)],
    email: [rules.required('Escribe el email.'), rules.email()],
    phone: [rules.phone()],
    password: pwdRules,
  });
  const pwd = useForm({ password: '', confirm: '' }, { password: pwdRules, confirm: [rules.required('Repite la contraseña.'), rules.match('password', 'Las contraseñas no coinciden.')] });

  if (profile.role !== 'super_admin') return <p className="card">Solo el super administrador puede gestionar usuarios.</p>;

  const create = form.submit(async (v) => {
    await api('/users', { method: 'POST', body: { ...v, email: v.email.trim(), full_name: v.full_name.trim(), phone: v.phone.trim() } });
    toast(`Usuario ${v.full_name} creado correctamente.`, 'success');
    setOpen(false); form.reset(); mutate('/users'); mutate('/drivers');
  });

  const patch = async (u, body, msg, danger) => {
    if (!(await confirm({ title: 'Confirmar cambio', message: `${u.full_name}: ${msg}`, confirmText: 'Aplicar', danger }))) return;
    try { await api(`/users/${u.id}`, { method: 'PATCH', body }); toast('Cambio guardado.', 'success'); mutate('/users'); mutate('/drivers'); }
    catch (e) { toast(e.message, 'error'); }
  };

  const resetPwd = pwd.submit(async ({ password }) => {
    await api(`/users/${pwdFor.id}/password`, { method: 'POST', body: { password } });
    toast(`Contraseña de ${pwdFor.full_name} actualizada.`, 'success'); setPwdFor(null); pwd.reset();
  });
  const cls = (f, n) => `field ${f.error(n) ? 'field-error' : ''}`;

  return (
    <div>
      <PageHeader title="Usuarios" subtitle="Crea usuarios y define su rol de acceso"
        actions={<button className="btn-primary" onClick={() => { form.reset(); setOpen(true); }}><Icon name="plus" className="h-4 w-4" />Nuevo usuario</button>} />
      <ErrorBox error={error} className="mb-4" />
      {isLoading ? <ListSkeleton /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {data?.map((u) => (
            <div key={u.id} className={`card space-y-4 ${u.active ? '' : 'opacity-60'}`}>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand">{u.full_name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span>
                <div className="min-w-0"><p className="truncate font-semibold">{u.full_name}{u.id === profile.id && ' (tú)'}{!u.active && ' · inactivo'}</p><p className="text-sm text-muted">{u.phone || 'Sin teléfono'}</p></div>
              </div>
              <label><span className="label">Rol</span>
                <select className="field" value={u.role} disabled={u.id === profile.id}
                  onChange={(e) => patch(u, { role: e.target.value }, `cambiar el rol a ${ROLE_LABEL[e.target.value]}`)}>
                  {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></label>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1" onClick={() => { pwd.reset(); setPwdFor(u); }}><Icon name="key" className="h-4 w-4" />Contraseña</button>
                {u.id !== profile.id && (
                  <button className={`${u.active ? 'btn-soft-danger' : 'btn-success'} flex-1`} onClick={() => patch(u, { active: !u.active }, u.active ? 'se desactivará su acceso a la app.' : 'se reactivará su acceso.', u.active)}>
                    {u.active ? 'Desactivar' : 'Activar'}
                  </button>)}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo usuario" subtitle="Recibirá acceso con el email y la contraseña inicial.">
        <form onSubmit={create} noValidate className="space-y-4">
          <Field label="Nombre completo" required error={form.error('full_name')}><input className={cls(form, 'full_name')} {...form.bind('full_name')} /></Field>
          <Field label="Email" required error={form.error('email')}><input className={cls(form, 'email')} type="email" inputMode="email" {...form.bind('email')} /></Field>
          <Field label="Teléfono" error={form.error('phone')}><input className={cls(form, 'phone')} type="tel" {...form.bind('phone')} /></Field>
          <Field label="Contraseña inicial" required error={form.error('password')} hint="Mínimo 8 caracteres. El usuario podrá pedir un cambio al administrador."><input className={cls(form, 'password')} type="text" autoComplete="off" {...form.bind('password')} /></Field>
          <Field label="Rol" required><select className="field" {...form.bind('role')}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <ErrorBox error={form.formError} />
          <button className="btn-primary w-full" disabled={form.busy}>{form.busy ? 'Creando…' : 'Crear usuario'}</button>
        </form>
      </Modal>

      <Modal open={Boolean(pwdFor)} onClose={() => setPwdFor(null)} title="Cambiar contraseña" subtitle={pwdFor?.full_name}>
        <form onSubmit={resetPwd} noValidate className="space-y-4">
          <Field label="Nueva contraseña" required error={pwd.error('password')}><input className={cls(pwd, 'password')} type="password" autoComplete="new-password" {...pwd.bind('password')} /></Field>
          <Field label="Repetir contraseña" required error={pwd.error('confirm')}><input className={cls(pwd, 'confirm')} type="password" autoComplete="new-password" {...pwd.bind('confirm')} /></Field>
          <ErrorBox error={pwd.formError} />
          <button className="btn-primary w-full" disabled={pwd.busy}>{pwd.busy ? 'Guardando…' : 'Guardar contraseña'}</button>
        </form>
      </Modal>
    </div>
  );
}
