# Les idées pour améliorer les jeux

Relevées en octobre 2026 par des agents qui ont **lu** le code de chaque jeu (sans y jouer ni rien modifier).
C'est une réserve où piocher, pas une liste de choses à faire : c'est le joueur qui trie, et qui juge
l'équilibrage en jouant. Taille : **S** petit, **M** moyen, **L** gros. Une idée faite ou écartée sort de la liste.

## À juger en jouant

Les réglages de ressenti posés sans avoir joué : la valeur d'aujourd'hui, puis d'autres options. Dire ce
qui ne va pas suffit, on ajuste.

**Casse-briques**
- Au doigt, la raquette remonte de 70 px au-dessus d'une bande pour le pouce : la balle a un peu moins de chemin
  avant elle. La remonter moins (50 px), ou plus (90 px) ?
- La balle, ralentie pour les enfants : départ 320 px/s, +2 par brique, au plus 520 (avant : 380, +3, 620).

**Tir spatial**
- Coup reçu : ralenti à 30 % pendant 220 ms et flash rouge. Plus marqué (20 % / 300 ms), ou un arrêt net de 80 ms ?
- Boss abattu : ralenti à 25 % pendant 900 ms. Plus court (500 ms) ?
- Pendant les ralentis, le vaisseau et ses balles saccadent un peu (la physique fait moins de pas) : à voir à l'œil ; un ralenti moins fort (0,4) l'adoucit.
- Au téléphone, les marges : ciel étoilé, voilé de noir à 35 %, un trait cyan au bord de l'aire. Sans voile, ou un vrai cadre ?
- Le flash rouge ne couvre que l'aire de jeu : tout l'écran ?
- « Bouclier ! » et « +1 vie » s'envolent aussi ; rien quand l'arme est déjà au plus bas : un « −1 vie » ?

**Baston**
- L'annonce de chaque manche dure 2,25 s (« Manche N », 3, 2, 1, « Combat ! ») au lieu de 1,5 s. Plus rapide, ou 3, 2, 1 seulement à la première manche ?
- Arrêt sur coup : 70 ms, 150 ms au spécial et au K.O. Plus léger (50/100) ou plus lourd (100/200) ?
- Appui gardé : 150 ms. 100 ms (moins de coups involontaires) ou 200 ms (plus tolérant) ?
- Un saut tapé pendant les 70 ms d'un arrêt sur coup est perdu (frapper et tirer sont gardés, pas le saut) : à garder aussi ?
- En solo, ça vibre aussi quand l'ordinateur tombe K.O. : seulement les coups reçus ?
- Le bouton du son au doigt est petit (18 px), à droite du ✕ : plus gros, ou une icône seule ? (Et le « (M) » du bouton n'a pas de sens au doigt.)
- Les nouveaux sons (saut, bip, cloche, fanfare) ; le saut de l'ordinateur plus grave ?

**Catapulte**
- Au téléphone, le château garde sa taille (du paysage en plus sur les côtés). Zoomer d'après la largeur (le château plus grand, mais le haut du ciel coupé) ?
- Gros écroulement = 4 blocs en 1 s, secousse de 350 ms. 3 blocs, ou la pierre compte double ?
- Ralenti du dernier slime : 0,25 pendant 450 ms. Plus marqué, ou avec un zoom sur le slime ?
- La trace du tir d'avant : points blancs pâles, jusqu'au sol. Jaune, ou arrêtée au premier choc ?
- Le ricanement « hi hi ! » est écrit, sans son : un petit son ?
- Les slimes clignent toutes les 6 s environ : plus rare, plus long ?
- La visée à la manette : 1° et 0,02 de force par appui sur la croix ; tenue, elle avance d'elle-même après
  300 ms, à 40° et 0,5 de force par seconde (le stick aussi, poussé à fond). Plus lent tenu (25°/s), une attente
  plus courte (200 ms) ?
- Un tir s'arrête quand tout est calme, ou au bout de 20 s (un bloc qui glisserait sans fin sur la glace) :
  15 s, ou 30 s ?

**Platformer**
- Saut court : la vitesse ramenée à 40 % (un bond de 35 px contre 130 px tenu). Plus franc, ou plus doux (50 à 60 %) ?
- La caméra regarde 12 % devant, change de côté en une demi-seconde. Plus loin, moins loin, seulement en courant ?
- Le drapeau ondule tout le temps, zoom ×1,12 à la victoire : immobile jusqu'à la victoire ? Zoom plus ou moins fort ?
- Les sons d'atterrissage, de fragile et de double saut sont des sons existants joués plus aigus : garder, baisser, ou de vrais sons fabriqués ?
- Le « poc » d'atterrissage sonne dès 68 px de chute, donc à chaque saut entier : seulement sur une vraie chute (vers 170 px) ?

**Course**
- Le flash du turbo : blanc à 35 %, à chaque turbo, flèches comprises. Seulement la réserve ? Une teinte par thème (orange la nitro, rose les licornes) ?
- Choc fort à partir de 300 px/s d'impact (secousse de 7 px, 180 ms). Plus souvent (220) ou moins (380) ?
- Les sons des voitures sont synthétiques (fanfare, souffle de nitro) : garder, ou de vrais fichiers ?
- Les menus élargis gardent leur contenu au milieu : l'écarter vers les bords ?
- L'écart au fantôme s'affiche aussi à la ligne, avec « Nouveau record ! » : seulement aux portes ?

**Démineur**
- Au doigt, la barre passe à 68 px pour le ⏸ (12 px de moins pour la grille). Ou garder 56 px, le ⏸ dessiné plus petit mais touchable aussi bien ?
- Accord raté : 180 ms d'enfoncement, un tremblement et un clic grave. Sans le son ? Plus long (250 ms) ?
- La vue de toute la grille part dès l'explosion : un instant de gros plan sur la mine d'abord ? Aussi à la victoire ?
- Les mines en chaîne : une douzaine de « boum » aigus et doux. Un par mine, ou des clics ?
- Un drapeau posé à la manette fait-il vibrer la manette ?

**Tamago**
- Le rythme : 1 an pour 3 min 45 (quatre fois plus vite qu'avant), un adulte à 16 min, une vie de 45 min à 1 h 15. Encore plus vite, ou les stades plus courts que la vie ?
- Avec ce rythme, une surprise arrive toutes les 30 s à 1 min 15 (les appels, eux, attendent toujours 1 min avant l'oubli). Des surprises plus rares ?
- Sans jouer souvent, la maladie « trop de friandises » est presque inévitable (à rejuger avec le nouveau rythme).

## Course (voitures et licornes)

**Finition**
- Un ralenti et un zoom sur la ligne d'arrivée (M).

**Contenu**
- Des rivaux qui vont chercher les bonus et évitent les pièges ; des écarts de vitesse entre eux (M).
- Deux circuits de plus pour les voitures, un Grand Prix plus long (M).
- De nouveaux objets pour les voitures avec les effets existants : boue (étourdi), monster truck (géant) (M).

**Au doigt et à la manette**
- L'aide de la manette à l'écran quand une manette est branchée (S).

**Modes**
- Les circuits à l'envers (M).
- L'élimination : le dernier de chaque tour sort (M).

## Baston de robots

**Contenu**
- Garde / parade (M, à essayer : peut ralentir les parties).
- Des arènes variées : usine, toit la nuit, pluie (M).
- Un 4e robot (M).

**Au doigt et à la manette**
- Une touche à part pour le spécial (S).
- Une aide au premier combat au doigt, sur les zones (S).

**Modes**
- Tournoi : les trois robots à la suite (M).
- Survie : une seule barre de vie, un record de K.O. (M).

## Platformer

**Contenu**
- Un Infini qui se transforme avec la distance (M).
- Un boss qui change quand il est blessé (M).

**Au doigt et à la manette**
- Toute la moitié droite de l'écran pour sauter (S).

**Modes**
- Le duo à armes égales : la même graine pour les deux (S).
- Des médailles par niveau : chrono et pièces (M).

## Tir spatial

**Contenu**
- Un deuxième boss, ou des phases (M).
- De nouveaux ennemis et formations : kamikaze, mine, cercle (M).
- De nouveaux bonus : bombe, aimant, drones (M).

**Modes**
- Le multiplicateur, qui retombe au premier coup (S).
- Boss Rush ou Survie (M).
- À deux sur le même écran (L).

## Catapulte

**Contenu**
- La caisse de TNT, puis le boulet bombe (M).
- Du relief (rochers, plateaux) et plus de niveaux, avec des pages au menu : il n'en tient que 8 (M).
- Le slime casqué (S).

**Au doigt et à la manette**
- L'aide de la manette à l'écran (S).

**Modes**
- Le château du jour (M/L).
- L'atelier : l'un construit, l'autre tire (L).

## Démineur

**Contenu**
- La grille du jour (S/M).
- Des statistiques par niveau (S).
- Un niveau personnalisé (M).

**Au doigt et à la manette**
- Plus de « ? » au doigt (S).
- Un vrai bouton de retour dans la barre (S).
- La croix tenue qui avance toute seule (S).
- Revoir l'aide (un « ? ») (S).

**Modes**
- Sans hasard : une grille toujours soluble par la logique (L).
- Duo « chasse aux mines » (M/L).
- Contre la montre (M).

## Tamago

**Finition**
- Son humeur sur lui : fatigué (il bâille), et pas seulement malade ou comblé (S).
- Une évolution façon silhouette (S).

**Contenu**
- Le Tamadex : toutes les formes, « ??? » pour les inconnues (S/M).
- Lui donner un nom (et la saisie de texte monte au socle) (M).
- Des répliques par caractère (S).
- Un second petit jeu (M).

**Modes**
- Le thème Rétro, prévu dans REGLES.md (L).
- Des surprises à jouer : l'aigle, les bonbons (M).
- Une vie express (M).
