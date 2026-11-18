// Builds a self-contained deploy artifact in dist/:
//   dist/server.mjs  the server with every npm dependency bundled in
//   dist/public/     the static frontend, served next to server.mjs
// Prisma Compute deploys only what the build produces (no node_modules), so
// nothing may stay external except runtime built-ins.
import { build } from "esbuild";
import { cp, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });

await build({
  entryPoints: ["src/server.js"],
  outfile: "dist/server.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  // pg only loads its optional native binding when asked to; it is not installed.
  external: ["pg-native"],
  // Express and other CommonJS dependencies call require() for Node built-ins.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  logLevel: "info",
});

await cp("public", "dist/public", { recursive: true });
console.log("Copied public/ -> dist/public/");
