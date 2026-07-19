/* Ostoslista — kahden hengen jaettu ostoslista.
 * Tallennus: Firebase Firestore, virallinen REST-rajapinta (ei ulkoisia kirjastoja).
 */
(function () {
  "use strict";

  var CONFIG = window.OSTOSLISTA_CONFIG || OSTOSLISTA_CONFIG;
  var BASE =
    "https://firestore.googleapis.com/v1/projects/" +
    CONFIG.projectId +
    "/databases/(default)/documents";
  var ITEMS_PATH = "lists/" + CONFIG.listId + "/items";

  var lomake = document.getElementById("lisays-lomake");
  var syote = document.getElementById("uusi-tuote");
  var paivitaNappi = document.getElementById("paivita");
  var poistaNappi = document.getElementById("poista-valitut");
  var tila = document.getElementById("tila");
  var tyhjaViesti = document.getElementById("tyhja");
  var lista = document.getElementById("lista");

  function ilmoita(viesti) {
    tila.textContent = viesti;
  }

  function apiUrl(polku, parametrit) {
    var url = BASE + "/" + polku + "?key=" + encodeURIComponent(CONFIG.apiKey);
    if (parametrit) url += "&" + parametrit;
    return url;
  }

  function tarkistaVastaus(vastaus) {
    if (!vastaus.ok) {
      throw new Error("HTTP " + vastaus.status);
    }
    return vastaus.json();
  }

  function dokumenttiRiviksi(doc) {
    var osat = doc.name.split("/");
    return {
      id: osat[osat.length - 1],
      text: (doc.fields && doc.fields.text && doc.fields.text.stringValue) || "",
      checked: !!(doc.fields && doc.fields.checked && doc.fields.checked.booleanValue),
      luotu: new Date(doc.createTime).getTime(),
      nimi: doc.name,
    };
  }

  // --- Firestore-kutsut ---

  function haeKaikki() {
    var kaikki = [];
    function haeSivu(sivutunnus) {
      var parametrit = "pageSize=300" + (sivutunnus ? "&pageToken=" + encodeURIComponent(sivutunnus) : "");
      return fetch(apiUrl(ITEMS_PATH, parametrit))
        .then(tarkistaVastaus)
        .then(function (data) {
          (data.documents || []).forEach(function (doc) {
            kaikki.push(dokumenttiRiviksi(doc));
          });
          if (data.nextPageToken && kaikki.length < 3000) {
            return haeSivu(data.nextPageToken);
          }
          return kaikki;
        });
    }
    return haeSivu(null).then(function (rivit) {
      rivit.sort(function (a, b) {
        return a.luotu - b.luotu || (a.id < b.id ? -1 : 1);
      });
      return rivit;
    });
  }

  function lisaaTuote(teksti) {
    return fetch(apiUrl(ITEMS_PATH), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          text: { stringValue: teksti },
          checked: { booleanValue: false },
        },
      }),
    }).then(tarkistaVastaus);
  }

  function tallennaRasti(id, rastittu) {
    return fetch(apiUrl(ITEMS_PATH + "/" + id, "updateMask.fieldPaths=checked"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: { checked: { booleanValue: rastittu } },
      }),
    }).then(tarkistaVastaus);
  }

  function poistaTuote(id) {
    return fetch(apiUrl(ITEMS_PATH + "/" + id), { method: "DELETE" }).then(function (vastaus) {
      if (!vastaus.ok) throw new Error("HTTP " + vastaus.status);
    });
  }

  // --- Käyttöliittymä ---

  function luoRivi(rivi) {
    var li = document.createElement("li");
    var ruutu = document.createElement("input");
    ruutu.type = "checkbox";
    ruutu.id = "tuote-" + rivi.id;
    ruutu.checked = rivi.checked;
    ruutu.dataset.id = rivi.id;

    var nimio = document.createElement("label");
    nimio.htmlFor = ruutu.id;
    nimio.textContent = rivi.text;

    ruutu.addEventListener("change", function () {
      var uusiTila = ruutu.checked;
      ruutu.disabled = true;
      tallennaRasti(rivi.id, uusiTila)
        .then(function () {
          ruutu.disabled = false;
          li.classList.toggle("rastittu", uusiTila);
        })
        .catch(function () {
          ruutu.disabled = false;
          ruutu.checked = !uusiTila;
          ilmoita("Muutoksen tallennus epäonnistui. Tarkista verkkoyhteys.");
        });
    });

    li.classList.toggle("rastittu", rivi.checked);
    li.appendChild(ruutu);
    li.appendChild(nimio);
    return li;
  }

  function naytaLista(rivit) {
    lista.textContent = "";
    rivit.forEach(function (rivi) {
      lista.appendChild(luoRivi(rivi));
    });
    tyhjaViesti.hidden = rivit.length > 0;
  }

  var paivitysKaynnissa = false;

  function paivitaLista(ilmoitaValmis) {
    if (paivitysKaynnissa) return;
    paivitysKaynnissa = true;
    haeKaikki()
      .then(function (rivit) {
        naytaLista(rivit);
        if (ilmoitaValmis) ilmoita("Lista päivitetty.");
      })
      .catch(function () {
        ilmoita("Listan hakeminen epäonnistui. Tarkista verkkoyhteys ja paina Päivitä lista.");
      })
      .then(function () {
        paivitysKaynnissa = false;
      });
  }

  lomake.addEventListener("submit", function (tapahtuma) {
    tapahtuma.preventDefault();
    var teksti = syote.value.trim();
    if (!teksti) return;
    // Tyhjennetään kenttä heti ja pidetään kohdistus siinä,
    // jotta seuraavan tuotteen voi kirjoittaa välittömästi.
    syote.value = "";
    syote.focus();
    lisaaTuote(teksti)
      .then(function (doc) {
        lista.appendChild(luoRivi(dokumenttiRiviksi(doc)));
        tyhjaViesti.hidden = true;
        ilmoita("Lisätty: " + teksti);
      })
      .catch(function () {
        ilmoita("Tuotteen ”" + teksti + "” lisääminen epäonnistui. Tarkista verkkoyhteys.");
      });
  });

  paivitaNappi.addEventListener("click", function () {
    ilmoita("Päivitetään listaa…");
    paivitaLista(true);
  });

  poistaNappi.addEventListener("click", function () {
    var rastitut = Array.prototype.slice.call(
      lista.querySelectorAll('input[type="checkbox"]:checked')
    );
    var maara = rastitut.length;
    if (maara === 0) {
      ilmoita("Ei valittuja rivejä.");
      return;
    }
    var kysymys =
      maara === 1 ? "Poistetaanko 1 valittu rivi?" : "Poistetaanko " + maara + " valittua riviä?";
    if (!window.confirm(kysymys)) return;

    ilmoita("Poistetaan…");
    Promise.all(
      rastitut.map(function (ruutu) {
        return poistaTuote(ruutu.dataset.id).then(
          function () {
            var li = ruutu.closest("li");
            if (li) li.remove();
            return true;
          },
          function () {
            return false;
          }
        );
      })
    ).then(function (tulokset) {
      var onnistui = tulokset.filter(Boolean).length;
      var epaonnistui = maara - onnistui;
      tyhjaViesti.hidden = lista.children.length > 0;
      if (epaonnistui === 0) {
        ilmoita(onnistui === 1 ? "Poistettu 1 rivi." : "Poistettu " + onnistui + " riviä.");
      } else {
        ilmoita(
          "Poistettu " + onnistui + " riviä, mutta " + epaonnistui +
          " rivin poisto epäonnistui. Tarkista verkkoyhteys ja yritä uudelleen."
        );
      }
    });
  });

  // Haetaan lista automaattisesti, kun sovellukseen palataan.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      paivitaLista(false);
    }
  });

  // Ensimmäinen haku, kun sovellus avataan.
  ilmoita("Ladataan listaa…");
  haeKaikki()
    .then(function (rivit) {
      naytaLista(rivit);
      ilmoita("");
    })
    .catch(function () {
      ilmoita("Listan hakeminen epäonnistui. Tarkista verkkoyhteys ja paina Päivitä lista.");
    });

  // PWA: rekisteröidään service worker asennusta ja offline-käynnistystä varten.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(function () {
      // Sovellus toimii myös ilman service workeria.
    });
  }
})();
