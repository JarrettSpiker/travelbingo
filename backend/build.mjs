import { build } from "esbuild";

// Bundles to a single ESM file the Lambda runtime loads as index.mjs.
// The AWS SDK is left external: the nodejs22.x runtime ships v3, so bundling it
// would add megabytes to every deploy for no behavioural gain.
await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.mjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: false,
  minify: false,
  external: ["@aws-sdk/*"],
});
