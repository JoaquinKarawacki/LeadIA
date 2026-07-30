import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (vía pdfjs-dist) resuelve su worker en runtime con lógica que
  // el bundler de Turbopack no reproduce bien — "Setting up fake worker
  // failed". Server-external evita que se empaquete y lo deja resolverse
  // como require() normal de Node, igual que corriendo el paquete suelto.
  // No agregar "pdfjs-dist" acá — nadie lo importa directo (es transitiva de
  // pdf-parse) y agregarlo generaba rutas de trace rotas (ver de abajo).
  serverExternalPackages: ["pdf-parse"],
  // El tracer de archivos de Vercel (@vercel/nft) no detecta el worker de
  // pdfjs-dist porque pdf-parse lo resuelve con una ruta dinámica en runtime,
  // no con un import estático — sin esto, el archivo existe en node_modules
  // pero no se copia al bundle de la función ("Cannot find module .../
  // pdf.worker.mjs" en producción, aunque local funcione con todo instalado).
  //
  // OJO: el glob apunta a la ruta real dentro de .pnpm (pdfjs-dist NO cuelga
  // suelto de node_modules/ — es una dependencia transitiva de pdf-parse,
  // pnpm no la hoistea). El comodín en "pdf-parse@*" sobrevive a bumps de
  // versión de pdf-parse.
  outputFileTracingIncludes: {
    "/catalogo/importar": [
      "./node_modules/.pnpm/pdf-parse@*/node_modules/pdfjs-dist/legacy/build/*.mjs",
    ],
  },
  // El propio análisis estático de Next (no algo que yo agrego) también
  // genera una entrada de trace rota — "node_modules/.pnpm/node_modules/
  // pdfjs-dist", sin número de versión, porque intenta resolver el bare
  // specifier "pdfjs-dist" del import dentro de pdf-parse y pnpm no lo tiene
  // colgado en ese nivel. Esa ruta fantasma hacía fallar el deploy entero
  // con "ENOTDIR: not a directory" al reconstruir el árbol de archivos —
  // se excluye a mano para que ni se intente crear.
  outputFileTracingExcludes: {
    "/catalogo/importar": ["./node_modules/.pnpm/node_modules/**"],
  },
  experimental: {
    serverActions: {
      // Default de Next.js es 1mb — un catálogo en PDF real pesa mucho más.
      // 100mb es el techo que soportan las Vercel Functions (no tiene sentido
      // poner un límite más alto acá, la plataforma lo rechazaría antes).
      bodySizeLimit: "100mb",
    },
  },
};

export default withWorkflow(nextConfig);
