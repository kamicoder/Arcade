// Le son du jeu de course : le réglage (son et musique, sans musique, coupé), les sons du thème, et un
// petit synthétiseur pour les thèmes qui fabriquent leurs bruitages et leur musique (les licornes : aucun
// fichier son, comme dans l'ancien jeu).
//
// Le synthétiseur joue des notes avec la Web Audio : un oscillateur (la note), un gain (son volume qui
// monte puis s'éteint). Le contexte audio est celui de Phaser (scene.sound.context) : Phaser le débloque
// au premier geste et le met en veille quand on quitte la fenêtre.

import Phaser from "phaser";
import type { NomDeSon } from "./theme";
import { preferences, garderLeSon, themeEnCours } from "./sauvegarde";

let gestionnaire: Phaser.Sound.WebAudioSoundManager | null = null;
let sortieMusique: GainNode | null = null;
let bufferBruit: AudioBuffer | null = null;

export const NOMS_REGLAGE_SON = ["Son et musique", "Son sans musique", "Son coupé"];
export const ICONES_REGLAGE_SON = ["🔊", "🎵✕", "🔇"];

// Appelé au chargement : sans Web Audio (un vieux navigateur), le synthétiseur reste muet
export function brancherLeSon(scene: Phaser.Scene) {
  if (scene.sound instanceof Phaser.Sound.WebAudioSoundManager && gestionnaire !== scene.sound) {
    gestionnaire = scene.sound;
    sortieMusique = null;
    bufferBruit = null;
  }
}

export const sonCoupe = () => preferences.son === 2;

// Un réglage de plus : sans musique, il n'y a que « son » et « coupé »
export function changerReglageSon(): string {
  preferences.son = (preferences.son + 1) % 3;
  if (preferences.son === 1 && !themeEnCours().musique) {
    preferences.son = 2;
  }
  garderLeSon();
  return NOMS_REGLAGE_SON[preferences.son];
}

// Un son du thème (s'il en a un de ce nom)
export function jouer(scene: Phaser.Scene, nom: NomDeSon) {
  if (!sonCoupe()) {
    themeEnCours().sons[nom]?.(scene);
  }
}

// Un fichier son chargé par le thème (le réglage « coupé » le fait taire aussi)
export function jouerFichier(scene: Phaser.Scene, cle: string, reglage?: Phaser.Types.Sound.SoundConfig) {
  if (!sonCoupe()) {
    scene.sound.play(cle, reglage);
  }
}

// ===== Le synthétiseur =====

// Le contexte, s'il peut jouer maintenant. Tant qu'il dort (pas encore de geste, fenêtre quittée),
// on ne prépare rien : les notes s'entasseraient et sortiraient toutes ensemble au réveil.
function contexte(): AudioContext | null {
  if (!gestionnaire || sonCoupe()) {
    return null;
  }
  const a = gestionnaire.context;
  return a && a.state === "running" ? a : null;
}

// Une note : sa fréquence, quand elle commence (en secondes à partir de maintenant), sa durée...
export function note(freq: number, debut: number, duree: number, type: OscillatorType, volume: number, freqFin = 0, sortie?: AudioNode) {
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

// Un souffle de bruit, pour le tonnerre et les « pouf »
export function bruit(duree: number, volume: number, frequence: number) {
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

// ===== La musique : une mélodie et une basse, jouées pas à pas =====
// Les notes comptent les demi-tons à partir du do du milieu (0) ; null : un silence.

export interface Air {
  tempo: number;
  timbre: OscillatorType;
  volume: number;
  melodie: (number | null)[];
  basse: (number | null)[];
}

const frequenceDe = (n: number) => 261.63 * Math.pow(2, n / 12);

// Le musicien : la scène Musique l'appelle souvent (toutes les 30 ms), il prépare les notes à venir
export const musicien = {
  air: null as "menu" | "course" | null,
  pas: 0,
  prochainPas: 0,
  rythme: 1,                               // plus grand : la musique s'accélère (le dernier tour)

  jouer(nom: "menu" | "course") {
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
    const airs = themeEnCours().musique;
    if (!a || !gestionnaire || this.air === null || !airs || preferences.son !== 0) {
      return;
    }
    if (!sortieMusique || sortieMusique.context !== a) {
      sortieMusique = a.createGain();
      sortieMusique.connect(gestionnaire.destination);
    }
    const m = airs[this.air];
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
