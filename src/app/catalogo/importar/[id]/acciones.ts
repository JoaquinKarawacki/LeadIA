"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearCliente } from "@/utilidades/supabase/server";
import { formatoVectorPg, generarEmbeddings } from "@/utilidades/llm";
import { textoParaEmbedding } from "@/utilidades/producto";

async function tenantIdActual() {
  const supabase = await crearCliente();
  const {
    data: { user: usuario },
  } = await supabase.auth.getUser();

  return usuario?.app_metadata.tenant_id as string;
}

export async function confirmarImportacion(
  importacionId: string,
  datosFormulario: FormData,
) {
  const supabase = await crearCliente();
  const tenantId = await tenantIdActual();

  const cantidad = Number(datosFormulario.get("cantidad") ?? 0);

  const productos = Array.from({ length: cantidad })
    .map((_, indice) => ({
      incluir: datosFormulario.get(`incluir_${indice}`) === "on",
      nombre: ((datosFormulario.get(`nombre_${indice}`) as string) ?? "").trim(),
      descripcion:
        ((datosFormulario.get(`descripcion_${indice}`) as string) ?? "").trim() ||
        null,
      precio: Number(datosFormulario.get(`precio_${indice}`)),
      moneda: (datosFormulario.get(`moneda_${indice}`) as string) || "USD",
    }))
    .filter(
      (producto) =>
        producto.incluir && producto.nombre && !Number.isNaN(producto.precio),
    );

  if (productos.length > 0) {
    const embeddings = await generarEmbeddings(
      tenantId,
      "embedding_producto_import_pdf",
      productos.map((producto) =>
        textoParaEmbedding(producto.nombre, producto.descripcion),
      ),
    );

    await supabase.from("producto").insert(
      productos.map((producto, indice) => ({
        tenant_id: tenantId,
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        precio: producto.precio,
        moneda: producto.moneda,
        embedding: formatoVectorPg(embeddings[indice]),
      })),
    );
  }

  await supabase
    .from("importacion_catalogo")
    .update({ estado: "completado" })
    .eq("id", importacionId);

  revalidatePath("/catalogo");
  redirect("/catalogo");
}

export async function cancelarImportacion(importacionId: string) {
  const supabase = await crearCliente();
  await supabase.from("importacion_catalogo").delete().eq("id", importacionId);
  redirect("/catalogo/importar");
}
