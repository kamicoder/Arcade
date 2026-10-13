// Les tests de l'Arcade : Playwright pilote un vrai navigateur (le Edge du poste, rien à télécharger)
// sur le serveur de dev, où le jeu Phaser est visible en tant que window.jeu.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    channel: "msedge",
    baseURL: "http://localhost:5174",
    viewport: { width: 1280, height: 720 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx vite --port 5174 --strictPort",
    url: "http://localhost:5174",
    reuseExistingServer: true,
  },
});
