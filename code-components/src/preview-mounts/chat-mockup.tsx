import { createRoot } from "react-dom/client";
import ChatMockup from "../components/ChatMockup/ChatMockup";

const MOUNT_ID = "chat-mockup-mount";

const el = document.getElementById(MOUNT_ID);
if (el) {
  createRoot(el).render(<ChatMockup />);
} else {
  console.warn(`[preview] #${MOUNT_ID} introuvable sur la page.`);
}
