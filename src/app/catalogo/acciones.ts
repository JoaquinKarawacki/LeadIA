"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { crearCliente } from "@/utilidades/supabase/server";

interface FilaCsv {
  nombre?: string;
  descripcion?: string;
  precio?: string;
  moneda?: string;
  imagen_url?: string;
}

async function tenantIdActual() {
  const supabase = await crearCliente();
  const {
    data: { user: usuario },
  } = await supabase.auth.getUser();

  return usuario?.app_metadata.tenant_id as string;
}

export async function agregarProducto(datosFormulario: FormData) {
  const supabase = await crearCliente();
  const tenantId = await tenantIdActual();

  const nombre = datosFormulario.get("nombre") as string;
  const descripcion = (datosFormulario.get("descripcion") as string) || null;
  const precio = Number(datosFormulario.get("precio"));
  const moneda = (datosFormulario.get("moneda") as string) || "USD";

  await supabase
    .from("producto")
    .insert({ tenant_id: tenantId, nombre, descripcion, precio, moneda });

  revalidatePath("/catalogo");
}

export async function eliminarProducto(idProducto: string) {
  const supabase = await crearCliente();
  await supabase.from("producto").delete().eq("id", idProducto);
  revalidatePath("/catalogo");
}

export async function importarCsv(datosFormulario: FormData) {
  const archivo = datosFormulario.get("archivo") as File;
  const tenantId = await tenantIdActual();

  const texto = await archivo.text();
  const { data: filas } = Papa.parse<FilaCsv>(texto, {
    header: true,
    skipEmptyLines: true,
  });

  const productos = filas
    .map((fila) => ({
      tenant_id: tenantId,
      nombre: fila.nombre?.trim() ?? "",
      descripcion: fila.descripcion?.trim() || null,
      precio: Number(fila.precio),
      moneda: fila.moneda?.trim() || "USD",
      imagen_url: fila.imagen_url?.trim() || null,
    }))
    .filter((producto) => producto.nombre && !Number.isNaN(producto.precio));

  if (productos.length > 0) {
    const supabase = await crearCliente();
    await supabase.from("producto").insert(productos);
  }

  revalidatePath("/catalogo");
}
