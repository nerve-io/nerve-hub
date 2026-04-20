import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    clean: true,
    sourcemap: true,
  },
  {
    entry: {
      "cli/index": "src/cli/index.ts",
    },
    format: ["cjs"],
    dts: false,
    clean: false,
    sourcemap: true,
    outDir: "dist",
    esbuildOptions(options) {
      options.banner = {
        js: "#!/usr/bin/env node",
      };
    },
  },
]);
