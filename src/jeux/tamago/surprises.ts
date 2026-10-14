// Les surprises de TAMAGO-XTREME : des événements absurdes et des visiteurs, toutes les quelques minutes.
// Leurs effets se comptent en cœurs, comme le reste. Un visiteur rejoint le carnet d'amis.

import type { Etat } from "./vie";
import { COEURS } from "./reglages";

export interface Surprise {
  id: string;
  emoji: string;
  annonce: string;                         // ce qui s'affiche, et s'écrit au journal
  replique: string;                        // ce que dit le Tamago
  visiteur?: string;                       // le nom du visiteur, pour le carnet d'amis
  effet: (e: Etat) => void;
}

const plus = (valeur: number, n: number) => Math.max(0, Math.min(COEURS, valeur + n));

export const SURPRISES: Surprise[] = [
  {
    id: "ovni", emoji: "🛸", annonce: "Un OVNI survole la maison !", replique: "ILS SONT LÀ ! J'AI TOUJOURS SU !",
    effet: (e) => { e.moral = plus(e.moral, 1); },
  },
  {
    id: "bonbons", emoji: "🍬", annonce: "Une pluie de bonbons !", replique: "Le ciel m'aime. C'est officiel.",
    effet: (e) => { e.moral = plus(e.moral, 1); e.poids += 2; },
  },
  {
    id: "aigle", emoji: "🦅", annonce: "Un aigle voleur passe en piqué !", replique: "IL A PRIS MON GOÛTER !!!",
    effet: (e) => { e.ventre = plus(e.ventre, -1); },
  },
  {
    id: "fee", emoji: "🧹", annonce: "La fée du ménage est passée.", replique: "Ça sent le propre. C'est bizarre.",
    effet: (e) => { e.crottes = []; },
  },
  {
    id: "invasion", emoji: "💩", annonce: "Invasion de cacas !", replique: "Ce n'est pas moi. Enfin, pas tout.",
    effet: (e) => {
      for (let i = 0; i < 2 && e.crottes.length < 4 && e.roiCaca === null; i++) {
        e.crottes.push(0);
      }
    },
  },
  {
    id: "champignon", emoji: "🍄", annonce: "Il a mangé un champignon bizarre...", replique: "Les couleurs... PARLENT...",
    effet: (e) => { e.moral = plus(e.moral, 1); },
  },
  {
    id: "seisme", emoji: "🌋", annonce: "Tremblement de terre !", replique: "J'AI RIEN FAIT !",
    effet: (e) => { e.moral = plus(e.moral, -1); },
  },
  {
    id: "musicien", emoji: "🎵", annonce: "Un musicien joue sous la fenêtre.", replique: "C'est ma chanson préférée. Je la connais pas.",
    effet: (e) => { e.moral = plus(e.moral, 1); },
  },
  {
    id: "colis", emoji: "📦", annonce: "Un colis mystère !", replique: "Une boîte ! Je vais habiter dedans.",
    effet: (e) => { e.moral = plus(e.moral, 1); },
  },
  // Les visiteurs
  {
    id: "pizza", emoji: "🍕", annonce: "Le livreur de pizza s'est trompé d'adresse.", replique: "Je ne dirai rien. Miam.",
    visiteur: "Livreur de pizza", effet: (e) => { e.ventre = plus(e.ventre, 2); e.poids += 1; },
  },
  {
    id: "chat", emoji: "🐱", annonce: "Un chat errant vient se frotter.", replique: "Il ronronne. Je ronronne aussi. On est deux.",
    visiteur: "Chat errant", effet: (e) => { e.moral = plus(e.moral, 1); },
  },
  {
    id: "alien", emoji: "👽", annonce: "Un alien touriste prend des photos.", replique: "Souris ! Non, l'autre côté !",
    visiteur: "Alien touriste", effet: () => {},
  },
  {
    id: "squelette", emoji: "💀", annonce: "Un squelette amical passe dire bonjour.", replique: "Il est super sympa. Un peu maigre.",
    visiteur: "Squelette amical", effet: (e) => { e.moral = plus(e.moral, 1); },
  },
  {
    id: "ninja", emoji: "🥷", annonce: "Un ninja était là depuis le début.", replique: "Depuis QUAND ?!",
    visiteur: "Ninja", effet: () => {},
  },
  {
    id: "astronaute", emoji: "🧑‍🚀", annonce: "Une astronaute fait une escale.", replique: "Elle connaît ma planète !",
    visiteur: "Astronaute", effet: (e) => { e.moral = plus(e.moral, 1); },
  },
];
