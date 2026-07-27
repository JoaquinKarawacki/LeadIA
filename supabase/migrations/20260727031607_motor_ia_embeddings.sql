-- Etapa 2 — Motor de IA (cimientos): embeddings del catálogo + tracking de costo de IA.
--
-- pgvector en la misma Postgres (regla "sin base vectorial separada"). Sin índice ANN
-- todavía: con el volumen de catálogo esperado (PyME, no miles de productos) la
-- distancia coseno por fuerza bruta alcanza. Agregar ivfflat/hnsw cuando el volumen
-- lo justifique.

create extension if not exists vector with schema extensions;

alter table producto add column embedding extensions.vector(1536);

-- ── uso_ia — tracking de costo de IA por tenant ──────────────
create table uso_ia (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references organizacion (id) on delete cascade,
  tarea text not null,
  modelo text not null,
  tokens_input integer not null default 0,
  tokens_output integer not null default 0,
  costo_estimado numeric(12, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index uso_ia_tenant_id_idx on uso_ia (tenant_id);

alter table uso_ia enable row level security;

create policy "select_uso_ia_propio_tenant"
  on uso_ia for select
  to authenticated
  using (tenant_id = tenant_id_actual());

create policy "insertar_uso_ia_propio_tenant"
  on uso_ia for insert
  to authenticated
  with check (tenant_id = tenant_id_actual());
