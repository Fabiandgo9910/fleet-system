'use client';
/** Detalle de un servicio + acciones según rol y estado. */
import { useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { api, fetcher } from '@/lib/api';
import { dateTime, isAdmin, money, timeOnly, ACTIVE_STATUSES } from '@/lib/format';
import { singleRouteUrl } from '@/lib/maps';
import { useAuth, useConfirm, useToast } from '@/components/Providers';
import { Elapsed, ErrorBox, Modal, Skeleton, StatusBadge } from '@/components/ui';

const Row = ({ label, children }) => (
  <div className="flex justify-between gap-4 border-b py-2.5 text-sm last:border-0">
    <span className="text-gray-500">{label}</span>
    <span className="text-right font-medium">{children}</span>
  </div>
);

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
  const [finish, setFinish] = useState(null); // null = cerrado; objeto = formulario abierto
  const [actionError, setActionError] = useState(null);

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-72 w-full" /></div>;
  if (error) return <ErrorBox error={error} />;

  const active = ACTIVE_STATUSES.includes(s.status);
  const isMine = profile.role === 'driver' && s.driver_id === profile.id;

  /** Ejecuta una acción de la API con control de errores y refresco. */
  const run = async (path, body, okMsg) => {
    setBusy(true); setActionError(null);
    try {
      await api(`${key}/${path}`, { method: 'POST', body });
      toast(okMsg, 'success');
      await mutate(key); mutate((k) => typeof k === 'string' && k.startsWith('/services?'));
      return true;
    } catch (e) { setActionError(e); return false; } finally { setBusy(false); }
  };

  const accept = async () => {
    if (await confirm({ title: 'Aceptar servicio', message: `${s.address}\n¿Confirmas que vas a realizarlo?`, confirmText: 'Sí, aceptar' }))
      run('accept', undefined, 'Servicio aceptado');
  };
  const cancel = async () => {
    if (await confirm({ title: 'Cancelar servicio', message: 'El servicio quedará cancelado y se avisará al conductor.', confirmText: 'Cancelar servicio', cancelText: 'Volver', danger: true }))
      run('cancel', undefined, 'Servicio cancelado');
  };
  const assign = async () => {
    const d = drivers.find((x) => x.id === assignTo);
    if (await confirm({ title: 'Asignar servicio', message: `Se asignará a ${d.full_name} y recibirá una notificación.`, confirmText: 'Asignar' }))
      run('assign', { driver_id: assignTo }, 'Servicio asignado');
  };

  // ---- Cierre del servicio (conductor) ----
  const openFinish = () => setFinish({ success: true, cash: '', card: '', old: s.leaves_old_battery });
  const submitFinish = async (e) => {
    e.preventDefault();
    const cash = Number(finish.cash || 0), card = Number(finish.card || 0);
    const msg = finish.success
      ? `Efectivo: ${money(cash)}\nTarjeta: ${money(card)}\nTotal cobrado: ${money(cash + card)}` +
        (cash + card !== Number(s.price) ? `\n⚠️ El precio previsto era ${money(s.price)}` : '') +
        `\nBatería vieja recibida: ${finish.old ? 'Sí' : 'No'}\n\nSe descontará 1 batería de tu stock.`
      : 'El servicio se marcará como FALLIDO y no se cobrará nada.';
    const ok = await confirm({ title: finish.success ? 'Finalizar con éxito' : 'Finalizar como fallido', message: msg, confirmText: 'Confirmar y cerrar', danger: !finish.success });
    if (!ok) return;
    if (await run('finish', { success: finish.success, cash, card, old_battery_received: finish.old }, 'Servicio cerrado')) setFinish(null);
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Servicio #{s.code}</h1>
        <StatusBadge status={s.status} />
      </div>

      <div className="card !py-1">
        <Row label="Cliente">{s.client_name}</Row>
        <Row label="Teléfono">
          <a className="text-brand" href={`tel:${s.client_phone}`}>📞 {s.client_phone}</a>{' '}
          <a className="text-emerald-600" href={`https://wa.me/${s.client_phone.replace('+', '')}`} target="_blank" rel="noreferrer">💬</a>
        </Row>
        <Row label="Dirección"><a className="text-brand underline" href={singleRouteUrl(s)} target="_blank" rel="noreferrer">📍 {s.address}</a></Row>
        <Row label="Matrícula">{s.plate}</Row>
        <Row label="Batería a montar">{s.battery_model}</Row>
        <Row label="A cobrar">{money(s.price)}</Row>
        <Row label="Deja batería vieja">{s.leaves_old_battery ? 'Sí' : 'No'}</Row>
        <Row label="Hora de llegada">{s.arrival_time ? dateTime(s.arrival_time) : '—'}</Row>
        <Row label="Creado">{dateTime(s.created_at)} · hace <Elapsed from={s.created_at} to={active ? null : s.finished_at} /></Row>
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
            <Row label="Batería vieja recibida">{s.old_battery_received ? 'Sí' : 'No'}</Row>
            {admin && <Row label="Reseña WhatsApp">{s.review_sent_at ? `Enviada ${dateTime(s.review_sent_at)}` : s.review_error ? '⚠️ Error de envío' : 'Pendiente'}</Row>}
          </>}
        </div>
      )}

      <ErrorBox error={actionError} />

      {/* ---------- Acciones ---------- */}
      <div className="space-y-3">
        {(s.status === 'assigned' || s.status === 'accepted') && (isMine || admin) && (
          <a className="btn-ghost w-full" href={singleRouteUrl(s)} target="_blank" rel="noreferrer">🧭 Cómo llegar (Google Maps)</a>
        )}
        {isMine && s.status === 'assigned' && <button className="btn-primary w-full" disabled={busy} onClick={accept}>✅ Aceptar servicio</button>}
        {isMine && s.status === 'accepted' && <button className="btn-success w-full" disabled={busy} onClick={openFinish}>🏁 Finalizar servicio</button>}

        {admin && active && (
          <div className="card space-y-3">
            <label className="label">{s.driver_id ? 'Reasignar a otro conductor' : 'Asignar a un conductor'}</label>
            <div className="flex gap-2">
              <select className="input" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                <option value="">Elegir…</option>
                {(drivers || []).filter((d) => d.active && d.id !== s.driver_id).map((d) => <option key={d.id} value={d.id}>{d.full_name} · stock {d.driver?.battery_stock ?? 0}</option>)}
              </select>
              <button className="btn-primary" disabled={!assignTo || busy} onClick={assign}>Asignar</button>
            </div>
            <button className="btn-danger w-full" disabled={busy} onClick={cancel}>Cancelar servicio</button>
          </div>
        )}
      </div>

      {/* ---------- Formulario de cierre ---------- */}
      <Modal open={Boolean(finish)} onClose={() => setFinish(null)} title="Finalizar servicio">
        {finish && (
          <form onSubmit={submitFinish} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setFinish({ ...finish, success: true })} className={`btn ${finish.success ? 'bg-emerald-600 text-white' : 'border'}`}>✔ Con éxito</button>
              <button type="button" onClick={() => setFinish({ ...finish, success: false })} className={`btn ${!finish.success ? 'bg-red-600 text-white' : 'border'}`}>✖ Fallido</button>
            </div>
            {finish.success && (<>
              <p className="rounded-xl bg-gray-50 p-3 text-sm">Precio previsto: <b>{money(s.price)}</b></p>
              <div className="grid grid-cols-2 gap-3">
                <label><span className="label">Cobrado en efectivo (€)</span>
                  <input className="input" type="number" inputMode="decimal" min="0" step="0.01" required value={finish.cash} onChange={(e) => setFinish({ ...finish, cash: e.target.value })} /></label>
                <label><span className="label">Cobrado con tarjeta (€)</span>
                  <input className="input" type="number" inputMode="decimal" min="0" step="0.01" required value={finish.card} onChange={(e) => setFinish({ ...finish, card: e.target.value })} /></label>
              </div>
              <label className="flex items-center gap-3 rounded-xl border p-3">
                <input type="checkbox" className="h-5 w-5" checked={finish.old} onChange={(e) => setFinish({ ...finish, old: e.target.checked })} />
                <span className="text-sm font-medium">He recogido la batería vieja</span>
              </label>
            </>)}
            <button className={`${finish.success ? 'btn-success' : 'btn-danger'} w-full`} disabled={busy}>Continuar</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
