// Interactivité de confort pour la preview locale uniquement.
// HTMLtoflow ne transfère que le HTML/CSS statique : le prompt animé du
// hero, l'accordéon FAQ, les bulles de questions du bloc 02, les réactions
// des lb-fanim (blocs 02/03/04) et le parallax scroll des lb-fvisual /
// lb-ficon devront être recréés avec les Interactions Webflow une fois la
// page importée.

document.addEventListener("DOMContentLoaded", () => {
  // Hero : exemples de questions qu'on pourrait poser à Leo, en boucle
  // "machine à écrire" (écrit -> pause -> efface -> question suivante) dans
  // le faux champ de prompt .lb-heroprompt (décoratif, aria-hidden). Certaines
  // questions reprennent celles du bloc 02 pour rester cohérent.
  const heroPromptTyped = document.getElementById("lb-heroprompt-typed");

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

  document.querySelectorAll(".lb-faqitem").forEach((item) => {
    const question = item.querySelector(".lb-faqq");
    question.addEventListener("click", () => {
      const isOpen = item.classList.toggle("is-open");
      question.setAttribute("aria-expanded", String(isOpen));
    });
  });

  const bubblesEl = document.getElementById("lb-chat-bubbles");
  const bubblesTemplate = document.getElementById("lb-chat-bubbles-template");
  const chatLogEl = document.getElementById("lb-chat-log");
  const fanimEl = document.getElementById("lb-chat-fanim");

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
    // Colle le scroll en bas du flux (voir .lb-chatlog : max-height +
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
      const bubble = event.target.closest(".lb-qbubble");
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
      userEl.className = "lb-buser";
      userEl.textContent = bubble.textContent;
      chatLogEl.appendChild(userEl);

      // Faux chargement : skeleton + Leo (mini badge dédié à ce message) qui
      // mimique une réflexion en cours.
      const bleoEl = document.createElement("div");
      bleoEl.className = "lb-bleo is-thinking";
      bleoEl.innerHTML =
        `<div class="lb-bleo-icon"><div id="${iconId}" style="width:100%;height:100%"></div></div>` +
        '<div class="lb-bleo-skeleton" aria-hidden="true"><span></span><span></span><span></span></div>' +
        '<span class="lb-chat-answer"></span>' +
        '<div class="lb-srcpill">Textes officiels &amp; jurisprudence cités<span class="lb-srcpill-icon" aria-hidden="true"></span></div>';
      chatLogEl.appendChild(bleoEl);
      scrollLogToBottom();

      const answerEl = bleoEl.querySelector(".lb-chat-answer");
      const srcpillEl = bleoEl.querySelector(".lb-srcpill");

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

        // Réserve d'avance la hauteur finale de .lb-bleo (pill sources
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
            // Les bulles reprennent leur place dans le flex : .lb-chatlog
            // rétrécit d'autant, donc son ancien scrollTop ne colle plus au
            // bas — sans ce re-scroll, les bulles couvriraient le dernier
            // message au lieu de le pousser au-dessus (effet overlay).
            bubblesEl.hidden = false;
            scrollLogToBottom();

            // Réponse terminée : la mini-icône de ce message s'efface (elle a
            // fini son rôle, et évite d'empiler indéfiniment des animations
            // Lottie actives au fil de la boucle).
            bleoEl.querySelector(".lb-bleo-icon")?.classList.add("is-done");
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
  const edBody = document.getElementById("lb-ed-body");
  const edMinicheck = document.getElementById("lb-ed-minicheck");

  document.getElementById("lb-ed-recommend")?.addEventListener("click", (event) => {
    if (!edBody) return;

    const button = event.currentTarget;
    const delEl = edBody.querySelector(".lb-del");
    const addEls = [...edBody.querySelectorAll(".lb-add")];
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

  document.getElementById("lb-av-propose")?.addEventListener("click", () => {
    flashCheck("la-av", "hammer.json");
    window.leoAnims?.flashMiniCheck("la-av-check", "lb-av-minicheck");
  });

  // 04 — avocats : pioche 2-3 clauses au hasard parmi les 9 du <template>, au
  // chargement et à chaque "Relancer l'analyse", avec un bref état "scan"
  // (skeleton + anim) entre les deux pour donner l'impression d'une vraie
  // nouvelle passe plutôt qu'un simple remplacement instantané.
  const avCritlist = document.getElementById("lb-av-critlist");
  const avCritTemplate = document.getElementById("lb-av-crit-template");
  const avMinicheck = document.getElementById("lb-av-minicheck");

  // Élevé (pas de modificateur sur .lb-risk) avant moyen avant faible.
  function riskRank(critEl) {
    const riskEl = critEl.querySelector(".lb-risk");
    if (riskEl?.classList.contains("lb-risk--medium")) return 1;
    if (riskEl?.classList.contains("lb-risk--low")) return 2;
    return 0;
  }

  function renderRandomCrits() {
    if (!avCritlist || !avCritTemplate) return;

    const pool = [...avCritTemplate.content.querySelectorAll(".lb-crit")];
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

  document.getElementById("lb-av-relaunch")?.addEventListener("click", () => {
    if (!avCritlist) return;

    window.leoAnims?.swap("la-av", "scan.json", { loop: true });
    avMinicheck?.classList.add("is-visible");
    window.leoAnims?.swap("la-av-check", "generating.json", { loop: true });

    const skeletonCount = Math.random() < 0.5 ? 2 : 3;
    avCritlist.replaceChildren(
      ...Array.from({ length: skeletonCount }, () => {
        const skeleton = document.createElement("div");
        skeleton.className = "lb-crit-skeleton";
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

  // Parallax : chaque mockup .lb-fvisual dérive verticalement selon sa
  // position dans le viewport (translateY, pas de reflow). À recréer en
  // Webflow via une interaction "Scroll into View" -> Move sur chaque lb-fvisual,
  // avec un décalage de départ/arrivée équivalent à PARALLAX_STRENGTH.
  // Désactivé pour l'instant (rendu jugé bizarre sur .lb-fvisual) — gardé en
  // l'état pour être réactivé, ou réappliqué à d'autres éléments, plus tard.
  const PARALLAX_ENABLED = false;
  const visuals = document.querySelectorAll(".lb-fvisual");
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobileQuery = window.matchMedia("(max-width: 780px)");

  // Transition douce de hauteur pour les mockups dont le contenu change de
  // taille (04 relance d'analyse, 03 reveal/retract...). Cible
  // .lb-formmock/.lb-reco, pas .lb-fvisual directement : ce dernier porte des
  // badges .lb-fanim/.lb-ficon volontairement en dehors de ses bords (ex:
  // .lb-ficon-b/-c en right:-28px, bottom:-16px), qu'un overflow: hidden
  // couperait pendant la transition — .lb-fvisual grandit simplement en même
  // temps puisque sa hauteur (auto) suit celle de son enfant. CSS ne sait pas
  // transitionner height: auto ; on mesure avant/après et on anime entre deux
  // valeurs en px via ResizeObserver, puis on repasse en auto pour ne pas
  // casser le redimensionnement responsive ensuite. Exclut .lb-chatmock
  // (mockup 02, dans .lb-fvisual--chat qui a maintenant une height fixe —
  // rien à faire grandir) et #lb-fm-panel (mockup 01, dont les
  // .lb-fmfield-wrap animent déjà finement leur propre hauteur — un second
  // système de transition par-dessus se marcherait dessus).
  if (!reduceMotionQuery.matches && "ResizeObserver" in window) {
    document.querySelectorAll(".lb-formmock:not(.lb-chatmock):not(#lb-fm-panel), .lb-reco").forEach((el) => {
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
        // .lb-chatmock a flex: 1 (flex-basis: 0%), qui prime sur height pour
        // sa taille en layout flex — height seul y serait ignoré. On fige
        // aussi flex-grow/-shrink/-basis en parallèle : no-op sur un élément
        // bloc normal (.lb-formmock/.lb-reco), agissant sur un flex item.
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

  // Parallax des icônes flottantes (.lb-ficon, autour de chaque .lb-fvisual) :
  // même principe que le parallax ci-dessus (translateY selon la position
  // dans le viewport), mais avec une profondeur par icône (`data-depth`, posé
  // en HTML) pour qu'elles ne dérivent pas toutes à la même vitesse. Le léger
  // flottement continu, lui, est en CSS pure (@keyframes lb-ficon-float) et
  // se transfère tel quel vers Webflow — seul ce parallax est à recréer, voir
  // WEBFLOW-TODO.md #8.
  const ficons = document.querySelectorAll(".lb-ficon");
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
