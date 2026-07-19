/* Ostoslistan service worker: sovelluksen runko toimii myös ilman verkkoa.
 * Listan tiedot haetaan aina verkosta (Firestore), niitä ei välimuisteta tässä.
 */
var VALIMUISTI = "ostoslista-v1";
var TIEDOSTOT = [
  "./",
  "./index.html",
  "./style.css",
  "./config.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", function (tapahtuma) {
  tapahtuma.waitUntil(
    caches.open(VALIMUISTI).then(function (valimuisti) {
      return valimuisti.addAll(TIEDOSTOT);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (tapahtuma) {
  tapahtuma.waitUntil(
    caches
      .keys()
      .then(function (avaimet) {
        return Promise.all(
          avaimet
            .filter(function (avain) {
              return avain !== VALIMUISTI;
            })
            .map(function (avain) {
              return caches.delete(avain);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function (tapahtuma) {
  var pyynto = tapahtuma.request;
  if (pyynto.method !== "GET") return;

  var osoite = new URL(pyynto.url);
  if (osoite.origin !== self.location.origin) return; // Firestore ym. suoraan verkosta

  // Verkko ensin, välimuisti varalla: päivitykset näkyvät heti,
  // mutta sovellus aukeaa myös ilman verkkoa.
  tapahtuma.respondWith(
    fetch(pyynto)
      .then(function (vastaus) {
        var kopio = vastaus.clone();
        caches.open(VALIMUISTI).then(function (valimuisti) {
          valimuisti.put(pyynto, kopio);
        });
        return vastaus;
      })
      .catch(function () {
        return caches.match(pyynto, { ignoreSearch: pyynto.mode === "navigate" }).then(function (osuma) {
          if (osuma) return osuma;
          if (pyynto.mode === "navigate") return caches.match("./index.html");
          return Response.error();
        });
      })
  );
});
