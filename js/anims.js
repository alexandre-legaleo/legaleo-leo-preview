// Rendu des animations Lottie de Leo (dossier /leo-anims) pour la preview locale.
// Ne transfère pas via HTMLtoflow (JS) : à recréer comme embeds Lottie natifs
// dans Webflow une fois la page importée. Mapping choisi par déduction des noms
// de fichiers — à corriger si un visuel ne correspond pas à l'intention.

const leoAnimInstances = {};

function simpleLoop(containerId, file) {
  swapAnim(containerId, file, { loop: true });
}

// Change l'animation jouée dans un badge déjà initialisé (ex: réagir à un
// clic). Exposé sur window.leoAnims pour être piloté par d'autres scripts
// (voir js/onboarding-demo.js).
function swapAnim(containerId, file, { loop = true, onComplete } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  if (leoAnimInstances[containerId]) {
    leoAnimInstances[containerId].destroy();
  }

  const anim = lottie.loadAnimation({
    container,
    renderer: "svg",
    loop,
    autoplay: true,
    path: `leo-anims/${file}`,
  });
  leoAnimInstances[containerId] = anim;

  if (!loop && onComplete) {
    anim.addEventListener("complete", onComplete);
  }

  return anim;
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

// Hero : petite narration bouclée idle -> fetch -> generating -> check,
// construite à partir des segments d'entrée/sortie fournis.
function playSequence(containerId, segments) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let index = 0;

  function playNext() {
    const segment = segments[index % segments.length];
    const anim = lottie.loadAnimation({
      container,
      renderer: "svg",
      loop: !!segment.loop,
      autoplay: true,
      path: `leo-anims/${segment.file}`,
    });

    if (segment.loop) {
      let completedLoops = 0;
      anim.addEventListener("loopComplete", () => {
        completedLoops += 1;
        if (completedLoops >= (segment.repeat || 1)) {
          anim.destroy();
          index += 1;
          playNext();
        }
      });
    } else {
      anim.addEventListener("complete", () => {
        anim.destroy();
        index += 1;
        playNext();
      });
    }
  }

  playNext();
}

document.addEventListener("DOMContentLoaded", () => {
  playSequence("la-hero", [
    { file: "idle-in.json" },
    { file: "idle.json", loop: true, repeat: 2 },
    { file: "idle-out.json" },
    { file: "fetch-external.json", loop: true, repeat: 2 },
    { file: "generating-in.json" },
    { file: "generating.json", loop: true, repeat: 2 },
    { file: "check.json" },
    { file: "check-out.json" },
  ]);

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
