// Les sons du casse-briques, fabriqués en code (sur le modèle de outils/catapulte/sons.mjs). À lancer depuis
// la racine du projet :
//   node outils/briques/sons.mjs public/briques/sons
import { writeFileSync, mkdirSync } from "node:fs";
const F = 22050;
const dossier = process.argv[2];
mkdirSync(dossier, { recursive: true });
function wav(nom, e) {
  const n = e.length, b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(F, 24);
  b.writeUInt32LE(F * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  e.forEach((v, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32000), 44 + i * 2));
  writeFileSync(dossier + "/" + nom + ".wav", b);
}
let g = 23; const bruit = () => ((g = (g * 16807) % 2147483647) / 2147483647) * 2 - 1;
// Un son : fréquence (Hz) et enveloppe, plus du bruit filtré (doux : 0.9, sec : 0.3)
function son(duree, { f = 0, f2 = f, onde = "sin", b = 0, doux = 0.6, v = 0.5, attaque = 0.003 }) {
  const r = []; let ph = 0; let p = 0;
  for (let i = 0; i < duree * F; i++) {
    const u = i / (duree * F); const t = i / F;
    const env = Math.min(1, t / attaque) * Math.pow(1 - u, 2);
    ph += (f + (f2 - f) * u) / F;
    const ton = onde === "sin" ? Math.sin(ph * 2 * Math.PI) : (ph % 1 < 0.5 ? 1 : -1);
    p = p * doux + bruit() * (1 - doux);
    r.push((ton * (1 - b) + p * b * 3) * v * env);
  }
  return r;
}
const suite = (...m) => m.flat();
wav("rebond", son(0.09, { f: 520, f2: 440, onde: "carre", v: 0.22 }));
wav("mur", son(0.05, { f: 300, f2: 260, v: 0.4 }));
wav("brique", son(0.12, { f: 880, f2: 660, onde: "carre", v: 0.2 }));
wav("dure", son(0.1, { f: 340, f2: 300, b: 0.3, doux: 0.4, v: 0.5 }));
wav("metal", suite(son(0.03, { f: 2200, b: 0.6, doux: 0.2, v: 0.45 }), son(0.25, { f: 1760, f2: 1700, v: 0.25 })));
wav("boum", son(0.5, { f: 120, f2: 40, b: 0.7, doux: 0.85, v: 0.8 }));
wav("bonus", suite(...[660, 880, 1100].map((f) => son(0.07, { f, onde: "carre", v: 0.2 }))));
wav("perdu", son(0.6, { f: 500, f2: 120, onde: "carre", v: 0.2, attaque: 0.01 }));
wav("victoire", suite(...[523, 659, 784, 1047].map((f) => son(0.12, { f, onde: "carre", v: 0.22 })), son(0.4, { f: 1319, onde: "carre", v: 0.22 })));
wav("defaite", suite(...[392, 349, 311].map((f) => son(0.2, { f, onde: "carre", v: 0.2 })), son(0.5, { f: 262, onde: "carre", v: 0.2 })));
