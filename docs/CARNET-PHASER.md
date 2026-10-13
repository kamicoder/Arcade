# Carnet Phaser

On apprend Phaser en construisant l'Arcade. Chaque leçon part du code qui vient d'être écrit :
on le lit, on comprend les idées, puis on bricole avec les exercices. Pour les essayer,
`npm run dev` : la page se recharge à chaque sauvegarde.

La doc de référence : https://docs.phaser.io. Les exemples : https://phaser.io/examples. Ils sont
souvent écrits pour Phaser 3, et presque tout marche pareil en Phaser 4.

---

## Leçon 1 : le jeu, les scènes, les objets

### La philosophie en une phrase

**Un `Game` contient des `Scene`s, chaque scène contient des objets de jeu (Game Objects), et met à
leur service des systèmes déjà prêts : `this.add`, `this.tweens`, `this.input`, `this.cameras`,
`this.time`, `this.physics`...**

Dans nos jeux en JS pur, on écrivait la boucle (`requestAnimationFrame`), on effaçait et on
redessinait tout à chaque image, on gérait à la main l'état « menu / course / résultats ». Avec Phaser :

| En JS pur | Avec Phaser |
|---|---|
| `requestAnimationFrame(boucle)` | Phaser fait tourner la boucle ; on écrit seulement `update()` si besoin |
| `ctx.fillRect(...)` à chaque image | on **crée** un objet une fois (`this.add.rectangle`) ; Phaser le redessine tout seul |
| `etat = "menu"` + un gros `if` | une **scène** par écran : `this.scene.start("Course")` |
| `x += (cible - x) * 0.2` pour animer | un **tween** : `this.tweens.add({ targets, x: cible })` |
| `setTimeout`, compteurs d'images | `this.time.delayedCall(...)`, qui respecte la pause du jeu |

Le plus gros changement d'habitude est le deuxième. Un objet de jeu **reste** à l'écran tant qu'on ne
le détruit pas. Pour le déplacer, on change son `x`. Pour le cacher, on fait `setVisible(false)`.

### Le `Game` (`src/main.ts`)

Un seul pour toute l'Arcade. Ce qu'il faut retenir de sa configuration :

- `width` et `height` (960 × 540) : la taille **logique**. Tout le code raisonne dans ce repère, quel que
  soit l'écran.
- `scale.mode: FIT` : Phaser agrandit ce 960 × 540 pour remplir l'écran sans le déformer. Fini les
  calculs de taille à la main pour le téléphone.
- `scene: [Demarrage, Hub]` : les scènes connues au départ. **La première démarre toute seule.**

### Les scènes et leur cycle de vie

Une scène est une classe qui hérite de `Phaser.Scene`. Phaser appelle ses méthodes dans cet ordre :

1. `init(donnees)` : reçoit ce qu'on lui passe avec `this.scene.start("Nom", donnees)` ;
2. `preload()` : charge images et sons (`this.load.image(...)`). Phaser attend que tout soit là ;
3. `create()` : crée les objets, une fois ;
4. `update(temps, delta)` : à chaque image, tant que la scène tourne.

Dans `Demarrage.ts`, `create()` fabrique une petite texture (l'étincelle), puis
`this.scene.start("Hub")`. **`start` arrête la scène actuelle et lance l'autre.** Il existe aussi
`launch`, qui lance une scène *en plus* (utile pour un affichage de score par-dessus la course),
et `pause` / `resume` / `sleep` / `wake`.

Le piège : **une scène qu'on relance repasse par `create()`, mais l'objet de la classe est le même.**
Les propriétés (`this.cartes`, `this.choisie`...) gardent leur ancienne valeur. C'est pour ça que
`Hub.create()` commence par les remettre à zéro. Dans le Hub, c'est voulu pour `choisie` : en revenant
d'un jeu, la carte de ce jeu est toujours sélectionnée.

### Les objets de jeu (`Hub.ts`)

- `this.add.text(x, y, "texte", style)`, `this.add.rectangle(x, y, l, h, couleur)` : créer, c'est
  afficher.
- **L'origine** : par défaut, `x, y` désigne le *centre* d'un rectangle, mais le *coin haut gauche*
  d'un texte. `setOrigin(0.5)` centre le texte, `setOrigin(1, 0)` le cale en haut à droite.
- Presque toutes les méthodes renvoient l'objet lui-même, donc on les **enchaîne** :
  `this.add.rectangle(...).setRounded(22).setStrokeStyle(3, couleur)`.
- **Le Container** regroupe des objets. Leurs positions deviennent relatives au container, et bouger,
  tourner ou agrandir le container les entraîne tous. Chaque carte du Hub est un container : fond,
  emoji et titre.
- Les couleurs : en nombre `0xRRVVBB` pour les formes, en chaîne CSS `"#rrvvbb"` pour les textes.

### Les entrées

- **Souris et doigts, même code** : `objet.setInteractive()`, puis `objet.on("pointerup", ...)`. Phaser
  appelle « pointer » aussi bien la souris qu'un doigt.
- **Clavier** : `this.input.keyboard.on("keydown-LEFT", ...)` pour réagir à un appui. Pour une
  conduite, on préférera *regarder* l'état des touches à chaque image dans `update()` :
  `curseurs.left.isDown`. On le verra avec la voiture.
- **Manette** : `this.input.gamepad.on("down", (manette, bouton) => ...)`.
- Phaser retire tout seul les écouteurs de `this.input` quand la scène s'arrête. Pour ceux qu'on branche
  ailleurs, on fait le ménage nous-mêmes à l'événement `SHUTDOWN` de la scène. Le Hub le fait pour la
  mise à jour automatique.

### Les tweens

```ts
this.tweens.add({ targets: carte.boite, scale: 1.08, duration: 140, ease: "Back.Out" });
```

« Fais aller `scale` jusqu'à 1.08 en 140 ms, avec une courbe qui dépasse un peu puis revient. »
N'importe quelle propriété numérique s'anime : `x`, `y`, `angle`, `alpha`, `scale`...
Options utiles : `yoyo: true` (aller-retour), `repeat: -1` (pour toujours), `delay`, `onComplete`.
Les courbes : https://phaser.io/examples (cherche « ease »).

### Les particules et la caméra

- `this.add.particles(x, y, "etincelle", { ... })` : un émetteur. Chaque réglage peut être une valeur,
  un intervalle `{ min, max }` ou une évolution `{ start, end }` sur la vie de la particule.
- `this.cameras.main` est la caméra de la scène : `fadeIn`, `fadeOut`, `shake`, `flash`, `zoomTo`,
  et `startFollow(objet)` pour suivre une voiture.

### Exercices

Le serveur tourne (`npm run dev`), tu modifies, tu sauvegardes, tu regardes.

1. **Un sixième jeu** : ajoute une fiche dans `catalogue.ts`. Les cartes se rangent toutes seules.
   Passe ensuite `PAR_RANGEE` à 4.
2. **Le titre qui respire** : dans `creerDecor`, garde le texte du titre dans une variable, puis
   ajoute un tween sur son `scale` avec `yoyo: true` et `repeat: -1`. Essaie `ease: "Sine.InOut"`.
3. **Des cartes qui rebondissent** : dans `choisir`, remplace `"Back.Out"` par `"Elastic.Out"` et
   mets `duration` à 600.
4. **Une arrivée en cascade** : dans `creerCartes`, fais partir chaque carte de `y + 300` avec
   `alpha` à 0, puis amène-la à sa place avec un tween. Indice : `delay: i * 80`.
5. **Un feu d'artifice** : quand on lance une carte « bientôt », fais exploser des étincelles de sa
   couleur. Indice : un émetteur créé avec `emitting: false`, puis `emetteur.explode(30, x, y)`.

---

## Leçon 2 : la course de voitures

> **Depuis, la course a changé.** La course de voitures et la course des licornes sont devenues un seul
> jeu, `src/jeux/course/`, avec un thème « voitures » et un thème « licornes » (voir `CLAUDE.md`). Les
> véhicules n'utilisent plus la physique Arcade : leur conduite est calculée à la main (`Coureur.ts`),
> comme la bousculade ci-dessous, ce qui évite le piège du sprite qui a un pas de retard sur son corps.
> Cette leçon décrit la première version, qu'on retrouve dans l'historique git (`git show f937414`) :
> elle reste une bonne visite de la physique Arcade, des caméras et des scènes en parallèle.

Le code était dans `src/jeux/voiture/`. Commence par `index.ts` : c'est la liste des scènes du jeu.
`Chargement` démarre, puis viennent `Menu`, `Course`, avec `Tableau` et `Arrivee` par-dessus.

### Ce qui n'est pas du Phaser

`circuits.ts` et les calculs de conduite dans `Voiture.ts` viennent presque tels quels de l'ancien jeu :
la trace, les tours, le pilote de l'ordinateur, le dérapage. **Phaser affiche, fait bouger et détecte
les contacts. Ce qu'est un tour de circuit ou un dérapage, c'est notre jeu qui le sait.** Garder ces
calculs à part (sans `this.add`, sans scène) les rend faciles à lire et à tester.

Un exemple de règle de jeu qui simplifie le code : la **barrière de pneus**, 75 pixels après le bord
de la route (empruntée à la Course des licornes). Sans elle, on pouvait couper par l'herbe, et il
fallait une règle compliquée pour ne pas compter le raccourci ; elle faisait tomber les tours plusieurs
secondes après la ligne. Avec elle, le chemin parcouru, c'est simplement le point de la route le plus
proche, et un tour tombe pile sur la ligne (`suivreLaTrace` dans `Voiture.ts`).

### `update()` et les touches tenues

Dans le Hub, on réagissait à un *appui* (`keydown-LEFT`). Pour conduire, on veut savoir à chaque image
si la touche est *enfoncée* :

```ts
this.touches = this.input.keyboard.addKeys({ haut: "UP", gauche: "LEFT", ... });
// puis, dans update() :
e.avancer = this.touches.haut.isDown;
```

`update(temps, delta)` est appelée à chaque image ; `delta` est le temps écoulé depuis la précédente, en
millisecondes. Tout ce qui bouge se multiplie par ce temps (`ACCELERATION * duree`) : le jeu va à la
même vitesse sur un écran à 60 images par seconde et sur un écran à 240.

La manette se lit de la même façon : `this.input.gamepad.pad1`, avec `pad.A`, `pad.leftStick.x`,
`pad.R2`... (voir `lireLesEntrees` dans `Course.ts`).

**Un défaut de Phaser 4.2** : si l'appui et le relâchement d'une touche tombent dans la même image,
Phaser envoie l'appui deux fois. C'est pour ça que les menus utilisent `surTouche()`
(`src/socle/clavier.ts`) au lieu de `keyboard.on("keydown-...")`. On l'a trouvé grâce aux tests
automatiques : un robot tape bien plus vite qu'un humain.

### La physique Arcade

- Une scène qui en a besoin la demande : `super({ key: "voiture-course", physics: { default: "arcade" } })`.
- `Voiture` **hérite** de `Phaser.Physics.Arcade.Sprite` : c'est une image qui a un **corps**
  (`this.body`). Un objet créé avec `new` n'est encore nulle part : il faut `scene.add.existing(this)`
  pour l'afficher, et `scene.physics.add.existing(this)` pour lui donner un corps.
- Le corps a une **vitesse** (`body.velocity`), et la physique déplace l'image toute seule à chaque pas.
  Notre conduite ne touche jamais à `x` et `y` : elle calcule la nouvelle vitesse, et c'est tout.
- `body.setCircle(rayon)` donne un corps rond. Un corps Arcade ne tourne jamais (c'est un rond ou un
  rectangle droit) : pour une voiture qui tourne, le rond est le bon choix.
- `setCollideWorldBounds(true)` : la voiture s'arrête au bord du monde (`physics.world.setBounds`).
- **`collider` ou `overlap`** : un `collider` empêche deux corps de se traverser et les fait rebondir. Un
  `overlap` prévient seulement qu'ils se touchent, et on décide de ce qui se passe. Les bidons, les
  flèches et les flaques sont des `overlap` sur des corps **statiques** (`staticGroup`), qui ne bougent
  jamais.

Une histoire vraie : au début, les voitures se rentraient dedans avec un `collider`. Résultat, selon le
rebond choisi, deux voitures restaient collées et roulaient à moitié moins vite, ou bien elles
rebondissaient comme des boules de billard. La bousculade de l'ancien jeu (on les écarte, et elles
échangent la vitesse qui les rapproche) était bien réglée : on l'a gardée, branchée sur un `overlap`
(`bousculer` dans `Course.ts`). **Les outils de Phaser sont là pour servir le jeu, pas l'inverse.**

### Le temps

`this.time.delayedCall(5000, () => ...)` : dans 5 secondes, fais ceci. Un bidon ramassé disparaît
(`disableBody`) et une minuterie le fait revenir (`enableBody`). Le compte à rebours est un
`this.time.addEvent({ delay: 1000, repeat: 2, callback })`. Contrairement à `setTimeout`, ces minuteries
s'arrêtent quand la scène est en pause, et disparaissent avec elle.

### La caméra

```ts
camera.setBounds(0, 0, largeur, hauteur);          // elle ne montre jamais l'extérieur du monde
camera.startFollow(this.joueur, true, 0.12, 0.12); // elle suit, avec un peu de retard (lerp)
```

Dans `update()`, deux petits plus : `followOffset` décale la caméra pour regarder **devant** la
voiture, et `setZoom` recule un peu la vue quand elle va vite. `Phaser.Math.Linear(a, b, 0.05)` fait
glisser une valeur vers une autre, un peu à chaque image : c'est ce qui rend ces mouvements doux.

### Des scènes en parallèle

La course lance son tableau de bord par-dessus : `this.scene.launch("voiture-tableau")`. Chaque scène a
sa caméra : celle de la course suit la voiture, celle du tableau ne bouge pas. Les compteurs restent
donc en place à l'écran.

Pour se parler :
- une scène retrouve une autre par son nom : `this.scene.get("voiture-course")` ;
- une scène **émet** un événement (`this.events.emit("compte", 2)`), une autre **l'écoute**
  (`course.events.on("compte", ...)`). Les écouteurs posés sur une *autre* scène ne disparaissent pas
  tout seuls : on les retire à l'événement `SHUTDOWN` (voir `Tableau.ts`) ;
- à l'arrivée, la course se met en pause (`this.physics.pause()`) et lance `voiture-arrivee` par-dessus.

L'ordre d'affichage des scènes est celui de la liste dans `index.ts` : la dernière est dessus.

### Les textures

- `Graphics` puis `generateTexture("cle", l, h)` : on dessine une fois et on en fait une image (la
  voiture, le bidon, la flèche...).
- **CanvasTexture** : pour la piste, on avait besoin de routes courbes, épaisses et en pointillés, ce que
  `Graphics` ne sait pas faire. On dessine avec le canvas 2D du navigateur (comme dans l'ancien jeu)
  dans une texture Phaser, puis `texture.refresh()`.
- **RenderTexture** : une image sur laquelle on peut dessiner pendant le jeu. Les marques de pneus y sont
  tamponnées (`stamp`). En Phaser 4, on finit par `render()` pour que les tampons apparaissent.
- **La teinte, en Phaser 4** : `setTint(couleur)` multiplie les couleurs. Pour le fantôme tout blanc, on
  remplace les couleurs : `setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)`.

### Particules et sons

- Chaque voiture a son propre émetteur de flammes, qu'on allume (`start()`) et éteint (`stop()`) avec
  la nitro. Son angle est calculé à la naissance de chaque flamme : `angle: { onEmit: () => ... }`.
- La fumée et les gerbes sont partagées : `emitParticleAt(x, y)` pour une particule, `explode(12, x, y)`
  pour une gerbe.
- Les sons se chargent dans `preload` (`this.load.audio`), puis `this.sound.add(cle, { loop: true })`.
  `moteur.setRate(...)` le rend plus aigu quand on accélère. Un son n'appartient pas à la scène : on le
  détruit nous-mêmes à son `SHUTDOWN`.

### Un piège : les fondus

`camera.fadeOut()` **ne fait rien** si un autre fondu est déjà en cours, par exemple le `fadeIn` de
l'arrivée sur l'écran. Celui qui appuie très vite reste alors bloqué. `fonduPuis()` (dans
`src/socle/retour.ts`) force le fondu : `camera.fade(200, 0, 0, 0, true)`.

### Les tests

`npm test` lance les tests de `tests/` : Playwright ouvre Edge, joue au clavier et au doigt, et
vérifie l'état du jeu à travers `window.jeu`. Ce `window.jeu` n'existe qu'en développement
(`npm run dev`). Ouvre la console du navigateur (F12) et essaie :

```js
jeu.scene.getScenes(true)                                  // les scènes actives
jeu.scene.getScene("voiture-course").joueur.nitro = 3      // de la triche, pour essayer la nitro
```

### Exercices

1. **Les réglages** : dans `reglages.ts`, change `VIRAGE`, `ADHERENCE` ou `VITESSE_NITRO`, et sens la
   différence au volant. Mets `arcade: { debug: true }` dans la scène `Course` : la physique dessine
   les corps et leurs vitesses.
2. **Ça secoue** : quand une voiture du joueur glisse sur une flaque, fais trembler la caméra.
   Indice : `this.cameras.main.shake(200, 0.01)`, dans l'`overlap` des huiles.
3. **La poussière** : dans l'herbe, la fumée devrait être marron. Indice : `fumer` peut recevoir un
   paramètre de plus, et `emitParticleAt` accepte un nombre de particules ; regarde `particleTint`.
4. **Le compteur de vitesse** : dans le tableau de bord, affiche la vitesse du joueur en km/h
   (`joueur.vitesse / 4`, par exemple). Un texte de plus, mis à jour dans `update()`.
5. **Un nouveau circuit** : ajoute un modèle dans `CIRCUITS`. Le menu, la piste, la trace et le pilote
   de l'ordinateur suivent tout seuls.

---

*Leçon 3 : le Grand Prix (passer des données d'une scène à l'autre), la course à deux (deux caméras sur
le même écran) et l'éditeur de circuit (glisser des points au doigt).*
