import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/firebase-messaging-sw.ts",
      name: "BifocalMessaging",
      formats: ["iife"],
      fileName: () => "firebase-messaging-sw.js",
    },
  },
});
