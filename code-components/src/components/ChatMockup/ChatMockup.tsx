import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";
import idleAnim from "./leo-anims/idle.json";
import generatingInAnim from "./leo-anims/generating-in.json";
import generatingAnim from "./leo-anims/generating.json";
import "./ChatMockup.css";

interface Question {
  question: string;
  // HTML brut (des <b> autorisés) — repris de data-answer sur le
  // <template id="lb-chat-bubbles-template"> d'origine.
  answerHTML: string;
}

// Repris tel quel du <template id="lb-chat-bubbles-template">
// (front-legaleo-leo/index.html, bloc 02).
const QUESTIONS: Question[] = [
  {
    question: "Comment structurer une clause de renouvellement ?",
    answerHTML:
      "Sauf clause contraire, un renouvellement fait naître un <b>nouveau contrat à durée indéterminée</b>. Pour conserver une durée déterminée, il faut le prévoir explicitement dans la clause.",
  },
  {
    question: "Le DIP doit être remis combien de temps avant la signature d'un contrat de franchise ?",
    answerHTML:
      "Le Document d'Information Précontractuelle (DIP) doit être remis au moins <b>vingt (20) jours</b> avant la signature du contrat ou le versement de toute somme, sous peine de nullité de l'engagement.",
  },
  {
    question: "Puis-je imposer une clause d'exclusivité territoriale ?",
    answerHTML:
      "Une exclusivité territoriale est possible, mais elle doit rester <b>proportionnée</b> à la protection du savoir-faire transmis : une zone trop large peut être requalifiée en clause abusive par le juge.",
  },
];

const THINKING_DELAY = 950;
const WORD_DELAY = 45;

export default function ChatMockup() {
  const logRef = useRef<HTMLDivElement>(null);
  const fanimRef = useRef<HTMLDivElement>(null);
  const fanimBadgeRef = useRef<HTMLDivElement>(null);
  const fanimAnimRef = useRef<AnimationItem | null>(null);
  const bubblesRef = useRef<HTMLDivElement>(null);

  // Badge Lottie unique (idle.json) affiché tant qu'aucune question n'a été
  // posée — instance persistante créée une fois au montage, comme pour
  // OnboardingMockup (voir son commentaire équivalent).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!fanimBadgeRef.current) return;
      const lottie = (await import("lottie-web")).default;
      if (cancelled || !fanimBadgeRef.current) return;
      fanimAnimRef.current = lottie.loadAnimation({
        container: fanimBadgeRef.current,
        renderer: "canvas",
        loop: true,
        autoplay: true,
        animationData: idleAnim,
      });

      const canvas = fanimBadgeRef.current.querySelector("canvas");
      if (canvas) {
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
      }
    })();

    return () => {
      cancelled = true;
      fanimAnimRef.current?.destroy();
    };
  }, []);

  // Port quasi littéral de js/main.js (bloc 02) : flux continu, cumulatif,
  // avec streaming mot par mot et un mini-badge Lottie par message — voir le
  // commentaire équivalent dans OnboardingMockup.tsx sur le choix de rester
  // en DOM impératif plutôt que de forcer ça en state React.
  useEffect(() => {
    const logEl = logRef.current;
    const fanimEl = fanimRef.current;
    const bubblesEl = bubblesRef.current;

    if (!logEl || !fanimEl || !bubblesEl) return;

    let destroyed = false;
    const pendingTimeouts: number[] = [];

    function schedule(fn: () => void, delay: number) {
      const id = window.setTimeout(() => {
        if (destroyed) return;
        fn();
      }, delay);
      pendingTimeouts.push(id);
      return id;
    }

    function scrollLogToBottom() {
      logEl!.scrollTop = logEl!.scrollHeight;
    }

    // Découpe un fragment HTML en tokens (balises / espaces / mots) pour
    // pouvoir le révéler mot par mot.
    function tokenizeHTML(html: string) {
      return html.match(/<[^>]+>|\s+|[^\s<]+/g) || [];
    }

    // Décode les entités HTML d'un token texte (&amp; -> &) sans le
    // ré-interpréter comme du HTML.
    const entityDecoder = document.createElement("textarea");
    function decodeEntities(str: string) {
      entityDecoder.innerHTML = str;
      return entityDecoder.value;
    }

    // Construit le DOM au fur et à mesure (append de noeuds) plutôt que de
    // réécrire tout le innerHTML à chaque tick : un ré-innerHTML complet
    // force Chrome à reparser/relayouter tout le paragraphe et fait
    // apparaître un interligne temporairement trop grand sur la dernière
    // ligne en cours de révélation, le temps qu'elle se stabilise.
    function streamHTML(
      el: HTMLElement,
      html: string,
      { wordDelay = 45, shouldContinue = () => true, onDone }: { wordDelay?: number; shouldContinue?: () => boolean; onDone?: () => void } = {},
    ) {
      const tokens = tokenizeHTML(html);
      el.innerHTML = "";
      const parentStack: HTMLElement[] = [el];
      let i = 0;

      function appendToken(token: string) {
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
          // recalculer la ligne en cours de révélation à chaque mot.
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
        if (destroyed || !shouldContinue()) return;
        appendToken(tokens[i]);
        if (i >= tokens.length - 1) {
          onDone?.();
          return;
        }
        const isWord = !/^\s+$/.test(tokens[i]) && !/^<[^>]+>$/.test(tokens[i]);
        i += 1;
        schedule(step, isWord ? wordDelay : 0);
      }

      step();
    }

    // Repeuple les bulles de départ — au premier chargement, et à nouveau
    // chaque fois que le pool est épuisé, pour une boucle sans fin.
    let pool: Question[] = [];
    function refillBubbles() {
      pool = [...QUESTIONS];
      bubblesEl!.replaceChildren(
        ...pool.map((q) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "chm-qbubble";
          btn.textContent = q.question;
          return btn;
        }),
      );
    }

    refillBubbles();

    let renderToken = 0;

    function handleBubbleClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      const bubble = target.closest<HTMLButtonElement>(".chm-qbubble");
      if (!bubble) return;

      const bubbleIndex = Array.from(bubblesEl!.children).indexOf(bubble);
      const picked = pool[bubbleIndex];
      if (!picked) return;

      renderToken += 1;
      const myRenderToken = renderToken;

      // La question posée quitte le pool de suggestions pour de bon (jusqu'à
      // ce qu'il soit repeuplé) ; le groupe entier se cache pendant la
      // réflexion/le streaming et ne réapparaît qu'une fois la réponse
      // terminée.
      bubblesEl!.hidden = true;
      bubble.remove();
      pool.splice(bubbleIndex, 1);

      // Le badge Leo unique ne sert plus une fois la conversation lancée :
      // chaque réponse porte désormais sa propre mini-icône (voir plus bas).
      fanimEl!.hidden = true;

      const userEl = document.createElement("div");
      userEl.className = "chm-buser";
      userEl.textContent = picked.question;
      logEl!.appendChild(userEl);

      // Faux chargement : skeleton + Leo (mini badge dédié à ce message) qui
      // mimique une réflexion en cours.
      const bleoEl = document.createElement("div");
      bleoEl.className = "chm-bleo is-thinking";

      const iconEl = document.createElement("div");
      iconEl.className = "chm-bleo-icon";
      const iconBadgeEl = document.createElement("div");
      iconBadgeEl.style.width = "100%";
      iconBadgeEl.style.height = "100%";
      iconEl.appendChild(iconBadgeEl);

      const skeletonEl = document.createElement("div");
      skeletonEl.className = "chm-bleo-skeleton";
      skeletonEl.setAttribute("aria-hidden", "true");
      skeletonEl.innerHTML = "<span></span><span></span><span></span>";

      const answerEl = document.createElement("span");
      answerEl.className = "chm-chat-answer";

      const srcpillEl = document.createElement("div");
      srcpillEl.className = "chm-srcpill";
      srcpillEl.innerHTML = 'Textes officiels &amp; jurisprudence cités<span class="chm-srcpill-icon" aria-hidden="true"></span>';

      bleoEl.append(iconEl, skeletonEl, answerEl, srcpillEl);
      logEl!.appendChild(bleoEl);
      scrollLogToBottom();

      let msgAnim: AnimationItem | null = null;
      void (async () => {
        const lottie = (await import("lottie-web")).default;
        if (destroyed || myRenderToken !== renderToken) return;
        msgAnim = lottie.loadAnimation({
          container: iconBadgeEl,
          renderer: "canvas",
          loop: false,
          autoplay: true,
          animationData: generatingInAnim,
        });
        const canvas = iconBadgeEl.querySelector("canvas");
        if (canvas) {
          canvas.style.width = "100%";
          canvas.style.height = "100%";
          canvas.style.display = "block";
        }
        msgAnim.addEventListener("complete", () => {
          if (destroyed) return;
          msgAnim?.destroy();
          msgAnim = lottie.loadAnimation({
            container: iconBadgeEl,
            renderer: "canvas",
            loop: true,
            autoplay: true,
            animationData: generatingAnim,
          });
          const loopCanvas = iconBadgeEl.querySelector("canvas");
          if (loopCanvas) {
            loopCanvas.style.width = "100%";
            loopCanvas.style.height = "100%";
            loopCanvas.style.display = "block";
          }
        });
      })();

      schedule(() => {
        if (myRenderToken !== renderToken) return; // une question plus récente a été cliquée entretemps

        bleoEl.classList.remove("is-thinking");
        // "generating" continue de tourner (déjà lancée pendant la réflexion,
        // voir plus haut) tout le temps du streaming mot à mot.

        const fullAnswerHTML = picked.answerHTML;

        // Réserve d'avance la hauteur finale de .chm-bleo (pill sources
        // comprise) pour qu'elle ne grandisse pas par à-coups à chaque ligne
        // pendant le streaming.
        answerEl.innerHTML = fullAnswerHTML;
        srcpillEl.classList.add("is-visible");
        bleoEl.style.minHeight = `${bleoEl.getBoundingClientRect().height}px`;
        srcpillEl.classList.remove("is-visible");
        answerEl.innerHTML = "";
        scrollLogToBottom();

        streamHTML(answerEl, fullAnswerHTML, {
          wordDelay: WORD_DELAY,
          shouldContinue: () => myRenderToken === renderToken,
          onDone: () => {
            srcpillEl.classList.add("is-visible");
            bleoEl.style.minHeight = "";
            if (!bubblesEl!.children.length) refillBubbles();
            // Les bulles reprennent leur place dans le flex : .chm-chatlog
            // rétrécit d'autant, donc son ancien scrollTop ne colle plus au
            // bas — sans ce re-scroll, les bulles couvriraient le dernier
            // message au lieu de le pousser au-dessus (effet overlay).
            bubblesEl!.hidden = false;
            scrollLogToBottom();

            // Réponse terminée : la mini-icône de ce message s'efface (elle
            // a fini son rôle) et son animation Lottie est détruite — sans
            // ça, une conversation qui s'allonge indéfiniment accumulerait
            // des animations actives en mémoire pour toujours (le site
            // statique d'origine se contente de les masquer en opacité,
            // sans les détruire ; ici le composant est censé rester monté
            // potentiellement très longtemps, donc autant nettoyer).
            iconEl.classList.add("is-done");
            msgAnim?.destroy();
          },
        });
      }, THINKING_DELAY);
    }

    bubblesEl.addEventListener("click", handleBubbleClick);

    return () => {
      destroyed = true;
      pendingTimeouts.forEach((id) => window.clearTimeout(id));
      bubblesEl.removeEventListener("click", handleBubbleClick);
    };
  }, []);

  return (
    <div className="chm-mockup">
      <div className="chm-chatlog" ref={logRef} />
      <div className="chm-fanim-inline" ref={fanimRef} aria-hidden="true">
        <div ref={fanimBadgeRef} style={{ width: "100%", height: "100%" }} />
      </div>
      <div className="chm-qbubbles" ref={bubblesRef} role="group" aria-label="Questions suggérées" />
    </div>
  );
}
