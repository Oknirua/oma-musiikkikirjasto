'use strict';

const VALIMUISTI = 'musiikkikirjasto-v2';
const TIEDOSTOT = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './manifest.json',
  './icon-180.png',
  './icon-512.png'
];

self.addEventListener('install', function (tapahtuma) {
  tapahtuma.waitUntil(
    caches.open(VALIMUISTI)
      .then(function (valimuisti) { return valimuisti.addAll(TIEDOSTOT); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (tapahtuma) {
  tapahtuma.waitUntil(
    caches.keys()
      .then(function (avaimet) {
        return Promise.all(
          avaimet
            .filter(function (avain) { return avain !== VALIMUISTI; })
            .map(function (avain) { return caches.delete(avain); })
        );
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (tapahtuma) {
  const url = new URL(tapahtuma.request.url);
  // OpenAI ja muut ulkoiset pyynnöt menevät aina suoraan verkkoon.
  if (url.origin !== location.origin) return;
  tapahtuma.respondWith(
    caches.match(tapahtuma.request).then(function (valimuistista) {
      if (valimuistista) return valimuistista;
      return fetch(tapahtuma.request).then(function (vastaus) {
        const kopio = vastaus.clone();
        caches.open(VALIMUISTI).then(function (valimuisti) {
          valimuisti.put(tapahtuma.request, kopio);
        });
        return vastaus;
      });
    })
  );
});
