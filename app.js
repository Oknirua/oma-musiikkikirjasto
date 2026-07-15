'use strict';

// Vaihda tähän toteutushetken paras kuvia ymmärtävä OpenAI-malli.
const OPENAI_MALLI = 'gpt-5.1';

const TUNNISTUSKEHOTE =
  'Kuvassa on CD-levyn kansi. Palauta JSON, jossa kentät esittaja, nimi ja genre. ' +
  'Genre suomeksi yhdellä sanalla, esimerkiksi Rock, Country, Klassinen, Iskelmä. ' +
  'Jos et tunnista jotakin tietoa varmasti, aseta kentän arvoksi null. ' +
  'Palauta vain JSON-objekti, ei mitään muuta.';

const AVAIN_KIRJASTO = 'musiikkikirjasto';
const AVAIN_ASETUKSET = 'musiikkikirjasto_asetukset';

// ---------- Tallennus ----------

function suurinNumero(levyt) {
  return levyt.reduce(function (suurin, l) {
    return Math.max(suurin, Number(l.numero) || 0);
  }, 0);
}

function lataaKirjasto() {
  try {
    const data = JSON.parse(localStorage.getItem(AVAIN_KIRJASTO));
    if (data && Array.isArray(data.levyt)) {
      // Vanha tallenne ilman laskuria: jatketaan suurimmasta käytetystä numerosta.
      if (!Number.isInteger(data.viimeisinNumero) || data.viimeisinNumero < 0) {
        data.viimeisinNumero = suurinNumero(data.levyt);
      }
      return data;
    }
  } catch (e) { /* vioittunut data -> aloitetaan tyhjästä */ }
  return { versio: 1, levyt: [], viimeisinNumero: 0 };
}

function lataaAsetukset() {
  try {
    return JSON.parse(localStorage.getItem(AVAIN_ASETUKSET)) || {};
  } catch (e) {
    return {};
  }
}

let kirjasto = lataaKirjasto();
let asetukset = lataaAsetukset();

function tallennaKirjasto() {
  localStorage.setItem(AVAIN_KIRJASTO, JSON.stringify(kirjasto));
}

function tallennaAsetukset() {
  localStorage.setItem(AVAIN_ASETUKSET, JSON.stringify(asetukset));
}

function seuraavaNumero() {
  // Numerointi jatkuu aina viimeksi käytetystä numerosta, myös jos levyjä on
  // poistettu välistä; laskuri tallentuu kirjaston mukana pysyvästi.
  return Math.max(kirjasto.viimeisinNumero, suurinNumero(kirjasto.levyt)) + 1;
}

function uusiId() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

// ---------- Apufunktiot ----------

function e(id) { return document.getElementById(id); }

function kohdista(elementti) {
  if (elementti) elementti.focus();
}

function ilmoita(teksti) {
  const alue = e('ilmoitus');
  alue.textContent = '';
  setTimeout(function () { alue.textContent = teksti; }, 50);
}

// ---------- Näkymät ----------

const NAKYMAT = ['aloitus', 'haku', 'tietosivu', 'lisays', 'asetukset'];

function naytaNakyma(nimi) {
  NAKYMAT.forEach(function (n) {
    e('nakyma-' + n).hidden = (n !== nimi);
  });
}

// ---------- Dialogi ----------

function naytaDialogi(teksti, okTeksti, okToiminto, palautusElementti) {
  const tausta = e('dialogi-tausta');
  const okNappi = e('dialogi-ok');
  const peruutaNappi = e('dialogi-peruuta');
  e('dialogi-teksti').textContent = teksti;
  okNappi.textContent = okTeksti;
  e('sovellus').setAttribute('aria-hidden', 'true');
  tausta.hidden = false;

  function sulje(hyvaksytty) {
    tausta.hidden = true;
    e('sovellus').removeAttribute('aria-hidden');
    okNappi.onclick = null;
    peruutaNappi.onclick = null;
    if (hyvaksytty) {
      okToiminto();
    } else if (palautusElementti) {
      kohdista(palautusElementti);
    }
  }

  okNappi.onclick = function () { sulje(true); };
  peruutaNappi.onclick = function () { sulje(false); };
  kohdista(okNappi);
}

// ---------- Aloitusnäkymä ----------

function avaaAloitus() {
  naytaNakyma('aloitus');
  kohdista(e('nappi-hae'));
}

// ---------- Hakunäkymä ----------

const hakuTila = { sana: '', indeksi: -1 };
let hakuTulokset = [];
let ilmoitusAjastin = null;

function tulosTeksti(levy) {
  if (levy.esittaja) {
    return 'Numero ' + levy.numero + '. ' + levy.esittaja + '. ' + levy.nimi + '.';
  }
  return 'Numero ' + levy.numero + '. ' + levy.nimi + '.';
}

function suoritaHaku() {
  const sana = hakuTila.sana.trim().toLowerCase();
  const lista = e('hakutulokset');
  lista.innerHTML = '';
  hakuTulokset = [];

  if (sana !== '') {
    hakuTulokset = kirjasto.levyt.filter(function (l) {
      return String(l.numero).indexOf(sana) !== -1 ||
        (l.esittaja || '').toLowerCase().indexOf(sana) !== -1 ||
        (l.nimi || '').toLowerCase().indexOf(sana) !== -1 ||
        (l.genre || '').toLowerCase().indexOf(sana) !== -1 ||
        (l.muistiinpanot || '').toLowerCase().indexOf(sana) !== -1;
    }).sort(function (a, b) {
      const avainA = a.esittaja || a.nimi || '';
      const avainB = b.esittaja || b.nimi || '';
      return avainA.localeCompare(avainB, 'fi') ||
        (a.nimi || '').localeCompare(b.nimi || '', 'fi');
    });

    hakuTulokset.forEach(function (levy, indeksi) {
      const li = document.createElement('li');
      const nappi = document.createElement('button');
      nappi.type = 'button';
      nappi.dataset.indeksi = String(indeksi);
      nappi.textContent = tulosTeksti(levy);
      nappi.addEventListener('click', function () {
        hakuTila.indeksi = indeksi;
        avaaTietosivu(levy.id);
      });
      li.appendChild(nappi);
      lista.appendChild(li);
    });
  }
}

function ilmoitaTulosmaara() {
  if (hakuTila.sana.trim() === '') return;
  const maara = hakuTulokset.length;
  if (maara === 0) ilmoita('Ei tuloksia');
  else if (maara === 1) ilmoita('1 tulos');
  else ilmoita(maara + ' tulosta');
}

function avaaHaku(sailytaTila) {
  if (!sailytaTila) {
    hakuTila.sana = '';
    hakuTila.indeksi = -1;
  }
  e('hakukentta').value = hakuTila.sana;
  suoritaHaku();
  naytaNakyma('haku');

  if (sailytaTila && hakuTila.indeksi >= 0 && hakuTulokset.length > 0) {
    kohdistaTulokseen(hakuTila.indeksi);
  } else {
    kohdista(e('hakukentta'));
  }
}

function kohdistaTulokseen(indeksi) {
  const rajattu = Math.min(indeksi, hakuTulokset.length - 1);
  const nappi = document.querySelector('#hakutulokset button[data-indeksi="' + rajattu + '"]');
  if (nappi) kohdista(nappi);
  else kohdista(e('hakukentta'));
}

// ---------- Levyn tietosivu ----------

let tietosivunLevyId = null;

function avaaTietosivu(id) {
  const levy = kirjasto.levyt.find(function (l) { return l.id === id; });
  if (!levy) return;
  tietosivunLevyId = id;
  e('tieto-otsikko').textContent = 'Numero ' + levy.numero;
  e('tieto-esittaja').value = levy.esittaja || '';
  e('tieto-nimi').value = levy.nimi || '';
  e('tieto-genre').value = levy.genre || '';
  e('tieto-muistiinpanot').value = levy.muistiinpanot || '';
  naytaNakyma('tietosivu');
  kohdista(e('tieto-otsikko'));
}

function tallennaTietosivu() {
  const levy = kirjasto.levyt.find(function (l) { return l.id === tietosivunLevyId; });
  if (!levy) return;
  const nimi = e('tieto-nimi').value.trim();
  if (!nimi) {
    ilmoita('Levyn nimi puuttuu.');
    kohdista(e('tieto-nimi'));
    return;
  }
  levy.esittaja = e('tieto-esittaja').value.trim();
  levy.nimi = nimi;
  levy.genre = e('tieto-genre').value.trim();
  levy.muistiinpanot = e('tieto-muistiinpanot').value.trim();
  tallennaKirjasto();
  kohdista(e('tieto-otsikko'));
}

function poistaLevy() {
  const levy = kirjasto.levyt.find(function (l) { return l.id === tietosivunLevyId; });
  if (!levy) return;
  naytaDialogi(
    'Poistetaanko levy numero ' + levy.numero + ', ' + levy.nimi + '?',
    'Poista',
    function () {
      kirjasto.levyt = kirjasto.levyt.filter(function (l) { return l.id !== levy.id; });
      tallennaKirjasto();
      e('hakukentta').value = hakuTila.sana;
      suoritaHaku();
      naytaNakyma('haku');
      if (hakuTulokset.length > 0 && hakuTila.indeksi >= 0) {
        kohdistaTulokseen(hakuTila.indeksi);
      } else {
        kohdista(e('hakukentta'));
      }
    },
    e('tieto-poista')
  );
}

// ---------- Uuden levyn lisääminen ----------

let lisayksenNumero = null;

function avaaLisays() {
  lisayksenNumero = seuraavaNumero();
  e('lisays-otsikko').textContent = 'Uusi levy. Numero ' + lisayksenNumero + '.';
  e('lisays-esittaja').value = '';
  e('lisays-nimi').value = '';
  e('lisays-genre').value = '';
  e('lisays-muistiinpanot').value = '';
  e('lisays-kuva').value = '';
  naytaNakyma('lisays');
  kohdista(e('lisays-tunnista'));
  ilmoita('Uusi levy. Numero ' + lisayksenNumero + '.');
}

function pienennaKuva(tiedosto) {
  return new Promise(function (ratkaise, hylkaa) {
    const url = URL.createObjectURL(tiedosto);
    const kuva = new Image();
    kuva.onload = function () {
      URL.revokeObjectURL(url);
      const enimmaissivu = 1024;
      let leveys = kuva.naturalWidth;
      let korkeus = kuva.naturalHeight;
      const suhde = Math.min(1, enimmaissivu / Math.max(leveys, korkeus));
      leveys = Math.round(leveys * suhde);
      korkeus = Math.round(korkeus * suhde);
      const kangas = document.createElement('canvas');
      kangas.width = leveys;
      kangas.height = korkeus;
      kangas.getContext('2d').drawImage(kuva, 0, 0, leveys, korkeus);
      ratkaise(kangas.toDataURL('image/jpeg', 0.8));
    };
    kuva.onerror = function () {
      URL.revokeObjectURL(url);
      hylkaa(new Error('kuva'));
    };
    kuva.src = url;
  });
}

async function tunnistaOpenAI(dataUrl) {
  const keskeytin = new AbortController();
  const ajastin = setTimeout(function () { keskeytin.abort(); }, 30000);
  try {
    const vastaus = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: keskeytin.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + asetukset.apiAvain
      },
      body: JSON.stringify({
        model: OPENAI_MALLI,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: TUNNISTUSKEHOTE },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }]
      })
    });
    if (!vastaus.ok) throw new Error('api');
    const data = await vastaus.json();
    let sisalto = (data.choices && data.choices[0] && data.choices[0].message &&
      data.choices[0].message.content) || '';
    const alku = sisalto.indexOf('{');
    const loppu = sisalto.lastIndexOf('}');
    if (alku < 0 || loppu <= alku) throw new Error('jasennys');
    const tulos = JSON.parse(sisalto.slice(alku, loppu + 1));
    return {
      esittaja: typeof tulos.esittaja === 'string' ? tulos.esittaja : '',
      nimi: typeof tulos.nimi === 'string' ? tulos.nimi : '',
      genre: typeof tulos.genre === 'string' ? tulos.genre : ''
    };
  } finally {
    clearTimeout(ajastin);
  }
}

async function kasitteleKuva(tiedosto) {
  if (!navigator.onLine) {
    ilmoita('Ei verkkoyhteyttä. Täytä tiedot käsin.');
    return;
  }
  if (!asetukset.apiAvain) {
    ilmoita('API-avainta ei ole tallennettu. Täytä tiedot käsin.');
    return;
  }
  ilmoita('Tunnistetaan…');
  try {
    const dataUrl = await pienennaKuva(tiedosto);
    const tulos = await tunnistaOpenAI(dataUrl);
    e('lisays-esittaja').value = tulos.esittaja;
    e('lisays-nimi').value = tulos.nimi;
    e('lisays-genre').value = tulos.genre;
    ilmoita('');
    kohdista(e('lisays-esittaja'));
  } catch (virhe) {
    ilmoita('Tunnistus epäonnistui. Täytä tiedot käsin.');
  }
}

function tallennaUusiLevy() {
  const nimi = e('lisays-nimi').value.trim();
  if (!nimi) {
    ilmoita('Levyn nimi puuttuu.');
    kohdista(e('lisays-nimi'));
    return;
  }
  const kaksois = kirjasto.levyt.find(function (l) {
    return l.nimi.toLowerCase() === nimi.toLowerCase();
  });
  if (kaksois) {
    naytaDialogi(
      'Samanniminen levy on jo kirjastossa, numero ' + kaksois.numero + '. Tallennetaanko silti?',
      'Tallenna',
      function () { viimeisteleUusiLevy(nimi); },
      e('lisays-tallenna')
    );
  } else {
    viimeisteleUusiLevy(nimi);
  }
}

function viimeisteleUusiLevy(nimi) {
  kirjasto.levyt.push({
    id: uusiId(),
    numero: lisayksenNumero,
    esittaja: e('lisays-esittaja').value.trim(),
    nimi: nimi,
    genre: e('lisays-genre').value.trim(),
    muistiinpanot: e('lisays-muistiinpanot').value.trim()
  });
  kirjasto.viimeisinNumero = Math.max(kirjasto.viimeisinNumero, lisayksenNumero);
  tallennaKirjasto();
  avaaAloitus();
}

// ---------- Asetukset ----------

function paivitaAvaimenTila() {
  e('avain-tila').textContent = asetukset.apiAvain
    ? 'API-avain on tallennettu.'
    : 'API-avainta ei ole tallennettu.';
}

function avaaAsetukset() {
  paivitaAvaimenTila();
  e('avain-kentta').value = '';
  naytaNakyma('asetukset');
  kohdista(e('avain-tila'));
}

function tallennaAvain() {
  const avain = e('avain-kentta').value.trim();
  if (!avain) return;
  asetukset.apiAvain = avain;
  tallennaAsetukset();
  e('avain-kentta').value = '';
  paivitaAvaimenTila();
  kohdista(e('avain-tila'));
}

async function testaaAvain() {
  if (!asetukset.apiAvain) {
    ilmoita('API-avainta ei ole tallennettu.');
    return;
  }
  if (!navigator.onLine) {
    ilmoita('Ei verkkoyhteyttä.');
    return;
  }
  ilmoita('Testataan…');
  try {
    const vastaus = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + asetukset.apiAvain
      },
      body: JSON.stringify({
        model: OPENAI_MALLI,
        messages: [{ role: 'user', content: 'Vastaa vain: ok' }]
      })
    });
    ilmoita(vastaus.ok ? 'Avain toimii.' : 'Avain ei toimi.');
  } catch (virhe) {
    ilmoita('Avain ei toimi.');
  }
}

// ---------- Varmuuskopiointi ----------

function vieVarmuuskopio() {
  const rivit = [
    'OMA MUSIIKKIKIRJASTO',
    'Versio 1',
    'Viimeisin numero: ' + Math.max(kirjasto.viimeisinNumero, suurinNumero(kirjasto.levyt)),
    ''
  ];
  kirjasto.levyt
    .slice()
    .sort(function (a, b) { return a.numero - b.numero; })
    .forEach(function (l) {
      rivit.push('Numero: ' + l.numero);
      rivit.push('Esittäjä: ' + (l.esittaja || ''));
      rivit.push('Levy: ' + l.nimi);
      rivit.push('Genre: ' + (l.genre || ''));
      rivit.push('Muistiinpanot: ' + (l.muistiinpanot || ''));
      rivit.push('');
    });
  const blob = new Blob([rivit.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const linkki = document.createElement('a');
  linkki.href = url;
  linkki.download = 'musiikkikirjasto.txt';
  document.body.appendChild(linkki);
  linkki.click();
  linkki.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
}

function jasennaVarmuuskopio(teksti) {
  const rivit = teksti.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let i = 0;
  while (i < rivit.length && rivit[i].trim() === '') i++;
  if ((rivit[i] || '').trim() !== 'OMA MUSIIKKIKIRJASTO') throw new Error('otsikko');
  i++;

  const levyt = [];
  const numerot = new Set();
  let viimeisinNumero = 0;
  let tietue = null;
  let muistiinpanotAuki = false;

  function paataTietue() {
    if (!tietue) return;
    const numero = Number(tietue.numeroRaaka);
    if (!Number.isInteger(numero) || numero < 1) throw new Error('numero');
    if (numerot.has(numero)) throw new Error('tuplanumero');
    if (!tietue.nimi) throw new Error('nimi');
    numerot.add(numero);
    levyt.push({
      id: uusiId(),
      numero: numero,
      esittaja: tietue.esittaja,
      nimi: tietue.nimi,
      genre: tietue.genre,
      muistiinpanot: tietue.muistiinpanot.replace(/\s+$/, '')
    });
    tietue = null;
  }

  for (; i < rivit.length; i++) {
    const rivi = rivit[i];
    if (rivi.indexOf('Numero:') === 0) {
      paataTietue();
      tietue = {
        numeroRaaka: rivi.slice(7).trim(),
        esittaja: '', nimi: '', genre: '', muistiinpanot: ''
      };
      muistiinpanotAuki = false;
    } else if (!tietue) {
      if (rivi.trim() === '' || rivi.indexOf('Versio') === 0) continue;
      if (rivi.indexOf('Viimeisin numero:') === 0) {
        const arvo = Number(rivi.slice(17).trim());
        if (Number.isInteger(arvo) && arvo >= 0) viimeisinNumero = arvo;
        continue;
      }
      throw new Error('rivi');
    } else if (rivi.indexOf('Esittäjä:') === 0) {
      tietue.esittaja = rivi.slice(9).trim();
      muistiinpanotAuki = false;
    } else if (rivi.indexOf('Levy:') === 0) {
      tietue.nimi = rivi.slice(5).trim();
      muistiinpanotAuki = false;
    } else if (rivi.indexOf('Genre:') === 0) {
      tietue.genre = rivi.slice(6).trim();
      muistiinpanotAuki = false;
    } else if (rivi.indexOf('Muistiinpanot:') === 0) {
      tietue.muistiinpanot = rivi.slice(14).replace(/^ /, '');
      muistiinpanotAuki = true;
    } else if (muistiinpanotAuki) {
      tietue.muistiinpanot += '\n' + rivi;
    } else if (rivi.trim() === '') {
      continue;
    } else {
      throw new Error('rivi');
    }
  }
  paataTietue();
  return { levyt: levyt, viimeisinNumero: Math.max(viimeisinNumero, suurinNumero(levyt)) };
}

function tuoVarmuuskopio(tiedosto) {
  const lukija = new FileReader();
  lukija.onload = function () {
    try {
      const tulos = jasennaVarmuuskopio(String(lukija.result));
      kirjasto = { versio: 1, levyt: tulos.levyt, viimeisinNumero: tulos.viimeisinNumero };
      tallennaKirjasto();
      ilmoita(tulos.levyt.length === 1 ? 'Tuotu 1 levy.' : 'Tuotu ' + tulos.levyt.length + ' levyä.');
    } catch (virhe) {
      ilmoita('Tuonti epäonnistui. Kirjastoa ei muutettu.');
    }
  };
  lukija.onerror = function () {
    ilmoita('Tuonti epäonnistui. Kirjastoa ei muutettu.');
  };
  lukija.readAsText(tiedosto);
}

// ---------- Tapahtumat ----------

document.addEventListener('DOMContentLoaded', function () {

  // Aloitusnäkymä
  e('nappi-hae').addEventListener('click', function () { avaaHaku(false); });
  e('nappi-lisaa').addEventListener('click', avaaLisays);
  e('nappi-asetukset').addEventListener('click', avaaAsetukset);

  // Hakunäkymä
  e('haku-takaisin').addEventListener('click', function () {
    hakuTila.sana = '';
    hakuTila.indeksi = -1;
    avaaAloitus();
  });
  e('hakukentta').addEventListener('input', function (tapahtuma) {
    hakuTila.sana = tapahtuma.target.value;
    hakuTila.indeksi = -1;
    suoritaHaku();
    clearTimeout(ilmoitusAjastin);
    ilmoitusAjastin = setTimeout(ilmoitaTulosmaara, 500);
  });

  // Tietosivu
  e('tieto-takaisin').addEventListener('click', function () { avaaHaku(true); });
  e('tieto-tallenna').addEventListener('click', tallennaTietosivu);
  e('tieto-poista').addEventListener('click', poistaLevy);

  // Lisäys
  e('lisays-takaisin').addEventListener('click', avaaAloitus);
  e('lisays-tunnista').addEventListener('click', function () {
    e('lisays-kuva').click();
  });
  e('lisays-kuva').addEventListener('change', function (tapahtuma) {
    const tiedosto = tapahtuma.target.files && tapahtuma.target.files[0];
    if (tiedosto) kasitteleKuva(tiedosto);
    tapahtuma.target.value = '';
  });
  e('lisays-tallenna').addEventListener('click', tallennaUusiLevy);

  // Asetukset
  e('asetukset-takaisin').addEventListener('click', avaaAloitus);
  e('avain-tallenna').addEventListener('click', tallennaAvain);
  e('avain-testaa').addEventListener('click', testaaAvain);
  e('vie-nappi').addEventListener('click', vieVarmuuskopio);
  e('tuo-nappi').addEventListener('click', function () {
    naytaDialogi(
      'Tuonti korvaa koko nykyisen kirjaston. Jatketaanko?',
      'Tuo',
      function () { e('tuonti-tiedosto').click(); },
      e('tuo-nappi')
    );
  });
  e('tuonti-tiedosto').addEventListener('change', function (tapahtuma) {
    const tiedosto = tapahtuma.target.files && tapahtuma.target.files[0];
    if (tiedosto) tuoVarmuuskopio(tiedosto);
    tapahtuma.target.value = '';
  });

  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(function () { /* ei estä käyttöä */ });
  }

  avaaAloitus();
});
