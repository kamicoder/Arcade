# Tamago : les règles

Un animal virtuel qui vit **pendant qu'on joue avec lui**, et dort quand on s'en va. La mécanique vient
du vrai Tamagotchi (1996), ramenée à l'échelle d'une partie : le but est de s'amuser, pas d'être obligé
d'ouvrir le jeu pour le nourrir. L'âme vient de TAMAGO-XTREME 3000 : les lignées, les cacas qui
parlent, les événements absurdes. Les chiffres sont dans `reglages.ts`, à régler en jouant.

## 1. Le temps

- **Il ne vit que quand son écran est affiché.** Le jeu fermé, un autre jeu de l'Arcade, un autre
  onglet, le téléphone verrouillé : tout est en pause, rien ne baisse, rien ne se perd. Le carnet et le
  petit jeu arrêtent aussi sa vie pendant qu'ils sont ouverts.
- **Partir, c'est le coucher** : il s'endort (💤, l'écran de la console s'éteint), dort pendant ton
  absence, et te dit bonjour à ton retour.
- **Il grandit en temps de jeu** : 1 an pour 3 minutes 45 passées avec lui. Son âge se lit en mois la
  première année (« 3 mois »), puis en ans (« 1 an », « 2 ans »).
- Toutes les durées de sa vie (la faim, les crottes, les maladies, les stades...) suivent ce rythme ;
  l'éclosion, la parole et le temps pour répondre à un appel restent à la vitesse de celui qui regarde.

## 2. Ce qu'on surveille

- **Ventre** et **Moral** : 4 cœurs chacun. Il perd un cœur de Ventre toutes les 45 secondes et un cœur
  de Moral toutes les minutes (deux fois plus vite pour un bébé). Un cœur perdu clignote et tombe.
- **Discipline** : de 0 à 100 %, par pas de 25 %.
- **Poids** : chaque stade a son poids de base. Les friandises font grossir, les jeux font maigrir, mais
  jamais sous le poids de base.
- **Les crottes** : une toutes les 1 minute à 1 minute 30 (deux fois plus souvent chez un bébé), jusqu'à 4
  à l'écran.
- **Son humeur se voit sur lui** : malade, il verdit ; comblé (les cœurs pleins, rien ne traîne), des
  cœurs s'envolent de lui.

## 3. Les soins

Les touches 1 à 8 (dans l'ordre des boutons), ou ← → puis Entrée ; M coupe le son, partout dans le jeu.

| Soin | Effet |
|---|---|
| 🍙 Repas | +1 cœur de Ventre, +1 g. Il refuse quand il est plein |
| 🍬 Friandise | +1 cœur de Moral, +2 g. Il ne refuse jamais (attention au poids) |
| 🎮 Jouer | Un petit jeu de 5 manches (deviner gauche ou droite). 3 manches gagnées donnent +1 cœur de Moral. Une partie finie, même perdue, fait perdre 1 g et compte pour la lignée Joyeux (on a joué avec lui). Arrêtée en route (Échap, ✕), elle ne compte pas |
| 🧽 Nettoyer | Enlève toutes les crottes. Toucher une crotte n'enlève qu'elle (et compte pour elle seule) |
| 💊 Soigner | Une dose de médicament ; il en faut 1 à 3 selon la maladie |
| 📢 Gronder | Pendant un caprice : +25 % de discipline. Hors caprice : il est vexé, −1 cœur de Moral |
| 🤚 Caresser | Toucher le Tamago (ou ce bouton) : il rit. Compte pour la lignée Stylée, au plus une fois toutes les 7 secondes et demie |

## 4. Les appels et les oublis

Il **appelle** quand son Ventre ou son Moral tombe à zéro, ou par **caprice** : il appelle alors que tout va
bien, et il faut le gronder : tant que dure son caprice, il refuse le Repas et le Jeu. Pendant un appel, le bouton qui y répond **bat** (Repas pour la faim ; Jouer
pour le moral, ou Friandise s'il est malade ; Gronder pour un caprice).

- Un appel ignoré **1 minute** devient un **oubli**. Comme le jeu est en pause quand tu n'es pas là, un
  oubli veut toujours dire « je l'ai vu, et je n'ai rien fait ».
- **Un caprice ignoré** passe au bout d'une minute, sans oubli, mais sa discipline reste basse, et ça se verra.
- **Les caprices** : 3 quand il est enfant, 2 quand il est ado. Chacun grondé vaut 25 % de discipline, jusqu'à
  100 % : l'ado a un caprice de plus qu'il n'en faut, pour rattraper un caprice manqué enfant.
- Un caprice qui n'a pas pu venir avant la fin du stade (il appelait déjà, ou il était malade) n'est pas
  perdu : il vient au début du stade suivant.

## 5. La maladie

Il tombe malade si des crottes restent **1 minute 15**, s'il devient **trop gros** (le double de son poids
de base), ou une fois par stade au hasard, à partir de l'enfance (le bébé n'attrape que les deux
premières). Malade, il refuse de jouer, et il faut 1 à 3 doses de médicament. Une maladie laissée
**2 minutes 30** le fait partir (voir la fin).

## 6. Grandir : tes soins décident de ce qu'il devient

| Stade | Durée |
|---|---|
| Œuf | 5 tapes pour le réchauffer, puis quelques secondes |
| Bébé | 1 minute 15, jusqu'à 4 mois (toujours la même forme) |
| Enfant | 5 minutes, jusqu'à 1 an et 8 mois |
| Ado | 10 minutes, jusqu'à 4 ans et 4 mois |
| Adulte | le reste de sa vie |

Une petite barre, sous son âge, montre où il en est de son stade (les tapes, pour l'œuf), et annonce
« grandit bientôt » dans les 15 derniers pour cent du stade (« éclot bientôt » pour l'œuf). L'adulte n'en a plus.

**La lignée** vient de ton **style** : chaque soin donne des points à une lignée, et celle qui en a le plus
quand il grandit l'emporte. À égalité, celle d'avant reste ; sinon, le hasard choisit. Le carnet montre
son penchant, et dit quand il hésite entre plusieurs. Les lignées et leurs noms viennent de TAMAGO-XTREME.

| Ton style | Lignée |
|---|---|
| Beaucoup de repas | Gourmand (Pioupiou, Drakounet, DRAGOMEGA...) |
| Beaucoup de jeux | Joyeux (Bébou, Renardo, LEONALD...) |
| Les crottes nettoyées vite | Propre (Germy, Krakouille, KTHULU JR...) |
| Beaucoup de friandises et de caresses | Stylé (Glamy, Feelia, ARCHIMAGE...) |

**La variante** vient de la **qualité** des soins pendant le stade : **gentille** avec 0 à 2 oublis et assez
de discipline à la fin du stade (aucune pour le bébé, 75 % pour l'enfant, 100 % pour l'ado), sinon
**sauvage**, avec les formes « bad » de XTREME (Krakmaw, Cradox, PLAGUEBORN...). Chaque stade recalcule la
variante : on peut se rattraper.

**La forme secrète**, la légende (ETERNADRAKE, STAR LORD...), est réservée à un adulte élevé sans aucun oubli
de bout en bout, avec 100 % de discipline : il le devient à 8 ans (30 minutes).

## 7. La fin : jamais d'écran triste

Le vrai Tamagotchi meurt (un fantôme, une pierre tombale), XTREME aussi (« Ton Tamago est parti... »).
Ici, il ne meurt jamais :

- **De vieillesse**, après 45 minutes à 1 h 15 de jeu (de 12 à 20 ans) : chaque oubli lui retire un an. Il
  **repart sur sa planète**, et laisse un œuf.
- **D'abandon** : 2 minutes 30 le Ventre vide, ou malade sans soin. Il **s'enfuit** (« parti vivre chez le
  voisin, qui a des croquettes »), et un nouvel œuf attend.
- **L'album** garde le souvenir de chaque Tamago : sa forme, son nom, son âge, comment il est parti.

## 8. Le grain de folie de XTREME

- **Les crottes vivantes** bougent et parlent (« Je pue donc je suis »). Quatre crottes laissées 30 secondes
  font venir le **ROI CACA** : il faut le taper (ou le nettoyer) 5 fois.
- **Des événements absurdes**, à partir de l'enfance, un toutes les 30 secondes à 1 minute 15 : l'OVNI,
  l'aigle voleur, la fée ménage, la pluie de bonbons... Ils agissent en cœurs.
- **Des visiteurs** (le livreur de pizza, l'alien touriste, le squelette amical) et leur **carnet d'amis**.
- **La parole** : ses répliques selon son humeur, avec tout l'humour d'XTREME.
- **Le journal** de sa vie.

## 9. Les thèmes : deux habillages, les mêmes règles

- **Rétro** : un écran LCD vert à gros points, des bips, la coque en forme d'œuf. Idée pour ne pas
  dessiner 40 personnages à la main : dessiner l'emoji de chaque forme en tout petit, puis le
  transformer en points d'écran LCD.
- **Néon** : le look de TAMAGO-XTREME, avec les emojis, les couleurs fluo et les particules.

## 10. Plus tard, une fois le cœur amusant

La météo, la cuisine, le familier, l'arène, les rêves, les accessoires, la photo, d'autres lignées
(Hyperactif, Studieux), le thème Rétro. L'arbre de talents d'XTREME n'est pas repris tel quel : une vingtaine de ses talents ne
faisaient rien.

## Les choix faits

- Le thème **Néon** d'abord, avec les emojis ; le thème Rétro pourra avoir de vrais dessins.
- **Un seul Tamago** par appareil.
- Au téléphone, le jeu prend toute la largeur : la console au milieu, les boutons, plus gros, sur les côtés,
  et l'écran de la console, agrandi, dans la place qu'ils laissent en bas.
- **Pas de pause** : partir, c'est déjà le mettre en pause (il dort), et le carnet arrête aussi sa vie.
- Les vitesses et la durée de vie : celles de ces pages, à régler en jouant. Le premier rythme (1 an pour
  15 minutes) était trop lent : tout est allé quatre fois plus vite (octobre 2026).
