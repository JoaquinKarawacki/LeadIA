import { embedMany, generateObject, generateText } from "ai";
import type { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crearCliente } from "@/utilidades/supabase/server";
import type { Database } from "@/utilidades/supabase/tipos";

const MODELO_EMBEDDING = "openai/text-embedding-3-small";
const MODELO_CHICO = "openai/gpt-4o-mini";

// Precio de lista en USD por millón de tokens, de entrada y salida. A mano
// porque el Gateway no expone una API de pricing — actualizar si cambia el modelo.
const PRECIOS_POR_MILLON_TOKENS: Record<
  string,
  { entrada: number; salida: number }
> = {
  "openai/text-embedding-3-small": { entrada: 0.02, salida: 0 },
  "openai/gpt-4o-mini": { entrada: 0.15, salida: 0.6 },
};

async function registrarUsoIa(
  tenantId: string,
  tarea: string,
  modelo: string,
  tokensInput: number,
  tokensOutput = 0,
  clienteSupabase?: SupabaseClient<Database>,
) {
  const precios = PRECIOS_POR_MILLON_TOKENS[modelo] ?? {
    entrada: 0,
    salida: 0,
  };
  const costoEstimado =
    (tokensInput / 1_000_000) * precios.entrada +
    (tokensOutput / 1_000_000) * precios.salida;

  // Sin cliente explícito, asume que corremos dentro de un request de Next.js
  // con sesión (crearCliente() depende de cookies()). Los workflows/steps en
  // background no tienen sesión de usuario, así que le pasan su propio
  // cliente (service role) — ver completarEstructurado.
  const supabase = clienteSupabase ?? (await crearCliente());
  await supabase.from("uso_ia").insert({
    tenant_id: tenantId,
    tarea,
    modelo,
    tokens_input: tokensInput,
    tokens_output: tokensOutput,
    costo_estimado: costoEstimado,
  });
}

// Genera un embedding por cada texto (mismo orden que `textos`) y registra el
// costo en uso_ia. Usar un solo llamado batch para varios textos es más
// barato que uno por texto.
export async function generarEmbeddings(
  tenantId: string,
  tarea: string,
  textos: string[],
): Promise<number[][]> {
  const { embeddings, usage } = await embedMany({
    model: MODELO_EMBEDDING,
    values: textos,
  });

  await registrarUsoIa(tenantId, tarea, MODELO_EMBEDDING, usage.tokens);

  return embeddings;
}

// Genera texto con el modelo chico/barato (resúmenes, explicaciones). Para la
// cotización final, cuando exista, se usará un modelo más potente aparte.
export async function completar(
  tenantId: string,
  tarea: string,
  prompt: string,
): Promise<string> {
  const { text, usage } = await generateText({
    model: MODELO_CHICO,
    prompt,
  });

  await registrarUsoIa(
    tenantId,
    tarea,
    MODELO_CHICO,
    usage.inputTokens ?? 0,
    usage.outputTokens ?? 0,
  );

  return text;
}

// Genera salida estructurada (JSON validado contra `esquema`) con el modelo
// chico. `clienteSupabase` es obligatorio para llamadas desde un contexto sin
// sesión de usuario (steps de un workflow en background) — ver registrarUsoIa.
export async function completarEstructurado<T>(
  tenantId: string,
  tarea: string,
  prompt: string,
  esquema: z.ZodType<T>,
  clienteSupabase?: SupabaseClient<Database>,
): Promise<T> {
  const { object, usage } = await generateObject({
    model: MODELO_CHICO,
    schema: esquema,
    prompt,
    // Sin reintentos propios del AI SDK: quien llama con clienteSupabase (un
    // step de workflow en background) ya tiene su propio retry con backoff
    // real (ver estructurarLote) — reintentar rápido acá solo desperdicia
    // intentos contra un rate limit que no se libera en segundos.
    maxRetries: clienteSupabase ? 0 : 2,
  });

  await registrarUsoIa(
    tenantId,
    tarea,
    MODELO_CHICO,
    usage.inputTokens ?? 0,
    usage.outputTokens ?? 0,
    clienteSupabase,
  );

  return object;
}

// pgvector espera el literal de texto "[0.1,0.2,...]" al insertar/actualizar
// una columna vector vía PostgREST (que tipa la columna como string).
export function formatoVectorPg(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
