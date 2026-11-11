/* App Calistenia: guarda o app no aparelho para abrir sem internet. */
var V = 'p60-v1';
var CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
var VIDS = ["videos/01.mp4", "videos/02.mp4", "videos/03.mp4", "videos/04.mp4", "videos/05.mp4", "videos/06.mp4", "videos/07.mp4", "videos/08.mp4", "videos/09.mp4", "videos/10.mp4", "videos/11.mp4", "videos/12.mp4", "videos/13.mp4", "videos/14.mp4", "videos/15.mp4", "videos/16.mp4", "videos/17.mp4", "videos/18.mp4", "videos/19.mp4", "videos/20.mp4"];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(CORE.concat(VIDS)); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* O Safari só toca vídeo que responde a pedidos de trecho (Range). */
function rangeResponse(req) {
  return caches.match(req.url, { ignoreSearch: true }).then(function (hit) { return hit || fetch(req.url); }).then(function (full) {
    return full.arrayBuffer().then(function (buf) {
      var m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
      var start = m && m[1] ? parseInt(m[1], 10) : 0;
      var end = m && m[2] ? parseInt(m[2], 10) : buf.byteLength - 1;
      end = Math.min(end, buf.byteLength - 1);
      var part = buf.slice(start, end + 1);
      return new Response(part, {
        status: 206,
        headers: {
          'Content-Type': full.headers.get('Content-Type') || 'video/mp4',
          'Content-Range': 'bytes ' + start + '-' + end + '/' + buf.byteLength,
          'Content-Length': String(part.byteLength)
        }
      });
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var same = url.origin === self.location.origin;
  if (same && req.headers.get('range')) { e.respondWith(rangeResponse(req)); return; }
  var isVideo = same && /\.mp4$/.test(url.pathname);
  var isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (isVideo || isFont) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && res.ok) { var cp = res.clone(); caches.open(V).then(function (c) { c.put(req, cp); }); }
        return res;
      });
    }));
    return;
  }
  if (!same) return;
  /* página e arquivos do app: tenta a rede primeiro, para pegar versões novas; sem rede usa o guardado */
  e.respondWith(fetch(req).then(function (res) {
    if (res && res.ok) { var cp = res.clone(); caches.open(V).then(function (c) { c.put(req, cp); }); }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || caches.match('index.html'); });
  }));
});
