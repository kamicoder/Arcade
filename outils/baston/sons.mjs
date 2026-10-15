// Les sons de la baston qui ne viennent pas de l'atelier (le saut, le décompte, la victoire), fabriqués
// en code comme ceux de la catapulte. À lancer depuis la racine du projet :
//   node outils/baston/sons.mjs public/baston/sons
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
let g = 23; const bruit = () => ((g = (g * 16807) % 2147483647) / 2147483647) * 2 - 1;
// Un son : fréquence (Hz) qui glisse de f à f2, enveloppe, plus du bruit filtré (doux : 0.9, sec : 0.3)
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
// Deux sons joués ensemble
const ensemble = (a, c) => a.map((x, i) => x + (c[i] ?? 0));

// Le saut : un petit « bwip » de ressort, qui monte
wav("saut", son(0.16, { f: 260, f2: 620, onde: "carre", b: 0.15, doux: 0.7, v: 0.16, attaque: 0.01 }));
// Le décompte : 3, 2, 1 font « bip », puis « Combat ! » sonne comme la cloche d'un ring
wav("bip", son(0.14, { f: 880, onde: "carre", v: 0.18 }));
wav("combat", ensemble(son(0.7, { f: 440, f2: 430, v: 0.45, attaque: 0.002 }), son(0.7, { f: 1180, f2: 1150, b: 0.2, doux: 0.5, v: 0.2 })));
// La victoire : une fanfare qui monte ; la défaite (contre l'ordinateur) descend
wav("victoire", suite(...[392, 523, 659, 784].map((f) => son(0.12, { f, onde: "carre", v: 0.22 })),
  son(0.08, { f: 659, onde: "carre", v: 0.2 }), son(0.55, { f: 784, onde: "carre", v: 0.24 })));
wav("defaite", suite(...[440, 415, 392].map((f) => son(0.22, { f, onde: "carre", v: 0.2 })),
  son(0.6, { f: 370, f2: 330, onde: "carre", v: 0.2 })));
