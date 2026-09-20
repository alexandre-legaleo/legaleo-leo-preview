import EditorMockup from "./components/EditorMockup/EditorMockup";

// Preview locale des composants avant de les republier avec
// `webflow devlink import` — pas lié au rendu réel dans Webflow (qui passe
// par les fichiers *.webflow.tsx), juste un aperçu pratique pendant le dev.
function App() {
  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 20px" }}>
      <h2>Mockup — Éditeur (bloc 03)</h2>
      <EditorMockup />
    </div>
  );
}

export default App;
