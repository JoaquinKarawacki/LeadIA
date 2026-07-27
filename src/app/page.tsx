import Link from "next/link";
import { cerrarSesion } from "./login/acciones";
import { crearCliente } from "@/utilidades/supabase/server";

export default async function Inicio() {
  const supabase = await crearCliente();
  const {
    data: { user: usuario },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 font-sans dark:bg-black">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        LeadIA
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Hola, {usuario?.email}
      </p>
      <Link href="/catalogo" className="text-sm underline text-zinc-600 dark:text-zinc-400">
        Catálogo
      </Link>
      <Link href="/prospectos" className="text-sm underline text-zinc-600 dark:text-zinc-400">
        Prospectos
      </Link>
      <form action={cerrarSesion}>
        <button
          type="submit"
          className="text-sm text-zinc-600 underline dark:text-zinc-400"
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
