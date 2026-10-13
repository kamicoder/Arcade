// Les tests de l'Arcade : Playwright pilote un vrai navigateur (le Edge du poste, rien à télécharger)
// sur le serveur de dev, où le jeu Phaser est visible en tant que window.jeu.
import { defineConfig } from "@playwright/test";

// Le port du serveur de test : PORT_TESTS=5181 npm test pour en prendre un autre (plusieurs copies du
// projet testées en même temps ne doivent pas partager le même serveur)
declare const process: { env: Record<string, string | undefined> };   // Node, sans charger tous ses types
const port = Number(process.env.PORT_TESTS ?? 5174);

export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    channel: "msedge",
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1280, height: 720 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx vite --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
  },
});
