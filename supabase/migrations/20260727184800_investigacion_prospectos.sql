-- Etapa 2 — Investigación de empresa: prospecto (empresa investigada) + evento
-- (log genérico de actividad, regla no negociable #3 de CLAUDE.md — quedó
-- pendiente desde Etapa 1, se crea recién ahora porque investigar una empresa
-- es la primera acción que hace falta loguear).

-- ── prospecto ─────────────────────────────────────────────────
create table prospecto (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references organizacion (id) on delete cascade,
  nombre_empresa text not null,
  web text,
  perfil_investigacion text,
  embedding extensions.vector(1536),
  estado text not null default 'nuevo'
    check (estado in ('nuevo', 'contactado', 'cotizado', 'ganado', 'perdido')),
  asignado_a uuid references usuario (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prospecto_tenant_id_idx on prospecto (tenant_id);

alter table prospecto enable row level security;

create trigger set_updated_at
  before update on prospecto
  for each row execute function public.actualizar_updated_at();

create policy "select_prospectos_propio_tenant"
  on prospecto for select
  to authenticated
  using (tenant_id = tenant_id_actual());

create policy "insertar_prospectos_propio_tenant"
  on prospecto for insert
  to authenticated
  with check (tenant_id = tenant_id_actual());

create policy "actualizar_prospectos_propio_tenant"
  on prospecto for update
  to authenticated
  using (tenant_id = tenant_id_actual())
  with check (tenant_id = tenant_id_actual());

create policy "eliminar_prospectos_propio_tenant"
  on prospecto for delete
  to authenticated
  using (tenant_id = tenant_id_actual());

-- ── evento — log genérico de actividad ───────────────────────
create table evento (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references organizacion (id) on delete cascade,
  usuario_id uuid references usuario (id) on delete set null,
  tipo text not null,
  entidad_tipo text not null,
  entidad_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index evento_tenant_id_idx on evento (tenant_id);

alter table evento enable row level security;

create policy "select_eventos_propio_tenant"
  on evento for select
  to authenticated
  using (tenant_id = tenant_id_actual());

create policy "insertar_eventos_propio_tenant"
  on evento for insert
  to authenticated
  with check (tenant_id = tenant_id_actual());
