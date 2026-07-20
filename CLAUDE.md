# CLAUDE.md — LeadIA

Contexto del proyecto para Claude Code. Leé esto antes de proponer o escribir código.

---

## Qué es LeadIA

SaaS **multi-tenant** para equipos de ventas. Automatiza el flujo del vendedor:

> Investigar la empresa → recomendar productos del catálogo → generar cotización editable → exportar PDF → enviar → hacer seguimiento.

**Problema que resuelve:** un vendedor solo puede atender a un número limitado de clientes. El sistema le saca de encima las tareas repetitivas (investigación y armado de cotizaciones) para que rinda más.

**Clientes:** empresas con equipos de vendedores. Cada empresa es un **tenant** con su propio catálogo, usuarios y datos, totalmente aislados de los demás.

**Contexto del equipo:** un solo desarrollador. Prioridad absoluta en **bajo mantenimiento, bajo costo y escalabilidad**. Preferí siempre tecnología aburrida y probada sobre lo novedoso.

---

## Stack

- **Framework:** Next.js (front + back en TypeScript).
- **Base de datos / backend:** Supabase → Postgres, Auth, Row-Level Security, **pgvector**, Storage.
- **IA:** modelos vía **API de inferencia por token** (open source vía Together/Groq/Fireworks/DeepInfra, o proveedores cerrados). Nunca hostear GPUs propias.
- **Deploy:** Vercel (o VPS barato).
- **Tareas lentas** (investigación, PDF, envío): **workers asincrónicos / cola de trabajos**, nunca bloqueando la request del usuario.

---

## Reglas NO negociables (aplican a todo el código)

1. **`tenant_id` en TODAS las tablas.** Multi-tenancy desde el día cero. Nunca lo dejes "para después".
2. **Row-Level Security activo:** cada usuario ve solo filas de su `tenant_id`. Toda query respeta esto.
3. **Registrá eventos siempre:** cada acción relevante (investigación, cotización creada/editada/enviada, cambio de estado) escribe una fila en `evento`.
4. **Trackeá costo de IA por tenant:** cada llamada al LLM registra tenant, tarea, tokens y costo estimado en `uso_ia`.
5. **Abstraé el proveedor de IA:** toda llamada pasa por un módulo propio (ej. `lib/llm.ts` con `complete(task, input)`). Nunca llamar la API cruda desde la lógica de negocio. Objetivo: cambiar de modelo/proveedor sin tocar el resto.
6. **Monolito.** Sin microservicios, sin Kubernetes, sin base vectorial separada (usá pgvector en la misma Postgres).
7. **RAG para el matching, siempre.** Nunca meter el catálogo completo en un prompt.

---

## Cómo funciona el matching (RAG) — el núcleo del producto

1. Al crear/editar un `producto`, generar su **embedding** una sola vez y guardarlo en pgvector.
2. Al investigar una empresa: buscar info (API de búsqueda web) → resumir con un modelo **chico/barato** → guardar un "perfil" en `prospecto`.
3. Embeber ese perfil → búsqueda por similitud → traer los **top-K productos** del catálogo.
4. Pasar al LLM **solo esos K productos** para que arme la recomendación y explique el porqué.

**Optimizaciones de costo obligatorias:** modelo chico para tareas simples (resumir/explicar), modelo potente solo para la cotización final, y **cachear** investigaciones repetidas (misma empresa = no investigar dos veces).

---

## Modelo de datos

Todas las tablas llevan `tenant_id` (salvo `organizacion`, que ES el tenant). Ids como UUID. Timestamps `created_at`/`updated_at`.

```
organizacion        -- el tenant / empresa cliente
  id, nombre, plan, created_at

usuario
  id, tenant_id, email, rol ('admin' | 'vendedor'), created_at

producto            -- catálogo
  id, tenant_id, nombre, descripcion, precio, moneda,
  imagen_url, embedding (vector), created_at

prospecto           -- empresa investigada / lead
  id, tenant_id, nombre_empresa, web,
  perfil_investigacion (jsonb/text), embedding (vector),
  estado ('nuevo'|'contactado'|'cotizado'|'ganado'|'perdido'),
  asignado_a (usuario_id), created_at

cotizacion
  id, tenant_id, prospecto_id, vendedor_id,
  estado ('borrador'|'enviada'|'aceptada'|'rechazada'),
  version (int), total, moneda, created_at, updated_at

cotizacion_item     -- líneas de la cotización
  id, cotizacion_id, producto_id, cantidad,
  precio_unitario, descripcion

evento              -- log genérico de actividad
  id, tenant_id, usuario_id, tipo,
  entidad_tipo, entidad_id, metadata (jsonb), created_at

recordatorio
  id, tenant_id, prospecto_id, usuario_id,
  fecha, nota, completado (bool)

uso_ia              -- tracking de costo de IA por tenant
  id, tenant_id, tarea, modelo,
  tokens_input, tokens_output, costo_estimado, created_at
```

**Notas:**
- `cotizacion` es editable → manejar versiones (o historial de cambios).
- `evento` y `uso_ia` se llenan desde la etapa 1 aunque el dashboard sea lo último.

---

## Roadmap por etapas

Ir en orden. Las etapas 1–3 son el MVP demostrable.

- **Etapa 0 — Terreno:** repo, Next.js + Supabase, deploy funcionando.
- **Etapa 1 — Cimientos:** auth, RLS, modelo de datos base, subir catálogo (manual + CSV). *DoD: empresa A no ve datos de empresa B.*
- **Etapa 2 — Motor de IA:** embeddings del catálogo, investigación de empresa, matching RAG. *DoD: metés una empresa real y devuelve productos relevantes con explicación.*
- **Etapa 3 — Cotización editable ⭐:** generar desde el match, editar todo (precio, cantidad, items). *DoD: MVP demostrable. Validar con clientes antes de seguir.*
- **Etapa 4 — PDF:** exportar cotización a PDF, guardar en Storage.
- **Etapa 5 — Mini-CRM:** estados de prospecto, actividades (vía `evento`), recordatorios propios. *No reconstruir un CRM completo. No integrar Google Calendar aún.*
- **Etapa 6 — Envío:** solo email para empezar. *WhatsApp/SMS quedan para cuando un cliente que paga los pida.*
- **Etapa 7 — Panel admin:** conversión, efectividad por vendedor, y costo de IA por tenant (unit economics).

---

## Cosas que NO hacer (aprendido de antemano)

- No meter el catálogo entero en un prompt (usar RAG).
- No hostear modelos en GPUs propias (usar API por token).
- No dejar `tenant_id` para después.
- No reconstruir un CRM completo — el diferencial es la IA, no el CRM.
- No integrar WhatsApp/SMS al inicio (pozo sin fondo: aprobaciones, costo por conversación).
- No microservicios, no Kubernetes, no base vectorial separada.
- No sobre-diseñar (editor de cotización, diseño del PDF): que funcione lo esencial primero.

---

## Convenciones de trabajo con Claude Code

- Trabajamos **una etapa a la vez**. No adelantar features de etapas futuras salvo que lo pida explícitamente.
- Ante una decisión de diseño con trade-offs, explicá el trade-off en vez de elegir en silencio.
- Priorizá siempre: bajo costo de mantenimiento > velocidad de features.
- **Código 100% en español**: nombres de variables, funciones, tipos, componentes y comentarios van en español. Excepciones (cuando "no se pueda"): identificadores que un framework/librería obliga a mantener en inglés (ej. el export `proxy` que exige Next.js, los métodos `getAll`/`setAll` de la interfaz de cookies de `@supabase/ssr`), palabras reservadas del lenguaje, nombres de paquetes/APIs de terceros, y términos técnicos sin traducción natural u homónima ya asentada en la jerga (ej. `hook`, `middleware`, `endpoint`, `commit`). Ante la duda, traducir.
- **Clean code siempre**: nombres descriptivos (nada de `x`, `data2`, `tmp`), funciones chicas con una sola responsabilidad, sin duplicación, sin código muerto ni comentarios que expliquen el "qué" (el código ya lo dice) — solo comentar el "por qué" cuando no sea obvio (una decisión no evidente, una limitación de una librería, un workaround).
