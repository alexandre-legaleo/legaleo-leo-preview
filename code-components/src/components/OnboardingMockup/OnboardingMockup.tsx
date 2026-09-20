import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";
import generatingAnim from "./leo-anims/generating.json";
import "./OnboardingMockup.css";

interface Scenario {
  question: string;
  user: string;
  leo: string;
}

// Repris tel quel de js/onboarding-demo.js (front-legaleo-leo, bloc 01).
const SCENARIOS: Scenario[] = [
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

// Ouvre lb-fm-leo-wrap à cette hauteur fixe le temps du badge "Leo réfléchit"
// (juste assez pour le rendre visible malgré l'overflow: clip du wrap replié).
const THINKING_HEIGHT = 40;
const THINKING_DURATION = 1100;
const REVEAL_DELAY = 350;
const TYPE_CHAR_DELAY = 24;
const HOLD_SELECTION_DELAY = 933; // 2800 / 3, repris de js/onboarding-demo.js

export default function OnboardingMockup() {
  const panelRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const fieldsRef = useRef<HTMLDivElement>(null);
  const userWrapRef = useRef<HTMLDivElement>(null);
  const leoWrapRef = useRef<HTMLDivElement>(null);
  const userFieldRef = useRef<HTMLDivElement>(null);
  const leoFieldRef = useRef<HTMLDivElement>(null);
  const useBtnRef = useRef<HTMLButtonElement>(null);
  const keepBtnRef = useRef<HTMLButtonElement>(null);
  const thinkingRef = useRef<HTMLDivElement>(null);
  const thinkingBadgeRef = useRef<HTMLDivElement>(null);
  const thinkingAnimRef = useRef<AnimationItem | null>(null);

  // Badge Lottie "Leo réfléchit" : instance persistante créée une fois au
  // montage (contrairement à editor/avocats, ce badge boucle indéfiniment
  // tant que le composant est monté — inutile de le détruire/recréer à
  // chaque cycle de scénario, seule sa visibilité change, voir plus bas).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!thinkingBadgeRef.current) return;
      const lottie = (await import("lottie-web")).default;
      if (cancelled || !thinkingBadgeRef.current) return;
      thinkingAnimRef.current = lottie.loadAnimation({
        container: thinkingBadgeRef.current,
        renderer: "canvas",
        loop: true,
        autoplay: true,
        animationData: generatingAnim,
      });

      const canvas = thinkingBadgeRef.current.querySelector("canvas");
      if (canvas) {
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
      }
    })();

    return () => {
      cancelled = true;
      thinkingAnimRef.current?.destroy();
    };
  }, []);

  // Port quasi littéral de js/onboarding-demo.js : la chorégraphie (mesures
  // de hauteur avant/après, frappe caractère par caractère, enchaînements de
  // setTimeout) est fondamentalement impérative — reproduire ça en state React
  // déclencherait un nouveau rendu à chaque frame/caractère pour un résultat
  // identique, pour beaucoup plus de risque de régression sur une logique de
  // timing déjà délicate. Seule différence : getElementById -> refs, plus
  // nettoyage à l'unmount (le script d'origine tournait sur une page qui ne
  // se démonte jamais).
  useEffect(() => {
    const panel = panelRef.current;
    const questionEl = questionRef.current;
    const fieldsEl = fieldsRef.current;
    const userWrapEl = userWrapRef.current;
    const leoWrapEl = leoWrapRef.current;
    const userFieldEl = userFieldRef.current;
    const leoFieldEl = leoFieldRef.current;
    const useBtn = useBtnRef.current;
    const keepBtn = keepBtnRef.current;
    const thinkingEl = thinkingRef.current;

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
      !thinkingEl
    ) {
      return;
    }

    let destroyed = false;
    let index = 0;
    let busy = false;
    const pendingTimeouts: number[] = [];
    const settleTimeouts = new WeakMap<HTMLElement, number>();

    function schedule(fn: () => void, delay: number) {
      const id = window.setTimeout(() => {
        if (destroyed) return;
        fn();
      }, delay);
      pendingTimeouts.push(id);
      return id;
    }

    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    function setButtonsDisabled(disabled: boolean) {
      useBtn!.disabled = disabled;
      keepBtn!.disabled = disabled;
    }

    function wrapOf(fieldEl: HTMLElement) {
      return fieldEl === userFieldEl ? userWrapEl! : leoWrapEl!;
    }

    // Mesure la hauteur qu'aurait `wrapEl` s'il contenait `text` — furtivement
    // (posé, lu, puis restauré à l'identique) — sans jamais peindre cet état.
    function measureWrapHeight(wrapEl: HTMLElement, fieldEl: HTMLElement, text: string) {
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

    function clearPendingSettle(wrapEl: HTMLElement) {
      const id = settleTimeouts.get(wrapEl);
      if (id !== undefined) {
        window.clearTimeout(id);
        settleTimeouts.delete(wrapEl);
      }
    }

    // Anime `wrapEl` vers la hauteur de `text`, en fondu. Cible directement la
    // hauteur du texte FINAL plutôt que du champ vide, pour éviter un layout
    // shift si le texte arrive progressivement (frappe) après coup.
    // `settle: false` laisse la hauteur épinglée en px (pas de retour à
    // "auto") quand l'appelant sait que le contenu va encore changer juste
    // après, et se charge lui-même de relâcher une fois stabilisé.
    function openWrapTo(wrapEl: HTMLElement, fieldEl: HTMLElement, text: string, { settle = true } = {}) {
      clearPendingSettle(wrapEl);
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

      requestAnimationFrame(() => {
        if (destroyed) return;
        wrapEl.style.transition = "";
        wrapEl.dataset.open = "true"; // même frame que la cible de hauteur
        wrapEl.style.height = `${target}px`;
      });

      if (settle) {
        const id = window.setTimeout(() => {
          wrapEl.style.height = "auto";
          settleTimeouts.delete(wrapEl);
        }, 470);
        settleTimeouts.set(wrapEl, id);
      }
    }

    function closeWrap(wrapEl: HTMLElement) {
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
        if (destroyed) return;
        wrapEl.style.height = "0px";
      });
    }

    // Ouvre `wrapEl` (fermé) à une petite hauteur fixe, juste assez pour
    // rendre visible le badge "Leo réfléchit" malgré l'overflow: clip.
    function openWrapToThinking(wrapEl: HTMLElement) {
      clearPendingSettle(wrapEl);
      wrapEl.dataset.open = "true";

      if (reduceMotionQuery.matches) {
        wrapEl.style.height = `${THINKING_HEIGHT}px`;
        return;
      }

      const current = wrapEl.getBoundingClientRect().height;
      wrapEl.style.transition = "none";
      wrapEl.style.height = `${current}px`;
      wrapEl.getBoundingClientRect();

      requestAnimationFrame(() => {
        if (destroyed) return;
        wrapEl.style.transition = "";
        wrapEl.style.height = `${THINKING_HEIGHT}px`;
      });
    }

    // Réserve, sur fieldsEl, la hauteur qu'occuperont ensemble les deux
    // champs pour `scenario` (mesurée avec les deux wrappers temporairement
    // ouverts sur le texte cible) — sinon justify-content: center n'aurait
    // aucun effet visible tant qu'un seul champ est ouvert.
    function syncFieldsMinHeight(scenario: Scenario) {
      const prevUserText = userFieldEl!.textContent;
      const prevLeoText = leoFieldEl!.textContent;
      const prevUserHeight = userWrapEl!.style.height;
      const prevLeoHeight = leoWrapEl!.style.height;
      const prevUserTransition = userWrapEl!.style.transition;
      const prevLeoTransition = leoWrapEl!.style.transition;

      fieldsEl!.style.minHeight = "";
      userFieldEl!.textContent = scenario.user;
      leoFieldEl!.textContent = scenario.leo;
      userWrapEl!.style.transition = "none";
      leoWrapEl!.style.transition = "none";
      userWrapEl!.style.height = "auto";
      leoWrapEl!.style.height = "auto";

      fieldsEl!.style.minHeight = `${fieldsEl!.getBoundingClientRect().height}px`;

      userWrapEl!.style.height = prevUserHeight;
      leoWrapEl!.style.height = prevLeoHeight;
      userWrapEl!.style.transition = prevUserTransition;
      leoWrapEl!.style.transition = prevLeoTransition;
      userFieldEl!.textContent = prevUserText;
      leoFieldEl!.textContent = prevLeoText;
    }

    function typeText(el: HTMLElement, text: string, onDone?: () => void) {
      let i = 0;
      function step() {
        if (destroyed) return;
        i += 1;
        el.textContent = text.slice(0, i);
        if (i < text.length) {
          schedule(step, TYPE_CHAR_DELAY);
        } else {
          onDone?.();
        }
      }
      step();
    }

    // Séquence d'un scénario : lb-fm-leo se referme (choisi au tour
    // précédent), lb-fm-user s'ouvre/se redimensionne directement sur la
    // hauteur de son texte final ET s'écrit progressivement en même temps.
    // Enfin lb-fm-leo s'ouvre à son tour, après un court "Leo réfléchit".
    function runScenario(scenario: Scenario) {
      syncFieldsMinHeight(scenario);

      userFieldEl!.classList.remove("is-selected");
      leoFieldEl!.classList.remove("is-selected");

      closeWrap(leoWrapEl!);

      openWrapTo(userWrapEl!, userFieldEl!, scenario.user, { settle: false });
      userFieldEl!.textContent = "";

      function openLeoField() {
        leoFieldEl!.textContent = scenario.leo;
        openWrapTo(leoWrapEl!, leoFieldEl!, scenario.leo);
        setButtonsDisabled(false);
      }

      function reveal() {
        userWrapEl!.style.height = "auto"; // texte stable désormais : aucun saut visible

        leoFieldEl!.textContent = "";
        openWrapToThinking(leoWrapEl!);
        thinkingEl!.classList.add("is-visible");

        schedule(() => {
          thinkingEl!.classList.remove("is-visible");
          openLeoField();
        }, THINKING_DURATION);
      }

      if (reduceMotionQuery.matches) {
        userFieldEl!.textContent = scenario.user;
        openLeoField();
        return;
      }

      typeText(userFieldEl!, scenario.user, () => schedule(reveal, REVEAL_DELAY));
    }

    function handleResize() {
      syncFieldsMinHeight(SCENARIOS[index]);
    }
    window.addEventListener("resize", handleResize);

    // N'amorce le tout premier scénario qu'au passage du bloc dans le
    // viewport ; les cycles suivants (après un clic) démarrent immédiatement.
    const introTarget = panel.closest(".lb-fvisual") || panel;
    let introObserver: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      introObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            observer.disconnect();
            runScenario(SCENARIOS[index]);
          });
        },
        { threshold: 0.4 },
      );
      introObserver.observe(introTarget);
    } else {
      runScenario(SCENARIOS[index]);
    }

    function holdSelection() {
      return new Promise<void>((resolve) => schedule(resolve, HOLD_SELECTION_DELAY));
    }

    function showNextScenario() {
      index = (index + 1) % SCENARIOS.length;
      const scenario = SCENARIOS[index];

      questionEl!.classList.add("obm-fade");

      schedule(() => {
        questionEl!.textContent = scenario.question;
        questionEl!.classList.remove("obm-fade");
        runScenario(scenario);
      }, 200);
    }

    async function handleChoice(fieldEl: HTMLElement) {
      if (busy) return;
      busy = true;
      setButtonsDisabled(true);

      const otherEl = fieldEl === userFieldEl ? leoFieldEl! : userFieldEl!;
      fieldEl.classList.add("is-selected");

      // Ne garde que l'option choisie, recentrée à la place des deux — le
      // champ restant suit tout seul via le flex reflow pendant que l'autre
      // wrapper se referme.
      closeWrap(wrapOf(otherEl));

      await holdSelection();
      if (destroyed) return;
      showNextScenario();
      busy = false;
    }

    function onUseClick() {
      void handleChoice(leoFieldEl!);
    }
    function onKeepClick() {
      void handleChoice(userFieldEl!);
    }
    function onUseEnter() {
      leoFieldEl!.classList.add("is-hint");
    }
    function onUseLeave() {
      leoFieldEl!.classList.remove("is-hint");
    }
    function onKeepEnter() {
      userFieldEl!.classList.add("is-hint");
    }
    function onKeepLeave() {
      userFieldEl!.classList.remove("is-hint");
    }

    useBtn.addEventListener("click", onUseClick);
    keepBtn.addEventListener("click", onKeepClick);
    useBtn.addEventListener("mouseenter", onUseEnter);
    useBtn.addEventListener("mouseleave", onUseLeave);
    keepBtn.addEventListener("mouseenter", onKeepEnter);
    keepBtn.addEventListener("mouseleave", onKeepLeave);

    return () => {
      destroyed = true;
      pendingTimeouts.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("resize", handleResize);
      introObserver?.disconnect();
      useBtn.removeEventListener("click", onUseClick);
      keepBtn.removeEventListener("click", onKeepClick);
      useBtn.removeEventListener("mouseenter", onUseEnter);
      useBtn.removeEventListener("mouseleave", onUseLeave);
      keepBtn.removeEventListener("mouseenter", onKeepEnter);
      keepBtn.removeEventListener("mouseleave", onKeepLeave);
    };
  }, []);

  return (
    <div className="obm-mockup" ref={panelRef}>
      <div className="obm-fmtitle">Paramètres du contrat</div>
      <div className="obm-fmq" ref={questionRef}>
        {SCENARIOS[0].question}
      </div>
      <div className="obm-fmfields" ref={fieldsRef}>
        <div className="obm-fmfield-wrap" ref={userWrapRef} data-open="true">
          <div className="obm-fmfield" ref={userFieldRef}>
            {SCENARIOS[0].user}
          </div>
        </div>
        <div className="obm-fmfield-wrap is-collapsed" ref={leoWrapRef} data-open="false">
          <div className="obm-fm-thinking" ref={thinkingRef} aria-hidden="true">
            <div ref={thinkingBadgeRef} style={{ width: "100%", height: "100%" }} />
          </div>
          <div className="obm-fmfield obm-fmleo" ref={leoFieldRef}>
            {SCENARIOS[0].leo}
          </div>
        </div>
      </div>
      <div className="obm-miniact">
        <button type="button" className="obm-sugg obm-sugg-solid" ref={useBtnRef}>
          Utiliser la version Leo
        </button>
        <button type="button" className="obm-sugg" ref={keepBtnRef}>
          Garder ma version
        </button>
      </div>
    </div>
  );
}
