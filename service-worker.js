// ============================================
// Brewery AI - Service Worker
// ============================================

const CACHE_NAME = 'brewery-ai-v1';

// キャッシュするファイル一覧
const ASSETS_TO_CACHE = [
  '/brewery-ai.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// ─── インストール：全ファイルをキャッシュに保存 ───
self.addEventListener('install', event => {
  console.log('[SW] インストール中...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] キャッシュに保存中');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      // 待機せず即座に有効化
      return self.skipWaiting();
    })
  );
});

// ─── アクティベート：古いキャッシュを削除 ───
self.addEventListener('activate', event => {
  console.log('[SW] アクティベート');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] 古いキャッシュを削除:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ─── フェッチ：Cache First 戦略 ───
self.addEventListener('fetch', event => {
  // GETリクエストのみキャッシュ対象
  if (event.request.method !== 'GET') return;

  // API系リクエスト（OpenAI等）はネットワーク優先
  if (event.request.url.includes('api.openai.com') ||
      event.request.url.includes('api.anthropic.com') ||
      event.request.url.includes('generativelanguage.googleapis.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // キャッシュがあればそれを返す（オフライン対応）
        console.log('[SW] キャッシュから返却:', event.request.url);
        return cachedResponse;
      }

      // キャッシュになければネットワークから取得してキャッシュに追加
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // オフライン時はメインページを返す
        if (event.request.destination === 'document') {
          return caches.match('/brewery-ai.html');
        }
      });
    })
  );
});
