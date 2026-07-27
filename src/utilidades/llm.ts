import { embedMany, generateText } from "ai";
import { crearCliente } from "@/utilidades/supabase/server";

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
) {
  const precios = PRECIOS_POR_MILLON_TOKENS[modelo] ?? {
    entrada: 0,
    salida: 0,
  };
  const costoEstimado =
    (tokensInput / 1_000_000) * precios.entrada +
    (tokensOutput / 1_000_000) * precios.salida;

  const supabase = await crearCliente();
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

// pgvector espera el literal de texto "[0.1,0.2,...]" al insertar/actualizar
// una columna vector vía PostgREST (que tipa la columna como string).
export function formatoVectorPg(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
