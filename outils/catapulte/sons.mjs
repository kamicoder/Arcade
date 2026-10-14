// Les sons de la catapulte, fabriqués en code. À lancer depuis la racine du projet :
//   node outils/catapulte/sons.mjs public/catapulte/sons
import { writeFileSync } from "node:fs";
const F = 22050;
const dossier = process.argv[2];
function wav(nom, e) {
  const n = e.length, b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(F, 24);
  b.writeUInt32LE(F * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  e.forEach((v, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32000), 44 + i * 2));
  writeFileSync(dossier + "/" + nom + ".wav", b);
}
let g = 17; const bruit = () => ((g = (g * 16807) % 2147483647) / 2147483647) * 2 - 1;
// Un son : fréquence (Hz) et enveloppe, plus du bruit filtré (doux : 0.9, sec : 0.3)
function son(duree, { f = 0, f2 = f, onde = "sin", b = 0, doux = 0.6, v = 0.5, attaque = 0.005 }) {
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
wav("tir", son(0.35, { f: 180, f2: 900, b: 0.5, doux: 0.85, v: 0.45, attaque: 0.02 }));
wav("tension", son(0.25, { f: 90, f2: 140, onde: "carre", b: 0.3, doux: 0.7, v: 0.15, attaque: 0.05 }));
wav("bois", son(0.22, { f: 140, f2: 90, b: 0.55, doux: 0.75, v: 0.7 }));
wav("pierre", son(0.18, { f: 420, f2: 300, b: 0.6, doux: 0.35, v: 0.6 }));
wav("glace", suite(son(0.05, { f: 2600, f2: 1800, b: 0.7, doux: 0.2, v: 0.5 }), son(0.3, { f: 3200, f2: 1500, b: 0.8, doux: 0.1, v: 0.35 })));
wav("slime", son(0.3, { f: 600, f2: 120, b: 0.45, doux: 0.8, v: 0.6 }));
wav("ouille", son(0.25, { f: 900, f2: 500, onde: "carre", v: 0.18 }));
wav("victoire", suite(...[523, 659, 784, 1047].map((f) => son(0.13, { f, onde: "carre", v: 0.25 })), son(0.45, { f: 1319, onde: "carre", v: 0.25 })));
wav("defaite", suite(...[392, 349, 311].map((f) => son(0.2, { f, onde: "carre", v: 0.22 })), son(0.5, { f: 262, onde: "carre", v: 0.22 })));
wav("etoile", son(0.25, { f: 1200, f2: 1800, v: 0.35 }));
