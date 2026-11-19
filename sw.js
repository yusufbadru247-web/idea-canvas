// Idea Canvas : s'ouvre hors ligne et reçoit ce qu'on partage depuis une autre application.
const CACHE = 'ic-shell-v1';
const SHARE = 'ic-share';
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './manifest.webmanifest', './icon-192.png'])).catch(() => {}));
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method === 'POST' && url.pathname.endsWith('/share')) { e.respondWith(receiveShare(req)); return; }
  // La page : toujours la version en ligne, la copie gardée seulement sans réseau.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put('./', copy)); }
      return r;
    }).catch(() => caches.match('./')));
  }
});
async function receiveShare(req) {
  const back = new URL('./?shared=1', self.registration.scope).href;
  try {
    const f = await req.formData();
    const c = await caches.open(SHARE), t = Date.now();
    const meta = { title: f.get('title') || '', text: f.get('text') || '', url: f.get('url') || '', files: [], t };
    const files = f.getAll('files').filter(x => x && typeof x === 'object' && x.size);
    for (let i = 0; i < files.length; i++) {
      const key = new URL(`./__share/${t}-${i}`, self.registration.scope).href;
      await c.put(key, new Response(files[i], { headers: { 'content-type': files[i].type || 'application/octet-stream', 'x-name': encodeURIComponent(files[i].name || '') } }));
      meta.files.push(key);
    }
    await c.put(new URL('./__share/meta', self.registration.scope).href, new Response(JSON.stringify(meta), { headers: { 'content-type': 'application/json' } }));
  } catch {}
  return Response.redirect(back, 303);
}
