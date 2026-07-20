import Link from "next/link";
import { crearCliente } from "@/utilidades/supabase/server";
import { agregarProducto, eliminarProducto, importarCsv } from "./acciones";

export default async function Catalogo() {
  const supabase = await crearCliente();
  const { data: productos } = await supabase
    .from("producto")
    .select()
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 bg-zinc-50 p-8 font-sans dark:bg-black">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Catálogo
        </h1>
        <Link href="/" className="text-sm underline text-zinc-600 dark:text-zinc-400">
          Volver
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-black dark:text-zinc-50">
          Agregar producto
        </h2>
        <form action={agregarProducto} className="flex flex-col gap-2">
          <input
            type="text"
            name="nombre"
            placeholder="Nombre"
            required
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <input
            type="text"
            name="descripcion"
            placeholder="Descripción"
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <div className="flex gap-2">
            <input
              type="number"
              name="precio"
              placeholder="Precio"
              step="0.01"
              required
              className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <input
              type="text"
              name="moneda"
              placeholder="USD"
              className="w-24 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-black px-3 py-2 text-white dark:bg-zinc-50 dark:text-black"
          >
            Agregar
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-black dark:text-zinc-50">
          Importar CSV
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Columnas esperadas: nombre, descripcion, precio, moneda, imagen_url
          (las últimas tres son opcionales).
        </p>
        <form action={importarCsv} className="flex items-center gap-2">
          <input
            type="file"
            name="archivo"
            accept=".csv"
            required
            className="text-sm text-zinc-600 dark:text-zinc-400"
          />
          <button
            type="submit"
            className="rounded bg-black px-3 py-2 text-white dark:bg-zinc-50 dark:text-black"
          >
            Importar
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium text-black dark:text-zinc-50">
          Productos ({productos?.length ?? 0})
        </h2>
        <ul className="flex flex-col gap-2">
          {productos?.map((producto) => (
            <li
              key={producto.id}
              className="flex items-center justify-between rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700"
            >
              <div>
                <p className="text-black dark:text-zinc-50">{producto.nombre}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {producto.precio} {producto.moneda}
                </p>
              </div>
              <form action={eliminarProducto.bind(null, producto.id)}>
                <button
                  type="submit"
                  className="text-sm text-red-600 underline dark:text-red-400"
                >
                  Eliminar
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
