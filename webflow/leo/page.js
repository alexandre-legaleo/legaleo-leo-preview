// js/anims.js
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
      fetch(`https://alexandre-legaleo.github.io/legaleo-leo-preview/leo-anims/${file}`)
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

// Révèle un badge .lv-minicheck (masqué par défaut, dans .lv-miniact), y joue
// le "check" une fois, puis le referme. Feedback local, au plus près du bouton
// cliqué — complémentaire de la réaction du badge .lv-fanim.
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

// js/onboarding-demo.js
// Démo cyclique du bloc 01 (onboarding) : à chaque scénario, lv-fm-user
// s'écrit progressivement (seul, centré verticalement dans .lv-fmfields),
// puis lv-fm-leo rejoint le flux et pousse lv-fm-user vers le haut. Un clic
// sur "Utiliser la version Leo" / "Garder ma version" ne laisse que l'option
// choisie (recentrée), avant d'enchaîner sur le scénario suivant — boucle
// indéfiniment sur 4 scénarios. Preview locale uniquement — voir la note en
// tête de js/anims.js.

const LB_FM_SCENARIOS = [
  {
    question: "Durée du contrat et modalités de renouvellement ?",
    user: "« 5 ans, renouvelable, avec un préavis de 6 mois. »",
    leo: "Leo rédige : « Le présent Contrat est conclu pour une durée de cinq (5) ans à compter de sa signature. Il est renouvelable par tacite reconduction, sauf préavis notifié par l'une des Parties au moins six (6) mois avant l'échéance. »",
  },
  {
    question: "Zone d'exclusivité territoriale ?",
    user: "« Un rayon de 5 km autour du point de vente. »",
    leo: "Leo rédige : « Le Franchisé bénéficie d'une exclusivité territoriale dans un rayon de cinq (5) kilomètres autour de l'Établissement, pendant toute la durée du présent Contrat. »",
  },
  {
    question: "Montant de la redevance mensuelle ?",
    user: "« 5 % du chiffre d'affaires HT, versé avant le 10 du mois suivant. »",
    leo: "Leo rédige : « Le Franchisé verse au Franchiseur une redevance mensuelle égale à cinq pour cent (5 %) du chiffre d'affaires hors taxes réalisé, payable au plus tard le dixième (10) jour du mois suivant. »",
  },
  {
    question: "Droit d'entrée à la signature ?",
    user: "« 15 000 euros HT, payable en une fois à la signature. »",
    leo: "Leo rédige : « Le Franchisé règle au Franchiseur, à la signature du présent Contrat, un droit d'entrée forfaitaire de quinze mille (15 000) euros hors taxes, payable en totalité et en une seule fois. »",
  },
];

document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("lv-fm-panel");
  const questionEl = document.getElementById("lv-fm-question");
  const fieldsEl = document.getElementById("lv-fm-fields");
  const userWrapEl = document.getElementById("lv-fm-user-wrap");
  const leoWrapEl = document.getElementById("lv-fm-leo-wrap");
  const userFieldEl = document.getElementById("lv-fm-user");
  const leoFieldEl = document.getElementById("lv-fm-leo");
  const useBtn = document.getElementById("lv-fm-use");
  const keepBtn = document.getElementById("lv-fm-keep");
  const thinkingEl = document.getElementById("lv-fm-thinking");
  const THINKING_ICON_ID = "la-onb-thinking";

  if (
    !panel ||
    !questionEl ||
    !fieldsEl ||
    !userWrapEl ||
    !leoWrapEl ||
    !userFieldEl ||
    !leoFieldEl ||
    !useBtn ||
    !keepBtn ||
    !thinkingEl ||
    !window.leoAnims
  ) {
    return;
  }

  let index = 0;
  let busy = false;

  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  function setButtonsDisabled(disabled) {
    useBtn.disabled = disabled;
    keepBtn.disabled = disabled;
  }

  function wrapOf(fieldEl) {
    return fieldEl === userFieldEl ? userWrapEl : leoWrapEl;
  }

  // Mesure la hauteur qu'aurait `wrapEl` s'il contenait `text` — furtivement
  // (le texte cible et height:auto sont posés, lus, puis tout est restauré à
  // l'identique) — sans jamais peindre cet état intermédiaire.
  function measureWrapHeight(wrapEl, fieldEl, text) {
    const prevText = fieldEl.textContent;
    const prevHeight = wrapEl.style.height;
    const prevTransition = wrapEl.style.transition;

    wrapEl.style.transition = "none";
    wrapEl.style.height = "auto";
    fieldEl.textContent = text;
    const height = wrapEl.getBoundingClientRect().height;

    fieldEl.textContent = prevText;
    wrapEl.style.height = prevHeight;
    wrapEl.style.transition = prevTransition;
    return height;
  }

  // Anime `wrapEl` (fermé ou déjà ouvert sur un autre texte) vers la hauteur
  // de `text`, en fondu (voir .lv-fmfield-wrap[data-open] en CSS). Cible
  // directement la hauteur du texte FINAL plutôt que du champ vide : sans ça,
  // une frappe progressive ultérieure ferait grandir la bulle par à-coups —
  // c'est le layout shift signalé (bulle quasi vide, donc quasi plate, avant
  // que le texte n'arrive). Anime la hauteur du wrapper plutôt que celle du
  // champ, pour que le padding/border/margin de .lv-fmfield ne la perturbe
  // pas. `settle: false` laisse la hauteur épinglée en px (pas de retour à
  // "auto") quand l'appelant sait que le contenu va encore changer juste
  // après (ex: lv-fm-user vidé pour la frappe) et se charge lui-même de
  // relâcher une fois stabilisé.
  // Annule un éventuel "settle" en attente (voir openWrapTo) : sans ça, un
  // clic assez rapide pour refermer un wrapper avant que son propre "settle"
  // ne se déclenche ferait repasser sa hauteur en "auto" (donc rouvrir en
  // plein, d'un coup) en pleine animation de fermeture.
  function clearPendingSettle(wrapEl) {
    if (wrapEl._settleTimeoutId) {
      window.clearTimeout(wrapEl._settleTimeoutId);
      wrapEl._settleTimeoutId = null;
    }
  }

  function openWrapTo(wrapEl, fieldEl, text, { settle = true } = {}) {
    clearPendingSettle(wrapEl);
    // Mesure et fige le point de départ AVANT de poser data-open="true" :
    // l'opacité de .lv-fmfield-wrap suit data-open en CSS, donc si on le
    // pose avant le coup de "transition: none" ci-dessous, l'opacité saute
    // directement à sa cible pendant cette fenêtre sans transition — il ne
    // reste alors plus rien à animer une fois la transition réactivée.
    const target = measureWrapHeight(wrapEl, fieldEl, text);

    if (reduceMotionQuery.matches) {
      wrapEl.dataset.open = "true";
      wrapEl.style.height = "auto";
      return;
    }

    const current = wrapEl.getBoundingClientRect().height;
    wrapEl.style.transition = "none";
    wrapEl.style.height = `${current}px`;
    wrapEl.getBoundingClientRect(); // fige le point de départ avant de le faire varier
    wrapEl.style.transition = "";

    requestAnimationFrame(() => {
      wrapEl.dataset.open = "true"; // même frame que la cible de hauteur : les deux transitions démarrent ensemble
      wrapEl.style.height = `${target}px`;
    });

    if (settle) {
      wrapEl._settleTimeoutId = window.setTimeout(() => {
        wrapEl.style.height = "auto";
        wrapEl._settleTimeoutId = null;
      }, 470);
    }
  }

  // Referme `wrapEl` (hauteur actuelle -> 0, fondu en CSS via data-open).
  function closeWrap(wrapEl) {
    clearPendingSettle(wrapEl);
    if (wrapEl.dataset.open !== "true") return;
    wrapEl.dataset.open = "false";

    if (reduceMotionQuery.matches) {
      wrapEl.style.height = "0px";
      return;
    }

    wrapEl.style.height = `${wrapEl.getBoundingClientRect().height}px`;
    wrapEl.getBoundingClientRect(); // fige la valeur de départ avant de la faire varier
    requestAnimationFrame(() => {
      wrapEl.style.height = "0px";
    });
  }

  // Ouvre `wrapEl` (fermé) à une petite hauteur fixe, juste assez pour
  // rendre visible .lv-fm-thinking dedans malgré l'overflow: clip — sans
  // ça le badge resterait invisible tant que le wrap est à hauteur 0.
  // openWrapTo() prend ensuite le relais depuis cette hauteur pour la
  // révélation finale (voir reveal()), donnant une seule transition continue.
  const THINKING_HEIGHT = 40;

  function openWrapToThinking(wrapEl) {
    clearPendingSettle(wrapEl);
    wrapEl.dataset.open = "true";

    if (reduceMotionQuery.matches) {
      wrapEl.style.height = `${THINKING_HEIGHT}px`;
      return;
    }

    const current = wrapEl.getBoundingClientRect().height;
    wrapEl.style.transition = "none";
    wrapEl.style.height = `${current}px`;
    wrapEl.getBoundingClientRect(); // fige le point de départ avant de le faire varier
    wrapEl.style.transition = "";

    requestAnimationFrame(() => {
      wrapEl.style.height = `${THINKING_HEIGHT}px`;
    });
  }

  // Réserve, sur .lv-fmfields, la hauteur qu'occuperont ensemble lv-fm-user +
  // lv-fm-leo pour `scenario` (mesurée avec les deux wrappers temporairement
  // ouverts sur le texte cible). Sans ça, .lv-fmfields ferait juste la
  // hauteur du champ seul ouvert, et justify-content: center n'aurait aucun
  // effet visible.
  function syncFieldsMinHeight(scenario) {
    const prevUserText = userFieldEl.textContent;
    const prevLeoText = leoFieldEl.textContent;
    const prevUserHeight = userWrapEl.style.height;
    const prevLeoHeight = leoWrapEl.style.height;
    const prevUserTransition = userWrapEl.style.transition;
    const prevLeoTransition = leoWrapEl.style.transition;

    fieldsEl.style.minHeight = "";
    userFieldEl.textContent = scenario.user;
    leoFieldEl.textContent = scenario.leo;
    userWrapEl.style.transition = "none";
    leoWrapEl.style.transition = "none";
    userWrapEl.style.height = "auto";
    leoWrapEl.style.height = "auto";

    fieldsEl.style.minHeight = `${fieldsEl.getBoundingClientRect().height}px`;

    userWrapEl.style.height = prevUserHeight;
    leoWrapEl.style.height = prevLeoHeight;
    userWrapEl.style.transition = prevUserTransition;
    leoWrapEl.style.transition = prevLeoTransition;
    userFieldEl.textContent = prevUserText;
    leoFieldEl.textContent = prevLeoText;
  }

  function typeText(el, text, { charDelay = 24, onDone } = {}) {
    let i = 0;
    function step() {
      i += 1;
      el.textContent = text.slice(0, i);
      if (i < text.length) {
        window.setTimeout(step, charDelay);
      } else {
        onDone?.();
      }
    }
    step();
  }

  // Séquence d'un scénario : lv-fm-leo se referme (choisi au tour précédent),
  // lv-fm-user s'ouvre/se redimensionne DIRECTEMENT sur la hauteur de son
  // texte final, ET s'écrit progressivement EN MÊME TEMPS (pas de pause
  // "bulle vide" avant que la frappe ne démarre — la bulle se remplit au fur
  // et à mesure qu'elle apparaît/grandit). Enfin lv-fm-leo s'ouvre à son
  // tour. Rejouée à chaque cycle, intro comprise.
  function runScenario(scenario) {
    syncFieldsMinHeight(scenario);

    userFieldEl.classList.remove("is-selected");
    leoFieldEl.classList.remove("is-selected");

    // Referme lv-fm-leo avec son texte encore actuel (celui du scénario
    // précédent, s'il était ouvert) : la hauteur de départ de l'animation
    // doit correspondre à ce qui est affiché à l'écran, pas au texte cible.
    closeWrap(leoWrapEl);

    // Vise la hauteur du texte FINAL, puis vide et tape IMMÉDIATEMENT (pas de
    // délai) : la bulle grandit/apparaît en fondu pendant que le texte s'y
    // écrit, au lieu d'arriver vide et d'attendre. settle: false — on ne
    // relâche pas la hauteur en "auto" tout de suite, le texte va encore
    // changer pendant la frappe ; reveal() s'en charge une fois stable.
    openWrapTo(userWrapEl, userFieldEl, scenario.user, { settle: false });
    userFieldEl.textContent = "";

    function openLeoField() {
      // À ce stade lv-fm-leo-wrap est soit fermé (hauteur 0, chemin
      // reduced-motion), soit à THINKING_HEIGHT (badge de réflexion, voir
      // reveal()) — dans les deux cas assez peu ouvert/clippé pour écrire le
      // texte du scénario sans qu'il ne "flashe" à l'écran.
      leoFieldEl.textContent = scenario.leo;
      openWrapTo(leoWrapEl, leoFieldEl, scenario.leo);
      setButtonsDisabled(false);
    }

    // Court instant "Leo réfléchit" (mini badge, generating.json) avant que
    // sa rédaction n'apparaisse — voir .lv-fm-thinking.
    function reveal() {
      userWrapEl.style.height = "auto"; // texte stable désormais : aucun saut visible

      // Vide le texte du scénario précédent avant d'ouvrir : sinon il
      // dépasserait brièvement, clippé, derrière/à côté du badge.
      leoFieldEl.textContent = "";
      openWrapToThinking(leoWrapEl);
      thinkingEl.classList.add("is-visible");
      window.leoAnims.swap(THINKING_ICON_ID, "generating.json", { loop: true });

      window.setTimeout(() => {
        thinkingEl.classList.remove("is-visible");
        openLeoField();
      }, 1100);
    }

    if (reduceMotionQuery.matches) {
      userFieldEl.textContent = scenario.user;
      openLeoField();
      return;
    }

    typeText(userFieldEl, scenario.user, {
      onDone: () => window.setTimeout(reveal, 350),
    });
  }

  window.addEventListener("resize", () => syncFieldsMinHeight(LB_FM_SCENARIOS[index]));

  // N'amorce le tout premier scénario qu'au passage du bloc dans le
  // viewport ; les cycles suivants (après un clic) démarrent immédiatement.
  const introTarget = panel.closest(".lv-fvisual") || panel;
  if ("IntersectionObserver" in window) {
    const introObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.disconnect();
          runScenario(LB_FM_SCENARIOS[index]);
        });
      },
      { threshold: 0.4 }
    );
    introObserver.observe(introTarget);
  } else {
    runScenario(LB_FM_SCENARIOS[index]);
  }

  // Laisse le temps de voir l'option choisie, seule et centrée, avant
  // d'enchaîner sur le scénario suivant. la-onb reste sur son idle
  // (sign-loop.json) tout du long — ne pas le swapper vers une autre anim.
  function holdSelection() {
    return new Promise((resolve) => window.setTimeout(resolve, 933)); // 2800 / 3
  }

  function showNextScenario() {
    index = (index + 1) % LB_FM_SCENARIOS.length;
    const scenario = LB_FM_SCENARIOS[index];

    questionEl.classList.add("lv-chat-fade");

    window.setTimeout(() => {
      questionEl.textContent = scenario.question;
      questionEl.classList.remove("lv-chat-fade");
      runScenario(scenario);
    }, 200);
  }

  async function handleChoice(fieldEl) {
    if (busy) return;
    busy = true;
    setButtonsDisabled(true);

    const otherEl = fieldEl === userFieldEl ? leoFieldEl : userFieldEl;
    fieldEl.classList.add("is-selected");

    // Ne garde que l'option choisie, recentrée à la place des deux — le
    // champ restant suit tout seul via le flex reflow pendant que l'autre
    // wrapper se referme.
    closeWrap(wrapOf(otherEl));

    await holdSelection();
    showNextScenario();
    busy = false;
  }

  useBtn.addEventListener("click", () => handleChoice(leoFieldEl));
  keepBtn.addEventListener("click", () => handleChoice(userFieldEl));

  // Survol d'un bouton -> léger surlignage de la bulle qu'il concerne, pour
  // voir en un coup d'oeil quel bouton correspond à quelle option.
  useBtn.addEventListener("mouseenter", () => leoFieldEl.classList.add("is-hint"));
  useBtn.addEventListener("mouseleave", () => leoFieldEl.classList.remove("is-hint"));
  keepBtn.addEventListener("mouseenter", () => userFieldEl.classList.add("is-hint"));
  keepBtn.addEventListener("mouseleave", () => userFieldEl.classList.remove("is-hint"));
});

// js/main.js
// Interactivité de confort pour la preview locale uniquement.
// HTMLtoflow ne transfère que le HTML/CSS statique : le prompt animé du
// hero, l'accordéon FAQ, les bulles de questions du bloc 02, les réactions
// des lv-fanim (blocs 02/03/04) et le parallax scroll des lv-fvisual /
// lv-ficon devront être recréés avec les Interactions Webflow une fois la
// page importée.

document.addEventListener("DOMContentLoaded", () => {
  // Hero : exemples de questions qu'on pourrait poser à Leo, en boucle
  // "machine à écrire" (écrit -> pause -> efface -> question suivante) dans
  // le faux champ de prompt .lv-heroprompt (décoratif, aria-hidden). Certaines
  // questions reprennent celles du bloc 02 pour rester cohérent.
  const heroPromptTyped = document.getElementById("lv-heroprompt-typed");

  if (heroPromptTyped) {
    const HERO_PROMPTS = [
      "Puis-je imposer une clause d'exclusivité territoriale ?",
      "Le DIP doit être remis combien de temps avant la signature d'un contrat de franchise?",
      "Comment structurer une clause de renouvellement ?",
      "Rédige-moi la clause de durée et de renouvellement de mon contrat.",
      "Cette clause de non-concurrence est-elle disproportionnée ?",
    ];

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      heroPromptTyped.textContent = HERO_PROMPTS[0];
    } else {
      let promptIndex = 0;

      const typeChar = (text, charIndex) => {
        heroPromptTyped.textContent = text.slice(0, charIndex);
        if (charIndex < text.length) {
          window.setTimeout(() => typeChar(text, charIndex + 1), 32);
        } else {
          window.setTimeout(() => eraseChar(text, text.length), 1900);
        }
      };

      const eraseChar = (text, charIndex) => {
        heroPromptTyped.textContent = text.slice(0, charIndex);
        if (charIndex > 0) {
          window.setTimeout(() => eraseChar(text, charIndex - 1), 14);
        } else {
          promptIndex += 1;
          window.setTimeout(() => typeChar(HERO_PROMPTS[promptIndex % HERO_PROMPTS.length], 1), 350);
        }
      };

      typeChar(HERO_PROMPTS[0], 1);
    }
  }

  document.querySelectorAll(".lv-faqitem").forEach((item) => {
    const question = item.querySelector(".lv-faqq");
    // preventDefault : dans Webflow natif, la question est un lien (href="#").
    question.addEventListener("click", (e) => {
      e.preventDefault();
      const isOpen = item.classList.toggle("is-open");
      question.setAttribute("aria-expanded", String(isOpen));
    });
  });

  const bubblesEl = document.getElementById("lv-chat-bubbles");
  const bubblesTemplate = document.getElementById("lv-chat-bubbles-template");
  const chatLogEl = document.getElementById("lv-chat-log");
  const fanimEl = document.getElementById("lv-chat-fanim");

  // Découpe un fragment HTML en tokens (balises / espaces / mots) pour pouvoir
  // le révéler mot par mot.
  function tokenizeHTML(html) {
    return html.match(/<[^>]+>|\s+|[^\s<]+/g) || [];
  }

  // Décode les entités HTML d'un token texte (&amp; -> &) sans le ré-interpréter
  // comme du HTML.
  const entityDecoder = document.createElement("textarea");
  function decodeEntities(str) {
    entityDecoder.innerHTML = str;
    return entityDecoder.value;
  }

  // Construit le DOM au fur et à mesure (append de noeuds) plutôt que de
  // réécrire tout le innerHTML à chaque tick : un ré-innerHTML complet force
  // Chrome à reparser/relayouter tout le paragraphe et fait apparaître un
  // interligne temporairement trop grand sur la dernière ligne en cours de
  // révélation, le temps qu'elle se stabilise.
  //
  // `shouldContinue` lets a stale, still-ticking stream (superseded by a newer
  // click) detect it's obsolete and stop, instead of clobbering the DOM out
  // from under the new one — same stale-response problem the puff worker
  // guards against with its task id.
  function streamHTML(el, html, { wordDelay = 45, shouldContinue = () => true, onDone } = {}) {
    const tokens = tokenizeHTML(html);
    el.innerHTML = "";
    const parentStack = [el];
    let i = 0;

    function appendToken(token) {
      const closeMatch = /^<\/([a-zA-Z]+)>$/.test(token);
      const openMatch = /^<([a-zA-Z]+)[^>]*>$/.exec(token);
      const parent = parentStack[parentStack.length - 1];
      if (closeMatch) {
        if (parentStack.length > 1) parentStack.pop();
      } else if (openMatch) {
        const node = document.createElement(openMatch[1]);
        parent.appendChild(node);
        parentStack.push(node);
      } else {
        // Fait grandir le dernier text node plutôt que d'en empiler un par
        // token : plusieurs Text siblings consécutifs forcent Chrome à
        // recalculer la ligne en cours de révélation à chaque mot, ce qui la
        // fait apparaître temporairement trop bas le temps qu'elle se
        // stabilise (visible surtout juste après un retour à la ligne).
        const text = decodeEntities(token);
        const lastChild = parent.lastChild;
        if (lastChild?.nodeType === Node.TEXT_NODE) {
          lastChild.textContent += text;
        } else {
          parent.appendChild(document.createTextNode(text));
        }
      }
    }

    function step() {
      if (!shouldContinue()) return;
      appendToken(tokens[i]);
      if (i >= tokens.length - 1) {
        onDone?.();
        return;
      }
      const isWord = !/^\s+$/.test(tokens[i]) && !/^<[^>]+>$/.test(tokens[i]);
      i += 1;
      window.setTimeout(step, isWord ? wordDelay : 0);
    }

    step();
  }

  if (bubblesEl && bubblesTemplate && chatLogEl && fanimEl) {
    // Colle le scroll en bas du flux (voir .lv-chatlog : max-height +
    // overflow-y: auto + scroll-behavior: smooth donnent l'effet de
    // défilement continu vers le haut à mesure que ça s'accumule).
    function scrollLogToBottom() {
      chatLogEl.scrollTop = chatLogEl.scrollHeight;
    }

    // Repeuple les 3 bulles de départ — au premier chargement, et à nouveau
    // chaque fois que le pool est épuisé, pour une boucle sans fin.
    function refillBubbles() {
      bubblesEl.replaceChildren(bubblesTemplate.content.cloneNode(true));
    }

    refillBubbles();

    let renderToken = 0;
    let messageCounter = 0;

    bubblesEl.addEventListener("click", (event) => {
      const bubble = event.target.closest(".lv-qbubble");
      if (!bubble) return;

      renderToken += 1;
      const myRenderToken = renderToken;
      messageCounter += 1;
      const iconId = `la-q-${messageCounter}`;

      // La question posée quitte le pool de suggestions pour de bon (jusqu'à
      // ce qu'il soit repeuplé) ; le groupe entier se cache pendant la
      // réflexion/le streaming et ne réapparaît (sous le flux, voir plus bas)
      // qu'une fois la réponse terminée.
      bubblesEl.hidden = true;
      bubble.remove();

      // Le badge Leo unique ne sert plus une fois la conversation lancée :
      // chaque réponse porte désormais sa propre mini-icône (voir plus bas).
      fanimEl.hidden = true;

      const userEl = document.createElement("div");
      userEl.className = "lv-buser";
      userEl.textContent = bubble.textContent;
      chatLogEl.appendChild(userEl);

      // Faux chargement : skeleton + Leo (mini badge dédié à ce message) qui
      // mimique une réflexion en cours.
      const bleoEl = document.createElement("div");
      bleoEl.className = "lv-bleo is-thinking";
      bleoEl.innerHTML =
        `<div class="lv-bleo-icon"><div id="${iconId}" style="width:100%;height:100%"></div></div>` +
        '<div class="lv-bleo-skeleton" aria-hidden="true"><span></span><span></span><span></span></div>' +
        '<span class="lv-chat-answer"></span>' +
        '<div class="lv-srcpill">Textes officiels &amp; jurisprudence cités<span class="lv-srcpill-icon" aria-hidden="true"></span></div>';
      chatLogEl.appendChild(bleoEl);
      scrollLogToBottom();

      const answerEl = bleoEl.querySelector(".lv-chat-answer");
      const srcpillEl = bleoEl.querySelector(".lv-srcpill");

      window.leoAnims?.swap(iconId, "generating-in.json", {
        loop: false,
        onComplete: () => window.leoAnims.swap(iconId, "generating.json", { loop: true }),
      });

      window.setTimeout(() => {
        if (myRenderToken !== renderToken) return; // une question plus récente a été cliquée entretemps

        bleoEl.classList.remove("is-thinking");
        // "generating" continue de tourner (déjà lancée pendant la réflexion,
        // voir plus haut) tout le temps du streaming mot à mot.

        const fullAnswerHTML = `<b>⚠ Point de vigilance :</b> ${bubble.dataset.answer}`;

        // Réserve d'avance la hauteur finale de .lv-bleo (pill sources
        // comprise) pour qu'elle ne grandisse pas par à-coups à chaque ligne
        // pendant le streaming — sans ça, chaque ligne ajoutée ferait sauter
        // la hauteur du flux (et donc son scroll) par à-coups.
        answerEl.innerHTML = fullAnswerHTML;
        srcpillEl.classList.add("is-visible");
        bleoEl.style.minHeight = `${bleoEl.getBoundingClientRect().height}px`;
        srcpillEl.classList.remove("is-visible");
        answerEl.innerHTML = "";
        scrollLogToBottom();

        streamHTML(answerEl, fullAnswerHTML, {
          wordDelay: 45,
          shouldContinue: () => myRenderToken === renderToken,
          onDone: () => {
            srcpillEl.classList.add("is-visible");
            bleoEl.style.minHeight = "";
            if (!bubblesEl.children.length) refillBubbles();
            // Les bulles reprennent leur place dans le flex : .lv-chatlog
            // rétrécit d'autant, donc son ancien scrollTop ne colle plus au
            // bas — sans ce re-scroll, les bulles couvriraient le dernier
            // message au lieu de le pousser au-dessus (effet overlay).
            bubblesEl.hidden = false;
            scrollLogToBottom();

            // Réponse terminée : la mini-icône de ce message s'efface (elle a
            // fini son rôle, et évite d'empiler indéfiniment des animations
            // Lottie actives au fil de la boucle).
            bleoEl.querySelector(".lv-bleo-icon")?.classList.add("is-done");
          },
        });
      }, 950);
    });
  }

  // Icônes contextuelles : l'action principale (bouton plein) de chaque
  // mockup déclenche l'animation Leo "check", comme confirmation visuelle.
  function flashCheck(containerId, idleFile) {
    window.leoAnims?.swap(containerId, "check.json", {
      loop: false,
      onComplete: () => window.leoAnims.swap(containerId, idleFile, { loop: true }),
    });
  }

  // 03 — éditeur : part d'un texte basique (pas de diff visible), et révèle
  // la suggestion de Leo au clic — d'abord le mot retiré qui se barre, puis
  // les ajouts qui apparaissent en fondu, un par un. Rejouable : reclique et
  // ça repart du texte basique.
  const edBody = document.getElementById("lv-ed-body");
  const edMinicheck = document.getElementById("lv-ed-minicheck");

  document.getElementById("lv-ed-recommend")?.addEventListener("click", (event) => {
    if (!edBody) return;

    const button = event.currentTarget;
    const delEl = edBody.querySelector(".lv-del");
    const addEls = [...edBody.querySelectorAll(".lv-add")];
    const strikeDuration = 450;
    const addStagger = 150;
    const addFadeDuration = 400;

    if (!delEl?.classList.contains("is-struck")) {
      button.textContent = "Retirer la recommandation";

      // Badge "Leo travaille" pendant toute la révélation — pas de check de
      // confirmation, il s'efface une fois la suggestion affichée.
      edMinicheck?.classList.add("is-visible");
      window.leoAnims?.swap("la-ed-check", "generating.json", { loop: true });

      // Reset défensif (pour rejouer proprement si jamais l'état était
      // incohérent), puis révèle : le mot retiré se barre, puis les ajouts
      // apparaissent en fondu un par un.
      addEls.forEach((el) => {
        el.classList.remove("is-visible");
        el.hidden = true;
      });
      void edBody.offsetWidth; // force le reflow avant de relancer les transitions

      window.setTimeout(() => delEl?.classList.add("is-struck"), 50);

      addEls.forEach((el, index) => {
        window.setTimeout(() => {
          el.hidden = false;
          void el.offsetWidth;
          el.classList.add("is-visible");
        }, strikeDuration + index * addStagger);
      });

      window.setTimeout(() => {
        flashCheck("la-ed", "annotate.json");
        edMinicheck?.classList.remove("is-visible");
      }, strikeDuration + addEls.length * addStagger + 300);
    } else {
      button.textContent = "Recommander une amélioration";

      // Animation inverse : les ajouts s'effacent en fondu, du dernier au
      // premier, puis le mot retiré redevient du texte normal.
      [...addEls].reverse().forEach((el, index) => {
        window.setTimeout(() => {
          el.classList.remove("is-visible");
          window.setTimeout(() => {
            el.hidden = true;
          }, addFadeDuration);
        }, index * addStagger);
      });

      const unstrikeDelay = addEls.length * addStagger + addFadeDuration;
      window.setTimeout(() => delEl.classList.remove("is-struck"), unstrikeDelay);
    }
  });

  document.getElementById("lv-av-propose")?.addEventListener("click", () => {
    flashCheck("la-av", "hammer.json");
    window.leoAnims?.flashMiniCheck("la-av-check", "lv-av-minicheck");
  });

  // 04 — avocats : pioche 2-3 clauses au hasard parmi les 9 du <template>, au
  // chargement et à chaque "Relancer l'analyse", avec un bref état "scan"
  // (skeleton + anim) entre les deux pour donner l'impression d'une vraie
  // nouvelle passe plutôt qu'un simple remplacement instantané.
  const avCritlist = document.getElementById("lv-av-critlist");
  const avCritTemplate = document.getElementById("lv-av-crit-template");
  const avMinicheck = document.getElementById("lv-av-minicheck");

  // Élevé (pas de modificateur sur .lv-risk) avant moyen avant faible.
  function riskRank(critEl) {
    const riskEl = critEl.querySelector(".lv-risk");
    if (riskEl?.classList.contains("lv-risk--medium")) return 1;
    if (riskEl?.classList.contains("lv-risk--low")) return 2;
    return 0;
  }

  function renderRandomCrits() {
    if (!avCritlist || !avCritTemplate) return;

    const pool = [...avCritTemplate.content.querySelectorAll(".lv-crit")];
    const count = Math.random() < 0.5 ? 2 : 3;
    const picked = pool
      .map((el) => ({ el, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .slice(0, count)
      .map(({ el }) => el.cloneNode(true))
      .sort((a, b) => riskRank(a) - riskRank(b));

    picked.forEach((el, index) => {
      el.style.animationDelay = `${index * 90}ms`;
    });

    avCritlist.replaceChildren(...picked);
  }

  renderRandomCrits();

  document.getElementById("lv-av-relaunch")?.addEventListener("click", () => {
    if (!avCritlist) return;

    window.leoAnims?.swap("la-av", "scan.json", { loop: true });
    avMinicheck?.classList.add("is-visible");
    window.leoAnims?.swap("la-av-check", "generating.json", { loop: true });

    const skeletonCount = Math.random() < 0.5 ? 2 : 3;
    avCritlist.replaceChildren(
      ...Array.from({ length: skeletonCount }, () => {
        const skeleton = document.createElement("div");
        skeleton.className = "lv-crit-skeleton";
        skeleton.innerHTML = "<span></span><span></span><span></span>";
        return skeleton;
      }),
    );

    window.setTimeout(() => {
      renderRandomCrits();
      flashCheck("la-av", "hammer.json");
      avMinicheck?.classList.remove("is-visible");
    }, 800);
  });

  // Parallax : chaque mockup .lv-fvisual dérive verticalement selon sa
  // position dans le viewport (translateY, pas de reflow). À recréer en
  // Webflow via une interaction "Scroll into View" -> Move sur chaque lv-fvisual,
  // avec un décalage de départ/arrivée équivalent à PARALLAX_STRENGTH.
  // Désactivé pour l'instant (rendu jugé bizarre sur .lv-fvisual) — gardé en
  // l'état pour être réactivé, ou réappliqué à d'autres éléments, plus tard.
  const PARALLAX_ENABLED = false;
  const visuals = document.querySelectorAll(".lv-fvisual");
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobileQuery = window.matchMedia("(max-width: 780px)");

  // Transition douce de hauteur pour les mockups dont le contenu change de
  // taille (04 relance d'analyse, 03 reveal/retract...). Cible
  // .lv-formmock/.lv-reco, pas .lv-fvisual directement : ce dernier porte des
  // badges .lv-fanim/.lv-ficon volontairement en dehors de ses bords (ex:
  // .lv-ficon-b/-c en right:-28px, bottom:-16px), qu'un overflow: hidden
  // couperait pendant la transition — .lv-fvisual grandit simplement en même
  // temps puisque sa hauteur (auto) suit celle de son enfant. CSS ne sait pas
  // transitionner height: auto ; on mesure avant/après et on anime entre deux
  // valeurs en px via ResizeObserver, puis on repasse en auto pour ne pas
  // casser le redimensionnement responsive ensuite. Exclut .lv-chatmock
  // (mockup 02, dans .lv-fvisual--chat qui a maintenant une height fixe —
  // rien à faire grandir) et #lv-fm-panel (mockup 01, dont les
  // .lv-fmfield-wrap animent déjà finement leur propre hauteur — un second
  // système de transition par-dessus se marcherait dessus).
  if (!reduceMotionQuery.matches && "ResizeObserver" in window) {
    document.querySelectorAll(".lv-formmock:not(.lv-chatmock):not(#lv-fm-panel), .lv-reco").forEach((el) => {
      let previousHeight = el.getBoundingClientRect().height;
      let resetTimeout = null;
      let isAnimating = false;

      const ro = new ResizeObserver(() => {
        // Sans ce garde, chaque frame de notre propre transition (la hauteur
        // change réellement, frame par frame) redéclenche l'observer, qui
        // repart en boucle sur cette valeur intermédiaire — d'où le
        // "vibrement". On ignore tout ce qui se passe pendant notre transition.
        if (isAnimating) return;

        const newHeight = el.getBoundingClientRect().height;
        if (Math.abs(newHeight - previousHeight) < 1) return;

        isAnimating = true;
        el.style.transition = "none";
        el.style.overflow = "hidden";
        // .lv-chatmock a flex: 1 (flex-basis: 0%), qui prime sur height pour
        // sa taille en layout flex — height seul y serait ignoré. On fige
        // aussi flex-grow/-shrink/-basis en parallèle : no-op sur un élément
        // bloc normal (.lv-formmock/.lv-reco), agissant sur un flex item.
        el.style.flexGrow = "0";
        el.style.flexShrink = "0";
        el.style.flexBasis = `${previousHeight}px`;
        el.style.height = `${previousHeight}px`;
        void el.offsetHeight; // force le reflow avant de relancer la transition

        requestAnimationFrame(() => {
          el.style.transition = "height 0.35s ease, flex-basis 0.35s ease";
          el.style.flexBasis = `${newHeight}px`;
          el.style.height = `${newHeight}px`;
        });

        previousHeight = newHeight;

        window.clearTimeout(resetTimeout);
        resetTimeout = window.setTimeout(() => {
          el.style.transition = "";
          el.style.height = "";
          el.style.flexGrow = "";
          el.style.flexShrink = "";
          el.style.flexBasis = "";
          el.style.overflow = "";
          isAnimating = false;
        }, 400);
      });

      ro.observe(el);
    });
  }

  if (PARALLAX_ENABLED && visuals.length && !reduceMotionQuery.matches) {
    const PARALLAX_STRENGTH = 60; // px de déplacement max, de part et d'autre du centre

    let ticking = false;

    function updateParallax() {
      ticking = false;

      if (mobileQuery.matches) {
        visuals.forEach((el) => {
          el.style.transform = "";
        });
        return;
      }

      const viewportCenter = window.innerHeight / 2;

      visuals.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const elCenter = rect.top + rect.height / 2;
        const progress = Math.max(-1, Math.min(1, (viewportCenter - elCenter) / window.innerHeight));
        el.style.transform = `translateY(${(progress * PARALLAX_STRENGTH).toFixed(1)}px)`;
      });
    }

    function requestParallaxUpdate() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(updateParallax);
      }
    }

    window.addEventListener("scroll", requestParallaxUpdate, { passive: true });
    window.addEventListener("resize", requestParallaxUpdate);
    updateParallax();
  }

  // Parallax des icônes flottantes (.lv-ficon, autour de chaque .lv-fvisual) :
  // même principe que le parallax ci-dessus (translateY selon la position
  // dans le viewport), mais avec une profondeur par icône (`data-depth`, posé
  // en HTML) pour qu'elles ne dérivent pas toutes à la même vitesse. Le léger
  // flottement continu, lui, est en CSS pure (@keyframes lv-ficon-float) et
  // se transfère tel quel vers Webflow — seul ce parallax est à recréer, voir
  // WEBFLOW-TODO.md #8.
  const ficons = document.querySelectorAll(".lv-ficon");
  const ficonMobileQuery = window.matchMedia("(max-width: 900px)");

  if (ficons.length && !reduceMotionQuery.matches) {
    const FICON_PARALLAX_STRENGTH = 26; // px de déplacement max, de part et d'autre du centre, avant multiplication par la profondeur

    let ficonTicking = false;

    function updateFiconParallax() {
      ficonTicking = false;

      if (ficonMobileQuery.matches) {
        ficons.forEach((el) => {
          el.style.transform = "";
        });
        return;
      }

      const viewportCenter = window.innerHeight / 2;

      ficons.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const elCenter = rect.top + rect.height / 2;
        const progress = Math.max(-1, Math.min(1, (viewportCenter - elCenter) / window.innerHeight));
        const depth = Number(el.dataset.depth) || 1;
        el.style.transform = `translateY(${(progress * FICON_PARALLAX_STRENGTH * depth).toFixed(1)}px)`;
      });
    }

    function requestFiconParallaxUpdate() {
      if (!ficonTicking) {
        ficonTicking = true;
        window.requestAnimationFrame(updateFiconParallax);
      }
    }

    window.addEventListener("scroll", requestFiconParallaxUpdate, { passive: true });
    window.addEventListener("resize", requestFiconParallaxUpdate);
    updateFiconParallax();
  }
});
