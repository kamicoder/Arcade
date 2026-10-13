// Les bruitages et la musique, fabriqués par le navigateur : aucun fichier son, comme dans l'ancien jeu.
//
// On joue des notes avec la Web Audio : un oscillateur (la note), un gain (son volume qui monte puis
// s'éteint). Le contexte audio est celui de Phaser (this.sound.context) : Phaser le débloque au premier
// geste, le met en veille quand on quitte la fenêtre, et ses réglages (couper tout le son) s'appliquent.

import Phaser from "phaser";
import { preferences, garderLeSon } from "./sauvegarde";

let gestionnaire: Phaser.Sound.WebAudioSoundManager | null = null;
let sortieMusique: GainNode | null = null;
let bufferBruit: AudioBuffer | null = null;

export const NOMS_REGLAGE_SON = ["Son et musique", "Son sans musique", "Son coupé"];
export const ICONES_REGLAGE_SON = ["🔊", "🎵✕", "🔇"];

// Appelé au chargement : sans Web Audio (un vieux navigateur), le jeu reste muet
export function brancherLeSon(scene: Phaser.Scene) {
  if (scene.sound instanceof Phaser.Sound.WebAudioSoundManager && gestionnaire !== scene.sound) {
    gestionnaire = scene.sound;
    sortieMusique = null;
    bufferBruit = null;
  }
}

// Le contexte, s'il peut jouer maintenant. Tant qu'il dort (pas encore de geste, fenêtre quittée),
// on ne prépare rien : les notes s'entasseraient et sortiraient toutes ensemble au réveil.
function contexte(): AudioContext | null {
  if (!gestionnaire || preferences.son === 2) {
    return null;
  }
  const a = gestionnaire.context;
  return a && a.state === "running" ? a : null;
}

export function changerReglageSon(): string {
  preferences.son = (preferences.son + 1) % 3;
  garderLeSon();
  return NOMS_REGLAGE_SON[preferences.son];
}

// Une note : sa fréquence, quand elle commence (en secondes à partir de maintenant), sa durée...
function note(freq: number, debut: number, duree: number, type: OscillatorType, volume: number, freqFin = 0, sortie?: AudioNode) {
  const a = contexte();
  if (!a || !gestionnaire) {
    return;
  }
  const t = a.currentTime + debut;
  const oscillateur = a.createOscillator();
  const gain = a.createGain();
  oscillateur.type = type;
  oscillateur.frequency.setValueAtTime(freq, t);
  if (freqFin) {
    oscillateur.frequency.exponentialRampToValueAtTime(freqFin, t + duree);
  }
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  oscillateur.connect(gain).connect(sortie ?? gestionnaire.destination);
  oscillateur.start(t);
  oscillateur.stop(t + duree + 0.05);
}

// Un souffle de bruit, pour le tonnerre et les « pouf » dans les nuages
function bruit(duree: number, volume: number, frequence: number) {
  const a = contexte();
  if (!a || !gestionnaire) {
    return;
  }
  if (!bufferBruit) {
    bufferBruit = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const donnees = bufferBruit.getChannelData(0);
    for (let i = 0; i < donnees.length; i++) {
      donnees[i] = Math.random() * 2 - 1;
    }
  }
  const source = a.createBufferSource();
  source.buffer = bufferBruit;
  const filtre = a.createBiquadFilter();
  filtre.type = "lowpass";
  filtre.frequency.value = frequence;
  const gain = a.createGain();
  const t = a.currentTime;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  source.connect(filtre).connect(gain).connect(gestionnaire.destination);
  source.start(t);
  source.stop(t + duree + 0.05);
}

export const sons = {
  bip: () => note(660, 0, 0.18, "square", 0.05),
  partez: () => {
    note(1320, 0, 0.4, "square", 0.06);
    note(1760, 0.05, 0.4, "triangle", 0.06);
  },
  sabot: (aigu: boolean) => note(aigu ? 520 : 400, 0, 0.06, "triangle", 0.035, 180),
  etoile: () => [1568, 2093, 2637].forEach((f, i) => note(f, i * 0.06, 0.2, "triangle", 0.1)),
  turbo: () => {
    note(300, 0, 0.5, "sawtooth", 0.04, 1200);
    note(600, 0.05, 0.5, "triangle", 0.07, 2400);
  },
  fleche: () => note(500, 0, 0.25, "triangle", 0.07, 1500),
  bonbon: () => {
    note(200, 0, 0.5, "sine", 0.12, 900);
    note(400, 0.1, 0.5, "triangle", 0.06, 1600);
  },
  orage: () => {
    bruit(0.9, 0.35, 500);
    note(140, 0, 0.6, "sawtooth", 0.05, 60);
  },
  pouf: () => bruit(0.15, 0.12, 1200),
  tour: () => [784, 988, 1175].forEach((f, i) => note(f, i * 0.08, 0.2, "triangle", 0.09)),
  record: () => [1047, 1319, 1568, 2093, 2637].forEach((f, i) => note(f, 0.3 + i * 0.07, 0.25, "sine", 0.1)),
  victoire: () => {
    const air = [523, 659, 784, 1047, 0, 784, 1047];
    air.forEach((f, i) => {
      if (f > 0) {
        note(f, i * 0.14, i === air.length - 1 ? 0.7 : 0.18, "triangle", 0.1);
      }
    });
  },
  menu: () => note(988, 0, 0.1, "sine", 0.08),
  non: () => note(300, 0, 0.15, "square", 0.04, 200),
};

// ===== La musique : une mélodie et une basse, jouées pas à pas =====
// Les notes comptent les demi-tons à partir du do du milieu (0) ; null : un silence.

interface Air {
  tempo: number;
  timbre: OscillatorType;
  volume: number;
  melodie: (number | null)[];
  basse: (number | null)[];
}

export const MUSIQUES: Record<"menu" | "course", Air> = {
  menu: {
    tempo: 96, timbre: "triangle", volume: 0.045,
    melodie: [16, null, 19, null, 21, null, 19, 16, 14, null, 12, null, 9, null, 12, null,
      14, null, 16, null, 19, null, 16, 14, 12, null, null, null, null, null, null, null],
    basse: [0, 0, -3, -3, 5, 5, 7, 7, 0, 0, -3, -3, 5, 7, 0, 0],
  },
  course: {
    tempo: 138, timbre: "square", volume: 0.025,
    melodie: [12, null, 16, 19, 21, 19, 16, null, 14, null, 16, 14, 12, null, 9, null,
      12, null, 16, 19, 24, 21, 19, null, 21, 19, 16, 14, 12, null, null, null,
      17, null, 21, 24, 26, 24, 21, null, 19, null, 23, 19, 14, null, 11, null,
      12, null, 16, 19, 24, null, 19, 16, 21, 19, 16, 14, 12, null, 12, null],
    basse: [0, 0, 7, 7, -3, -3, 4, 4, 5, 5, 0, 0, 7, 7, 2, 2,
      5, 5, 9, 9, 7, 7, 2, 2, 0, 0, 5, 5, 7, 7, 0, 0],
  },
};

const frequenceDe = (n: number) => 261.63 * Math.pow(2, n / 12);

// Le musicien : la scène Musique l'appelle souvent (toutes les 30 ms), il prépare les notes à venir
export const musicien = {
  air: null as keyof typeof MUSIQUES | null,
  pas: 0,
  prochainPas: 0,
  rythme: 1,                               // plus grand : la musique s'accélère (le dernier tour)

  jouer(nom: keyof typeof MUSIQUES) {
    if (this.air === nom) {
      return;
    }
    this.air = nom;
    this.pas = 0;
    this.prochainPas = 0;
    this.rythme = 1;
  },

  // On prépare les notes des 150 prochaines millisecondes : la minuterie de Phaser n'est pas assez
  // régulière pour jouer chaque note pile à l'heure, mais l'horloge de la Web Audio, elle, l'est
  preparer() {
    const a = contexte();
    if (!a || !gestionnaire || this.air === null || preferences.son !== 0) {
      return;
    }
    if (!sortieMusique || sortieMusique.context !== a) {
      sortieMusique = a.createGain();
      sortieMusique.connect(gestionnaire.destination);
    }
    const m = MUSIQUES[this.air];
    const duree = 60 / m.tempo / 2 / this.rythme;
    if (this.prochainPas < a.currentTime) {
      this.prochainPas = a.currentTime + 0.05;
    }
    while (this.prochainPas < a.currentTime + 0.15) {
      const debut = this.prochainPas - a.currentTime;
      const n = m.melodie[this.pas % m.melodie.length];
      if (n !== null) {
        note(frequenceDe(n), debut, duree * 0.9, m.timbre, m.volume, 0, sortieMusique);
      }
      if (this.pas % 2 === 0) {
        const b = m.basse[(this.pas / 2) % m.basse.length];
        if (b !== null) {
          note(frequenceDe(b - 24), debut, duree * 1.7, "triangle", m.volume * 1.6, 0, sortieMusique);
        }
      }
      this.pas++;
      this.prochainPas += duree;
    }
  },
};
