# Le jeu de course et ses thèmes

Un seul jeu de course, et des **thèmes** : « voitures » et « licornes ». Le jeu est écrit une fois :

- les scènes (`scenes/` : chargement, menu, choix du circuit, course, tableau de bord, arrivée, pause,
  Grand Prix et podium, atelier, éditeur) ;
- la conduite calculée à la main, le pilote de l'ordinateur, la barrière, le repêchage et la bousculade
  (`Coureur.ts`, sans physique Arcade : voir le carnet, leçon 2) ;
- les circuits et leur trace (`circuits.ts`), les sauvegardes (`sauvegarde.ts`), le son et la musique
  (`son.ts`), les boutons et textes (`interface.ts`).

Tous les modes sont communs : Grand Prix, contre l'ordinateur, à deux (avec ou sans rivaux), contre la
montre et son fantôme, atelier, circuit dessiné, niveaux Facile / Normal / Expert.

## Un thème

Un thème (`themes/<nom>/`, l'interface `Theme` de `theme.ts`, documentée champ par champ) n'apporte que
des données et des dessins : son habillage (police, couleurs, fond des menus, fête), ses mots
(« licorne » / « voiture », « 1re » / « 1er »...), ses réglages de conduite et ses niveaux (chaque thème se
conduit comme avant), la largeur de sa route et sa barrière, ses circuits et son Grand Prix (la liste
des courses et le niveau des rivaux), ses objets, ses sons, sa musique, et un `DecorDeCourse` qui
dessine une course (la vue de chaque véhicule, les objets, les gerbes, les traces) et réagit à ses
événements (`Evenement` : une foulée, la barrière, un objet touché...).

- **Les objets** : chaque type déclare son effet, pris dans la liste du jeu (`Effet` : `reserve` pour un
  turbo à garder, `turbo`, `glisse`, `etourdi`, `geant`), sa portée, s'il disparaît et revient (`retour`),
  s'il attend avant de reservir (`attente`), ou s'il se pose tout seul le long du tour (`auto`). Les
  circuits placent les autres par type : `objets: { bidons: [[place, decalage], ...] }`.
- **L'atelier** est commun. Un thème déclare son équipe (`equipe` : les véhicules de départ, chacun une
  `Apparence` avec au moins un `nom`), ses `rubriques` (un champ de l'apparence, son libellé, la liste de
  ses choix, et comment les montrer : `"couleur"`, `"couleurs"`, ou une fonction qui donne un texte),
  `completer` (ce qui se déduit, comme l'ombre d'une robe), `couleur` (sa couleur au tableau de bord), et
  `vehicule.texture` qui dessine une apparence (une animation `<cle>-anim` si `anime`). Le joueur 1 et
  le joueur 2 choisissent chacun un véhicule de l'équipe ; les rivaux sont les autres.

## Ajouter un thème

Des fusées, des escargots... : un dossier `themes/<nom>/` dont l'`index.ts` exporte un `Theme`
(s'inspirer de `voitures/`, le plus court), une ligne dans `themes/index.ts`, et une carte dans
`catalogue.ts` : `import("./course").then((m) => m.courseAuTheme("<nom>"))`.

Le Hub a une carte par thème, qui lance le même jeu avec son thème. Pour une seule carte,
`courseAuTheme()` sans thème : le menu propose alors de changer de thème (touche T).

## Les sauvegardes

Toutes en JSON par `lire` / `ecrire`, sous une seule forme : `course/<theme>/niveau`, `.../son`,
`.../joueurs` ([j1, j2]), `.../rivaux`, `.../circuit` (le dernier choisi), `.../circuit-dessine`,
`.../record/<circuit>`, `.../perso/<numero>` (ce que l'atelier a changé à ce véhicule de l'équipe), et
`course/theme` (le dernier thème joué).

## Les tests

Dans `tests/course.spec.ts` ; les premiers jouent la même course dans chaque thème.
