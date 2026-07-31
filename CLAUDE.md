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
- **IA:** modelos vía **Vercel AI Gateway** (una sola key para proveedores abiertos y cerrados, trackeo de costo incluido, cero markup sobre precio de lista). Nunca hostear GPUs propias. Detalle de la decisión y el setup en "Estado actual" más abajo.
- **Deploy:** Vercel (o VPS barato).
- **Tareas lentas** (investigación, PDF, envío): **workers asincrónicos / cola de trabajos**, nunca bloqueando la request del usuario.

---

## Reglas NO negociables (aplican a todo el código)

1. **`tenant_id` en TODAS las tablas.** Multi-tenancy desde el día cero. Nunca lo dejes "para después".
2. **Row-Level Security activo:** cada usuario ve solo filas de su `tenant_id`. Toda query respeta esto.
3. **Registrá eventos siempre:** cada acción relevante (investigación, cotización creada/editada/enviada, cambio de estado) escribe una fila en `evento`.
4. **Trackeá costo de IA por tenant:** cada llamada al LLM registra tenant, tarea, tokens y costo estimado en `uso_ia`.
5. **Abstraé el proveedor de IA:** toda llamada pasa por un módulo propio (ej. `src/utilidades/llm.ts` con `complete(task, input)`). Nunca llamar la API cruda desde la lógica de negocio. Objetivo: cambiar de modelo/proveedor sin tocar el resto.
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

- **✅ Etapa 0 — Terreno:** repo, Next.js + Supabase, deploy funcionando.
- **✅ Etapa 1 — Cimientos:** auth, RLS, modelo de datos base, subir catálogo (manual + CSV). *DoD: empresa A no ve datos de empresa B.* — verificado en el navegador con dos tenants reales.
- **✅ Etapa 2 — Motor de IA:**
  - ✅ `src/utilidades/llm.ts` (abstracción de IA vía Vercel AI Gateway) + embeddings del catálogo (pgvector, se generan solos al crear un producto manual o por CSV) + `uso_ia` (tracking de costo). Ver detalle en "Estado actual" más abajo.
  - ✅ Investigación de empresa (búsqueda web + resumen con modelo chico → `prospecto`).
  - ✅ Matching RAG (embedding del perfil de la empresa → top-K productos por similitud → explicación con LLM).
  - ✅ Import de catálogo por PDF (extracción de texto + modelo chico que estructura los productos, con pantalla de revisión antes de guardar).
  - *DoD de la etapa: metés una empresa real y devuelve productos relevantes con explicación.* — cumplido.
  - **Etapa 2 completa.**
- **Etapa 3 — Cotización editable ⭐:** generar desde el match, editar todo (precio, cantidad, items). *DoD: MVP demostrable. Validar con clientes antes de seguir.*
- **Etapa 4 — PDF:** exportar cotización a PDF, guardar en Storage.
- **Etapa 5 — Mini-CRM:** estados de prospecto, actividades (vía `evento`), recordatorios propios. *No reconstruir un CRM completo. No integrar Google Calendar aún.*
- **Etapa 6 — Envío:** solo email para empezar. *WhatsApp/SMS quedan para cuando un cliente que paga los pida.*
- **Etapa 7 — Panel admin:** conversión, efectividad por vendedor, y costo de IA por tenant (unit economics).

---

## Estado actual (Etapa 2 completa, 2026-07-27 noche)

**Deploy e infra:**
- Repo en GitHub (`JoaquinKarawacki/LeadIA`), main deployado en Vercel: `https://leadia-gamma.vercel.app`. Push a `main` dispara deploy de producción automático (integración de Vercel con GitHub ya conectada).
- Proyecto de Supabase: ref `acwbffvddwtwlxykiehv`, región `us-east-2`.
- Gestor de paquetes: **pnpm**. CLI de Supabase pinneado como devDependency (`pnpm exec supabase ...`, ya linkeado al proyecto).
- Estructura de carpetas en español salvo lo que Next.js exige literal: `src/`, `app/`, `public/` quedan así porque el framework los reconoce por nombre; el código propio vive en `src/utilidades/` (no `lib/`).

**Auth y multi-tenancy (cómo está implementado, no solo el plan):**
- Login con email + password vía Supabase Auth (se descartó magic link: rate limit de emails muy bajo en plan free). Rutas protegidas por `src/proxy.ts` (Next.js 16 renombró `middleware` → `proxy`; la función exportada debe llamarse literal `proxy`).
- Tenants **aprovisionados por el dev**, no self-serve: `pnpm crear-tenant "<nombre organización>" <email> <contraseña>`. El script (`scripts/crear-tenant.ts`) usa `SUPABASE_SERVICE_ROLE_KEY`, corre solo local, nunca se deploya.
- El `tenant_id` de la sesión viaja en el JWT (`auth.jwt() -> app_metadata ->> tenant_id`), seteado por el script de aprovisionamiento al crear el usuario (`auth.admin.createUser` con `app_metadata`). **Toda política de RLS nueva debe usar la función `public.tenant_id_actual()`** (definida en `supabase/migrations/20260720201807_cimientos.sql`) en vez de subconsultas a otras tablas con RLS — evita problemas de recursión.
- `src/utilidades/supabase/tipos.ts` es **autogenerado** (`supabase gen types typescript --linked`) — no editar a mano, regenerar después de cada migración.

**Modelo de datos: existen `organizacion`, `usuario`, `producto`, `uso_ia`, `prospecto` y `evento`** (migraciones `20260720201807_cimientos.sql`, `20260727031607_motor_ia_embeddings.sql`, `20260727184800_investigacion_prospectos.sql` y `20260727193000_matching_rag.sql`). El resto de la sección "Modelo de datos" de este archivo (`cotizacion`, `cotizacion_item`, `recordatorio`) es el diseño objetivo, todavía no creado en la base — se van agregando tabla por tabla a medida que la etapa correspondiente las necesita. `producto` y `prospecto` ya tienen columna `embedding` (pgvector, `vector(1536)`, sin índice ANN todavía — se agrega ivfflat/hnsw si el volumen lo llega a justificar). `evento` se creó recién junto con `prospecto` (quedó pendiente desde Etapa 1 pese a la regla no negociable #3; no había ninguna acción que loguear todavía).

**Motor de IA (Etapa 2, cimientos + investigación de empresa ya construidos):**
- Toda llamada a IA pasa por `src/utilidades/llm.ts`, que expone `generarEmbeddings(tenantId, tarea, textos)` y `completar(tenantId, tarea, prompt)` (generación de texto). Usa **Vercel AI Gateway** (paquete `ai`, modelos `"proveedor/modelo"` como string plana — sin SDK de proveedor específico, sin wrapper `gateway()`). Cada llamada registra tokens (input y output) y costo estimado en `uso_ia`.
- Modelo de embeddings: `openai/text-embedding-3-small` (1536 dim). Modelo chico para resumir/explicar: `openai/gpt-4o-mini` — mismo proveedor que los embeddings, simplifica la tabla de precios a mano en `llm.ts`.
- Auth del Gateway: en producción (deploy en Vercel) se resuelve solo vía OIDC, sin ninguna key. En desarrollo local hace falta `AI_GATEWAY_API_KEY` en `.env.local` (dashboard de Vercel → proyecto `leadia` → AI Gateway → API Keys) — **requiere una tarjeta cargada en el team correcto de Vercel** (el que es dueño del proyecto) para que el Gateway deje de responder 403 `customer_verification_required`, incluso usando solo el crédito gratis de $5/mes.
- `agregarProducto` e `importarCsv` (`src/app/catalogo/acciones.ts`) generan el embedding de cada producto (nombre + descripción) antes de insertarlo — un solo llamado batch en el caso del CSV.
- **Investigación de empresa** (`src/utilidades/investigacion.ts`, función `investigarEmpresa`): busca la empresa con **Exa Search API** (`exa-js`, integración provisionada vía Vercel Marketplace — `EXA_API_KEY` autogenerada, ver `vercel integration list`), resume los resultados con `completar()` (modelo chico), embebe el perfil y lo guarda en `prospecto`. **Caché sin TTL**: si ya existe un `prospecto` con `perfil_investigacion` para ese nombre de empresa en el tenant (case-insensitive), lo reusa y no vuelve a llamar a Exa/LLM — no hay botón de "reinvestigar forzado" todavía (no sobre-diseñar). UI en `/prospectos` (`src/app/prospectos/`), mismo patrón que `/catalogo`.
- **Matching RAG** (`src/utilidades/matching.ts`, función `recomendarProductos`): usa el RPC de Postgres `buscar_productos_similares` (`supabase/migrations/20260727193000_matching_rag.sql` — `language sql`, ordena por `embedding <=> embedding_consulta`; **ojo**: el operador `<=>` vive en el schema `extensions`, así que la función necesita `set search_path = public, extensions` o falla con "operator does not exist") para traer el top-K de `producto` por similitud contra el embedding del `prospecto`, y le pasa *solo esos* K productos a `completar()` para que explique la recomendación (cumple la regla no negociable #7, nunca el catálogo entero al prompt). **No persiste la recomendación** — se recalcula cada vez que el vendedor la pide (botón "Recomendar productos" en `/prospectos`, vía query param `?recomendarId=`, sin componentes cliente): el artefacto persistente real es la cotización de Etapa 3, así que cachear esto ahora sería adelantar diseño.
- **Import de catálogo por PDF** (`src/utilidades/flujos/importar-catalogo-pdf.ts`): el candidato más pesado de la etapa (catálogos reales de cientos de páginas), así que corre en **Vercel Workflow DevKit** (paquete `workflow`, `next.config.ts` envuelto con `withWorkflow()`) en vez de bloquear la request o encadenar `fetch`+`after()` a mano — decisión tomada explícitamente con el usuario por los reintentos/resumibilidad de fábrica que da WDK. Flujo: `subirCatalogoPdf` (`src/app/catalogo/importar/acciones.ts`) extrae el texto del PDF **sincrónicamente** con **`unpdf`** (`extractText`/`getDocumentProxy`; rápido, no hace falta Storage — el array de texto por página se pasa directo como argumento del workflow) y crea la fila en `importacion_catalogo`; el workflow trocea las páginas en lotes de 6 (`PAGINAS_POR_LOTE`), cada lote es un step (`estructurarLote`) que llama a `completarEstructurado()` (nuevo en `llm.ts`, `generateObject` con schema de `zod`) para extraer productos, y otro step (`guardarLote`) persiste el resultado. Pantalla de revisión editable en `/catalogo/importar/[id]` antes de guardar en `producto` (primer componente cliente del proyecto — `BotonSubir`, solo para mostrar el estado "Subiendo…" de la Server Action vía `useFormStatus`; el resto sigue siendo forms + server actions sin JS de más).
- **`unpdf`, no `pdf-parse`, para extraer texto del PDF** — se probó `pdf-parse` primero y se migró después de romper producción varias veces (ver memoria `decisiones_import_pdf` para la saga completa: DOMMatrix faltante, worker no trackeado por el tracer de Vercel, y un intento de arreglarlo que rompió el deploy entero con ENOTDIR). `unpdf` bundlea su propia build de PDF.js con el worker inlineado, pensada para serverless — no necesita `serverExternalPackages` ni `outputFileTracingIncludes/Excludes`. **Lección: para librerías que parseen/rendericen algo pesado en una ruta de Next.js en Vercel, preguntar primero si existe una alternativa "serverless-first" antes de pelear con polyfills/tracing de la librería "normal" de Node.**
- **Otros gotchas de producción encontrados preparando una demo** (ver memoria `decisiones_import_pdf`): (1) el free tier del AI Gateway tiene rate limit real, que corta un import largo a mitad de camino — `estructurarLote` detecta `GatewayRateLimitError` (envuelto en `AI_RetryError`, hay que mirar `error.lastError`) y tira `RetryableError` con `retryAfter: "90s"` en vez de dejar que el AI SDK reintente rápido y se rinda (`completarEstructurado` pasa `maxRetries: 0` al SDK en background — el backoff real lo maneja el step). (2) Muchos catálogos B2B **no imprimen precio** — el schema de extracción lo deja `nullable`, nunca inventado, y la revisión fuerza a completarlo a mano. (3) `SUPABASE_SERVICE_ROLE_KEY` estaba en `.env.local` pero nunca se había subido a Vercel (production/preview) — el workflow la necesita en sus steps; hay que acordarse de `vercel env add` para cualquier env var de servidor nueva, no asumir que "andar en local" alcanza. (4) Next.js limita a 1MB el body de una Server Action por defecto — `experimental.serverActions.bodySizeLimit: "100mb"` en `next.config.ts` (100mb es además el techo real de las Vercel Functions).
- Los steps del workflow corren en background sin sesión de usuario — usan el service role de Supabase directo (no `crearCliente()`), así que `registrarUsoIa` en `llm.ts` ahora acepta un cliente Supabase opcional para poder loguear costo desde ahí también.
- Con esto se cumple el DoD de la Etapa 2 ("metés una empresa real y devuelve productos relevantes con explicación"). **Etapa 2 cerrada.**

Hay dos tenants de prueba cargados en la base (`demo@leadia.test` / `demo2@leadia.test`, contraseñas en el historial de este chat) — son solo para verificar aislamiento, se pueden borrar cuando se sume el primer cliente real. También se sumaron y ya se borraron los tenants "Prueba Etapa2 Investigacion", "Prueba Etapa2 Matching" y "Prueba Etapa2 ImportPDF": la extensión de Chrome sigue sin conectar en este entorno (ver memoria `entorno_sin_extension_chrome`), así que ninguna de las tres features (investigación, matching, import PDF) se validó clickeando en el navegador — se verificaron con scripts/rutas de diagnóstico descartables que replican el camino real. El import de PDF se probó con un catálogo real que el usuario dejó en la raíz del repo (`CATALOGOONLINESEGUMAX2023.pdf`, gitignoreado — no se commitea) — confirmó extracción de calidad real hasta que cortó el rate limit del free tier; el fix de backoff quedó implementado pero no se re-corrió de punta a punta las 244 páginas todavía (el usuario dijo que lo prueba él más tarde).

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
