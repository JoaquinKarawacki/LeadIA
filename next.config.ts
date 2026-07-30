import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (vía pdfjs-dist) resuelve su worker en runtime con lógica que
  // el bundler de Turbopack no reproduce bien — "Setting up fake worker
  // failed". Server-external evita que se empaquete y lo deja resolverse
  // como require() normal de Node, igual que corriendo el paquete suelto.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  // El tracer de archivos de Vercel (@vercel/nft) no detecta el worker de
  // pdfjs-dist porque pdf-parse lo resuelve con una ruta dinámica en runtime,
  // no con un import estático — sin esto, el archivo existe en node_modules
  // pero no se copia al bundle de la función ("Cannot find module .../
  // pdf.worker.mjs" en producción, aunque local funcione con todo instalado).
  outputFileTracingIncludes: {
    "/catalogo/importar": ["./node_modules/pdfjs-dist/legacy/build/*.mjs"],
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
