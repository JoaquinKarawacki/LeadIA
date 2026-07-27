import { completar } from "@/utilidades/llm";
import { crearCliente } from "@/utilidades/supabase/server";

const CANTIDAD_PRODUCTOS_RECOMENDADOS = 5;

function promptRecomendacion(
  perfilProspecto: string,
  productos: { nombre: string; descripcion: string | null; precio: number; moneda: string }[],
) {
  const listaProductos = productos
    .map(
      (producto, indice) =>
        `${indice + 1}. ${producto.nombre} (${producto.precio} ${producto.moneda})${
          producto.descripcion ? ` — ${producto.descripcion}` : ""
        }`,
    )
    .join("\n");

  return `Sos un vendedor experto. Este es el perfil de una empresa prospecto:

${perfilProspecto}

Estos son los productos del catálogo más relevantes según similitud semántica:

${listaProductos}

Recomendá cuáles de estos productos le conviene ofrecerle a esta empresa y explicá brevemente el porqué de cada uno (en español, máximo 150 palabras en total). Si ninguno encaja bien, decilo con honestidad en vez de forzar una recomendación.`;
}

// Matching RAG: dado un prospecto ya investigado, busca los productos del
// catálogo semánticamente más parecidos a su perfil (top-K vía pgvector) y le
// pide al LLM que explique la recomendación usando SOLO esos K productos.
export async function recomendarProductos(tenantId: string, prospectoId: string) {
  const supabase = await crearCliente();

  const { data: prospecto, error: errorProspecto } = await supabase
    .from("prospecto")
    .select("perfil_investigacion, embedding")
    .eq("id", prospectoId)
    .single();

  if (errorProspecto) {
    throw errorProspecto;
  }

  if (!prospecto.perfil_investigacion || !prospecto.embedding) {
    throw new Error("El prospecto todavía no tiene perfil investigado.");
  }

  const { data: productos, error: errorProductos } = await supabase.rpc(
    "buscar_productos_similares",
    {
      embedding_consulta: prospecto.embedding,
      cantidad: CANTIDAD_PRODUCTOS_RECOMENDADOS,
    },
  );

  if (errorProductos) {
    throw errorProductos;
  }

  if (!productos || productos.length === 0) {
    return { productos: [], explicacion: "El catálogo todavía no tiene productos cargados." };
  }

  const explicacion = await completar(
    tenantId,
    "recomendacion_productos_prospecto",
    promptRecomendacion(prospecto.perfil_investigacion, productos),
  );

  return { productos, explicacion };
}
