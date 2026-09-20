import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? files(path.join(dir, e.name))
          : path.join(dir, e.name),
      ),
    )
  ).flat();
}
const build = (await readFile('.next/BUILD_ID', 'utf8')).trim();
const assets = (await files('.next/static'))
  .filter((f) => /\.(js|css|woff2?)$/.test(f))
  .map((f) => '/' + f.replaceAll('\\', '/').replace('.next/', '_next/'));
await writeFile(
  'public/sw.js',
  `/* Generated from the production build. No private API responses are cached. */
const CACHE = ${JSON.stringify('shabooya-shell-' + build)};
const ASSETS = ${JSON.stringify(['/', '/offline.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png', ...assets])};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('message', event => { if(event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => (k.startsWith('shabooya-shell-') || k.startsWith('rollcall-shell-')) && k !== CACHE).map(k => caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', event => {
 const url = new URL(event.request.url);
 if(event.request.method !== 'GET' || url.origin !== self.location.origin) return;
 if(event.request.mode === 'navigate') { event.respondWith(fetch(event.request).catch(async()=> (await caches.match('/')) || (await caches.match('/offline.html')))); return; }
 if(ASSETS.includes(url.pathname)) event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
`,
);
console.log(
  'Service worker generated with ' + assets.length + ' static assets.',
);
