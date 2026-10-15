// Un thème du jeu de course : tout ce qui change d'une course de voitures à une course de licornes.
//
// Le jeu (les scènes, la conduite, le pilote de l'ordinateur, les circuits, les modes, l'atelier, les
// sauvegardes) est écrit une seule fois, dans ce dossier. Un thème n'apporte que des données et des
// dessins : son apparence, ses véhicules et ce qui s'y personnalise, ses réglages de conduite, ses
// circuits, ses objets (et l'effet de chacun, pris dans la liste des effets du jeu), ses sons, sa
// musique, ses mots. Ajouter un thème : un dossier themes/<nom>/ qui exporte un Theme, et une ligne
// dans themes/index.ts. Voir themes/voitures/ et themes/licornes/.

import type Phaser from "phaser";
import type { Coureur, Instant } from "./Coureur";
import type { Circuit, ModeleDeCircuit, Point, Emplacement } from "./circuits";
import type { Air } from "./son";

// ===== Les véhicules, et ce qui s'y personnalise (l'atelier) =====

// L'apparence d'un véhicule : son nom, puis ce que le thème veut (des couleurs, des noms de choix...).
// C'est elle que l'atelier modifie et que le jeu garde (course/<theme>/perso/<numero>).
export interface Apparence {
  nom: string;
  [cle: string]: string | string[];
}

// Une rubrique de l'atelier : un champ de l'apparence, et les valeurs qu'on peut lui donner (◀ ▶)
export interface Rubrique {
  cle: string;                             // le champ de l'apparence qu'elle change
  libelle: string;                         // « Sa robe », « Décalco »...
  choix: (string | string[])[];            // les valeurs possibles, dans l'ordre
  // Comment l'atelier montre la valeur : une pastille de couleur, une rangée de pastilles, ou un texte
  montrer: "couleur" | "couleurs" | ((valeur: string) => string);
}

// Le dessin d'un véhicule. Les feuilles sont dessinées « resolution » fois plus grand que la taille de
// course, pour rester nettes quand on les agrandit (menus, atelier, géante).
export interface DessinDuVehicule {
  resolution: number;                      // celle des feuilles de course
  echellePortrait: number;                 // dans les menus : un véhicule petit (une voiture) est grossi
  // La feuille d'une apparence (une seule image, ou plusieurs pour une animation « <cle>-anim »).
  // Une clé imposée remplace l'ancienne feuille (l'atelier redessine sans cesse le même véhicule).
  texture(scene: Phaser.Scene, apparence: Apparence, resolution?: number, cleImposee?: string): string;
  anime: boolean;                          // vrai : la feuille a une animation (le galop)
  imageDe?(phase: number): number;         // l'image de l'animation pour une phase de la foulée
}

// ===== La conduite : les réglages de chaque thème, pour que chacun se conduise comme avant =====

export interface Conduite {
  acceleration: number;                    // pixels par seconde gagnés chaque seconde où l'on accélère
  frein: number;
  vitesseMax: number;
  marcheArriere: number;
  virage: number;                          // radians par seconde
  pivot: number;                           // 0 : il faut rouler pour tourner ; plus : on pivote sur place
  frottement: number;                      // sur la route
  frottementHorsPiste: number;
  adherence: number;                       // moins, et le véhicule glisse
  adherenceHorsPiste: number;
  turbo: {
    duree: number;                         // secondes de turbo par objet de la réserve
    vitesse: number;
    poussee: number;                       // l'accélération en plus, en nombre d'« acceleration »
    survole: boolean;                      // vrai : en turbo, le hors-piste ne freine plus
  };
  reserveMax: number;                      // les turbos qu'on peut garder
  taille: number;                          // l'échelle du véhicule en course
  rayonChoc: number;                       // deux véhicules plus proches que leurs rayons se poussent
  rayonBarriere: number;                   // le corps s'arrête à ce rayon de la barrière
  choc: number;                            // la part de la vitesse échangée dans un choc
  redresser: number;                       // le nez contre la barrière, il tourne vers la route (radians/s, 0 : non)
  grille: { recul: number; rangee: number; decalage: number };   // la grille de départ
  // Le repêchage : remis au milieu de la route quand il n'a plus avancé depuis « sansProgres » secondes,
  // ou quand il est resté presque arrêté hors de la route « horsPiste » secondes
  repechage: { sansProgres?: number; horsPiste?: number };
}

// ===== Les objets sur la route =====

// Ce qu'un objet fait à celui qui le touche (les effets sont ceux du jeu : un thème les choisit)
export type Effet =
  | { genre: "reserve" }                   // un turbo de plus dans la réserve (bidon, étoile)
  | { genre: "turbo"; duree: number }      // un petit turbo gratuit (flèche)
  | { genre: "glisse"; duree: number; adherence: number }   // ça glisse (huile)
  | { genre: "etourdi"; duree: number }    // la tête qui tourne, on va moins vite (orage)
  | { genre: "geant"; duree: number };     // géant : il pousse les autres, rien ne l'étourdit (bonbon)

export interface TypeDObjet {
  id: string;                              // son nom dans les circuits (objets.<id>)
  effet: Effet;
  portee: number;                          // touché à moins de cette distance (un géant attrape de plus loin)
  retour?: number;                         // il disparaît quand on le prend, et revient après ces secondes
  attente?: number;                        // pour le même véhicule, pas deux fois en moins de ces secondes
  auto?: boolean;                          // posé tout seul le long du tour (les étoiles), pas par les circuits
}

// ===== Les niveaux =====

//   rivaux : leur vitesse ; horsPiste : le frottement hors de la route pour les joueurs ; malus : la durée
//   des mauvais effets (huile, orage) ; direction : l'aide au pilotage (0 : aucune) ; elastique : les
//   rivaux en tête attendent les joueurs, ceux qui traînent se dépêchent (0 : non)
export interface Niveau {
  id: string;
  nom: string;
  rivaux: number;
  horsPiste: number;
  malus: number;
  direction: number;
  elastique: number;
}

// ===== Pendant la course : ce que le thème dessine, et comment il réagit =====

// Ce qui arrive en course : le thème y répond par des sons, des gerbes, des messages
export type Evenement =
  | { genre: "pas"; aigu: boolean }        // une foulée (le galop fait « clop »)
  | { genre: "barriere"; x: number; y: number; fort: boolean }   // fort : de face, et vite (voir CHOC_FORT)
  | { genre: "choc"; x: number; y: number; fort: boolean; gerbe: boolean }   // contre un autre véhicule (gerbe : les étincelles, une fois par contact)
  | { genre: "repeche"; avantX: number; avantY: number }
  | { genre: "etourdi" }
  | { genre: "turbo" }
  | { genre: "objet"; type: TypeDObjet; x: number; y: number };

// Ce qu'on voit d'un véhicule : la scène le fait suivre par la caméra et l'actualise à chaque image
export interface VueDuCoureur {
  objet: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;
  actualiser(horloge: number, duree: number): void;
}

// La scène de course, telle que le thème la voit
export interface CourseVue {
  scene: Phaser.Scene;
  circuit: Circuit;
  joueurs: Coureur[];
  annoncer(texte: string, couleur: string, coureur?: Coureur): void;
}

// Le thème habille une course : il en reçoit une à chaque départ
export interface DecorDeCourse {
  vue(coureur: Coureur, etiquette: boolean): VueDuCoureur;
  objet(type: TypeDObjet, place: Emplacement): Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Visible
    & Phaser.GameObjects.GameObject;
  fantome(): { objet: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible; placer(instant: Instant): void };
  reagir(coureur: Coureur, evenement: Evenement): void;
  apresImage?(): void;                     // une fois par image, après tous les véhicules
}

// Un moteur qui ronronne, un par joueur (les voitures)
export interface Moteur {
  demarrer(): void;
  regler(vitesse: number): void;
  arreter(): void;
  detruire(): void;
}

// Les sons que le jeu demande. Ceux qu'un thème n'a pas restent muets.
export type NomDeSon = "menu" | "non" | "bip" | "partez" | "tour" | "record" | "victoire" | "atelier";

// ===== L'apparence des écrans (menus, tableau de bord) =====

export interface Habillage {
  police: string;
  contour: string;                         // le bord des textes qui doivent ressortir
  degrade: string[];                       // les bordures des boutons choisis (l'arc-en-ciel, l'orange)
  couleurs: {
    texte: string; texteDoux: string; texteClair: string;
    accent: string;                        // les titres et ce qui est choisi
    accent2: string;                       // les flèches ◀ ▶
    record: string;
    rangs: [string, string, string];       // or, argent, bronze
    ligne: string;                         // un mode du menu, pas choisi
    fondCarte: string;                     // les cartes des menus (CSS)
    fondLigne: string;                     // un bouton pas choisi
    fondChoisi: string;                    // un bouton choisi
    fondPanneau: number;                   // les panneaux du tableau de bord, de l'arrivée...
    alphaPanneau: number;
    voile: number;                         // derrière l'arrivée et la pause
    alphaVoile: number;
    separation: number;                    // le trait de l'écran partagé
    carteRoute: string;                    // la route sur la petite carte
    compte: string[];                      // les couleurs du 3, 2, 1
    commande: string;                      // les flèches des boutons au doigt
    alphaCommande: number;
  };
  icones: { reserve: string; reserveVide: string; grandeReserve: string; barre: string };   // des clés de texture
  fond(scene: Phaser.Scene): void;         // le fond des menus
  fete(scene: Phaser.Scene, frequence: number): Phaser.GameObjects.Particles.ParticleEmitter;   // confettis, feu d'artifice
  titre(texte: Phaser.GameObjects.Text): Phaser.GameObjects.Text;   // l'effet des titres
}

// ===== Les mots =====

export interface Mots {
  vehicule: string;                        // « licorne », « voiture »
  vehicules: string;
  ta: string;                              // « Ta licorne »
  rivaux: string;                          // « licornes de l'ordinateur »
  lesRivaux: string;                       // « rivales », « rivaux »
  aucunRival: string;                      // « aucune, juste vous deux »
  premier: string;                         // « 1re », « 1er »
  turbo: string;                           // « turbo arc-en-ciel », « nitro »
  atelier: string;                         // « Atelier des licornes »
  atelierDetail: string;
  astuce: string;                          // sous le menu : comment avoir un turbo
  objets: string;                          // sous le menu : ce que font les objets
}

// ===== Le thème =====

export interface Theme {
  id: string;                              // le début des sauvegardes (course/<id>/...) : ne plus le changer
  titre: string;
  emoji: string;
  mots: Mots;
  habillage: Habillage;

  // Les véhicules : l'équipe de départ (les joueurs choisissent dans la liste, les rivaux sont les autres),
  // ce que l'atelier peut y changer, et comment les dessiner
  equipe: Apparence[];
  rubriques: Rubrique[];
  completer(apparence: Apparence): Apparence;    // ce qui se déduit du reste (une ombre plus sombre...)
  couleur(apparence: Apparence): string;   // sa couleur sur la carte, au tableau de bord, dans les classements
  vehicule: DessinDuVehicule;

  conduite: Conduite;
  route: { largeur: number; barriere: number };  // la barrière : sa distance au milieu de la route
  niveaux: Niveau[];
  niveauParDefaut: string;
  aideAuDoigt: Partial<Omit<Niveau, "id" | "nom">>;   // au doigt, quel que soit le niveau
  objets: TypeDObjet[];

  circuits: ModeleDeCircuit[];
  objetsDuCircuitDessine: ModeleDeCircuit["objets"];
  margeEditeur: number;                    // les points dessinés restent à cette distance du bord du monde
  grandPrix: { circuit: string; niveau: number }[];
  niveauDesRivaux: number;                 // contre l'ordinateur, et à deux
  ecartsRivaux: number[];                  // le premier rival un peu plus fort, le dernier un peu moins...

  // Les dessins
  charger?(scene: Phaser.Scene): void;     // dans preload : des sons, une police
  fabriquerTextures(scene: Phaser.Scene): void;
  peindreLaPiste(p: CanvasRenderingContext2D, circuit: Circuit): void;
  peindreLApercu(p: CanvasRenderingContext2D, monde: { largeur: number; hauteur: number }, points: Point[], w: number, h: number): void;
  decor(course: CourseVue): DecorDeCourse;
  camera: { suivi: number; regard: number; lissage: number; recul: number; fond?: string };

  // Les sons
  sons: Partial<Record<NomDeSon, (scene: Phaser.Scene) => void>>;
  moteur?(scene: Phaser.Scene, auDoigt: boolean, joueurs: number): Moteur;
  musique?: { menu: Air; course: Air };
}
