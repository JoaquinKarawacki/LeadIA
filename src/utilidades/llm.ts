import { embedMany } from "ai";
import { crearCliente } from "@/utilidades/supabase/server";

const MODELO_EMBEDDING = "openai/text-embedding-3-small";

// Precio de lista en USD por millón de tokens de entrada. A mano porque el
// Gateway no expone una API de pricing — actualizar si cambia el modelo.
const PRECIOS_POR_MILLON_TOKENS: Record<string, number> = {
  "openai/text-embedding-3-small": 0.02,
};

async function registrarUsoIa(
  tenantId: string,
  tarea: string,
  modelo: string,
  tokensInput: number,
) {
  const precioPorMillon = PRECIOS_POR_MILLON_TOKENS[modelo] ?? 0;
  const costoEstimado = (tokensInput / 1_000_000) * precioPorMillon;

  const supabase = await crearCliente();
  await supabase.from("uso_ia").insert({
    tenant_id: tenantId,
    tarea,
    modelo,
    tokens_input: tokensInput,
    tokens_output: 0,
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

// pgvector espera el literal de texto "[0.1,0.2,...]" al insertar/actualizar
// una columna vector vía PostgREST (que tipa la columna como string).
export function formatoVectorPg(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
