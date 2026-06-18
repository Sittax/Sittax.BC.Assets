import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Zod é usado em Server Actions e Server Components simultaneamente.
  // No Next 15.5.x, as duas compilações (RSC + Actions) tentam vendor-chunkar
  // o mesmo módulo e entram em conflito — o chunk nunca é criado no disco.
  // Marcando como external, o Node require()s direto do node_modules em runtime,
  // eliminando a referência ao vendor-chunks/zod.js que não existe.
  serverExternalPackages: ["zod"],
};

export default nextConfig;
