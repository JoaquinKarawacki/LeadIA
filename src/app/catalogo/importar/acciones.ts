"use server";

import { redirect } from "next/navigation";
import { start } from "workflow/api";
import { extractText, getDocumentProxy } from "unpdf";
import { crearCliente } from "@/utilidades/supabase/server";
import { importarCatalogoPdfWorkflow } from "@/utilidades/flujos/importar-catalogo-pdf";

export async function subirCatalogoPdf(datosFormulario: FormData) {
  const supabase = await crearCliente();
  const {
    data: { user: usuario },
  } = await supabase.auth.getUser();
  const tenantId = usuario!.app_metadata.tenant_id as string;

  const archivo = datosFormulario.get("archivo") as File;
  const buffer = new Uint8Array(await archivo.arrayBuffer());

  const documento = await getDocumentProxy(buffer);
  const { text: paginasTexto } = await extractText(documento, {
    mergePages: false,
  });

  const { data: importacion, error } = await supabase
    .from("importacion_catalogo")
    .insert({
      tenant_id: tenantId,
      creado_por: usuario!.id,
      nombre_archivo: archivo.name,
      total_paginas: paginasTexto.length,
      estado: "procesando",
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  const run = await start(importarCatalogoPdfWorkflow, [
    tenantId,
    importacion.id,
    paginasTexto,
  ]);

  await supabase
    .from("importacion_catalogo")
    .update({ run_id: run.runId })
    .eq("id", importacion.id);

  redirect(`/catalogo/importar/${importacion.id}`);
}
