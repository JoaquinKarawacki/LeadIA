import Link from "next/link";
import { crearCliente } from "@/utilidades/supabase/server";
import { crearProspecto, eliminarProspecto } from "./acciones";

export default async function Prospectos() {
  const supabase = await crearCliente();
  const { data: prospectos } = await supabase
    .from("prospecto")
    .select()
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 bg-zinc-50 p-8 font-sans dark:bg-black">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Prospectos
        </h1>
        <Link href="/" className="text-sm underline text-zinc-600 dark:text-zinc-400">
          Volver
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-black dark:text-zinc-50">
          Investigar empresa
        </h2>
        <form action={crearProspecto} className="flex flex-col gap-2">
          <input
            type="text"
            name="nombre_empresa"
            placeholder="Nombre de la empresa"
            required
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <input
            type="text"
            name="web"
            placeholder="Sitio web (opcional)"
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <button
            type="submit"
            className="rounded bg-black px-3 py-2 text-white dark:bg-zinc-50 dark:text-black"
          >
            Investigar
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium text-black dark:text-zinc-50">
          Empresas investigadas ({prospectos?.length ?? 0})
        </h2>
        <ul className="flex flex-col gap-3">
          {prospectos?.map((prospecto) => (
            <li
              key={prospecto.id}
              className="flex flex-col gap-1 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-black dark:text-zinc-50">
                    {prospecto.nombre_empresa}
                  </p>
                  {prospecto.web && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {prospecto.web}
                    </p>
                  )}
                </div>
                <form action={eliminarProspecto.bind(null, prospecto.id)}>
                  <button
                    type="submit"
                    className="text-sm text-red-600 underline dark:text-red-400"
                  >
                    Eliminar
                  </button>
                </form>
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                {prospecto.perfil_investigacion ?? "Sin perfil todavía."}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
