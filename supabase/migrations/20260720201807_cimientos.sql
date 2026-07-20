-- Etapa 1 — Cimientos: organizacion (tenant), usuario, producto (catálogo) + RLS.
--
-- Multi-tenancy: el tenant_id de la sesión viaja en el JWT (app_metadata.tenant_id),
-- seteado por el script de aprovisionamiento al crear el usuario. Las políticas leen
-- ese claim directo, sin subconsultas a otras tablas con RLS (evita recursión).

create or replace function public.tenant_id_actual()
returns uuid
language sql
stable
as $$
  select (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
$$;

create or replace function public.actualizar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── organizacion (el tenant) ─────────────────────────────────
create table organizacion (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  plan text not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table organizacion enable row level security;

create trigger set_updated_at
  before update on organizacion
  for each row execute function public.actualizar_updated_at();

create policy "select_propia_organizacion"
  on organizacion for select
  to authenticated
  using (id = tenant_id_actual());

-- ── usuario ───────────────────────────────────────────────────
create table usuario (
  id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null references organizacion (id) on delete cascade,
  email text not null,
  rol text not null check (rol in ('admin', 'vendedor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index usuario_tenant_id_idx on usuario (tenant_id);

alter table usuario enable row level security;

create trigger set_updated_at
  before update on usuario
  for each row execute function public.actualizar_updated_at();

create policy "select_usuarios_propio_tenant"
  on usuario for select
  to authenticated
  using (tenant_id = tenant_id_actual());

-- ── producto (catálogo) ──────────────────────────────────────
create table producto (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references organizacion (id) on delete cascade,
  nombre text not null,
  descripcion text,
  precio numeric(12, 2) not null,
  moneda text not null default 'USD',
  imagen_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index producto_tenant_id_idx on producto (tenant_id);

alter table producto enable row level security;

create trigger set_updated_at
  before update on producto
  for each row execute function public.actualizar_updated_at();

create policy "select_productos_propio_tenant"
  on producto for select
  to authenticated
  using (tenant_id = tenant_id_actual());

create policy "insertar_productos_propio_tenant"
  on producto for insert
  to authenticated
  with check (tenant_id = tenant_id_actual());

create policy "actualizar_productos_propio_tenant"
  on producto for update
  to authenticated
  using (tenant_id = tenant_id_actual())
  with check (tenant_id = tenant_id_actual());

create policy "eliminar_productos_propio_tenant"
  on producto for delete
  to authenticated
  using (tenant_id = tenant_id_actual());
