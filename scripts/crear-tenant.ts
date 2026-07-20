import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/utilidades/supabase/tipos";

const [nombreOrganizacion, correo, contrasena] = process.argv.slice(2);

if (!nombreOrganizacion || !correo || !contrasena) {
  console.error(
    'Uso: pnpm crear-tenant "<nombre de la organización>" <correo> <contraseña>',
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const claveServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !claveServiceRole) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.",
  );
  process.exit(1);
}

const supabase = createClient<Database>(url, claveServiceRole);

async function main() {
  const { data: organizacion, error: errorOrganizacion } = await supabase
    .from("organizacion")
    .insert({ nombre: nombreOrganizacion })
    .select()
    .single();

  if (errorOrganizacion) {
    throw errorOrganizacion;
  }

  const { data: datosAuth, error: errorAuth } =
    await supabase.auth.admin.createUser({
      email: correo,
      password: contrasena,
      email_confirm: true,
      app_metadata: { tenant_id: organizacion.id },
    });

  if (errorAuth) {
    throw errorAuth;
  }

  const { error: errorUsuario } = await supabase.from("usuario").insert({
    id: datosAuth.user.id,
    tenant_id: organizacion.id,
    email: correo,
    rol: "admin",
  });

  if (errorUsuario) {
    throw errorUsuario;
  }

  console.log(
    `Organización "${organizacion.nombre}" creada (${organizacion.id})`,
  );
  console.log(`Usuario admin: ${correo}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
