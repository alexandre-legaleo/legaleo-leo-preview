# À recréer manuellement dans Webflow

**Mise à jour stratégie** : codetocanvas.io n'est plus listé sur le
marketplace Webflow (plus de fiche `webflow.com/apps/detail/...`, disparition
non annoncée publiquement) — remplacé par **HTMLtoflow**, qui fait le même
import HTML/CSS → éléments Webflow natifs.

HTMLtoflow ne transfère que le HTML/CSS statique. Tout ce qui est piloté par
`js/*.js` (animations Lottie, interactions au clic, scroll) est présent dans
la preview locale mais **disparaît à l'import** — à recréer à la main via les
Interactions Webflow (IX2) et des embeds Lottie natifs, **sauf pour les blocs
convertis en Code Components React** (voir `code-components/`), dont la
logique JS est native au composant et n'a donc plus besoin d'être recréée en
IX2 une fois le composant déposé sur le canvas à la place du HTML statique.
Bloc 03 (éditeur) est déjà converti et poussé ; sa section plus bas ne
s'applique donc plus si vous utilisez le composant plutôt que le HTML statique.

Liste tenue à jour au fil des sessions. Dernière mise à jour : refonte
complète des mockups 01 à 04 (bloc 02 chat en flux continu sans fin, bloc 03
éditeur avec révélation/retrait du diff, bloc 04 avocats avec pool de clauses
tiré au hasard, bloc 01 avec badge "Leo réfléchit"), bandeau de réassurance du
hero (`.lb-heroreassure`), transitions de hauteur douces génériques, et
passage du bloc 03 en Code Component React.

## 1. Animations Leo (Lottie) — tous les badges `.lb-fanim` / `<div id="la-...">`

Chaque badge est un `<div>` vide en HTML ; l'animation est injectée par
`js/anims.js` via `lottie.loadAnimation`. Rien ne s'affichera après import
tant que chaque badge n'a pas un embed Lottie natif Webflow pointant vers le
bon fichier (dossier `/leo-anims`).

Pour `la-onb` / `la-ed` / `la-av` (blocs 01, 03, 04) : le badge est positionné
en absolu **dans `.lb-fvisual`**, coin haut-droit (haut-gauche dans
`.lb-feature-rev`, bloc 04) — voir `.lb-fanim` dans `css/journey.css`.
**`la-q` (bloc 02) fait exception** : il a été déplacé **à l'intérieur du
mockup** (`.lb-chatmock`, juste au-dessus des bulles de suggestion), en flux
normal — ce n'est plus un badge flottant en coin de `.lb-fvisual` (voir
section 4 et 8).

Plusieurs mockups ont maintenant, en plus du badge de coin, des **mini badges
par instance** créés dynamiquement en JS avec un id unique à chaque fois
(`la-q-1`, `la-q-2`, ...) — un embed Lottie statique ne suffit pas pour
ceux-là, il faut une interaction qui (re)joue l'animation sur le badge
concerné à chaque nouvelle instance. Voir détail par bloc plus bas.

| Badge (id) | Fichier idle en boucle | Déclenché par |
|---|---|---|
| `la-hero` | séquence : idle-in → idle(×2) → idle-out → fetch-external(×2) → generating-in → generating(×2) → check → check-out | auto, en boucle infinie, pas de clic |
| `la-onb` (bloc 01) | `sign-loop.json` | clic "Utiliser la version Leo" / "Garder ma version" → `check.json` (1x) → retour `sign-loop.json` (inchangé) |
| `la-onb-thinking` (nouveau, mini badge bloc 01) | masqué par défaut (`.lb-fm-thinking`, opacity 0) | juste avant chaque ouverture de `#lb-fm-leo-wrap` : `generating.json` (loop) pendant ~1100ms, puis masqué (fade out) |
| `la-fm-check` (mini badge bloc 01) | masqué par défaut (`.lb-minicheck`) | clic choix → `check.json` (1x), badge visible ~400ms puis se referme |
| `la-q` (bloc 02, chat) | `idle.json` (changé — était `scan.json`) | plus aucun swap après le 1er clic : le badge de coin (`#lb-chat-fanim`) se masque en permanence dès la 1ère question posée (voir section 4) |
| `la-q-N` (nouveau, mini badge **par réponse**, bloc 02) | un id unique généré à chaque nouvelle réponse (`la-q-1`, `la-q-2`, ...) | `generating-in.json` (1x) → `generating.json` (loop) pendant toute la réflexion **et** tout le streaming du texte (plus de check/scan en cours de route) → une fois le message terminé, le badge fade out (opacity), pas de `check.json` |
| `la-ed` (bloc 03, éditeur) | `annotate.json` | clic "Recommander une amélioration" (id renommé, était `#lb-ed-apply` → `#lb-ed-recommend`) → `check.json` (1x) → retour `annotate.json` (déclenché seulement en fin de révélation, pas au clic de retrait) |
| `la-ed-check` (mini badge bloc 03) | masqué par défaut (`.lb-ed-minicheck`) | même clic (sens "révéler" seulement) → `generating.json` (loop, changé — était un flash `check.json`) pendant toute la révélation, puis masqué (fade), pas de `check.json` |
| `la-av` (bloc 04, avocats) | `hammer.json` | **2 déclencheurs** : "Proposer l'évolution" (`#lb-av-propose`, inchangé : `check.json` puis retour `hammer.json`) **et** "Relancer l'analyse" (`#lb-av-relaunch`, nouveau, jusque-là inactif : `scan.json` (loop) pendant le scan, puis `check.json` (1x) → retour `hammer.json`) |
| `la-av-check` (mini badge bloc 04) | masqué par défaut (`.lb-av-minicheck`) | "Proposer" → flash `check.json` (inchangé) ; "Relancer" (nouveau) → `generating.json` (loop) pendant le scan, puis masqué (fade), pas de `check.json` |
| `la-si` / `la-sf` / `la-sg` / `la-sc` (section transparence) | `idle.json` / `fetch-external.json` / `generating.json` / `check.json` | auto, chacun boucle sur son fichier, pas de clic |
| `la-fin` (CTA final) | `scale.json` | auto, en boucle, pas de clic |

Le mapping fichier ↔ badge a été choisi par déduction des noms de fichiers
(voir commentaire en tête de `js/anims.js`) — à vérifier visuellement une
fois les embeds en place, corriger si un visuel ne correspond pas à l'intention.

## 2. Accordéon FAQ

Clic sur `.lb-faqq` → toggle classe `is-open` sur `.lb-faqitem` (+ mise à jour
`aria-expanded`). Recréable simplement avec une interaction "Toggle class" au
clic, ou le composant Accordion natif de Webflow.

## 3. Bloc 01 — Onboarding, démo cyclique (`js/onboarding-demo.js`)

4 scénarios qui tournent en boucle (`LB_FM_SCENARIOS`). Au clic sur
"Utiliser la version Leo" / "Garder ma version" :
1. le champ correspondant reçoit `.is-selected` (coche visuelle),
2. le mini badge check flashe (`la-fm-check`),
3. l'anim Leo `la-onb` joue `check.json`,
4. ~500ms après, le panneau fade out/in et bascule sur le scénario suivant
   (question, champ utilisateur, champ Leo tous remplacés), boutons
   réactivés.

**Nouveau : badge "Leo réfléchit" avant la rédaction.** Juste avant que le
champ `#lb-fm-leo-wrap` ne s'ouvre sur le texte rédigé par Leo, un mini badge
(`#lb-fm-thinking`, à l'intérieur du wrap, sibling de `#lb-fm-leo` — jamais
dedans) apparaît avec `generating.json` en boucle. Le wrap s'ouvre d'abord à
une petite hauteur fixe (40px) pour rendre le badge visible malgré son
`overflow: clip` en position repliée, tient ~1100ms, puis le badge fade out et
le wrap continue son ouverture jusqu'à la hauteur du texte final — une seule
transition de hauteur continue (40px → hauteur finale), pas deux séparées.
Équivalent Webflow : interaction "Move/Resize" en deux temps sur le wrap
(petite hauteur, pause, hauteur finale) + fade du badge, ou simplifier en un
seul temps si la fidélité totale coûte trop cher.

Séquence globale assez longue à recréer 1:1 en IX2 (fade + timed state change
+ Lottie + boucle sur 4 scénarios) — envisager de simplifier si la fidélité
totale coûte trop cher à monter à la main (ex. un seul scénario statique +
juste l'effet "check" au clic, sans la rotation automatique).

## 4. Bloc 02 — Chat conversationnel (refonte complète)

Le mockup n'est plus un slot unique question/réponse remplacé à chaque clic :
c'est maintenant un **flux qui s'accumule sans fin**, comme une vraie appli de
chat.

- **Structure** : `#lb-chat-log` (vide au départ) accueille une paire
  `.lb-buser` (question) + `.lb-bleo` (réponse) à chaque clic, ajoutée **en
  bas** — jamais de remplacement de la précédente. En dessous,
  `#lb-chat-bubbles` (les bulles de suggestion cliquables) et, tout en haut de
  ce groupe, le badge Leo unique `#lb-chat-fanim` (`.lb-fanim.lb-fanim--inline`,
  déplacé à l'intérieur du mockup, plus un badge flottant de coin — voir
  sections 1 et 8).
- **Pool de questions sans fin** : les 3 bulles de départ vivent dans un
  `<template id="lb-chat-bubbles-template">`. Une bulle cliquée est retirée du
  pool ; une fois les 3 épuisées, le pool est **régénéré à l'identique** —
  boucle infinie. Équivalent Webflow : dupliquer/réafficher les 3 boutons
  plutôt que de vraiment les "retirer".
- **Défilement** : `#lb-chat-log` a une hauteur plafonnée (`.lb-fvisual--chat`
  fait 400px fixes) et un scroll **désactivé pour l'utilisateur**
  (`overflow-y: hidden`) mais piloté par JS (`scrollTop` + `scroll-behavior:
  smooth`) pour toujours révéler le dernier message ajouté. **Pas
  d'équivalent Webflow natif** pour un scroll interne piloté par script sans
  barre visible — au mieux, utiliser un vrai scroll natif (barre visible ou
  stylée) sur ce conteneur en acceptant que l'utilisateur puisse scroller à la
  main, ou accepter un défilement moins fluide (jump direct en bas à chaque
  nouveau message via une ancre).
- **Séquence au clic sur une bulle** :
  a. le groupe de bulles se masque, la bulle cliquée est retirée du pool ;
  b. la question rejoint le bas du flux (`.lb-buser`, avec un léger fade +
     slide d'entrée, `@keyframes lb-msg-in`) ;
  c. une bulle `.lb-bleo` est ajoutée juste après, avec son propre mini badge
     Leo (`.lb-bleo-icon`, id Lottie unique par message — voir section 1) et
     un skeleton à 3 barres shimmer pendant ~950ms (le CSS du shimmer,
     `@keyframes lb-shimmer`, se transfère automatiquement — seuls le
     **show/hide** et le **timing** sont à recréer) ;
  d. la réponse s'affiche ensuite mot par mot (~45ms/mot) — le mini badge
     joue `generating.json` en boucle pendant **toute** cette phase (plus de
     bascule vers un autre fichier en cours de route) ;
  e. la pastille sources (`.lb-srcpill`, maintenant sur sa propre ligne, plus
     un pill en ligne avec le texte) fade in une fois le streaming terminé,
     puis le mini badge de ce message fade out (il a fini son rôle) ;
  f. les bulles restantes réapparaissent sous le flux (ou un pool régénéré si
     épuisé), et le scroll recale sur le nouveau bas du flux.
- **Point d'attention inchangé** : si on clique une nouvelle question pendant
  qu'une autre "streame" encore, il faut annuler l'ancienne séquence avant de
  démarrer la nouvelle. En JS c'est géré par un compteur de génération
  (`renderToken`) — en Webflow, viser au minimum à interrompre/relancer
  proprement l'interaction en cours (kill actions IX2) plutôt que de les
  empiler. Ceci dit, comme les bulles se masquent pendant qu'une réponse est
  en cours, ce cas ne devrait plus pouvoir se produire par un clic normal.

## 5. Bloc 03 — Éditeur (refonte complète)

Le mockup ne montre plus le diff en permanence : il démarre sur un **texte
basique** (la clause d'origine, sans diff visible) et le bouton — renommé
**"Recommander une amélioration"** (`#lb-ed-recommend`, était "Appliquer au
contrat" / `#lb-ed-apply`) — est maintenant un **toggle** :

- **Clic 1 (état "avant")** : le texte du bouton change **instantanément** en
  "Retirer la recommandation" ; le mot concerné (`.lb-del`) se barre avec un
  trait qui se dessine (`::after` + `transform: scaleX`, ~350ms) plutôt qu'un
  `text-decoration` qui apparaît d'un coup ; puis les 3 ajouts (`.lb-add`,
  masqués/`opacity: 0` par défaut) apparaissent en fondu l'un après l'autre
  (~150ms d'écart). Le mini badge (`#lb-ed-minicheck`) joue `generating.json`
  en boucle pendant toute la révélation, puis fade out (plus de flash
  `check.json`) ; `la-ed` joue `check.json` puis revient sur `annotate.json`
  une fois la révélation terminée.
- **Clic 2 (état "après")** : le texte du bouton redevient **instantanément**
  "Recommander une amélioration" ; animation inverse — les ajouts s'effacent
  en fondu (du dernier au premier), puis le mot retiré redevient du texte
  normal (le trait se "défait").
- L'état est déterminé en lisant si `.lb-del` porte la classe `is-struck` —
  pas de variable séparée à synchroniser.
- La légende "ajouté/retiré" (`#lb-ed-legend`) reste **masquée en
  permanence** (`hidden`) — elle n'est plus affichée du tout, quel que soit
  l'état. Rien à recréer pour elle en Webflow.
- La hauteur de `.lb-reco` change entre les deux états (plus de texte affiché
  en "après") et transitionne en douceur — voir section 11.

## 6. Bloc 04 — Avocats (refonte complète)

Le mockup ne montre plus 2 clauses fixes : `#lb-av-critlist` pioche **2 ou 3
clauses au hasard** parmi un pool de **9**, vivant dans un
`<template id="lb-av-crit-template">`. Les clauses affichées sont triées par
risque : élevé, puis moyen, puis faible (3 styles maintenant : `.lb-risk`
rouge, `.lb-risk--medium` orange, `.lb-risk--low` vert — avant il n'y avait
que le rouge).

- **Au chargement** : un tirage aléatoire de 2-3 clauses s'affiche déjà,
  avec une entrée en fondu + léger slide décalée (`@keyframes lb-crit-in`).
- **"Relancer l'analyse"** (`#lb-av-relaunch`, jusque-là présent dans le HTML
  mais inactif) est maintenant câblé :
  a. `la-av` passe sur `scan.json` (loop), le mini badge
     (`#lb-av-minicheck`) joue `generating.json` (loop) ;
  b. les cartes actuelles sont remplacées par 2-3 skeletons qui pulsent
     (`.lb-crit-skeleton`, réutilise le `@keyframes lb-shimmer` existant)
     pendant ~800ms ;
  c. un nouveau tirage aléatoire de 2-3 clauses (triées par risque) remplace
     les skeletons, avec la même entrée en fondu décalée ;
  d. `la-av` joue `check.json` puis revient sur `hammer.json`, le mini badge
     fade out.
- "Proposer l'évolution" (`#lb-av-propose`) est **inchangé** : `check.json`
  puis retour `hammer.json` + flash du mini badge.
- La hauteur de `.lb-formmock` change selon qu'il y a 2 ou 3 clauses
  affichées, et transitionne en douceur — voir section 11.

## 7. Parallax scroll des `.lb-fvisual` (blocs 01 à 04) — DÉSACTIVÉ pour l'instant

Le code est en place (`PARALLAX_ENABLED = false` dans `js/main.js`) mais
coupé dans la preview actuelle — le rendu sur `.lb-fvisual` a été jugé
bizarre. **Rien à faire côté Webflow tant que ça reste désactivé.**

Pour info si ça revient (sur `.lb-fvisual` ou sur d'autres éléments) : chaque
élément ciblé se décale verticalement (`translateY`, ±60px) selon sa position
dans le viewport en scrollant, désactivé sous 780px et si
`prefers-reduced-motion: reduce`. Équivalent Webflow : interaction
**"Scroll into View" → Move (Y)**, décalage début/fin ±60px, désactivée sur
le breakpoint mobile.

## 8. Icônes flottantes `.lb-ficon` autour des mockups (blocs 01, 03, 04)

3 badges en coin par `.lb-fvisual` **pour les blocs 01, 03 et 04** : le badge
Lottie `.lb-fanim` (voir point 1, coin haut-extérieur) + 2 icônes purement
décoratives `.lb-ficon-b`/`-c`, une par sujet du bloc. Les 3 portent la classe
`.lb-ficon` et partagent le même parallax de scroll ; seules `-b`/`-c` ont en
plus le flottement continu.

**Bloc 02 fait exception** : `.lb-fanim`/`la-q` a été déplacé à l'intérieur du
mockup (voir section 4) et n'est plus un badge de coin — seules `.lb-ficon-b`
et `.lb-ficon-c` restent en coin de son `.lb-fvisual`.

- **Flottement continu** (`@keyframes lb-ficon-float` sur `.lb-ficon-inner`,
  dans `css/journey.css`, **pas** sur `.lb-fanim` — un seul mouvement continu
  à la fois sur son badge, déjà porté par son Lottie interne) : CSS pur, **se
  transfère automatiquement** avec le reste du CSS statique — rien à recréer
  en Webflow, comme `lb-shimmer`.
- **Parallax de scroll** (sur `.lb-ficon`, dans `js/main.js`) : ACTIVÉ, à la
  différence du parallax `.lb-fvisual` du point 7. Chaque badge se décale
  verticalement (`translateY`, ±26px × sa profondeur `data-depth`) selon sa
  position dans le viewport ; désactivé sous 900px et si
  `prefers-reduced-motion: reduce`. Équivalent Webflow : interaction
  **"Scroll into View" → Move (Y)** posée sur chaque `.lb-ficon`, avec un
  décalage début/fin proportionnel à son `data-depth` (`.lb-fanim` ×0.85,
  `-b` ×1.15, `-c` ×0.9, d'un décalage de base ±26px), désactivée sur le
  breakpoint mobile/tablette.
- `.lb-ficon-b`/`-c` masquées en dessous de 900px (`display: none`) : pas
  assez de marge pour déborder de `.lb-fvisual` sans risquer un scroll
  horizontal une fois le bloc repassé en colonne. `.lb-fanim` reste affiché
  (c'est un badge de statut, pas de la pure déco) mais rentre dans la carte
  (offsets positifs 14px) au lieu de déborder de son bord — sauf bloc 02, où
  il est déjà en flux normal (voir section 4).

## 9. Hero — faux champ de prompt animé (`.lb-heroprompt`)

Sous le lede du hero, à côté du badge Lottie `la-hero` (inchangé) : un champ
qui *ressemble* à un input de prompt mais n'en est pas un (pas de `<input>`,
`aria-hidden="true"` sur tout le bloc — purement démonstratif, aucune saisie
possible). Boucle "machine à écrire" en JS (`js/main.js`) sur 5 exemples de
questions de droit de la franchise (certaines reprises du bloc 02, pour la
cohérence) :

1. écrit caractère par caractère (~32ms/caractère) dans `#lb-heroprompt-typed`,
2. pause ~1.9s une fois la phrase complète,
3. efface caractère par caractère (~14ms/caractère),
4. passe à la question suivante (boucle infinie sur le tableau `HERO_PROMPTS`).

Le curseur clignotant (`.lb-heroprompt-cursor`) est en CSS pur
(`@keyframes lb-cursor-blink`) et **se transfère automatiquement** — seule la
boucle écrit/efface JS est à recréer. Si `prefers-reduced-motion: reduce`,
la première question s'affiche statiquement (pas de boucle) : reproduire ce
fallback en Webflow si l'interaction est conditionnée au même media query,
sinon au minimum garder une phrase fixe par défaut.

Équivalent Webflow : pas d'interaction IX2 native pour un effet caractère par
caractère — le plus simple est probablement une séquence de **Text
animations** (ou plusieurs éléments texte en fade/slide successifs) plutôt
qu'une réplique exacte du typewriter ; à arbitrer selon le budget de fidélité.

## 10. Hero — bandeau de réassurance (`.lb-heroreassure`)

Sous les CTA du hero, ancré en bas du bloc (grâce à `margin: auto 0` sur
`.lb-wrap`, qui le centre dans l'espace disponible au-dessus) : 3 mini items
texte + icône (`.lb-heroreassure-icon--external-link` / `--buddy` /
`--french`, en `background-image`). **Purement CSS/HTML, aucun JS** — se
transfère automatiquement à l'import, rien à recréer.

(Le bandeau plus large `.lb-reassure`, avec ses 4 icônes rondes, est présent
dans le HTML mais désactivé — `display: none` dans `css/hero.css` — laissé en
l'état intentionnellement.)

## 11. Transitions de hauteur douces (générique, blocs 02 à 04)

Un utilitaire dans `js/main.js` (`ResizeObserver` sur `.lb-formmock` et
`.lb-reco`, hors `#lb-fm-panel` et `.lb-chatmock`) anime en douceur la
hauteur de ces conteneurs quand leur contenu change de taille (bloc 03 :
révélation/retrait du diff ; bloc 04 : 2 ↔ 3 clauses affichées). CSS ne sait
pas transitionner `height: auto` nativement : le script mesure avant/après et
anime entre deux valeurs en px.

**Webflow n'a pas d'équivalent natif** : IX2 n'a pas de déclencheur "au
redimensionnement du contenu". Options à arbitrer :
- accepter un changement de hauteur instantané (pas de transition) pour ces
  deux mockups une fois importés — c'est la dégradation la plus simple ;
- ou dupliquer manuellement une interaction "Resize" sur les mêmes clics qui
  déclenchent déjà d'autres animations (le clic "Recommander une
  amélioration" du bloc 03, le clic "Relancer l'analyse" du bloc 04) — mais
  ça ne couvrira que ces déclencheurs-là, pas un changement de taille pour
  une autre raison.
