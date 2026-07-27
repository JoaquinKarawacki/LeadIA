import Link from "next/link";
import { notFound } from "next/navigation";
import { crearCliente } from "@/utilidades/supabase/server";
import { cancelarImportacion, confirmarImportacion } from "./acciones";

interface ProductoPropuesto {
  nombre: string;
  descripcion: string | null;
  precio: number | null;
}

export default async function EstadoImportacion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await crearCliente();
  const { data: importacion } = await supabase
    .from("importacion_catalogo")
    .select()
    .eq("id", id)
    .single();

  if (!importacion) {
    notFound();
  }

  const lotes = (importacion.lotes_productos ?? {}) as unknown as Record<
    string,
    ProductoPropuesto[]
  >;
  const productosPropuestos = Object.keys(lotes)
    .sort((a, b) => Number(a) - Number(b))
    .flatMap((clave) => lotes[clave]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 bg-zinc-50 p-8 font-sans dark:bg-black">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Importación de catálogo
        </h1>
        <Link href="/catalogo" className="text-sm underline text-zinc-600 dark:text-zinc-400">
          Volver
        </Link>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Archivo: {importacion.nombre_archivo}
      </p>

      {importacion.estado === "procesando" && (
        <div className="flex flex-col gap-3">
          <p className="text-black dark:text-zinc-50">
            Procesando página {importacion.pagina_actual} de{" "}
            {importacion.total_paginas}…
          </p>
          <div className="flex gap-3">
            <Link
              href={`/catalogo/importar/${id}`}
              className="text-sm underline text-zinc-600 dark:text-zinc-400"
            >
              Actualizar
            </Link>
            <form action={cancelarImportacion.bind(null, id)}>
              <button
                type="submit"
                className="text-sm text-red-600 underline dark:text-red-400"
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}

      {importacion.estado === "error" && (
        <div className="flex flex-col gap-3">
          <p className="text-red-600 dark:text-red-400">
            Error: {importacion.error_mensaje}
          </p>
          <form action={cancelarImportacion.bind(null, id)}>
            <button
              type="submit"
              className="text-sm text-red-600 underline dark:text-red-400"
            >
              Descartar
            </button>
          </form>
        </div>
      )}

      {importacion.estado === "revision" && (
        <form
          action={confirmarImportacion.bind(null, id)}
          className="flex flex-col gap-4"
        >
          <p className="text-black dark:text-zinc-50">
            Se propusieron {productosPropuestos.length} productos. Revisá
            nombre, descripción y precio (muchos catálogos no traen precio
            impreso, completalo antes de confirmar) y desmarcá lo que no
            corresponda.
          </p>
          <input type="hidden" name="cantidad" value={productosPropuestos.length} />
          <ul className="flex flex-col gap-3">
            {productosPropuestos.map((producto, indice) => (
              <li
                key={indice}
                className="flex flex-col gap-2 rounded border border-zinc-300 p-3 dark:border-zinc-700"
              >
                <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    name={`incluir_${indice}`}
                    defaultChecked
                  />
                  Incluir en el catálogo
                </label>
                <input type="hidden" name={`moneda_${indice}`} value="USD" />
                <input
                  type="text"
                  name={`nombre_${indice}`}
                  defaultValue={producto.nombre}
                  required
                  className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
                <input
                  type="text"
                  name={`descripcion_${indice}`}
                  defaultValue={producto.descripcion ?? ""}
                  className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
                <input
                  type="number"
                  step="0.01"
                  name={`precio_${indice}`}
                  defaultValue={producto.precio ?? ""}
                  placeholder="Precio (no venía en el PDF)"
                  required
                  className="w-48 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </li>
            ))}
          </ul>
          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded bg-black px-3 py-2 text-white dark:bg-zinc-50 dark:text-black"
            >
              Confirmar importación
            </button>
            <button
              type="submit"
              formAction={cancelarImportacion.bind(null, id)}
              className="text-sm text-red-600 underline dark:text-red-400"
            >
              Descartar todo
            </button>
          </div>
        </form>
      )}

      {importacion.estado === "completado" && (
        <p className="text-black dark:text-zinc-50">
          Importación completada.{" "}
          <Link href="/catalogo" className="underline">
            Ver catálogo
          </Link>
        </p>
      )}
    </div>
  );
}
