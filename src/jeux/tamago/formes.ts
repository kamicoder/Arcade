// Les formes du Tamago, reprises de TAMAGO-XTREME 3000 : quatre lignées, chacune avec une variante
// gentille et une sauvage, sur trois stades, plus une légende. Du TypeScript pur.

export type Stade = "oeuf" | "bebe" | "enfant" | "ado" | "adulte";
export type Lignee = "gourmand" | "joyeux" | "propre" | "style";
export type Variante = "gentil" | "sauvage";

export const LIGNEES: Lignee[] = ["gourmand", "joyeux", "propre", "style"];

export interface Forme {
  id: string;
  nom: string;
  emoji: string;
  caractere: string;                       // « gourmand », « vorace »...
}

const f = (id: string, nom: string, emoji: string, caractere: string): Forme => ({ id, nom, emoji, caractere });

export const OEUF = f("oeuf", "Œuf", "🥚", "mystérieux");
export const BEBE = f("bebe", "Ptiou", "🐥", "tout neuf");

// Le nom de chaque lignée, et ce qui la nourrit (REGLES.md, § 6)
export const NOMS_DES_LIGNEES: Record<Lignee, string> = {
  gourmand: "Gourmand", joyeux: "Joyeux", propre: "Propre", style: "Stylé",
};

type Etages = Record<"enfant" | "ado" | "adulte", Record<Variante, Forme>>;

const FORMES: Record<Lignee, Etages> = {
  gourmand: {
    enfant: { gentil: f("pioupiou", "Pioupiou", "🐣", "gourmand"), sauvage: f("krakmaw", "Krakmaw", "🦴", "vorace") },
    ado: { gentil: f("drakounet", "Drakounet", "🦎", "gourmand"), sauvage: f("devourix", "Devourix", "🦖", "vorace") },
    adulte: { gentil: f("dragomega", "DRAGOMEGA", "🐲", "gourmand"), sauvage: f("devourax", "DEVOURAX", "🦕", "vorace") },
  },
  joyeux: {
    enfant: { gentil: f("bebou", "Bébou", "👶", "joyeux"), sauvage: f("melanko", "Mélanko", "🌧️", "mélancolique") },
    ado: { gentil: f("renardo", "Renardo", "🦊", "joyeux"), sauvage: f("howlyx", "Howlyx", "🐺", "mélancolique") },
    adulte: { gentil: f("leonald", "LEONALD", "🦁", "joyeux"), sauvage: f("howlking", "HOWLKING", "🌪️", "mélancolique") },
  },
  propre: {
    enfant: { gentil: f("germy", "Germy", "🌱", "propre"), sauvage: f("cradox", "Cradox", "🗑️", "crado") },
    ado: { gentil: f("krakouille", "Krakouille", "🦑", "propre"), sauvage: f("toxix", "Toxix", "🦠", "crado") },
    adulte: { gentil: f("kthulu", "KTHULU JR", "🐙", "propre"), sauvage: f("plagueborn", "PLAGUEBORN", "☣️", "crado") },
  },
  style: {
    enfant: { gentil: f("glamy", "Glamy", "🎀", "stylé"), sauvage: f("punky", "Punky", "🤘", "punk") },
    ado: { gentil: f("feelia", "Feelia", "🧚", "stylé"), sauvage: f("darkwing", "Darkwing", "😈", "punk") },
    adulte: { gentil: f("archimage", "ARCHIMAGE", "🧙", "stylé"), sauvage: f("nightlord", "NIGHTLORD", "🦹", "punk") },
  },
};

const LEGENDES: Record<Lignee, Forme> = {
  gourmand: f("eternadrake", "ETERNADRAKE", "🐉", "légendaire"),
  joyeux: f("starlord", "STAR LORD", "🌟", "légendaire"),
  propre: f("abyssal", "ABYSSAL GOD", "🔱", "légendaire"),
  style: f("diamond", "DIAMOND SOUL", "💎", "légendaire"),
};

export function forme(stade: Stade, lignee: Lignee | null, variante: Variante | null, legende = false): Forme {
  if (stade === "oeuf") {
    return OEUF;
  }
  if (stade === "bebe" || !lignee || !variante) {
    return BEBE;
  }
  if (legende) {
    return LEGENDES[lignee];
  }
  return FORMES[lignee][stade][variante];
}

// La lignée d'après les points du stade : la plus nourrie l'emporte. À égalité, celle d'avant reste si
// elle en est ; sinon, le hasard choisit (un Tamago dont on ne s'est pas occupé n'est pas toujours Gourmand).
export function ligneeGagnante(points: Record<Lignee, number>, avant: Lignee | null, hasard: () => number): Lignee {
  const meilleur = Math.max(...LIGNEES.map((lignee) => points[lignee]));
  const aEgalite = LIGNEES.filter((lignee) => points[lignee] === meilleur);
  if (avant && aEgalite.includes(avant)) {
    return avant;
  }
  return aEgalite[Math.floor(hasard() * aEgalite.length)];
}
