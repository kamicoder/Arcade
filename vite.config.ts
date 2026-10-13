import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Des chemins relatifs : le site marche quel que soit le nom du dépôt GitHub
  base: "./",
  build: {
    chunkSizeWarningLimit: 2000,           // Phaser seul pèse plus d'un Mo : c'est normal
  },
  plugins: [
    VitePWA({
      // « prompt » : la nouvelle version attend qu'on lui dise d'y aller (au menu, jamais en pleine partie)
      registerType: "prompt",
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,json,wav,mp3,ogg}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: "L'Arcade",
        short_name: "Arcade",
        description: "Nos mini jeux, à emporter partout.",
        lang: "fr",
        start_url: ".",
        scope: ".",
        display: "fullscreen",
        orientation: "landscape",
        background_color: "#14121c",
        theme_color: "#14121c",
        icons: [
          { src: "icones/icone-192.png", sizes: "192x192", type: "image/png" },
          { src: "icones/icone-512.png", sizes: "512x512", type: "image/png" },
          { src: "icones/icone-masquable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
