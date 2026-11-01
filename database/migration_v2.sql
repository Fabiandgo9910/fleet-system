-- =====================================================================
--  MIGRACIÓN v2  (para bases de datos YA desplegadas)
--  Supabase > SQL Editor > New query > pegar todo > Run
--  Es seguro ejecutarla más de una vez.
-- =====================================================================

-- 1) Motivo cuando un servicio se da por fallido
alter table services add column if not exists fail_reason text;

-- 2) Historial de eventos de cada servicio (asignado, rechazado, fallido...)
create table if not exists service_events (
  id             uuid primary key default gen_random_uuid(),
  service_id     uuid not null references services(id) on delete cascade,
  type           text not null,   -- created|assigned|unassigned|accepted|rejected|finished_ok|finished_failed|cancelled
  user_id        uuid references profiles(id),   -- quién hizo la acción
  target_user_id uuid references profiles(id),   -- conductor afectado (asignado / retirado)
  note           text,
  created_at     timestamptz not null default now()
);
create index if not exists service_events_service_idx on service_events(service_id, created_at);

-- 3) Ajustes de la empresa (p. ej. dirección del almacén)
create table if not exists settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- 4) Índices para las búsquedas del historial
create index if not exists services_client_idx on services(client_id);
create index if not exists services_plate_idx  on services(plate);

-- 5) Seguridad (RLS sin políticas: solo el backend accede)
alter table service_events enable row level security;
alter table settings       enable row level security;

-- 6) finish_service ahora recibe el motivo del fallo
drop function if exists finish_service(uuid, boolean, numeric, numeric, boolean);

create or replace function finish_service(
  p_service_id uuid, p_success boolean, p_cash numeric, p_card numeric, p_old boolean,
  p_note text default null
) returns services language plpgsql as $$
declare s services;
begin
  select * into s from services where id = p_service_id for update;
  if not found then raise exception 'SERVICE_NOT_FOUND'; end if;
  if s.status <> 'accepted' then raise exception 'INVALID_STATUS'; end if;

  update services set
    status               = case when p_success then 'finished_ok'::service_status
                                else 'finished_failed'::service_status end,
    paid_cash            = case when p_success then p_cash else 0 end,
    paid_card            = case when p_success then p_card else 0 end,
    old_battery_received = (p_success and p_old),
    fail_reason          = case when p_success then null else p_note end,
    finished_at          = now()
  where id = p_service_id returning * into s;

  if p_success then
    update drivers set
      battery_stock          = battery_stock - 1,
      cash_collected         = cash_collected + p_cash,
      old_batteries_received = old_batteries_received + (case when p_old then 1 else 0 end),
      updated_at             = now()
    where profile_id = s.driver_id;
    insert into stock_movements(driver_id, delta, reason, service_id)
      values (s.driver_id, -1, 'sale', s.id);
  end if;
  return s;
end $$;

revoke all on function finish_service(uuid, boolean, numeric, numeric, boolean, text)
  from public, anon, authenticated;
