# Les idées pour améliorer les jeux

Relevées en octobre 2026 par des agents qui ont **lu** le code de chaque jeu (sans y jouer ni rien modifier).
C'est une réserve où piocher, pas une liste de choses à faire : c'est le joueur qui trie, et qui juge
l'équilibrage en jouant. Taille : **S** petit, **M** moyen, **L** gros. Une idée faite ou écartée sort de la liste.

## Les défauts repérés (à vérifier, puis corriger)

### Communs à plusieurs jeux
- **Ce qui suit `time.now` continue pendant la pause** : l'invincibilité du tir peut finir pendant la pause
  (le clignotement, lui, attend), les ennemis du tir tirent tous dès la reprise, le boss du platformer aussi.
- **La pause n'a pas été essayée avec une vraie manette** (les tests simulent l'appui).

### Baston
- Un appui bref pendant une animation (un tir, un coup encaissé) est perdu : à garder en mémoire jusqu'à
  ce que le robot ait les mains libres ? À juger en jouant ; l'ordinateur lance peut-être aussi son spécial
  un peu moins souvent depuis qu'il lui faut un nouvel appui.
- Au doigt, pas de bouton du son en combat (seulement au titre).

### Catapulte
- Le menu ne tient pas plus de 8 niveaux : des pages, quand un 9e arrivera.
- Un tir s'arrête au calme, ou au bout de 20 s (un bloc qui glisserait sans fin sur la glace) : à juger.

### Démineur
- Au doigt, le ⏸ de la barre fait 52 px (la barre en fait 56) au lieu des 64 conseillés.

### Tamago (et écarts avec `REGLES.md`)
Le Tamago est une ébauche : on le laisse de côté pour l'instant, ces notes attendent qu'on y revienne.
- La variante gentille : REGLES.md dit 75 % de discipline, le code veut 0 %, 75 % puis 100 %.
- La maladie épargne le bébé, les surprises aussi : REGLES.md ne le dit pas, et se contredit sur leur fréquence.
- Le jeu ne fait pas perdre de poids sous le poids de base, et donne des points Joyeux même perdu.
- REGLES.md dit de taper le ROI CACA : il n'est pas touchable.
- Le Carnet peut annoncer une autre lignée que celle qui gagnera (égalité).
- Le journal et l'album peuvent déborder en bas de l'écran.
- Un caprice qui glisse après la fin du stade est perdu.
- Revenir pendant l'éclosion : « Encore un peu ! » et l'œuf ne tremble plus.
- M ne coupe pas le son pendant le Carnet ou le jeu (l'écran est en pause).
- À juger en jouant : sans jouer souvent, la maladie « trop de friandises » est presque inévitable.

## Course (voitures et licornes)

**Finition**
- Caméra qui tremble au choc, flash au turbo, vibration (S).
- De vrais sons pour les voitures : nitro, choc, victoire (aujourd'hui le même bip) (S).
- Les écarts au contre-la-montre, à chaque porte (« −0.42 » en vert) (S).
- Un ralenti et un zoom sur la ligne d'arrivée (M).
- Une place gagnée se voit (le compteur grossit) (S).

**Contenu**
- Des rivaux qui vont chercher les bonus et évitent les pièges ; des écarts de vitesse entre eux (M).
- Deux circuits de plus pour les voitures, un Grand Prix plus long (M).
- De nouveaux objets pour les voitures avec les effets existants : boue (étourdi), monster truck (géant) (M).

**Au doigt et à la manette**
- La course sur toute la largeur du téléphone (`elargir`) (M).
- L'aide de la manette à l'écran quand une manette est branchée (S).

**Modes**
- Les circuits à l'envers (M).
- L'élimination : le dernier de chaque tour sort (M).

## Baston de robots

**Finition**
- Arrêt sur coup (hit-stop) (S).
- Le robot touché flashe en blanc, les dégâts s'envolent (S).
- Un « 3, 2, 1, Combat ! », des sons de saut et de victoire, le son coupé (M).

**Contenu**
- Garde / parade (M, à essayer : peut ralentir les parties).
- Des arènes variées : usine, toit la nuit, pluie (M).
- Un 4e robot (M).

**Au doigt et à la manette**
- Une touche à part pour le spécial (S).
- Une aide au premier combat au doigt, sur les zones (S).
- Vibration au coup et au K.O. (S).

**Modes**
- Tournoi : les trois robots à la suite (M).
- Survie : une seule barre de vie, un record de K.O. (M).

## Platformer

**Finition**
- Un saut court si on lâche la touche tôt (S).
- Gagner, c'est une fête : confettis, drapeau qui ondule, zoom (S).
- Une caméra qui regarde devant (S).
- Les sons qui manquent : atterrissage, fragile, drapeau, double saut (S).

**Contenu**
- Un Infini qui se transforme avec la distance (M).
- Un boss qui change quand il est blessé (M).

**Au doigt et à la manette**
- Le téléphone en entier avec `elargir` (M).
- Toute la moitié droite de l'écran pour sauter (S).

**Modes**
- Le duo à armes égales : la même graine pour les deux (S).
- Des médailles par niveau : chrono et pièces (M).

## Tir spatial

**Finition**
- Le choc qui se sent : ralenti, flash rouge (S).
- Dire ce qu'on perd et ce qu'on gagne (« −1 tir ») (S).
- Des explosions plus riches : onde de choc, sons variés (S).

**Contenu**
- Un deuxième boss, ou des phases (M).
- De nouveaux ennemis et formations : kamikaze, mine, cercle (M).
- De nouveaux bonus : bombe, aimant, drones (M).

**Au doigt et à la manette**
- Vibrations (S).
- Mieux remplir le téléphone (M, à essayer).

**Modes**
- Le multiplicateur, qui retombe au premier coup (S).
- Boss Rush ou Survie (M).
- À deux sur le même écran (L).

## Catapulte

**Finition**
- Une traînée en vol, et la trace du tir d'avant (S).
- Le poids des chocs : secousse, ralenti sur le dernier slime (S).
- Des slimes vivants : ils clignent, ils ricanent (S).

**Contenu**
- La caisse de TNT, puis le boulet bombe (M).
- Du relief (rochers, plateaux) et plus de niveaux, avec des pages au menu (M).
- Le slime casqué (S).

**Au doigt et à la manette**
- Viser d'après le glissé du doigt (règle aussi la tape qui tire) (S).
- Remplir l'écran du téléphone (M).
- Le stick analogique, et l'aide de la manette (S).

**Modes**
- Le château du jour (M/L).
- L'atelier : l'un construit, l'autre tire (L).

## Démineur

**Finition**
- Un accord raté se voit (les voisines s'enfoncent) (S).
- À la fin, la caméra montre toute la grille (S).
- Les autres mines éclatent en chaîne (S).

**Contenu**
- La grille du jour (S/M).
- Des statistiques par niveau (S).
- Un niveau personnalisé (M).

**Au doigt et à la manette**
- Plus de « ? » au doigt (S).
- Un vrai bouton de retour dans la barre (S).
- La croix tenue qui avance toute seule, et le stick (S).
- Revoir l'aide (un « ? ») (S).
- Élargir sur téléphone (M).

**Modes**
- Sans hasard : une grille toujours soluble par la logique (L).
- Duo « chasse aux mines » (M/L).
- Contre la montre (M).

## Tamago

**Finition**
- Un cœur perdu se voit (S).
- Son humeur sur lui : malade, fatigué, comblé (S/M).
- Une évolution façon silhouette (S).

**Contenu**
- Le Tamadex : toutes les formes, « ??? » pour les inconnues (S/M).
- Lui donner un nom (et la saisie de texte monte au socle) (M).
- Des répliques par caractère (S).
- Un second petit jeu (M).

**Au doigt et à la manette**
- Pendant un appel, le bon bouton bat (S).
- Toucher les crottes et le ROI CACA (S).
- Des boutons plus grands au téléphone (M).
- Une aide des touches (S).

**Modes**
- Le thème Rétro, prévu dans REGLES.md (L).
- Des surprises à jouer : l'aigle, les bonbons (M).
- Une vie express (M).

## Plusieurs jeux à la fois

Des idées revenues d'un jeu à l'autre, qui iraient au socle :
- **Les vibrations** (manette et téléphone) : baston, tir, course, catapulte.
- **`elargir` là où il manque** : platformer, tir, catapulte, course, démineur, Tamago.
