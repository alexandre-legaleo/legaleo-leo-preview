import { declareComponent } from "@webflow/react";
import ChatMockup from "./ChatMockup";

export default declareComponent(ChatMockup, {
  name: "Mockup — Chat (bloc 02)",
  description: "Flux de questions/réponses cumulatif, avec streaming mot par mot et sources citées.",
  group: "Legaleo — Parcours",
});
