import { useEffect, useRef, useState } from "react";
import type { AnimationItem } from "lottie-web";
import generatingAnim from "./leo-anims/generating.json";
import "./AvocatsMockup.css";

type Risk = "high" | "medium" | "low";

interface CritItem {
  id: string;
  title: string;
  risk: Risk;
  text: string;
}

// Pool de 9 clauses repris tel quel du <template id="lb-av-crit-template">
// (front-legaleo-leo/index.html, bloc 04) : le composant pioche 2-3 cartes
// dedans au lieu de lire un <template> DOM.
const CRIT_POOL: CritItem[] = [
  {
    id: "reaffiliation",
    title: "Clause de non-réaffiliation étendue",
    risk: "high",
    text: "L'interdiction sur tout le territoire national excède ce qui est nécessaire à la protection du savoir-faire et pourrait être jugée disproportionnée.",
  },
  {
    id: "indemnite",
    title: "Indemnité de rupture non réductible",
    risk: "high",
    text: "La clause pénale qualifiée de non réductible contrevient au pouvoir de modération du juge et pourrait être jugée abusive.",
  },
  {
    id: "dip",
    title: "Délai de remise du DIP",
    risk: "high",
    text: "Le Document d'Information Précontractuelle n'est pas remis vingt jours avant la signature, ce qui expose le contrat à une action en nullité.",
  },
  {
    id: "nonconcurrence",
    title: "Non-concurrence post-contractuelle",
    risk: "high",
    text: "Ni durée ni périmètre géographique ne sont précisés : une clause de non-concurrence indéterminée risque d'être annulée par le juge.",
  },
  {
    id: "redevance",
    title: "Redevance minimale garantie",
    risk: "medium",
    text: "Le montant dû indépendamment du chiffre d'affaires réalisé, sans contrepartie prévue, pourrait être requalifié en clause abusive.",
  },
  {
    id: "exclusivite",
    title: "Exclusivité territoriale figée",
    risk: "medium",
    text: "Aucune clause de revoyure sur le périmètre : un marché local en forte évolution pourrait justifier une renégociation non prévue au contrat.",
  },
  {
    id: "mediation",
    title: "Clause de médiation préalable absente",
    risk: "medium",
    text: "Aucune tentative de résolution amiable n'est prévue avant saisine du juge, ce qui allonge les délais en cas de litige.",
  },
  {
    id: "preavis",
    title: "Préavis de renouvellement court",
    risk: "low",
    text: "Le préavis de trois mois est conforme, mais reste court au regard des usages observés dans le secteur.",
  },
  {
    id: "savoirfaire",
    title: "Mise à jour du savoir-faire",
    risk: "low",
    text: "Les modalités d'actualisation du savoir-faire transmis pendant la durée du contrat gagneraient à être précisées.",
  },
];

const RISK_RANK: Record<Risk, number> = { high: 0, medium: 1, low: 2 };
const RISK_LABEL: Record<Risk, string> = {
  high: "Risque élevé",
  medium: "Risque moyen",
  low: "Risque faible",
};

// Repris de js/main.js (RELAUNCH_DELAY == la durée du "scan" avant nouvelle passe).
const RELAUNCH_DELAY = 800;

function pickRandomCrits(): CritItem[] {
  const count = Math.random() < 0.5 ? 2 : 3;
  return [...CRIT_POOL]
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, count)
    .map(({ item }) => item)
    .sort((a, b) => RISK_RANK[a.risk] - RISK_RANK[b.risk]);
}

export default function AvocatsMockup() {
  const [crits, setCrits] = useState<CritItem[]>(() => pickRandomCrits());
  const [isScanning, setIsScanning] = useState(false);
  const [skeletonCount, setSkeletonCount] = useState(2);
  const [miniVisible, setMiniVisible] = useState(false);
  const mockupRef = useRef<HTMLDivElement>(null);
  const miniBadgeRef = useRef<HTMLDivElement>(null);
  const miniAnimRef = useRef<AnimationItem | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      miniAnimRef.current?.destroy();
    };
  }, []);

  // Import dynamique : voir EditorMockup.tsx pour le détail (lottie-web
  // touche HTMLCanvasElement au chargement du module, ce qui plante l'étape
  // "Collecting metadata" du CLI Webflow si l'import est statique).
  async function playMiniBadge() {
    if (!miniBadgeRef.current) return;
    const lottie = (await import("lottie-web")).default;
    if (!miniBadgeRef.current) return;
    miniAnimRef.current?.destroy();
    miniAnimRef.current = lottie.loadAnimation({
      container: miniBadgeRef.current,
      renderer: "canvas",
      loop: true,
      autoplay: true,
      animationData: generatingAnim,
    });

    const canvas = miniBadgeRef.current.querySelector("canvas");
    if (canvas) {
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
    }
  }

  function handleRelaunch() {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);

    // Fige la largeur mesurée avant de basculer sur le skeleton : les cartes
    // skeleton (des <span> vides à largeur en %, sans texte) n'ont presque
    // aucune largeur intrinsèque, donc dans un conteneur hôte qui dimensionne
    // par shrink-to-fit (fréquent côté Webflow selon la section où le
    // composant est déposé), la boîte s'écroulerait visiblement le temps du
    // scan. On verrouille en px la largeur déjà correcte des vraies cartes,
    // puis on relâche (retour à width: 100%, voir AvocatsMockup.css) une fois
    // les nouvelles cartes affichées.
    if (mockupRef.current) {
      mockupRef.current.style.width = `${mockupRef.current.getBoundingClientRect().width}px`;
    }

    setIsScanning(true);
    setSkeletonCount(Math.random() < 0.5 ? 2 : 3);
    setMiniVisible(true);
    void playMiniBadge();

    timeoutRef.current = window.setTimeout(() => {
      setCrits(pickRandomCrits());
      setIsScanning(false);
      setMiniVisible(false);
      if (mockupRef.current) {
        mockupRef.current.style.width = "";
      }
    }, RELAUNCH_DELAY);
  }

  return (
    <div className="avm-mockup" ref={mockupRef}>
      <div className="avm-critlist">
        {isScanning
          ? Array.from({ length: skeletonCount }, (_, index) => (
              <div className="avm-crit-skeleton" key={`skeleton-${index}`}>
                <span />
                <span />
                <span />
              </div>
            ))
          : crits.map((crit, index) => (
              <div className="avm-crit" style={{ animationDelay: `${index * 90}ms` }} key={crit.id}>
                <div className="avm-critt">
                  {crit.title}
                  <span className={crit.risk === "high" ? "avm-risk" : `avm-risk avm-risk--${crit.risk}`}>
                    {RISK_LABEL[crit.risk]}
                  </span>
                </div>
                <p className="avm-critp">{crit.text}</p>
              </div>
            ))}
      </div>
      <div className="avm-miniact">
        <button type="button" className="avm-sugg" onClick={handleRelaunch}>
          Relancer l'analyse
        </button>
        <span className={miniVisible ? "avm-minicheck is-visible" : "avm-minicheck"}>
          <div ref={miniBadgeRef} style={{ width: "100%", height: "100%" }} />
        </span>
      </div>
    </div>
  );
}
