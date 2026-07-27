import { z } from "zod";
import { RetryError } from "ai";
import { RetryableError } from "workflow";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { completarEstructurado } from "@/utilidades/llm";
import type { Database } from "@/utilidades/supabase/tipos";

// Cuánto espera el step antes de reintentar cuando el AI Gateway devuelve
// rate limit. En el free tier de Vercel no alcanza con el backoff rápido del
// AI SDK (segundos) — hace falta una espera real.
const ESPERA_RATE_LIMIT = "90s";

// Cuántas páginas del PDF se mandan juntas en cada llamada al LLM. Un
// catálogo de 244 páginas queda en ~41 lotes — cada uno es un step
// independiente, así que ningún request individual tiene que esperar a que
// el catálogo entero termine de procesarse.
const PAGINAS_POR_LOTE = 6;

const EsquemaProductosExtraidos = z.object({
  productos: z.array(
    z.object({
      nombre: z.string(),
      descripcion: z.string().nullable(),
      // Muchos catálogos B2B no imprimen precio (se cotiza aparte) — el
      // modelo NUNCA debe inventar uno; se completa a mano en la revisión.
      precio: z.number().nullable(),
    }),
  ),
});

type ProductoExtraido = z.infer<typeof EsquemaProductosExtraidos>["productos"][number];

// Los steps corren en background, sin sesión de usuario (no hay cookies que
// crearCliente() pueda leer) — usan el service role, así que cada operación
// tiene que filtrar/setear tenant_id a mano en vez de confiar en RLS.
function clienteServicio(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function promptEstructurarLote(textoLote: string) {
  return `Sos un asistente que extrae productos de un catálogo comercial en PDF. A partir del siguiente texto (puede tener ruido de encabezados, pies de página, o texto de marketing sin productos), extraé cada producto distinto que aparezca, con su nombre/modelo y una descripción breve con sus características principales (material, certificaciones, colores, talles, etc.). Si el texto no tiene precio impreso, dejá precio en null — NUNCA inventes un precio. Ignorá texto que no describa un producto puntual (portada, institucional, índice).

Texto (páginas del catálogo):
${textoLote}`;
}

async function estructurarLote(
  tenantId: string,
  textoLote: string,
): Promise<ProductoExtraido[]> {
  "use step";

  if (!textoLote.trim()) {
    return [];
  }

  try {
    const { productos } = await completarEstructurado(
      tenantId,
      "estructurar_lote_catalogo_pdf",
      promptEstructurarLote(textoLote),
      EsquemaProductosExtraidos,
      clienteServicio(),
    );

    return productos;
  } catch (error) {
    const causaOriginal = RetryError.isInstance(error) ? error.lastError : error;
    const esRateLimit =
      (causaOriginal as { name?: string } | undefined)?.name ===
      "GatewayRateLimitError";

    if (esRateLimit) {
      throw new RetryableError(
        "Rate limit del AI Gateway (free tier) — reintentando con espera",
        { retryAfter: ESPERA_RATE_LIMIT },
      );
    }

    throw error;
  }
}
// Con backoff real (90s), unos pocos reintentos alcanzan para pasar el
// rate limit del free tier — es solo tiempo de espera, no gasto extra.
estructurarLote.maxRetries = 10;

// Sobreescribe (no hace append) la entrada del lote en `lotes_productos`, así
// que si el workflow reintenta este step, el resultado es idempotente: repite
// el mismo lote en el mismo índice en vez de duplicarlo.
async function guardarLote(
  importacionId: string,
  indiceLote: number,
  productos: ProductoExtraido[],
  paginaActual: number,
) {
  "use step";

  const supabase = clienteServicio();

  const { data: actual, error: errorLectura } = await supabase
    .from("importacion_catalogo")
    .select("lotes_productos")
    .eq("id", importacionId)
    .single();

  if (errorLectura) {
    throw errorLectura;
  }

  const lotes = {
    ...(actual.lotes_productos as Record<string, ProductoExtraido[]>),
    [String(indiceLote)]: productos,
  };

  const { error: errorUpdate } = await supabase
    .from("importacion_catalogo")
    .update({ lotes_productos: lotes, pagina_actual: paginaActual })
    .eq("id", importacionId);

  if (errorUpdate) {
    throw errorUpdate;
  }
}

async function marcarEnRevision(importacionId: string) {
  "use step";

  const supabase = clienteServicio();
  await supabase
    .from("importacion_catalogo")
    .update({ estado: "revision" })
    .eq("id", importacionId);
}

async function marcarError(importacionId: string, mensaje: string) {
  "use step";

  const supabase = clienteServicio();
  await supabase
    .from("importacion_catalogo")
    .update({ estado: "error", error_mensaje: mensaje })
    .eq("id", importacionId);
}

export async function importarCatalogoPdfWorkflow(
  tenantId: string,
  importacionId: string,
  paginasTexto: string[],
) {
  "use workflow";

  try {
    for (let inicio = 0; inicio < paginasTexto.length; inicio += PAGINAS_POR_LOTE) {
      const indiceLote = inicio / PAGINAS_POR_LOTE;
      const textoLote = paginasTexto.slice(inicio, inicio + PAGINAS_POR_LOTE).join("\n\n");
      const paginaActual = Math.min(inicio + PAGINAS_POR_LOTE, paginasTexto.length);

      const productos = await estructurarLote(tenantId, textoLote);
      await guardarLote(importacionId, indiceLote, productos, paginaActual);
    }

    await marcarEnRevision(importacionId);
  } catch (error) {
    await marcarError(
      importacionId,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }

  return { importacionId };
}
