// Les réglages du Tamago : les chiffres de REGLES.md, à changer pour sentir la différence en jouant.
// Toutes les durées sont en millisecondes de JEU : le Tamago ne vit que quand son écran est affiché.
//
// Deux sortes de durées. Celles de sa VIE (la faim, les crottes, les stades...) suivent toutes le
// même rythme : UN_AN, 3 min 45 d'écran. Les accélérer ou les ralentir ensemble garde l'équilibre du
// jeu (le premier rythme, 15 minutes par an, était quatre fois plus lent). Celles de l'INTERFACE
// (l'éclosion, la parole, le temps pour répondre à un appel) sont à la vitesse d'un humain qui
// regarde, et ne suivent pas ce rythme.

export const SECONDE = 1000;
export const MINUTE = 60 * SECONDE;

// —— Sa vie ——

export const UN_AN = 3 * MINUTE + 45 * SECONDE;
export const UN_MOIS = UN_AN / 12;         // l'âge s'affiche en mois, la première année

// Les jauges : 4 cœurs chacune
export const COEURS = 4;
export const PERTE_VENTRE = 45 * SECONDE;  // un cœur de Ventre en moins
export const PERTE_MORAL = MINUTE;         // un cœur de Moral en moins
export const BEBE_PLUS_VITE = 2;           // un bébé a faim et s'ennuie deux fois plus vite

// Les crottes
export const CROTTE_MIN = MINUTE;          // entre deux crottes...
export const CROTTE_MAX = 90 * SECONDE;    // ... (deux fois plus souvent chez un bébé)
export const CROTTES_MAX = 4;
export const CROTTE_FRAICHE = 15 * SECONDE; // nettoyée avant ça, elle compte double pour la lignée Propre
export const MALADE_DES_CROTTES = 75 * SECONDE;
export const ROI_CACA_APRES = 30 * SECONDE; // 4 crottes laissées tant que ça : le ROI CACA arrive
export const ROI_CACA_VIE = 5;

// La maladie et la fuite
export const DOSES_MIN = 1;
export const DOSES_MAX = 3;
export const PART_SI_MALADE = 150 * SECONDE;
export const PART_SI_VENTRE_VIDE = 150 * SECONDE;

// Grandir (un bébé de 4 mois, un ado à 1 an 8 mois, un adulte à 4 ans 4 mois)
export const DUREE_STADE = { bebe: 75 * SECONDE, enfant: 5 * MINUTE, ado: 10 * MINUTE };
export const BIENTOT = 0.85;               // passé cette part du stade, il « grandit bientôt »
export const MALADIE_ADULTE_DANS = 15 * MINUTE; // la maladie du stade adulte tombe dans ce temps-là
export const LEGENDE_A = 8 * UN_AN;        // un adulte parfait devient une légende à cet âge
export const VIE_MAX = 20 * UN_AN;         // il repart sur sa planète à cet âge...
export const VIE_MIN = 12 * UN_AN;         // ... moins un an par oubli, jamais avant celui-ci
export const OUBLI_RACCOURCIT = UN_AN;

// Une caresse compte pour la lignée Stylée, mais pas plus d'une fois toutes les 7 s et demie (autant de
// caresses comptées par stade qu'au premier rythme)
export const CARESSE_COMPTE = 7.5 * SECONDE;

// Les surprises (événements absurdes et visiteurs)
export const SURPRISE_MIN = 30 * SECONDE;
export const SURPRISE_MAX = 75 * SECONDE;

// La discipline : en quarts (0 à 4, soit 0 à 100 %). Les caprices de chaque stade : 3 pour l'enfant (75 %),
// et 2 pour l'ado, un de plus qu'il n'en faut pour 100 % : un caprice manqué enfant se rattrape
export const DISCIPLINE_MAX = 4;
export const CAPRICES = { bebe: 0, enfant: 3, ado: 2, adulte: 0 };
export const DISCIPLINE_GENTIL = { bebe: 0, enfant: 3, ado: 4 };   // pour la variante gentille, en fin de stade
export const OUBLIS_GENTIL = 2;           // au plus, pendant le stade

// Le poids de base de chaque stade ; le double rend malade
export const POIDS = { bebe: 5, enfant: 10, ado: 20, adulte: 30 };

// —— L'interface : à la vitesse de celui qui regarde ——

// Les appels : le temps qu'a le joueur pour réagir. Il vit quatre fois plus vite, mais le joueur, lui,
// réagit toujours à vitesse humaine.
export const OUBLI_APRES = MINUTE;         // un appel ignoré tant que ça devient un oubli
export const CAPRICE_DUREE = MINUTE;       // un caprice qu'on ne gronde pas finit par passer

export const OEUF_TAPES = 5;
export const OEUF_ECLOSION = 4 * SECONDE;  // après la 5e tape

// La parole : une réplique de temps en temps
export const PAROLE_MIN = 8 * SECONDE;
export const PAROLE_MAX = 16 * SECONDE;

export const JOURNAL_MAX = 40;
export const SAUVEGARDE = "tamago";
