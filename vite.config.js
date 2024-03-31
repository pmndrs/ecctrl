import { defineConfig } from "vite";
import * as path from "node:path";
import react from "@vitejs/plugin-react";

const isCodeSandbox =
  "SANDBOX_URL" in process.env || "CODESANDBOX_HOST" in process.env;

const dev = defineConfig({
  plugins: [react()],
  root: "example/",
  publicDir: "../public/",
  base: "./",
  server: {
    host: true,
    open: !isCodeSandbox, // Open if it's not a CodeSandbox
  },
});

const build = defineConfig({
  publicDir: false,
  build: {
    minify: false,
    sourcemap: true,
    target: "es2018",
    lib: {
      formats: ["cjs", "es"],
      entry: "src/Ecctrl.tsx",
      fileName: "[name]",
    },
    rollupOptions: {
      external: (id) => !id.startsWith(".") && !path.isAbsolute(id),
      output: {
        sourcemapExcludeSources: true,
      },
    },
  },
});

export default process.argv[2] ? build : dev;
