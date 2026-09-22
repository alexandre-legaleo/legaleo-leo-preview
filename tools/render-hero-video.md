# Refabriquer la vidéo du badge de hero

`leo-anims/whole.mp4` / `.webm` sont un rendu de `leo-anims/whole.json`. À
refaire après toute modification de ce fichier, sinon le hero garde l'ancienne
animation.

## Pourquoi une vidéo et pas Lottie

Sous Safari, le renderer canvas de lottie-web laisse une encoche à l'extrémité
des traits coupés par un trim path (`whole.json` en compte 27). Le défaut est
invisible sous Chrome, et il est géométrique : monter le `dpr` ne fait que le
dessiner plus nettement. Les deux contournements possibles étaient de forcer
les caps en rond (change le design) ou de rastériser en amont — d'où cette
vidéo, calculée une fois depuis Chrome et donc identique dans tous les
navigateurs. Les autres badges restent en Lottie : ils changent d'animation au
clic, ce qu'une vidéo rend maladroit.

## Procédure

Prérequis : Google Chrome, Node, `ffmpeg` (`brew install ffmpeg`).

1. Servir le projet à la racine : `python3 -m http.server 5197`.

2. Page d'appui, à placer à la racine du projet le temps du rendu :

   ```html
   <!doctype html><meta charset="utf-8">
   <style>html,body{margin:0;background:#00383c}
   #box{width:47px;height:47px;background:#00383c;overflow:hidden}</style>
   <script src="https://cdn.jsdelivr.net/npm/lottie-web@5.12.2/build/player/lottie_canvas.min.js"></script>
   <div id="box"></div>
   <script>
   const a = lottie.loadAnimation({ container: document.getElementById('box'),
     renderer: 'canvas', loop: false, autoplay: false,
     path: 'leo-anims/whole.json', rendererSettings: { dpr: 4 } });
   a.addEventListener('DOMLoaded', () => {
     const c = document.querySelector('#box canvas');
     c.style.width = '100%'; c.style.height = '100%'; c.style.display = 'block';
     window.__a = a;
   });
   </script>
   ```

   Le fond `#00383c` est `--color-leo-badge` : il est cuit dans la vidéo, ce qui
   évite d'avoir à gérer la transparence (Safari veut du HEVC, les autres du
   VP9). Il doit donc rester identique à celui de `.lb-hero-anim`.

3. Piloter Chrome sans interface pour poser chaque frame (`__a.goToAndStop(f,
   true)`) et capturer la zone de 47 px au facteur 4, soit 188×188. Parcourir
   `ip` à `op - 1` de `whole.json` (10 à 795) de 2 en 2, ce qui donne 393 images
   à 30 ips pour une source à 60.

4. Encoder :

   ```sh
   ffmpeg -y -framerate 30 -i frames/%04d.png -c:v libx264 -profile:v high \
     -pix_fmt yuv420p -crf 20 -movflags +faststart -an leo-anims/whole.mp4
   ffmpeg -y -framerate 30 -i frames/%04d.png -c:v libvpx-vp9 \
     -pix_fmt yuv420p -crf 32 -b:v 0 -row-mt 1 -an leo-anims/whole.webm
   ```

5. Supprimer la page d'appui, puis vérifier le hero dans Chrome **et** Safari.

Repères du dernier rendu : 393 images, 188×188, 30 ips, 13,1 s, 84 Ko en MP4 et
72 Ko en WebM. Les couleurs décodées sont à 1/255 de la référence CSS.
