import { iniciarSesion } from "./acciones";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 font-sans dark:bg-black">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        LeadIA
      </h1>
      <form
        action={iniciarSesion}
        className="flex w-full max-w-xs flex-col gap-3"
      >
        <input
          type="email"
          name="correo"
          placeholder="Email"
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <input
          type="password"
          name="contrasena"
          placeholder="Contraseña"
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Email o contraseña incorrectos.
          </p>
        )}
        <button
          type="submit"
          className="rounded bg-black px-3 py-2 text-white dark:bg-zinc-50 dark:text-black"
        >
          Ingresar
        </button>
      </form>
    </div>
  );
}
