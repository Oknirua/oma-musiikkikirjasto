# Ostoslista

Kahden hengen jaettu ostoslista-sovellus (PWA), joka toimii iPhonella (Safari/VoiceOver)
ja Androidilla (Chrome) kotivalikkoon asennettuna.

- Ei kirjautumista — lista jaetaan sovelluksen osoitteen (linkin) kautta
- Tuotteet tallennetaan Firebase Firestoreen
- Lista haetaan avattaessa ja sovellukseen palattaessa; lisäksi **Päivitä lista** -painike
- Rastitetut tuotteet jäävät näkyviin yliviivattuina, kunnes ne poistetaan
  **Poista valitut** -painikkeella (varmistuskysymyksen kera)
- Käyttöliittymä on suomeksi ja suunniteltu esteettömäksi (VoiceOver)

## Käyttöönotto

### 1. Firestoren turvasäännöt (kerran)

1. Avaa [Firebase-konsoli](https://console.firebase.google.com) ja valitse projekti **ostoslista-63b3f**
2. Valitse vasemmasta valikosta **Build → Firestore Database**
3. Avaa välilehti **Rules** (Säännöt)
4. Poista vanha sisältö ja liitä tilalle tiedoston [`firestore.rules`](./firestore.rules) koko sisältö
5. Paina **Publish** (Julkaise)

Säännöt sallivat pääsyn vain tämän sovelluksen omaan listaan — mikään muu
projektin tieto ei ole avoinna internetiin.

### 2. Julkaisu GitHub Pagesiin

Julkaisu tapahtuu automaattisesti GitHub Actions -työnkululla
(`.github/workflows/deploy.yml`) aina, kun koodi päivittyy.

Jos julkaisu ei käynnisty automaattisesti, ota Pages käyttöön kerran:
**Settings → Pages → Build and deployment → Source: GitHub Actions**.

Sovelluksen osoite on muotoa `https://<käyttäjä>.github.io/ostoslista/`.

> Huom: GitHub Pages -sivusto on julkinen, vaikka repositorio on yksityinen.
> Osoitetta ei kannata jakaa muille kuin listan käyttäjille.

### 3. Asennus puhelimeen

**iPhone (Safari):** avaa sovelluksen osoite → paina **Jaa**-painiketta →
**Lisää Koti-valikkoon**.

**Android (Chrome):** avaa sovelluksen osoite → valikko (⋮) →
**Lisää aloitusnäytölle** / **Asenna sovellus**.

## Tiedostot

| Tiedosto | Tarkoitus |
|---|---|
| `index.html` | Sovelluksen rakenne |
| `style.css` | Ulkoasu (tukee vaaleaa ja tummaa tilaa) |
| `app.js` | Toimintalogiikka; Firestore REST-rajapinnan kautta, ei ulkoisia kirjastoja |
| `config.js` | Firebase-projektin julkiset tunnisteet ja listan tunniste |
| `firestore.rules` | Firestoren turvasäännöt (liitetään Firebase-konsoliin) |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA-asennus ja offline-käynnistys |
| `.github/workflows/deploy.yml` | Automaattinen julkaisu GitHub Pagesiin |
