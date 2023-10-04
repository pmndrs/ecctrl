import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
const isCodeSandbox =
  // @ts-ignore
  "SANDBOX_URL" in process.env || "CODESANDBOX_HOST" in process.env;

export default {
  plugins: [dts()],
  root: "src/",
  base: "./",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    lib: {
      entry: "index.ts",
      name: "ecctrl",
      formats: ["es"],
      fileName: (format: string) => `index.${format}.js`,
    },
    rollupOptions: {
      external: ["react", "react-dom"],
    },
  },
};
