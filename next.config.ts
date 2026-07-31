import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
