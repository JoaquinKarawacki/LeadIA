import DOMMatrixShim from "@thednp/dommatrix";

// pdfjs-dist (motor detrás de pdf-parse) espera `DOMMatrix` como global de
// browser incluso para extraer texto (lo usa para calcular la posición de
// cada glifo). El runtime Node.js serverless de Vercel no lo trae, así que
// sin este polyfill la sola importación de pdf-parse tira "ReferenceError:
// DOMMatrix is not defined" — pasó en producción, no en desarrollo local
// (diferencia de cómo cada entorno arma el bundle del server).
if (typeof globalThis.DOMMatrix === "undefined") {
  (globalThis as unknown as { DOMMatrix: unknown }).DOMMatrix = DOMMatrixShim;
}
