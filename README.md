# L'Arcade 🕹️

Nos mini jeux, dans le navigateur et sur téléphone (installable, jouable sans réseau).
Fait avec [Phaser 4](https://phaser.io), TypeScript et Vite.

## Commandes

```sh
npm install        # une fois, ou après un changement de package.json
npm run dev        # le serveur de dev : http://localhost:5173, recharge à chaque sauvegarde
npm run check      # vérifier les types
npm run build      # le site final dans dist/
npm run preview    # essayer dist/ comme en ligne (avec le service worker)
npm test           # les tests : Playwright joue dans Edge, au clavier et au doigt
```

`npm run dev` affiche aussi une adresse `Network` : ouverte sur un téléphone branché au même Wi-Fi,
elle permet d'essayer le jeu au doigt pendant qu'on le code.

## Publier

Un push sur `main` suffit : GitHub construit et publie (voir `.github/workflows/publier.yml`).
Les téléphones récupèrent la nouvelle version tout seuls, au retour dans le menu.

## Le code

| Où | Quoi |
|---|---|
| `src/main.ts` | Le jeu Phaser : taille, mise à l'échelle, entrées, scènes de départ |
| `src/scenes/` | Les scènes de l'Arcade : `Demarrage`, puis le `Hub` (le menu des jeux) |
| `src/jeux/catalogue.ts` | La liste des jeux ; chacun vit dans `src/jeux/<cle>/` et n'est chargé qu'à son lancement |
| `src/socle/` | Ce que tous les jeux partagent : style, clavier, transitions, sauvegardes, tactile, largeur, mise à jour |
| `src/jeux/voiture/` | La course de voitures : circuits, voiture, et ses scènes (menu, course, tableau de bord, arrivée) |
| `tests/` | Les tests Playwright ; un test raté garde sa trace : `npx playwright show-trace <chemin>` |
| `public/` | Copié tel quel : icônes, sons |
| `docs/CARNET-PHASER.md` | Apprendre Phaser en suivant la construction de l'Arcade |

## Ajouter un jeu

1. Un dossier `src/jeux/<cle>/` avec ses scènes, et un `index.ts` qui exporte par défaut `{ scenes, premiere }`
   (voir `ModuleDeJeu` dans `catalogue.ts`).
2. Dans `catalogue.ts`, la fiche du jeu avec `charger: () => import("./<cle>").then((module) => module.default)`.
