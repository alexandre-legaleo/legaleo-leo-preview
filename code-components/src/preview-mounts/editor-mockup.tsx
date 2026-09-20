// Point d'entrée du bundle de preview autonome (voir vite.preview.config.ts).
// Chargé via <script> dans front-legaleo-leo/index.html à la place du
// .lb-reco statique du bloc 03 : se monte tout seul dans la div qui l'attend,
// React + ReactDOM inclus dans ce bundle (page hôte purement statique, elle
// ne les fournit pas). Aucun rapport avec le bundle *.webflow.tsx utilisé
// pour le vrai push Webflow (voir webflow.json) — celui-ci sert uniquement à
// prévisualiser le composant en place, dans le contexte de toute la page.
import { createRoot } from "react-dom/client";
import EditorMockup from "../components/EditorMockup/EditorMockup";

const MOUNT_ID = "editor-mockup-mount";

const el = document.getElementById(MOUNT_ID);
if (el) {
  createRoot(el).render(<EditorMockup />);
} else {
  console.warn(`[preview] #${MOUNT_ID} introuvable sur la page.`);
}
