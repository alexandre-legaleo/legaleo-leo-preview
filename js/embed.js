// Page affichée dans un iframe (ex. onglet « Agent Leo » de www.legaleo.ai).
// Hors iframe, ce script ne fait rien. Dans un iframe :
//   1. pose la classe .is-embedded sur <html> (voir hero.css : plus de
//      min-height: 100vh, sinon 100vh = hauteur de l'iframe, qui s'ajuste à la
//      hauteur de la page → le hero grandirait en boucle) ;
//   2. envoie la hauteur de la page au parent, qui ajuste l'iframe :
//      { type: "leo-agent:height", height } ;
//   3. délègue au parent le défilement vers les ancres internes
//      ({ type: "leo-agent:scroll", y }) : l'iframe fait la hauteur de la
//      page, elle ne défile pas, c'est la page parente qui doit défiler.
// Côté parent (élément Embed Webflow) : voir webflow-embed.html.
(() => {
  let embedded;
  try {
    embedded = window.self !== window.top;
  } catch (e) {
    embedded = true; // accès à window.top refusé : on est bien dans un iframe
  }
  if (!embedded) return;

  document.documentElement.classList.add("is-embedded");

  // Seules origines à qui on envoie des messages : postMessage livre le message
  // uniquement si l'origine de la page parente correspond (jamais de "*").
  const PARENT_ORIGINS = ["https://www.legaleo.ai", "https://legaleo.webflow.io"];

  // document.referrer d'un iframe = page parente. Si son origine est dans la
  // liste, on n'écrit qu'à elle ; sinon (referrer masqué), aux deux.
  let targetOrigin = null;
  try {
    const refOrigin = new URL(document.referrer).origin;
    if (PARENT_ORIGINS.includes(refOrigin)) targetOrigin = refOrigin;
  } catch (e) {}

  const post = (message) => {
    (targetOrigin ? [targetOrigin] : PARENT_ORIGINS).forEach((origin) => {
      window.parent.postMessage(message, origin);
    });
  };

  // <html> et non scrollHeight : scrollHeight vaut au moins la hauteur du
  // viewport, donc l'iframe ne pourrait jamais rétrécir (ex. fenêtre élargie).
  const root = document.documentElement;
  let lastHeight = 0;
  const sendHeight = () => {
    const height = Math.ceil(root.getBoundingClientRect().height);
    if (height === lastHeight) return;
    lastHeight = height;
    post({ type: "leo-agent:height", height });
  };

  new ResizeObserver(sendHeight).observe(root);
  // Renvoie inconditionnellement au chargement complet : si le parent n'écoutait
  // pas encore au premier envoi, il rattrape ici.
  window.addEventListener("load", () => {
    lastHeight = 0;
    sendHeight();
  });

  document.addEventListener("click", (e) => {
    const link = e.target.closest && e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute("href").slice(1);
    const target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    post({
      type: "leo-agent:scroll",
      y: Math.round(target.getBoundingClientRect().top + window.pageYOffset),
    });
  });
})();
