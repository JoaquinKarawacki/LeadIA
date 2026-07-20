import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const RUTAS_PUBLICAS = ["/login"];

// Refresca la sesión de Supabase en cada petición y protege las rutas privadas.
export async function proxy(peticion: NextRequest) {
  let respuesta = NextResponse.next({ request: peticion });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return peticion.cookies.getAll();
        },
        setAll(cookiesParaEstablecer) {
          for (const { name: nombre, value: valor } of cookiesParaEstablecer) {
            peticion.cookies.set(nombre, valor);
          }
          respuesta = NextResponse.next({ request: peticion });
          for (const {
            name: nombre,
            value: valor,
            options: opciones,
          } of cookiesParaEstablecer) {
            respuesta.cookies.set(nombre, valor, opciones);
          }
        },
      },
    },
  );

  const {
    data: { user: usuario },
  } = await supabase.auth.getUser();

  const esRutaPublica = RUTAS_PUBLICAS.includes(peticion.nextUrl.pathname);

  if (!usuario && !esRutaPublica) {
    const url = peticion.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (usuario && esRutaPublica) {
    const url = peticion.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return respuesta;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
