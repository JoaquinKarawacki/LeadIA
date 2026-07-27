import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (vía pdfjs-dist) resuelve su worker en runtime con lógica que
  // el bundler de Turbopack no reproduce bien — "Setting up fake worker
  // failed". Server-external evita que se empaquete y lo deja resolverse
  // como require() normal de Node, igual que corriendo el paquete suelto.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default withWorkflow(nextConfig);
