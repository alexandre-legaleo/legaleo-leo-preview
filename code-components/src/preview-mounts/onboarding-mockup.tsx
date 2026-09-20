import { createRoot } from "react-dom/client";
import OnboardingMockup from "../components/OnboardingMockup/OnboardingMockup";

const MOUNT_ID = "onboarding-mockup-mount";

const el = document.getElementById(MOUNT_ID);
if (el) {
  createRoot(el).render(<OnboardingMockup />);
} else {
  console.warn(`[preview] #${MOUNT_ID} introuvable sur la page.`);
}
