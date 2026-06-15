import { defineConfig } from "vite";
import * as path from "node:path";
import react from "@vitejs/plugin-react";
import ssl from '@vitejs/plugin-basic-ssl'

const isCodeSandbox =
  "SANDBOX_URL" in process.env || "CODESANDBOX_HOST" in process.env;

const licenseBanner = `/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */`;

const licenseBannerPlugin = () => ({
  name: "ecctrl-license-banner",
  enforce: "post",
  generateBundle(_, bundle) {
    for (const chunk of Object.values(bundle)) {
      if (chunk.type !== "chunk") continue;
      if (chunk.code.startsWith(licenseBanner)) continue;
      chunk.code = `${licenseBanner}\n${chunk.code}`;
    }
  },
});

const dev = defineConfig({
  plugins: [react(), ssl()],
  root: "example/",
  publicDir: "../public/",
  base: "./",
  server: {
    host: true,
    open: !isCodeSandbox, // Open if it's not a CodeSandbox
  },
});

const build = defineConfig({
  plugins: [licenseBannerPlugin()],
  publicDir: false,
  build: {
    minify: false,
    sourcemap: true,
    target: "es2018",
    lib: {
      formats: ["cjs", "es"],
      entry: {
        index: "src/index.ts",
        vehicle: "src/vehicle.ts",
        input: "src/input.ts",
        animation: "src/animation.ts",
        gravity: "src/gravity.ts",
        camera: "src/camera.ts",
        time: "src/time.ts",
        curves: "src/curves.ts",
        leva: "src/leva.ts",
        utils: "src/utils.ts",
        all: "src/all.ts",
      },
      fileName: (format, entryName) =>
        `${entryName}.${format === "es" ? "js" : "cjs"}`,
    },
    rollupOptions: {
      external: (id) => !id.startsWith(".") && !path.isAbsolute(id),
      output: {
        sourcemapExcludeSources: true,
      },
    },
  },
});

export default defineConfig(({ command }) => command === "build" ? build : dev);
