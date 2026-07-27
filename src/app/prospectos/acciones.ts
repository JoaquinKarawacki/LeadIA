"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { investigarEmpresa } from "@/utilidades/investigacion";
import { crearCliente } from "@/utilidades/supabase/server";

async function usuarioActual() {
  const supabase = await crearCliente();
  const {
    data: { user: usuario },
  } = await supabase.auth.getUser();

  return usuario!;
}

export async function crearProspecto(datosFormulario: FormData) {
  const usuario = await usuarioActual();
  const tenantId = usuario.app_metadata.tenant_id as string;

  const nombreEmpresa = datosFormulario.get("nombre_empresa") as string;
  const web = (datosFormulario.get("web") as string) || null;

  await investigarEmpresa(tenantId, usuario.id, nombreEmpresa, web);

  revalidatePath("/prospectos");
}

export async function eliminarProspecto(idProspecto: string) {
  const supabase = await crearCliente();
  await supabase.from("prospecto").delete().eq("id", idProspecto);
  revalidatePath("/prospectos");
}

export async function pedirRecomendacion(idProspecto: string) {
  redirect(`/prospectos?recomendarId=${idProspecto}`);
}
