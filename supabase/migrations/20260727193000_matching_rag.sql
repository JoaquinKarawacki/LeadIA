-- Etapa 2 — Matching RAG: dado el embedding de un prospecto, devuelve los
-- productos del catálogo más parecidos (distancia coseno, pgvector).
--
-- No es SECURITY DEFINER: corre con los permisos de quien la llama, así que
-- RLS de `producto` sigue aplicando. El filtro por tenant_id_actual() es
-- redundante con esa RLS pero deja explícito el alcance de la búsqueda.

create or replace function public.buscar_productos_similares(
  embedding_consulta extensions.vector(1536),
  cantidad int default 5
)
returns setof producto
language sql
stable
set search_path = public, extensions
as $$
  select *
  from producto
  where tenant_id = tenant_id_actual()
  order by embedding <=> embedding_consulta
  limit cantidad
$$;
