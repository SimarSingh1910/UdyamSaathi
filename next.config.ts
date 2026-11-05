import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image.
  output: "standalone",
  // WhatsApp photos are read on the server; tesseract.js starts its own worker
  // thread from node_modules, so it must not be bundled.
  // The embedded PostgreSQL (PGlite) loads its WebAssembly files from node_modules too.
  serverExternalPackages: ["tesseract.js", "@electric-sql/pglite"],
  // The API routes read the synthetic CSVs from ./data at runtime,
  // so make sure they are bundled with the server output on deploy.
  outputFileTracingIncludes: {
    // Migrations are applied on start, and PGlite is used when DATABASE_URL is unset.
    "/api/**/*": ["./data/**/*", "./messages/**/*", "./drizzle/**/*", "./node_modules/@electric-sql/pglite/dist/*.{js,wasm,data}"],
    "/api/whatsapp/**/*": [
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
      "./node_modules/@tesseract.js-data/eng/4.0.0_best_int/**/*",
      "./public/kyc-samples/**/*",
    ],
  },
};

export default nextConfig;
