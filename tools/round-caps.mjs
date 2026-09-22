// Passe les contours des animations Lottie en cap rond (lc: 2).
//
// Pourquoi : sous Safari, le renderer canvas de lottie-web laisse une encoche à
// l'extrémité des traits coupés par un trim path — et toutes ces animations en
// utilisent. Le défaut est invisible sous Chrome et il est géométrique : monter
// le dpr le dessine plus nettement au lieu de le masquer. Un cap rond recouvre
// cette extrémité, donc l'encoche disparaît quel que soit le rastériseur
// (vérifié sur une page de test isolée, dans Safari).
//
// Idempotent. À rejouer après tout réexport depuis After Effects, ou à rendre
// inutile en réglant directement les contours en cap rond dans le projet AE.
//
//   node tools/round-caps.mjs            # applique
//   node tools/round-caps.mjs --check    # signale sans écrire (code 1 si besoin)
//
// Les joins (lj) sont laissés tels quels : l'encoche est aux extrémités, pas
// aux angles.

import { readFileSync, writeFileSync } from "node:fs";
import { globSync } from "node:fs";

const CHECK = process.argv.includes("--check");
const ROUND = 2; // 1 = butt, 2 = rond, 3 = carré

const files = [
  ...globSync("leo-anims/*.json"),
  ...globSync("code-components/src/components/*/leo-anims/*.json"),
].sort();

// Un contour est un objet {ty: "st"} (uni) ou {ty: "gs"} (dégradé).
function roundCaps(node, stats) {
  if (Array.isArray(node)) {
    node.forEach((n) => roundCaps(n, stats));
  } else if (node && typeof node === "object") {
    if ((node.ty === "st" || node.ty === "gs") && node.lc !== ROUND) {
      node.lc = ROUND;
      stats.changed += 1;
    }
    Object.values(node).forEach((v) => roundCaps(v, stats));
  }
}

let total = 0;
for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const data = JSON.parse(raw);
  const stats = { changed: 0 };
  roundCaps(data, stats);
  total += stats.changed;
  if (!stats.changed) continue;

  // Respecte la mise en forme d'origine (les exports AE sont sur une ligne).
  const compact = !raw.includes("\n");
  if (!CHECK) writeFileSync(file, compact ? JSON.stringify(data) : JSON.stringify(data, null, 2) + "\n");
  console.log(`${CHECK ? "à corriger" : "corrigé"} : ${file} — ${stats.changed} contour(s)`);
}

console.log(`\n${files.length} fichier(s) analysé(s), ${total} contour(s) ${CHECK ? "à passer" : "passés"} en cap rond.`);
if (CHECK && total) process.exit(1);
