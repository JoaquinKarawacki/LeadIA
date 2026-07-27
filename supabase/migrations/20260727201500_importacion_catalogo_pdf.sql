-- Etapa 2 — Import de catálogo por PDF: tabla de seguimiento de la
-- importación (progreso + productos propuestos por el LLM, pendientes de
-- revisión). El procesamiento en sí corre en un workflow (Vercel Workflow
-- DevKit) fuera del ciclo de request; sus pasos usan el service role
-- (no hay sesión de usuario en background), por eso las políticas de
-- escritura son solo para lo que hace el usuario desde la UI (crear la
-- importación, confirmarla, cancelarla).

create table importacion_catalogo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references organizacion (id) on delete cascade,
  creado_por uuid references usuario (id) on delete set null,
  nombre_archivo text not null,
  total_paginas int not null,
  pagina_actual int not null default 0,
  estado text not null default 'procesando'
    check (estado in ('procesando', 'revision', 'completado', 'error')),
  -- Mapa { "<indiceLote>": [producto, ...] } — se sobreescribe por índice de
  -- lote (no se hace push/append) para que reintentos del workflow sean
  -- idempotentes: reprocesar el mismo lote reemplaza su entrada, no duplica.
  lotes_productos jsonb not null default '{}'::jsonb,
  error_mensaje text,
  run_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index importacion_catalogo_tenant_id_idx on importacion_catalogo (tenant_id);

alter table importacion_catalogo enable row level security;

create trigger set_updated_at
  before update on importacion_catalogo
  for each row execute function public.actualizar_updated_at();

create policy "select_importaciones_propio_tenant"
  on importacion_catalogo for select
  to authenticated
  using (tenant_id = tenant_id_actual());

create policy "insertar_importaciones_propio_tenant"
  on importacion_catalogo for insert
  to authenticated
  with check (tenant_id = tenant_id_actual());

create policy "actualizar_importaciones_propio_tenant"
  on importacion_catalogo for update
  to authenticated
  using (tenant_id = tenant_id_actual())
  with check (tenant_id = tenant_id_actual());

create policy "eliminar_importaciones_propio_tenant"
  on importacion_catalogo for delete
  to authenticated
  using (tenant_id = tenant_id_actual());
