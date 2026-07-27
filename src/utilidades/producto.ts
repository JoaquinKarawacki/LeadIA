// Compartido entre alta manual, CSV e import por PDF (src/app/catalogo/*,
// src/utilidades/flujos/importar-catalogo-pdf.ts) para no repetir el mismo
// armado de texto en cada lugar que genera el embedding de un producto.
export function textoParaEmbedding(
  nombre: string,
  descripcion: string | null,
): string {
  return [nombre, descripcion].filter(Boolean).join(" ");
}
