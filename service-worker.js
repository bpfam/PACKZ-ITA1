"use strict";

/* ==========================================
   VESTIAMOCIALTAMODA
   SERVICE WORKER
   VERSIONE 1.0
========================================== */

const CACHE_VERSION = "v1.0.0";

const STATIC_CACHE = `vestiamocialtamoda-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `vestiamocialtamoda-runtime-${CACHE_VERSION}`;

const CACHE_PREFIX = "vestiamocialtamoda-";

/* File fondamentali dell'app */
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json"
];

/* ==========================================
   INSTALLAZIONE
========================================== */

self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);

      await cache.addAll(APP_SHELL);

      // Attiva il nuovo service worker senza attendere
      // la chiusura delle vecchie finestre.
      await self.skipWaiting();
    })()
  );
});

/* ==========================================
   ATTIVAZIONE
========================================== */

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter(name =>
            name.startsWith(CACHE_PREFIX) &&
            name !== STATIC_CACHE &&
            name !== RUNTIME_CACHE
          )
          .map(name => caches.delete(name))
      );

      // Il nuovo service worker prende il controllo.
      await self.clients.claim();
    })()
  );
});

/* ==========================================
   FUNZIONI CACHE
========================================== */

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);

    if (response.ok && response.type !== "opaque") {
      await cache.put(request, response.clone());
    }

    return response;

  } catch (error) {
    const cached = await cache.match(request);

    if (cached) return cached;

    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);

  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(async response => {
      if (response.ok && response.type !== "opaque") {
        await cache.put(request, response.clone());
      }

      return response;
    });

  if (cached) {
    // Aggiorna la cache in background.
    networkPromise.catch(() => {});
    return cached;
  }

  return networkPromise;
}

/* ==========================================
   INTERCETTA RICHIESTE
========================================== */

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Non intercettare richieste di altri domini.
  if (url.origin !== self.location.origin) return;

  // Non salvare risposte API o dati personali.
  if (
    url.pathname.includes("/auth/") ||
    url.pathname.includes("/api/")
  ) {
    return;
  }

  // Prodotti e recensioni:
  // prova sempre a recuperare i dati aggiornati.
  if (
    url.pathname.endsWith("/data/products.json") ||
    url.pathname.endsWith("/data/reviews.json")
  ) {
    event.respondWith(
      networkFirst(request, RUNTIME_CACHE)
    );
    return;
  }

  // Navigazione: privilegia la versione online.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await networkFirst(request, STATIC_CACHE);
        } catch {
          const cache = await caches.open(STATIC_CACHE);
          return (
            await cache.match("./index.html") ||
            Response.error()
          );
        }
      })()
    );
    return;
  }

  // CSS, JS, manifest e immagini locali.
  if (
    ["style", "script", "image", "font", "manifest"].includes(
      request.destination
    )
  ) {
    event.respondWith(
      staleWhileRevalidate(request, RUNTIME_CACHE)
    );
  }
});

/* ==========================================
   CONTROLLO AGGIORNAMENTI
========================================== */

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data?.type === "GET_VERSION") {
    event.source?.postMessage({
      type: "SW_VERSION",
      version: CACHE_VERSION
    });
  }
});