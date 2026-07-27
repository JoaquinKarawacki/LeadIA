import Exa from "exa-js";
import { completar, formatoVectorPg, generarEmbeddings } from "@/utilidades/llm";
import { crearCliente } from "@/utilidades/supabase/server";

const claveExa = process.env.EXA_API_KEY;

if (!claveExa) {
  throw new Error("Falta EXA_API_KEY");
}

const exa = new Exa(claveExa);

async function buscarInfoEmpresa(nombreEmpresa: string, web: string | null) {
  const consulta = web
    ? `${nombreEmpresa} (${web}) empresa`
    : `${nombreEmpresa} empresa`;

  const { results } = await exa.search(consulta, {
    numResults: 5,
    contents: { summary: true },
  });

  return results
    .filter((resultado) => resultado.summary)
    .map(
      (resultado) =>
        `Fuente: ${resultado.url}\n${resultado.title}\n${resultado.summary}`,
    )
    .join("\n\n");
}

function promptPerfil(nombreEmpresa: string, infoBruta: string) {
  return `Sos un analista comercial. A partir de esta información encontrada en la web sobre la empresa "${nombreEmpresa}", escribí un perfil breve en español (máximo 200 palabras) útil para que un vendedor le recomiende productos. Cubrí: a qué se dedica, tamaño aproximado, y qué necesidades o problemas podría tener. Si la información es insuficiente, decilo explícitamente en vez de inventar datos.

Información encontrada:
${infoBruta}`;
}

// Investiga una empresa (búsqueda web + resumen con modelo chico) y guarda el
// perfil en `prospecto`. Cachea por nombre_empresa: si ya existe un prospecto
// con perfil para ese tenant, lo reusa en vez de volver a buscar/resumir.
export async function investigarEmpresa(
  tenantId: string,
  usuarioId: string,
  nombreEmpresa: string,
  web: string | null,
) {
  const supabase = await crearCliente();

  const { data: existente } = await supabase
    .from("prospecto")
    .select()
    .eq("tenant_id", tenantId)
    .ilike("nombre_empresa", nombreEmpresa)
    .not("perfil_investigacion", "is", null)
    .maybeSingle();

  if (existente) {
    return existente;
  }

  const infoBruta = await buscarInfoEmpresa(nombreEmpresa, web);
  const perfil = await completar(
    tenantId,
    "resumen_investigacion_prospecto",
    promptPerfil(nombreEmpresa, infoBruta),
  );
  const [embedding] = await generarEmbeddings(
    tenantId,
    "embedding_perfil_prospecto",
    [perfil],
  );

  const { data: prospecto, error } = await supabase
    .from("prospecto")
    .insert({
      tenant_id: tenantId,
      nombre_empresa: nombreEmpresa,
      web,
      perfil_investigacion: perfil,
      embedding: formatoVectorPg(embedding),
      asignado_a: usuarioId,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  await supabase.from("evento").insert({
    tenant_id: tenantId,
    usuario_id: usuarioId,
    tipo: "investigacion_completada",
    entidad_tipo: "prospecto",
    entidad_id: prospecto.id,
    metadata: { nombre_empresa: nombreEmpresa },
  });

  return prospecto;
}
