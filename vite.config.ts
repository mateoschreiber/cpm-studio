import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  worker: { format: "es" },
  plugins: [react(), VitePWA({
    registerType: "prompt",
    injectRegister: null,
    includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png", "maskable-512.png", "THIRD_PARTY_NOTICES.txt"],
    manifest: {
      name: "CPM Studio", short_name: "CPM Studio", lang: "es",
      description: "Redes AOA, resolución CPM y diagramas de recursos en tu navegador.",
      theme_color: "#087f73", background_color: "#f3f8f7",
      display: "standalone", start_url: "/", scope: "/",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    workbox: {
      // Precache lazy views and worker bundles before announcing offline readiness.
      globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2,txt}"],
      maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      cleanupOutdatedCaches: true,
      skipWaiting: false,
      clientsClaim: true,
      navigateFallback: "/index.html",
    },
    devOptions: { enabled: false },
  })],
  test: { include: ["src/**/*.test.ts"] },
});
