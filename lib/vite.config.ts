import react from "@vitejs/plugin-react";
import path from "path";
import dts from "vite-plugin-dts";

export default {
  plugins: [react(), dts({ insertTypesEntry: true })],
  build: {
    outDir: "./dist",
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "ecctrl",
      formats: ["es", "umd"],
      fileName: (format: string) => `index.${format}.js`,
    },
    minify: false,
    rollupOptions: {
      external: ["react", "react-dom", "three"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          three: "three",
        },
      },
    },
  },
};
