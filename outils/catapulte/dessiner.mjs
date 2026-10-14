// Enregistre les images de la catapulte (dessins.js) dans public/catapulte/images/ : Edge les dessine
// avec son canvas, et on écrit chaque PNG. À lancer depuis la racine du projet :
//   node outils/catapulte/dessiner.mjs
// Avec « planche », on voit en plus toutes les petites images d'un coup : outils/catapulte/planche.png

import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const dossier = "public/catapulte/images";
mkdirSync(dossier, { recursive: true });
const dessins = readFileSync("outils/catapulte/dessins.js", "utf8");

const navigateur = await chromium.launch({ channel: "msedge" });
const page = await navigateur.newPage();
await page.setContent("<!doctype html><body></body>");
await page.addScriptTag({ content: dessins });
const images = await page.evaluate(() => window.dessinerTout());
for (const { nom, png } of images) {
  writeFileSync(`${dossier}/${nom}.png`, Buffer.from(png.split(",")[1], "base64"));
}
console.log(`${images.length} images dans ${dossier}`);
if (process.argv.includes("planche")) {
  await page.evaluate(() => window.planche());
  await page.setViewportSize({ width: 900, height: 600 });
  await page.screenshot({ path: "outils/catapulte/planche.png", fullPage: true });
}
await navigateur.close();
