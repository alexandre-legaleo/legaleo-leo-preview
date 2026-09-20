import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Bundle(s) de preview autonome(s) — voir src/preview-mounts/*.tsx et le
// commentaire en tête de ces fichiers. Séparé du build CRA (isolé, sans le
// reste du site) et du bundler Webflow (production, *.webflow.tsx).
//
// Un entry point par mockup ; format ES ("type=module" dans le <script>) au
// lieu d'IIFE pour pouvoir en ajouter d'autres sans les contraintes d'IIFE
// sur les chunks partagés entre plusieurs entrées.
export default defineConfig({
  plugins: [react()],
  // react-dom/client lit process.env.NODE_ENV directement (pas import.meta.env) ;
  // en mode lib, Vite ne le remplace pas automatiquement comme il le fait pour
  // une app classique — sans ça, `process` est undefined à l'exécution dans le
  // navigateur et le crash empêche silencieusement tout rendu (mount div vide).
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  // Sans ça, Vite copie aussi le contenu de public/ (favicon, index.html...
  // de create-react-app) dans preview-dist/, sans rapport avec ce build.
  publicDir: false,
  build: {
    outDir: "preview-dist",
    emptyOutDir: false,
    lib: {
      entry: {
        "editor-mockup": resolve(__dirname, "src/preview-mounts/editor-mockup.tsx"),
        "avocats-mockup": resolve(__dirname, "src/preview-mounts/avocats-mockup.tsx"),
        "onboarding-mockup": resolve(__dirname, "src/preview-mounts/onboarding-mockup.tsx"),
        "chat-mockup": resolve(__dirname, "src/preview-mounts/chat-mockup.tsx"),
      },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
  },
});
