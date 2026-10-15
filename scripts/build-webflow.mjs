// Build Webflow natif (sans iframe) : `pnpm build:webflow`.
//
// Le HTML de chaque page part dans des éléments Code Embed de la page
// Webflow. Le contenu est alors dans le source de www.legaleo.ai, donc
// indexé, ce que l'iframe GitHub Pages ne permettait pas. CSS et JS restent
// hébergés sur GitHub Pages (trop gros pour le custom code Webflow, limité
// à 50 000 caractères), chargés par les snippets head / footer de la page.
//
// Même build que front-legaleo-homepage (scripts/build-webflow.mjs), réglé
// pour la page Agent Leo (www.legaleo.ai/agent-ia-franchise-leo).
//
// Sortie : webflow/<page>/
//   embed-N.html   à coller chacun dans un Code Embed (< 50 000 caractères),
//                  dans l'ordre, à l'intérieur d'un Div Block de classe
//                  « lg-page » ;
//   head.html      Page settings > Custom code > Inside <head> tag ;
//   footer.html    Page settings > Custom code > Before </body> tag ;
//   page.css / page.js : chargés par head.html / footer.html.
//
// Le CSS est confiné au wrapper .lg-page : reset et styles de body passent
// sous :where(.lg-page) (spécificité inchangée, la nav et le footer Webflow
// ne sont pas touchés). Les règles « .is-embedded » (nav fixe de
// legaleo.ai à dégager) s'appliquent désormais toujours.
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://alexandre-legaleo.github.io/legaleo-leo-preview/";
const EMBED_MAX = 49000; // limite Webflow : 50 000 caractères par Code Embed
// Hauteur de la nav fixe de legaleo.ai (80 px desktop, 78 px mobile), plus
// un peu d'air : sections visées par une ancre, défilement de la page contact.
const NAV_OFFSET = 80;

const read = (p) => readFileSync(join(ROOT, p), "utf8");
// ?v= des snippets : empreinte du contenu, change seulement quand le fichier
// change (pas besoin de recoller head / footer dans Webflow sinon).
const hash = (...contents) => createHash("sha1").update(contents.join("\0")).digest("hex").slice(0, 8);

// ---------- CSS ----------

// reset.css confiné au wrapper. :where() garde la spécificité d'origine
// (sinon « .lg-page a » battrait « .hp-btn »).
const SCOPED_RESET = `
/* Le CSS du site Webflow style les balises nues (p 1.2rem, h1 à h6, ul
   padding 40px, sup décalé, label en bloc…), là où la page compte sur les
   valeurs du navigateur. Retour à ces valeurs (revert) dans le wrapper, à
   spécificité égale mais chargé après : nos classes passent toujours devant.
   Pas sur le SVG : revert y effacerait les attributs fill, stroke… */
:where(.lg-page) :is(p, h1, h2, h3, h4, h5, h6, ul, ol, li, a, b, strong, em, small, sub, sup, img, label, blockquote, figure, figcaption, button, input, select, textarea, summary, details, span, div, section, main, header, footer, nav, article) { all: revert; box-sizing: border-box; }
/* Typo du body Webflow (taille, interligne, graisse) : celle du navigateur. */
:where(.lg-page) { font-size: 16px; line-height: normal; font-weight: 400; letter-spacing: normal; text-align: left; }
:where(.lg-page),
:where(.lg-page) *,
:where(.lg-page) *::before,
:where(.lg-page) *::after { box-sizing: border-box; }
:where(.lg-page) { --anchor-offset: ${NAV_OFFSET + 16}px; }
:where(.lg-page) section[id] { scroll-margin-top: var(--anchor-offset, 0px); }
:where(.lg-page) img,
:where(.lg-page) svg { display: block; max-width: 100%; }
/* normalize Webflow : svg:not(:root) { overflow: hidden }. Un SVG de la page
   qui passerait en overflow visible avec une seule classe est à ajouter ici
   avec .lg-page devant (cf. front-legaleo-homepage). */
:where(.lg-page) svg:not(:root) { overflow: revert; }
:where(.lg-page) a { color: inherit; text-decoration: none; }
:where(.lg-page) button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
:where(.lg-page) ul { margin: 0; padding: 0; list-style: none; }
:where(.lg-page) h1,
:where(.lg-page) h2,
:where(.lg-page) h3,
:where(.lg-page) h4,
:where(.lg-page) p { margin: 0; }
/* Code Embed Webflow : pas de clearfix entre les morceaux de la page. */
.lg-page > .w-embed::before,
.lg-page > .w-embed::after { content: none; }
`;

const cssFile = (file) => {
  let css = read(`css/${file}`);
  if (file === "reset.css") return SCOPED_RESET;
  if (file === "fonts.css") css = css.replaceAll("../fonts/", `${BASE}fonts/`);
  // Styles de body (base.css, contact.css) : portés par le wrapper.
  css = css.replace(/^body \{/gm, ":where(.lg-page) {");
  // Premier écran : 100svh suffit hors iframe, --fold-h n'existe plus.
  css = css.replace(/\.is-embedded \.hp-fold \{[^}]*\}\s*/g, "");
  // La nav fixe recouvre toujours le haut de la page : on la dégage.
  css = css.replaceAll(".is-embedded ", ".lg-page ");
  // Hero plein écran hors iframe : 100svh au lieu de la hauteur envoyée par
  // la page parente (--embed-vh).
  css = css.replaceAll("var(--embed-vh, auto)", "100svh");
  css = css.replaceAll("url('/assets/", `url('${BASE}assets/`);
  return `/* ${file} */\n${css}`;
};

// footer.css : footer de la preview locale, absent de la page (footer Webflow).
const cssOf = (html) =>
  [...html.matchAll(/<link rel="stylesheet" href="css\/([^"]+)"/g)]
    .filter((m) => m[1] !== "footer.css")
    .map((m) => cssFile(m[1]))
    .concat(`/* code-components.css */\n${read("code-components/preview-dist/code-components.css")}`)
    .join("\n");

// ---------- HTML ----------

const absolutize = (html) => html.replace(/(src|href|srcset|poster)="(assets|fonts|leo-anims)\//g, `$1="${BASE}$2/`);

const minify = (html) =>
  html
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");

// Découpe en morceaux < EMBED_MAX, uniquement entre deux éléments de premier
// niveau (un Code Embed doit contenir du HTML complet).
const topLevelBlocks = (html) => {
  const blocks = [];
  let depth = 0;
  let start = 0;
  const re = /<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g;
  const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr", "path", "circle", "rect", "line", "polyline", "polygon", "ellipse", "stop", "use", "feGaussianBlur", "feOffset", "feBlend", "feMerge", "feMergeNode", "feColorMatrix", "feComposite", "feFlood"]);
  let m;
  while ((m = re.exec(html))) {
    const [, closing, tag, selfClosing] = m;
    if (selfClosing || (VOID.has(tag) && !closing)) {
      if (depth === 0) {
        blocks.push(html.slice(start, re.lastIndex));
        start = re.lastIndex;
      }
      continue;
    }
    // Contenu de <script>/<style>/<template> : pas de balises à suivre dedans
    if (!closing && (tag === "script" || tag === "style")) {
      const end = html.indexOf(`</${tag}>`, re.lastIndex);
      re.lastIndex = end + tag.length + 3;
      if (depth === 0) {
        blocks.push(html.slice(start, re.lastIndex));
        start = re.lastIndex;
      }
      continue;
    }
    depth += closing ? -1 : 1;
    if (depth < 0) throw new Error(`Balise fermante en trop : </${tag}> à ${m.index}`);
    if (depth === 0) {
      blocks.push(html.slice(start, re.lastIndex));
      start = re.lastIndex;
    }
  }
  if (depth !== 0) throw new Error(`HTML non équilibré (profondeur ${depth})`);
  const rest = html.slice(start).trim();
  if (rest) blocks.push(rest);
  return blocks.map((b) => b.trim()).filter(Boolean);
};

const chunk = (blocks) => {
  const chunks = [];
  let cur = "";
  for (const b of blocks) {
    if (b.length > EMBED_MAX) throw new Error(`Bloc trop gros pour un Code Embed (${b.length}) : ${b.slice(0, 80)}`);
    if (cur && cur.length + 1 + b.length > EMBED_MAX) {
      chunks.push(cur);
      cur = "";
    }
    cur = cur ? `${cur}\n${b}` : b;
  }
  if (cur) chunks.push(cur);
  return chunks;
};

const between = (html, open, close) => {
  const a = html.indexOf(open);
  const b = html.lastIndexOf(close);
  if (a < 0 || b < 0) throw new Error(`${open} … ${close} introuvable`);
  return html.slice(a + open.length, b);
};

// ---------- Pages ----------

const FONTS_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@300;400;500;600;700&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet" />`;

// Le CSS du site Webflow garde des classes lb-* d'un ancien import de cette
// page (62 en commun : .lb-hero, .lb-h1, .lb-step-n…), qui fuiraient sur la
// page. Toute la sortie (HTML, CSS, JS, composants) passe donc en lv-*. Les
// sources restent en lb-*.
const PREFIX_FROM = /(?<![\w-])lb-(?=[a-zA-Z0-9])/g;
const rename = (text) => text.replace(PREFIX_FROM, "lv-");

// Composants React (code-components/preview-dist, modules ES, animations
// Lottie incluses) : copiés renommés dans webflow/leo/components/ (le bundle
// onboarding cherche .lb-fvisual), avec leurs chunks, imports relatifs intacts.
const COMPONENTS = ["editor-mockup", "avocats-mockup", "onboarding-mockup", "chat-mockup"];
const COMPONENTS_DIR = "code-components/preview-dist";

const PAGES = [
  {
    name: "leo",
    source: "index.html",
    // Le wrapper .lg-page est le <main> (Div Block, tag « main » dans Webflow).
    body: (html) => between(html, "<main>", "</main>"),
    js: () =>
      ["js/anims.js", "js/onboarding-demo.js", "js/main.js"]
        .map((f) => `// ${f}\n` + read(f).replaceAll("fetch(`leo-anims/", `fetch(\`${BASE}leo-anims/`))
        .join("\n"),
    head: () => "",
    footer: (v) => `<script src="https://cdn.jsdelivr.net/npm/lottie-web@5.12.2/build/player/lottie_canvas.min.js"></script>
<script src="${BASE}webflow/leo/page.js?v=${v}"></script>
${COMPONENTS.map((c) => `<script type="module" src="${BASE}webflow/leo/components/${c}.js?v=${hash(read(`${COMPONENTS_DIR}/${c}.js`))}"></script>`).join("\n")}`,
  },
];

rmSync(join(ROOT, "webflow"), { recursive: true, force: true });

for (const page of PAGES) {
  const html = read(page.source);
  const out = join(ROOT, "webflow", page.name);
  mkdirSync(out, { recursive: true });

  const body = rename(minify(absolutize(page.body(html))));
  const embeds = chunk(topLevelBlocks(body));
  embeds.forEach((e, i) => writeFileSync(join(out, `embed-${i + 1}.html`), e + "\n"));

  const css = rename(cssOf(html));
  const js = rename(page.js());

  mkdirSync(join(out, "components"));
  for (const file of readdirSync(join(ROOT, COMPONENTS_DIR)).filter((f) => /\.m?js$/.test(f))) {
    writeFileSync(join(out, "components", file), rename(read(`${COMPONENTS_DIR}/${file}`)));
  }
  writeFileSync(join(out, "page.css"), css);
  writeFileSync(join(out, "page.js"), js);

  const head = [FONTS_HEAD, `<link rel="stylesheet" href="${BASE}webflow/${page.name}/page.css?v=${hash(css)}" />`, page.head()]
    .filter(Boolean)
    .join("\n");
  writeFileSync(join(out, "head.html"), head + "\n");
  const footer = page.footer(hash(js));
  writeFileSync(join(out, "footer.html"), footer + "\n");

  const sizes = embeds.map((e) => e.length);
  console.log(`${page.name}: ${embeds.length} embed(s) [${sizes.join(", ")}], head ${head.length}, footer ${footer.length} car.`);
}
