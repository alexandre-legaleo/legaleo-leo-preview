// Passe les contours d'une animation Lottie en cap rond (lc: 2), sur place.
//
// Pourquoi : sous Safari, le renderer canvas de lottie-web laisse une encoche à
// l'extrémité des traits coupés par un trim path — et toutes ces animations en
// utilisent. Le défaut est invisible sous Chrome, et il est géométrique : monter
// le dpr le dessine plus nettement au lieu de le masquer. Un cap rond recouvre
// cette extrémité, donc l'encoche disparaît quel que soit le rastériseur.
//
// Appliqué ici plutôt que dans les .json pour que ceux-ci restent des exports
// After Effects intacts : un réexport ne réintroduit pas le défaut. Pendant du
// roundCaps de js/anims.js, pour la page statique.
//
// Conséquence assumée : le cap déborde d'une demi-épaisseur de chaque côté,
// donc les traits paraissent un peu plus longs qu'à l'export. Les joins (lj)
// sont laissés tels quels : l'encoche est aux extrémités, pas aux angles.
//
// Idempotent, et volontairement mutant : les composants passent l'objet importé
// (partagé par le module) directement à loadAnimation, comme avant.
export function roundCaps<T>(node: T): T {
  if (Array.isArray(node)) {
    node.forEach(roundCaps);
  } else if (node && typeof node === "object") {
    const shape = node as { ty?: string; lc?: number };
    if (shape.ty === "st" || shape.ty === "gs") shape.lc = 2; // st = contour uni, gs = dégradé
    Object.values(node).forEach(roundCaps);
  }
  return node;
}
