// Démo cyclique du bloc 01 (onboarding) : à chaque scénario, lb-fm-user
// s'écrit progressivement (seul, centré verticalement dans .lb-fmfields),
// puis lb-fm-leo rejoint le flux et pousse lb-fm-user vers le haut. Un clic
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
  const panel = document.getElementById("lb-fm-panel");
  const questionEl = document.getElementById("lb-fm-question");
  const fieldsEl = document.getElementById("lb-fm-fields");
  const userWrapEl = document.getElementById("lb-fm-user-wrap");
  const leoWrapEl = document.getElementById("lb-fm-leo-wrap");
  const userFieldEl = document.getElementById("lb-fm-user");
  const leoFieldEl = document.getElementById("lb-fm-leo");
  const useBtn = document.getElementById("lb-fm-use");
  const keepBtn = document.getElementById("lb-fm-keep");
  const thinkingEl = document.getElementById("lb-fm-thinking");
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
  // de `text`, en fondu (voir .lb-fmfield-wrap[data-open] en CSS). Cible
  // directement la hauteur du texte FINAL plutôt que du champ vide : sans ça,
  // une frappe progressive ultérieure ferait grandir la bulle par à-coups —
  // c'est le layout shift signalé (bulle quasi vide, donc quasi plate, avant
  // que le texte n'arrive). Anime la hauteur du wrapper plutôt que celle du
  // champ, pour que le padding/border/margin de .lb-fmfield ne la perturbe
  // pas. `settle: false` laisse la hauteur épinglée en px (pas de retour à
  // "auto") quand l'appelant sait que le contenu va encore changer juste
  // après (ex: lb-fm-user vidé pour la frappe) et se charge lui-même de
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
    // l'opacité de .lb-fmfield-wrap suit data-open en CSS, donc si on le
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
  // rendre visible .lb-fm-thinking dedans malgré l'overflow: clip — sans
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

  // Réserve, sur .lb-fmfields, la hauteur qu'occuperont ensemble lb-fm-user +
  // lb-fm-leo pour `scenario` (mesurée avec les deux wrappers temporairement
  // ouverts sur le texte cible). Sans ça, .lb-fmfields ferait juste la
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

  // Séquence d'un scénario : lb-fm-leo se referme (choisi au tour précédent),
  // lb-fm-user s'ouvre/se redimensionne DIRECTEMENT sur la hauteur de son
  // texte final, ET s'écrit progressivement EN MÊME TEMPS (pas de pause
  // "bulle vide" avant que la frappe ne démarre — la bulle se remplit au fur
  // et à mesure qu'elle apparaît/grandit). Enfin lb-fm-leo s'ouvre à son
  // tour. Rejouée à chaque cycle, intro comprise.
  function runScenario(scenario) {
    syncFieldsMinHeight(scenario);

    userFieldEl.classList.remove("is-selected");
    leoFieldEl.classList.remove("is-selected");

    // Referme lb-fm-leo avec son texte encore actuel (celui du scénario
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
      // À ce stade lb-fm-leo-wrap est soit fermé (hauteur 0, chemin
      // reduced-motion), soit à THINKING_HEIGHT (badge de réflexion, voir
      // reveal()) — dans les deux cas assez peu ouvert/clippé pour écrire le
      // texte du scénario sans qu'il ne "flashe" à l'écran.
      leoFieldEl.textContent = scenario.leo;
      openWrapTo(leoWrapEl, leoFieldEl, scenario.leo);
      setButtonsDisabled(false);
    }

    // Court instant "Leo réfléchit" (mini badge, generating.json) avant que
    // sa rédaction n'apparaisse — voir .lb-fm-thinking.
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
  const introTarget = panel.closest(".lb-fvisual") || panel;
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

    questionEl.classList.add("lb-chat-fade");

    window.setTimeout(() => {
      questionEl.textContent = scenario.question;
      questionEl.classList.remove("lb-chat-fade");
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
