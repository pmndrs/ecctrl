import react from "@vitejs/plugin-react";
import path from "path";
import dts from "vite-plugin-dts";
const isCodeSandbox =
  // @ts-ignore
  "SANDBOX_URL" in process.env || "CODESANDBOX_HOST" in process.env;

export default {
  plugins: [react(), dts()],
  root: "src/",
  publicDir: "../public/",
  base: "./",
  server: {
    host: true,
    open: !isCodeSandbox, // Open if it's not a CodeSandbox
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: false,
    lib: {
      entry: "Ecctrl.tsx",
      name: "ecctrl",
      formats: ["es", "cjs"],
      fileName: (format: string) => `index.${format}.js`,
    },
    rollupOptions: {
      external: ["react"],
    },
  },
};
