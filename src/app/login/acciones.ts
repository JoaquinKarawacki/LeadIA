"use server";

import { redirect } from "next/navigation";
import { crearCliente } from "@/utilidades/supabase/server";

export async function iniciarSesion(datosFormulario: FormData) {
  const correo = datosFormulario.get("correo") as string;
  const contrasena = datosFormulario.get("contrasena") as string;

  const supabase = await crearCliente();
  const { error } = await supabase.auth.signInWithPassword({
    email: correo,
    password: contrasena,
  });

  if (error) {
    redirect("/login?error=credenciales-invalidas");
  }

  redirect("/");
}

export async function cerrarSesion() {
  const supabase = await crearCliente();
  await supabase.auth.signOut();
  redirect("/login");
}
