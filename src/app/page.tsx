import { crearCliente } from "@/utilidades/supabase/server";

export default async function Inicio() {
  const supabase = await crearCliente();
  const { error } = await supabase.auth.getSession();
  const conectado = !error;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 font-sans dark:bg-black">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        LeadIA
      </h1>
      <p
        className={
          conectado
            ? "text-green-600 dark:text-green-400"
            : "text-red-600 dark:text-red-400"
        }
      >
        {conectado
          ? "Conectado a Supabase"
          : `Error de conexión a Supabase: ${error?.message}`}
      </p>
    </div>
  );
}
