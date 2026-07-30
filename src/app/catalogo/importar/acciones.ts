"use server";

import "@/utilidades/polyfill-dommatrix";
import { redirect } from "next/navigation";
import { start } from "workflow/api";
import { PDFParse } from "pdf-parse";
import { crearCliente } from "@/utilidades/supabase/server";
import { importarCatalogoPdfWorkflow } from "@/utilidades/flujos/importar-catalogo-pdf";

export async function subirCatalogoPdf(datosFormulario: FormData) {
  const supabase = await crearCliente();
  const {
    data: { user: usuario },
  } = await supabase.auth.getUser();
  const tenantId = usuario!.app_metadata.tenant_id as string;

  const archivo = datosFormulario.get("archivo") as File;
  const buffer = Buffer.from(await archivo.arrayBuffer());

  const parser = new PDFParse({ data: buffer });
  const resultado = await parser.getText();
  await parser.destroy();

  const paginasTexto = resultado.pages.map((pagina) => pagina.text);

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
