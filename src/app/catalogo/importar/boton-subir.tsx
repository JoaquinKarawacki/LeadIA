"use client";

import { useFormStatus } from "react-dom";

// Con un PDF pesado, la subida puede tardar varios minutos y el form action
// no da ningún feedback por sí solo — sin esto, parece que el botón no hace
// nada mientras en realidad está subiendo el archivo de a poco.
export function BotonSubir() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-black px-3 py-2 text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
    >
      {pending ? "Subiendo…" : "Subir"}
    </button>
  );
}
