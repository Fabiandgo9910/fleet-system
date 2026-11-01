'use client';
/** Detalle de un servicio: ficha, acciones según rol/estado e historial de eventos. */
import { useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { api, fetcher } from '@/lib/api';
import { dateTime, EVENT, isAdmin, money, timeOnly, ACTIVE_STATUSES } from '@/lib/format';
import { rules, useForm, when } from '@/lib/validate';
import { useAuth, useConfirm, useToast } from '@/components/Providers';
import RouteButton from '@/components/RouteButton';
import Icon from '@/components/Icon';
import { Elapsed, ErrorBox, Field, Modal, Row, Skeleton, StatusBadge, Switch } from '@/components/ui';

const reasonRules = [rules.required('Escribe el motivo.'), rules.minLen(5, 'Explica el motivo con al menos 5 caracteres.'), rules.maxLen(500)];

export default function ServiceDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const admin = isAdmin(profile.role);
  const key = `/services/${id}`;
  const { data: s, error, isLoading } = useSWR(key, fetcher);
  const { data: drivers } = useSWR(admin ? '/drivers' : null, fetcher);
  const [busy, setBusy] = useState(false);
  const [assignTo, setAssignTo] = useState('');
  const [modal, setModal] = useState(null); // 'finish' | 'reject' | null
  const [actionError, setActionError] = useState(null);

  // Formularios de los modales (validación por campo).
  const rejectForm = useForm({ note: '' }, { note: reasonRules });
  const finishForm = useForm({ success: true, cash: '', card: '', old: false, note: '' }, {
    cash: [when((a) => a.success, rules.required('Indica el efectivo cobrado (0 si no hubo).'), rules.number(), rules.min(0), rules.max(100000), rules.decimals(2))],
    card: [when((a) => a.success, rules.required('Indica lo cobrado con tarjeta (0 si no hubo).'), rules.number(), rules.min(0), rules.max(100000), rules.decimals(2))],
    note: [when((a) => !a.success, ...reasonRules)],
  });

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-72 w-full" /></div>;
  if (error) return <ErrorBox error={error} />;

  const active = ACTIVE_STATUSES.includes(s.status);
  const isMine = profile.role === 'driver' && s.driver_id === profile.id;

  /** Ejecuta una acción de la API con control de errores y refresco de listas. */
  const run = async (path, body, okMsg) => {
    setBusy(true); setActionError(null);
    try {
      await api(`${key}/${path}`, { method: 'POST', body });
      toast(okMsg, 'success');
      await mutate(key);
      mutate((k) => typeof k === 'string' && (k.startsWith('/services?') || k.startsWith('/clients')));
      return true;
    } catch (e) { setActionError(e); return false; } finally { setBusy(false); }
  };

  const accept = async () => {
    if (await confirm({ title: 'Aceptar servicio', message: `${s.address}\n¿Confirmas que vas a realizarlo?`, confirmText: 'Sí, aceptar' }))
      run('accept', undefined, 'Servicio aceptado.');
  };
  const cancel = async () => {
    if (await confirm({ title: 'Cancelar servicio', message: 'El servicio quedará cancelado y se avisará al conductor.', confirmText: 'Cancelar servicio', cancelText: 'Volver', danger: true }))
      run('cancel', undefined, 'Servicio cancelado.');
  };
  const assign = async () => {
    const d = drivers.find((x) => x.id === assignTo);
    const msg = s.driver_id
      ? `Se le quitará el servicio a ${s.driver.full_name} (recibirá un aviso) y se asignará a ${d.full_name}.`
      : `Se asignará a ${d.full_name} y recibirá una notificación.`;
    if (await confirm({ title: s.driver_id ? 'Reasignar servicio' : 'Asignar servicio', message: msg, confirmText: s.driver_id ? 'Reasignar' : 'Asignar' })) {
      if (await run('assign', { driver_id: assignTo }, 'Servicio asignado.')) setAssignTo('');
    }
  };
  const unassign = async () => {
    if (await confirm({ title: 'Quitar asignación', message: `Se le quitará el servicio a ${s.driver.full_name} y volverá a "Creado" (sin conductor).`, confirmText: 'Quitar asignación', danger: true }))
      run('unassign', undefined, 'Servicio desasignado.');
  };

  // ---- Rechazar (conductor) ----
  const submitReject = rejectForm.submit(async ({ note }) => {
    if (!(await confirm({ title: 'Rechazar servicio', message: `Vas a rechazar el servicio #${s.code}. Volverá al administrador con tu motivo.`, confirmText: 'Rechazar servicio', danger: true }))) return;
    if (await run('reject', { note: note.trim() }, 'Servicio rechazado. Se ha avisado al administrador.')) { setModal(null); rejectForm.reset(); }
  });

  // ---- Cierre (éxito o fallido) ----
  const fv = finishForm.values;
  const submitFinish = finishForm.submit(async (val) => {
    const cash = Number(String(val.cash || 0).replace(',', '.')), card = Number(String(val.card || 0).replace(',', '.'));
    const msg = val.success
      ? `Efectivo: ${money(cash)}\nTarjeta: ${money(card)}\nTotal cobrado: ${money(cash + card)}` +
        (cash + card !== Number(s.price) ? `\n\nAtención: el precio previsto era ${money(s.price)}.` : '') +
        `\n\nBatería vieja recogida: ${val.old ? 'Sí' : 'No'}\nSe descontará 1 batería de tu stock.`
      : `El servicio se marcará como FALLIDO.\nMotivo: ${val.note.trim()}\n\nNo se cobrará nada ni se descontará stock.`;
    if (!(await confirm({ title: val.success ? 'Finalizar con éxito' : 'Finalizar como fallido', message: msg, confirmText: 'Confirmar y cerrar', danger: !val.success }))) return;
    const body = { success: val.success, cash: val.success ? cash : 0, card: val.success ? card : 0, old_battery_received: val.success && val.old, note: val.success ? undefined : val.note.trim() };
    if (await run('finish', body, val.success ? 'Servicio finalizado correctamente.' : 'Servicio marcado como fallido.')) { setModal(null); finishForm.reset(); }
  });
  const openFinish = () => { finishForm.reset({ success: true, cash: '', card: '', old: s.leaves_old_battery, note: '' }); setModal('finish'); };
  const fe = finishForm.error;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><p className="eyebrow">Servicio</p><h1 className="text-[22px] font-semibold tracking-tight">#{s.code} <span className="mx-1 text-faint">·</span><span className="font-mono tracking-wider">{s.plate}</span></h1></div>
        <StatusBadge status={s.status} />
      </div>

      {s.status === 'finished_failed' && s.fail_reason && (
        <div className="mb-4 flex gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"><Icon name="xCircle" className="mt-0.5 h-4 w-4" /><span><b>Motivo del fallo:</b> {s.fail_reason}</span></div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          <div className="card !py-1">
            <Row label="Cliente">{s.client_name}</Row>
            <Row label="Teléfono">
              <a className="text-brand hover:underline" href={`tel:${s.client_phone}`}>{s.client_phone}</a>
              <a className="ml-2 inline-block align-middle text-emerald-600" href={`https://wa.me/${s.client_phone.replace('+', '')}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><Icon name="message" className="h-4 w-4" /></a>
            </Row>
            <Row label="Dirección">{s.address}</Row>
            <Row label="Batería a montar">{s.battery_model}</Row>
            <Row label="A cobrar">{money(s.price)}</Row>
            <Row label="Deja batería vieja">{s.leaves_old_battery ? 'Sí' : 'No'}</Row>
            <Row label="Hora de llegada">{s.arrival_time ? dateTime(s.arrival_time) : '—'}</Row>
            <Row label="Creado">{dateTime(s.created_at)} <span className="text-muted">· hace <Elapsed from={s.created_at} to={active ? null : s.finished_at} /></span></Row>
            <Row label="Conductor">{s.driver?.full_name || 'Sin asignar'}</Row>
            {s.accepted_at && <Row label="Aceptado">{timeOnly(s.accepted_at)}</Row>}
            {s.notes && <Row label="Notas">{s.notes}</Row>}
          </div>

          {s.finished_at && (
            <div className="card !py-1">
              <Row label="Finalizado">{dateTime(s.finished_at)}</Row>
              {s.status === 'finished_ok' && <>
                <Row label="Cobrado en efectivo">{money(s.paid_cash)}</Row>
                <Row label="Cobrado con tarjeta">{money(s.paid_card)}</Row>
                <Row label="Total cobrado"><b>{money(Number(s.paid_cash) + Number(s.paid_card))}</b></Row>
                <Row label="Batería vieja recogida">{s.old_battery_received ? 'Sí' : 'No'}</Row>
                {admin && <Row label="Reseña WhatsApp">{s.review_sent_at ? `Enviada ${dateTime(s.review_sent_at)}` : s.review_error ? 'Error de envío' : 'Pendiente'}</Row>}
              </>}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <ErrorBox error={actionError} />

          {(isMine || admin) && (s.status === 'assigned' || s.status === 'accepted') && (
            <div className="card"><RouteButton services={[s]} label="Cómo llegar (Google Maps)" className="btn-ghost w-full" /></div>
          )}

          {isMine && (s.status === 'assigned' || s.status === 'accepted') && (
            <div className="card space-y-2">
              {s.status === 'assigned' && <button className="btn-primary w-full !min-h-11" disabled={busy} onClick={accept}><Icon name="check" className="h-4 w-4" />Aceptar servicio</button>}
              {s.status === 'accepted' && <button className="btn-success w-full !min-h-11" disabled={busy} onClick={openFinish}><Icon name="flag" className="h-4 w-4" />Finalizar servicio</button>}
              <button className="btn-soft-danger w-full" disabled={busy} onClick={() => { rejectForm.reset(); setModal('reject'); }}><Icon name="ban" className="h-4 w-4" />Rechazar servicio</button>
            </div>
          )}

          {admin && active && (
            <div className="card space-y-3">
              <p className="font-semibold">{s.driver_id ? 'Reasignar a otro conductor' : 'Asignar a un conductor'}</p>
              <div className="flex gap-2">
                <select className="field" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} aria-label="Conductor">
                  <option value="">Elegir conductor…</option>
                  {(drivers || []).filter((d) => d.active && d.id !== s.driver_id).map((d) => <option key={d.id} value={d.id}>{d.full_name} · stock {d.driver?.battery_stock ?? 0}</option>)}
                </select>
                <button className="btn-primary" disabled={!assignTo || busy} onClick={assign}>{s.driver_id ? 'Reasignar' : 'Asignar'}</button>
              </div>
              {s.driver_id && <button className="btn-ghost w-full" disabled={busy} onClick={unassign}><Icon name="undo" className="h-4 w-4" />Quitar asignación</button>}
              <button className="btn-soft-danger w-full" disabled={busy} onClick={cancel}><Icon name="x" className="h-4 w-4" />Cancelar servicio</button>
            </div>
          )}

          {/* ---------- Historial del servicio ---------- */}
          <div className="card">
            <p className="mb-3 font-semibold">Historial del servicio</p>
            <ol className="relative space-y-4 border-l border-line pl-5">
              {(s.events || []).map((e) => {
                const ev = EVENT[e.type] || EVENT.created;
                return (
                  <li key={e.id} className="relative">
                    <span className={`absolute -left-[31px] grid h-6 w-6 place-items-center rounded-full border border-line bg-surface ${ev.tone}`}><Icon name={ev.icon} className="h-3.5 w-3.5" /></span>
                    <p className="text-sm font-medium">{ev.label}{e.target?.full_name && ` ${e.target.full_name}`}</p>
                    <p className="text-xs text-muted">{dateTime(e.created_at)}{e.user?.full_name && ` · ${e.user.full_name}`}</p>
                    {e.note && <p className="mt-1 rounded-md bg-sunken px-2.5 py-1.5 text-sm text-muted">&ldquo;{e.note}&rdquo;</p>}
                  </li>
                );
              })}
              {!s.events?.length && <p className="text-sm text-muted">Sin eventos registrados.</p>}
            </ol>
          </div>
        </div>
      </div>

      {/* ---------- Modal: rechazar ---------- */}
      <Modal open={modal === 'reject'} onClose={() => setModal(null)} title="Rechazar servicio" subtitle="El administrador recibirá tu motivo y reasignará el servicio.">
        <form onSubmit={submitReject} noValidate className="space-y-4">
          <Field label="Motivo del rechazo" required error={rejectForm.error('note')} hint={`${rejectForm.values.note.length}/500`}>
            <textarea className={`field ${rejectForm.error('note') ? 'field-error' : ''}`} rows={4} placeholder="Ej. Estoy lejos de esa zona y no llego a la hora indicada." {...rejectForm.bind('note')} />
          </Field>
          <ErrorBox error={rejectForm.formError} />
          <div className="flex gap-2"><button type="button" className="btn-ghost flex-1" onClick={() => setModal(null)}>Volver</button><button className="btn-danger flex-1" disabled={busy}>Continuar</button></div>
        </form>
      </Modal>

      {/* ---------- Modal: finalizar ---------- */}
      <Modal open={modal === 'finish'} onClose={() => setModal(null)} title="Finalizar servicio" subtitle={`#${s.code} · ${s.client_name}`}>
        <form onSubmit={submitFinish} noValidate className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-sunken p-1">
            <button type="button" onClick={() => finishForm.set('success', true)} className={`btn !min-h-9 ${fv.success ? 'bg-emerald-600 text-white' : 'text-muted'}`}><Icon name="check" className="h-4 w-4" />Con éxito</button>
            <button type="button" onClick={() => finishForm.set('success', false)} className={`btn !min-h-9 ${!fv.success ? 'bg-red-600 text-white' : 'text-muted'}`}><Icon name="x" className="h-4 w-4" />Fallido</button>
          </div>
          {fv.success ? (<>
            <p className="flex items-center justify-between rounded-lg bg-sunken px-3 py-2.5 text-sm"><span className="text-muted">Precio previsto</span><b>{money(s.price)}</b></p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Efectivo (€)" required error={fe('cash')}><input className={`field ${fe('cash') ? 'field-error' : ''}`} inputMode="decimal" placeholder="0,00" {...finishForm.bind('cash')} /></Field>
              <Field label="Tarjeta (€)" required error={fe('card')}><input className={`field ${fe('card') ? 'field-error' : ''}`} inputMode="decimal" placeholder="0,00" {...finishForm.bind('card')} /></Field>
            </div>
            <Switch label="He recogido la batería vieja" {...finishForm.bind('old', { checkbox: true })} />
          </>) : (
            <Field label="Motivo del fallo" required error={fe('note')} hint={`${fv.note.length}/500`}>
              <textarea className={`field ${fe('note') ? 'field-error' : ''}`} rows={4} placeholder="Ej. El cliente no estaba en la dirección indicada." {...finishForm.bind('note')} />
            </Field>
          )}
          <ErrorBox error={finishForm.formError} />
          <button className={`${fv.success ? 'btn-success' : 'btn-danger'} w-full !min-h-11`} disabled={busy}>Continuar</button>
        </form>
      </Modal>
    </div>
  );
}
