import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      filename: "dashboard-sw.js",
      injectRegister: "script-defer",
      registerType: "autoUpdate",
      manifest: {
        id: "/",
        name: "Bifocal",
        short_name: "Bifocal",
        description: "Read and reply to requests from someone you support.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#f4f7fa",
        background_color: "#f4f7fa",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      includeManifestIcons: false,
      workbox: {
        globPatterns: ["offline.html"],
        navigateFallback: null,
        inlineWorkboxRuntime: true,
        skipWaiting: true,
        clientsClaim: true,
        // Root navigation can fall back offline. Requests and sign-in stay on the network.
        runtimeCaching: [{
          urlPattern: ({ request, url, sameOrigin }) =>
            sameOrigin && request.mode === "navigate" && url.pathname === "/",
          handler: "NetworkOnly",
          options: { precacheFallback: { fallbackURL: "/offline.html" } },
        }],
      },
    }),
  ],
});
