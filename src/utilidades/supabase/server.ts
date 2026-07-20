import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./tipos";

export async function crearCliente() {
  const almacenCookies = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return almacenCookies.getAll();
        },
        setAll(cookiesParaEstablecer) {
          try {
            for (const { name, value, options } of cookiesParaEstablecer) {
              almacenCookies.set(name, value, options);
            }
          } catch {
            // setAll fue llamado desde un Server Component: ignorar,
            // el proxy se encarga de refrescar la sesión.
          }
        },
      },
    },
  );
}
