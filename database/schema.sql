-- =====================================================================
--  ESQUEMA DE BASE DE DATOS (Supabase / PostgreSQL)
--  Ejecutar completo en: Supabase > SQL Editor > New query > Run
-- =====================================================================
create extension if not exists "pgcrypto";

-- ---------- Tipos enumerados ----------
create type user_role as enum ('super_admin','admin','driver','client');
create type service_status as enum
  ('created','assigned','accepted','finished_ok','finished_failed','cancelled');

-- ---------- Perfiles (1 a 1 con auth.users de Supabase) ----------
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  phone      text,
  role       user_role not null default 'client',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Datos propios del conductor ----------
create table drivers (
  profile_id             uuid primary key references profiles(id) on delete cascade,
  battery_stock          integer       not null default 0,  -- baterías que lleva
  cash_collected         numeric(10,2) not null default 0,  -- efectivo pendiente de entregar
  old_batteries_received integer       not null default 0,  -- baterías viejas recibidas
  updated_at             timestamptz   not null default now()
);

-- ---------- Clientes (se crean/actualizan al crear un servicio) ----------
create table clients (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  phone        text not null unique,
  last_address text,
  created_at   timestamptz not null default now()
);

-- ---------- Servicios ----------
create table services (
  id                   uuid primary key default gen_random_uuid(),
  code                 bigint generated always as identity,   -- nº legible (#1, #2...)
  status               service_status not null default 'created',
  client_id            uuid references clients(id),
  client_name          text not null,
  client_phone         text not null,
  address              text not null,
  lat                  double precision,
  lng                  double precision,
  place_id             text,
  plate                text not null,                          -- matrícula
  battery_model        text not null,                          -- batería a montar
  price                numeric(10,2) not null default 0,       -- cuánto hay que cobrar
  leaves_old_battery   boolean not null default false,         -- ¿deja la vieja?
  arrival_time         timestamptz,                            -- hora de llegada prevista
  driver_id            uuid references profiles(id),
  paid_cash            numeric(10,2),
  paid_card            numeric(10,2),
  old_battery_received boolean not null default false,
  notes                text,
  created_by           uuid references profiles(id),
  created_at           timestamptz not null default now(),
  assigned_at          timestamptz,
  accepted_at          timestamptz,
  finished_at          timestamptz,
  review_sent_at       timestamptz,                            -- reseña enviada por WhatsApp
  review_attempts      integer not null default 0,
  review_error         text
);
create index services_status_idx  on services(status);
create index services_driver_idx  on services(driver_id);
create index services_created_idx on services(created_at desc);
create index services_review_idx  on services(finished_at)
  where status = 'finished_ok' and review_sent_at is null;

-- ---------- Historiales (auditoría) ----------
create table stock_movements (
  id         uuid primary key default gen_random_uuid(),
  driver_id  uuid not null references profiles(id),
  delta      integer not null,
  reason     text not null,                -- 'sale' | 'admin_adjust' | 'service_create'
  service_id uuid references services(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create table cash_settlements (            -- cada vez que el conductor entrega el efectivo
  id         uuid primary key default gen_random_uuid(),
  driver_id  uuid not null references profiles(id),
  amount     numeric(10,2) not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- Notificaciones ----------
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  title      text not null,
  body       text,
  url        text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, created_at desc);

create table push_subscriptions (          -- Web Push (PWA en segundo plano)
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

-- =====================================================================
--  SEGURIDAD: RLS activado SIN políticas = nadie puede leer/escribir con la
--  clave pública (anon). Solo el backend (service_role) accede a los datos.
-- =====================================================================
alter table profiles           enable row level security;
alter table drivers            enable row level security;
alter table clients            enable row level security;
alter table services           enable row level security;
alter table stock_movements    enable row level security;
alter table cash_settlements   enable row level security;
alter table notifications      enable row level security;
alter table push_subscriptions enable row level security;

-- =====================================================================
--  FUNCIONES ATÓMICAS (se ejecutan en una sola transacción)
-- =====================================================================

-- Cierra un servicio y actualiza stock/efectivo/baterías viejas del conductor.
create or replace function finish_service(
  p_service_id uuid, p_success boolean, p_cash numeric, p_card numeric, p_old boolean
) returns services language plpgsql as $$
declare s services;
begin
  select * into s from services where id = p_service_id for update;   -- bloquea la fila
  if not found then raise exception 'SERVICE_NOT_FOUND'; end if;
  if s.status <> 'accepted' then raise exception 'INVALID_STATUS'; end if;

  update services set
    status               = case when p_success then 'finished_ok'::service_status
                                else 'finished_failed'::service_status end,
    paid_cash            = case when p_success then p_cash else 0 end,
    paid_card            = case when p_success then p_card else 0 end,
    old_battery_received = (p_success and p_old),
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

-- Suma/resta baterías al stock de un conductor.
create or replace function adjust_stock(
  p_driver uuid, p_delta integer, p_reason text, p_actor uuid, p_service uuid default null
) returns integer language plpgsql as $$
declare new_stock integer;
begin
  update drivers set battery_stock = battery_stock + p_delta, updated_at = now()
   where profile_id = p_driver returning battery_stock into new_stock;
  if not found then raise exception 'DRIVER_NOT_FOUND'; end if;
  insert into stock_movements(driver_id, delta, reason, service_id, created_by)
    values (p_driver, p_delta, p_reason, p_service, p_actor);
  return new_stock;
end $$;

-- El conductor entrega el efectivo: se registra y se reinicia a 0.
create or replace function settle_cash(p_driver uuid, p_actor uuid)
returns numeric language plpgsql as $$
declare amt numeric;
begin
  select cash_collected into amt from drivers where profile_id = p_driver for update;
  if not found then raise exception 'DRIVER_NOT_FOUND'; end if;
  insert into cash_settlements(driver_id, amount, created_by) values (p_driver, amt, p_actor);
  update drivers set cash_collected = 0, updated_at = now() where profile_id = p_driver;
  return amt;
end $$;

-- Resumen por conductor filtrable por fechas (sobre la fecha de creación).
create or replace function report_summary(
  p_from timestamptz default null, p_to timestamptz default null, p_driver uuid default null
) returns table (
  driver_id uuid, full_name text, total_services bigint, finished_ok bigint,
  finished_failed bigint, cancelled bigint, batteries_sold bigint,
  old_batteries bigint, cash_total numeric, card_total numeric
) language sql stable as $$
  select p.id, p.full_name,
         count(s.id),
         count(*) filter (where s.status = 'finished_ok'),
         count(*) filter (where s.status = 'finished_failed'),
         count(*) filter (where s.status = 'cancelled'),
         count(*) filter (where s.status = 'finished_ok'),
         count(*) filter (where s.old_battery_received),
         coalesce(sum(s.paid_cash) filter (where s.status = 'finished_ok'), 0),
         coalesce(sum(s.paid_card) filter (where s.status = 'finished_ok'), 0)
    from profiles p
    left join services s on s.driver_id = p.id
         and (p_from is null or s.created_at >= p_from)
         and (p_to   is null or s.created_at <= p_to)
   where p.role = 'driver' and (p_driver is null or p.id = p_driver)
   group by p.id, p.full_name
   order by p.full_name
$$;

-- Estas funciones solo las usa el backend (service_role).
revoke all on function finish_service, adjust_stock, settle_cash, report_summary
  from public, anon, authenticated;
