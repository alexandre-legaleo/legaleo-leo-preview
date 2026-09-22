import { useEffect, useRef, useState } from "react";
import type { AnimationItem } from "lottie-web";
import generatingAnim from "./leo-anims/generating.json";
import "./EditorMockup.css";
import { roundCaps } from "../../roundCaps";

// Timings repris tel quels de js/main.js (front-legaleo-leo, bloc 03).
const STRIKE_DURATION = 450;
const ADD_STAGGER = 150;
const ADD_FADE_DURATION = 400;

// dangerouslySetInnerHTML plutôt que du JSX avec des refs par <span> : évite
// tout piège d'espaces avalés par JSX (le texte alterne segments bruts et
// spans sans espace/avec espace selon le cas) et reproduit le HTML source à
// l'identique. Les .edm-add/.edm-del sont ensuite manipulés impérativement
// via bodyRef, exactement comme dans js/main.js (querySelector au lieu de
// getElementById, sinon la logique est inchangée).
const BODY_HTML =
  "…pendant une durée " +
  '<span class="edm-del">d\'une</span>' +
  '<span class="edm-add" hidden> d\'un (1) an</span>' +
  " suivant la résiliation ou l'expiration du Contrat, le Franchisé s'interdit" +
  '<span class="edm-add" hidden>, exclusivement dans le local où était situé l\'Établissement,</span>' +
  " d'exercer une Activité Concurrente." +
  '<span class="edm-add" hidden> Cette interdiction est strictement limitée à ce local et ne s\'étend à aucun autre territoire.</span>';

export default function EditorMockup() {
  const [revealed, setRevealed] = useState(false);
  const [miniVisible, setMiniVisible] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const miniBadgeRef = useRef<HTMLDivElement>(null);
  const miniAnimRef = useRef<AnimationItem | null>(null);
  const timeoutsRef = useRef<number[]>([]);

  function clearScheduled() {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];
  }

  function schedule(fn: () => void, delay: number) {
    timeoutsRef.current.push(window.setTimeout(fn, delay));
  }

  // Nettoyage si le composant est démonté en pleine séquence (Lottie +
  // timers en attente).
  useEffect(() => {
    return () => {
      clearScheduled();
      miniAnimRef.current?.destroy();
    };
  }, []);

  // Import dynamique : lottie-web touche HTMLCanvasElement dès son chargement
  // (au niveau module), ce qui plante l'étape "Collecting metadata" du CLI
  // Webflow (bundle exécuté dans un jsdom sans vrai canvas pour l'analyser).
  // Chargé ainsi, le module ne s'exécute qu'au clic, jamais pendant l'analyse
  // statique côté build.
  async function playMiniBadge() {
    if (!miniBadgeRef.current) return;
    const lottie = (await import("lottie-web")).default;
    if (!miniBadgeRef.current) return; // le composant a pu être démonté entretemps
    miniAnimRef.current?.destroy();
    miniAnimRef.current = lottie.loadAnimation({
      container: miniBadgeRef.current,
      // canvas (pas svg) : generating.json est fait de plusieurs paths
      // distincts (coins + rectangles) qui se touchent — le renderer SVG
      // laisse un filet de 1px entre eux (anti-aliasing par path indépendant).
      // Le renderer canvas rasterise tout en un seul bitmap par frame, ce qui
      // élimine ce filet. Sans lien avec le fix du dynamic import plus haut
      // (celui-ci protège le "Collecting metadata" du CLI, indépendamment du
      // renderer demandé ici).
      renderer: "canvas",
      loop: true,
      autoplay: true,
      animationData: roundCaps(generatingAnim),
    });

    // Le renderer canvas de lottie-web pose parfois un <canvas> dont la
    // taille (attributs width/height, donc son buffer de dessin) ne colle
    // pas exactement à celle de son conteneur mesurée après coup — visible
    // ici en icône rétrécie/décentrée. On force le canvas généré à occuper
    // tout l'espace disponible plutôt que de laisser Lottie décider seul.
    const canvas = miniBadgeRef.current.querySelector("canvas");
    if (canvas) {
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
    }
  }

  function handleClick() {
    const body = bodyRef.current;
    if (!body) return;

    // Repart de zéro si on reclique en cours de séquence.
    clearScheduled();

    const delEl = body.querySelector<HTMLElement>(".edm-del");
    const addEls = [...body.querySelectorAll<HTMLElement>(".edm-add")];

    if (!revealed) {
      setRevealed(true);

      // Badge "Leo travaille" pendant toute la révélation — pas de check de
      // confirmation, il s'efface une fois la suggestion affichée.
      setMiniVisible(true);
      void playMiniBadge();

      // Reset défensif (pour rejouer proprement si l'état DOM était
      // incohérent), puis révèle : le mot retiré se barre, puis les ajouts
      // apparaissent en fondu un par un.
      addEls.forEach((el) => {
        el.classList.remove("is-visible");
        el.hidden = true;
      });
      void body.offsetWidth; // force le reflow avant de relancer les transitions

      schedule(() => delEl?.classList.add("is-struck"), 50);

      addEls.forEach((el, index) => {
        schedule(() => {
          el.hidden = false;
          void el.offsetWidth;
          el.classList.add("is-visible");
        }, STRIKE_DURATION + index * ADD_STAGGER);
      });

      schedule(() => {
        setMiniVisible(false);
      }, STRIKE_DURATION + addEls.length * ADD_STAGGER + 300);
    } else {
      setRevealed(false);

      // Animation inverse : les ajouts s'effacent en fondu, du dernier au
      // premier, puis le mot retiré redevient du texte normal.
      [...addEls].reverse().forEach((el, index) => {
        schedule(() => {
          el.classList.remove("is-visible");
          schedule(() => {
            el.hidden = true;
          }, ADD_FADE_DURATION);
        }, index * ADD_STAGGER);
      });

      const unstrikeDelay = addEls.length * ADD_STAGGER + ADD_FADE_DURATION;
      schedule(() => delEl?.classList.remove("is-struck"), unstrikeDelay);
    }
  }

  return (
    <div className="edm-reco">
      <div className="edm-recoh">
        ♦ Recommandation de l'IA <span>Art. 18.2, Non-concurrence</span>
      </div>
      <div className="edm-recobody" ref={bodyRef} dangerouslySetInnerHTML={{ __html: BODY_HTML }} />
      <div className="edm-miniact">
        <button type="button" className="edm-sugg edm-sugg-solid" onClick={handleClick}>
          {revealed ? "Retirer la recommandation" : "Demander une amélioration"}
        </button>
        <span className={miniVisible ? "edm-minicheck is-visible" : "edm-minicheck"}>
          <div ref={miniBadgeRef} style={{ width: "100%", height: "100%" }} />
        </span>
      </div>
    </div>
  );
}
