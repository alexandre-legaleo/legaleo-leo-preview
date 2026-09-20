import { declareComponent } from "@webflow/react";
import EditorMockup from "./EditorMockup";

// Pas de props exposées au Designer : le contenu (clause, suggestion) reste
// en dur dans le composant, modifié ici en local puis republié via
// `webflow devlink import` (voir README du projet).
export default declareComponent(EditorMockup, {
  name: "Mockup — Éditeur (bloc 03)",
  description: "Révélation/retrait d'une suggestion de clause, avec animation de diff.",
  group: "Legaleo — Parcours",
});
