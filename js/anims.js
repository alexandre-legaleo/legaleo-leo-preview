// Rendu des animations Lottie de Leo (dossier /leo-anims) pour la preview locale.
// Ne transfère pas via HTMLtoflow (JS) : à recréer comme embeds Lottie natifs
// dans Webflow une fois la page importée. Mapping choisi par déduction des noms
// de fichiers — à corriger si un visuel ne correspond pas à l'intention.

const leoAnimInstances = {};

// canvas (pas svg), comme les mockups React (voir le commentaire dans
// EditorMockup.tsx) : ces animations sont faites de paths distincts qui se
// touchent, et le renderer SVG anti-aliase chacun séparément — d'où un filet
// clair entre eux, plus marqué sur Safari que sur Chrome. Le canvas rasterise
// la frame entière d'un coup, ce qui supprime ce filet. Le renderer cale seul
// son buffer sur window.devicePixelRatio, donc pas de perte de netteté.
// Le <script> d'index.html doit charger un build qui embarque ce renderer
// (lottie_canvas.min.js) : lottie_svg.min.js ne le contient pas.
const LEO_RENDERER = "canvas";

// Lottie dimensionne parfois le <canvas> qu'il crée d'après une mesure du
// conteneur faite trop tôt (icône rétrécie ou décentrée). On lui impose de
// remplir son conteneur — même correctif que dans les composants React.
function fitCanvas(container) {
  const canvas = container.querySelector("canvas");
  if (!canvas) return;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
}

// Passe les contours en cap rond (lc: 2) au chargement, plutôt que dans les
// fichiers : les .json restent des exports After Effects intacts, et un
// réexport ne réintroduit pas le défaut.
//
// Pourquoi : sous Safari, le renderer canvas laisse une encoche à l'extrémité
// des traits coupés par un trim path — et toutes ces animations en utilisent.
// Invisible sous Chrome, et géométrique : monter le dpr la dessine plus
// nettement au lieu de la masquer. Un cap rond recouvre cette extrémité.
// Conséquence assumée : le cap déborde d'une demi-épaisseur, donc les traits
// paraissent un peu plus longs qu'à l'export.
// Les joins (lj) sont laissés tels quels, l'encoche est aux bouts.
function roundCaps(node) {
  if (Array.isArray(node)) {
    node.forEach(roundCaps);
  } else if (node && typeof node === "object") {
    if (node.ty === "st" || node.ty === "gs") node.lc = 2; // st = contour uni, gs = dégradé
    Object.values(node).forEach(roundCaps);
  }
  return node;
}

// Le JSON transformé est mémorisé sous forme de texte, reparsé à chaque usage :
// lottie écrit dans l'objet qu'on lui passe, donc deux badges qui jouent le même
// fichier (idle.json par ex.) doivent avoir chacun le leur.
const leoAnimSources = new Map();

function loadAnimData(file) {
  if (!leoAnimSources.has(file)) {
    leoAnimSources.set(
      file,
      fetch(`leo-anims/${file}`)
        .then((r) => r.json())
        .then((data) => JSON.stringify(roundCaps(data)))
    );
  }
  return leoAnimSources.get(file).then(JSON.parse);
}

function simpleLoop(containerId, file) {
  swapAnim(containerId, file, { loop: true });
}

// Compteur par conteneur : le chargement étant asynchrone, un swap déclenché
// entre-temps (clic rapide) ne doit pas se faire écraser par l'arrivée tardive
// du précédent.
const leoSwapTokens = {};

// Change l'animation jouée dans un badge déjà initialisé (ex: réagir à un
// clic). Exposé sur window.leoAnims pour être piloté par d'autres scripts
// (voir js/onboarding-demo.js).
function swapAnim(containerId, file, { loop = true, onComplete } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const token = (leoSwapTokens[containerId] = (leoSwapTokens[containerId] || 0) + 1);

  loadAnimData(file).then((animationData) => {
    if (leoSwapTokens[containerId] !== token) return; // un swap plus récent a pris la main

    if (leoAnimInstances[containerId]) {
      leoAnimInstances[containerId].destroy();
    }

    const anim = lottie.loadAnimation({
      container,
      renderer: LEO_RENDERER,
      loop,
      autoplay: true,
      animationData,
    });
    leoAnimInstances[containerId] = anim;
    anim.addEventListener("DOMLoaded", () => fitCanvas(container));

    if (!loop && onComplete) {
      anim.addEventListener("complete", onComplete);
    }
  });
}

// Révèle un badge .lb-minicheck (masqué par défaut, dans .lb-miniact), y joue
// le "check" une fois, puis le referme. Feedback local, au plus près du bouton
// cliqué — complémentaire de la réaction du badge .lb-fanim.
function flashMiniCheck(containerId, badgeId) {
  const badge = document.getElementById(badgeId);
  if (!badge) return;

  badge.classList.add("is-visible");

  swapAnim(containerId, "check.json", {
    loop: false,
    onComplete: () => {
      window.setTimeout(() => badge.classList.remove("is-visible"), 400);
    },
  });
}

window.leoAnims = { swap: swapAnim, flashMiniCheck };

document.addEventListener("DOMContentLoaded", () => {
  // Hero : une seule animation, qui contient toute la narration (idle -> fetch
  // -> generating -> check). L'ancien enchaînement de 8 fichiers, et
  // l'utilitaire playSequence qui le pilotait, sont dans l'historique git.
  simpleLoop("la-hero", "whole.json");

  // 4 étapes du parcours (badge en coin de chaque mockup)
  simpleLoop("la-onb", "sign-loop.json"); // 01 onboarding — signature du contrat
  simpleLoop("la-q", "idle.json"); // 02 quotidien — en attente d'une question
  simpleLoop("la-ed", "annotate.json"); // 03 éditeur — clauses annotées / suggérées
  simpleLoop("la-av", "hammer.json"); // 04 avocats — analyse de criticité

  // 4 états de transparence — un état = une boucle dédiée
  simpleLoop("la-si", "idle.json");
  simpleLoop("la-sf", "fetch-external.json");
  simpleLoop("la-sg", "generating.json");
  simpleLoop("la-sc", "check.json");

  // CTA final
  simpleLoop("la-fin", "scale.json");
});
