import Link from "next/link";
import { crearCliente } from "@/utilidades/supabase/server";
import { subirCatalogoPdf } from "./acciones";
import { BotonSubir } from "./boton-subir";

export default async function ImportarCatalogo() {
  const supabase = await crearCliente();
  const { data: importaciones } = await supabase
    .from("importacion_catalogo")
    .select()
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 bg-zinc-50 p-8 font-sans dark:bg-black">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Importar catálogo por PDF
        </h1>
        <Link href="/catalogo" className="text-sm underline text-zinc-600 dark:text-zinc-400">
          Volver
        </Link>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Se extrae el texto del PDF y un modelo de IA propone los productos.
        Después vas a poder revisar y editar todo antes de guardarlos en el
        catálogo. Catálogos largos (cientos de páginas) se procesan en
        segundo plano — podés cerrar esta pantalla y volver más tarde.
      </p>

      <form action={subirCatalogoPdf} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            type="file"
            name="archivo"
            accept="application/pdf"
            required
            className="text-sm text-zinc-600 dark:text-zinc-400"
          />
          <BotonSubir />
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          Con archivos grandes (decenas de MB), subir el archivo puede tardar
          varios minutos según tu conexión — no cierres ni recargues la
          página mientras el botón diga &quot;Subiendo…&quot;.
        </p>
      </form>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium text-black dark:text-zinc-50">
          Importaciones anteriores
        </h2>
        <ul className="flex flex-col gap-2">
          {importaciones?.map((importacion) => (
            <li key={importacion.id}>
              <Link
                href={`/catalogo/importar/${importacion.id}`}
                className="flex items-center justify-between rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              >
                <span className="text-black dark:text-zinc-50">
                  {importacion.nombre_archivo}
                </span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {importacion.estado}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
