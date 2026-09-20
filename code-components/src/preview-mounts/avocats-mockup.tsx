import { createRoot } from "react-dom/client";
import AvocatsMockup from "../components/AvocatsMockup/AvocatsMockup";

const MOUNT_ID = "avocats-mockup-mount";

const el = document.getElementById(MOUNT_ID);
if (el) {
  createRoot(el).render(<AvocatsMockup />);
} else {
  console.warn(`[preview] #${MOUNT_ID} introuvable sur la page.`);
}
