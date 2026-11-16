# RIDEPLAY

**Your ride. Your music. Everyone controls the vibe.**

RIDEPLAY le permite pasagerilor să controleze muzica din mașină fără să atingă telefonul șoferului. Șoferul pornește o sesiune și afișează un cod QR. Pasagerii îl scanează, caută melodii direct în RIDEPLAY și le adaugă într-o coadă comună. Muzica pornește tot de pe telefonul șoferului, prin sistemul audio al mașinii, iar navigația nu e întreruptă.

Interfața aplicației este în engleză, conform specificației. Acest ghid este în română.

---

## Ce face aplicația

| | |
|---|---|
| **Șofer** | Se conectează la Spotify (sau Apple Music), alege telefonul pe care cântă muzica, creează sesiunea. Are tabloul de bord cu melodia curentă, controale, cod QR, link de copiat sau partajat, link nou, încheierea sesiunii, coada comună (cu „adăugat de”), lista pasagerilor și permisiunile. |
| **Pasager** | Scanează codul QR sau scrie codul de 8 caractere. Fără cont și fără aplicație instalată. Caută melodii, artiști, albume și playlisturi, adaugă în coadă și, dacă șoferul permite, folosește play/pauză/înainte/înapoi. |
| **Timp real** | Orice schimbare (cineva intră, o melodie adăugată sau scoasă, play/pauză) apare imediat pe toate telefoanele. Dacă un telefon pierde internetul, afișează „Reconnecting…” și revine singur. |
| **Permisiuni** | Șoferul poate opri adăugarea de melodii, play/pauza sau sărirea melodiilor, poate seta o limită de melodii pe pasager, poate lua controlul unui pasager anume și poate scoate un pasager din sesiune. |
| **Siguranță** | Link-urile sunt private și expiră după 12 ore. Un link nou îl dezactivează pe cel vechi. Nicio cheie secretă nu ajunge în browser. Datele sesiunii se șterg la 7 zile după încheiere. |

## Limite reale (impuse de Spotify și Apple, nu de RIDEPLAY)

**Spotify** (regulile valabile din februarie 2026):
- Controlul de la distanță merge **doar cu Spotify Premium**, iar **proprietarul aplicației de dezvoltator** trebuie să aibă Premium.
- O aplicație Spotify în „Development Mode” acceptă **maximum 5 conturi Spotify**, adăugate de mână. Asta privește doar șoferii; pasagerii nu au nevoie de cont Spotify. Pentru lansarea publică, Spotify acordă „Extended Quota” doar companiilor mari.
- Spotify **nu permite scoaterea unei melodii** din coada lui. Când șoferul scoate o melodie deja trimisă, RIDEPLAY o sare automat când începe și afișează asta clar.
- Aplicația Spotify trebuie să fie deschisă pe telefonul șoferului (măcar o melodie pornită o dată), ca Spotify să o vadă ca „dispozitiv activ”.
- Căutarea întoarce acum maximum 10 rezultate pe pagină. RIDEPLAY are buton de „Show more”.

**Apple Music:**
- Apple **nu oferă nicio metodă** prin care o aplicație să controleze de la distanță aplicația Music de pe iPhone. Cea mai apropiată variantă oficială: **pagina RIDEPLAY de pe telefonul șoferului devine playerul** (prin MusicKit, piese întregi, pentru abonații Apple Music) și execută comenzile pasagerilor.
- Pagina trebuie să rămână deschisă. Dacă telefonul stă blocat mult timp, browserul o poate pune pe pauză.
- Necesită un **cont Apple Developer plătit** (99 USD/an). Fără el, Apple Music apare în aplicație ca „Not set up on this server”.

RIDEPLAY nu redă, nu descarcă și nu stochează niciodată muzică. Folosește doar API-urile oficiale.

---

## Publicare pas cu pas (aprox. 30 de minute)

Ai nevoie de: contul Supabase (poți folosi **același proiect** ca la „Toamna în amintiri”, tabelele nu se amestecă), un cont GitHub, Vercel și un cont **Spotify Premium**.

### 1. Supabase — baza de date

1. Deschide proiectul în [supabase.com/dashboard](https://supabase.com/dashboard).
2. **SQL Editor → New query**: lipește tot conținutul fișierului `supabase/rideplay.sql` și apasă **Run**. Trebuie să apară „Success”.
3. **Project Settings → API Keys** (și **Data API** pentru URL). Notează:
   - **Project URL**: `https://xxxx.supabase.co`
   - **Secret key**: `sb_secret_...`
   - **Publishable key**: `sb_publishable_...` (pentru actualizări instantanee; aceasta e voie să fie publică)

### 2. Spotify — aplicația de dezvoltator

1. Intră pe [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) cu contul Spotify **Premium** și apasă **Create app**.
2. Completează:
   - **App name**: `RIDEPLAY`; **App description**: `Car music remote`
   - **Redirect URIs**: `https://ADRESA-TA.vercel.app/api/spotify/callback` (o pui după pasul 4, când știi adresa; poți reveni oricând)
   - La **Which API/SDKs are you planning to use?** bifează **Web API**, apoi **Save**.
3. **Settings**: copiază **Client ID** și apasă **View client secret** → copiază **Client secret**.
4. **User Management**: adaugă numele și e-mailul contului Spotify al fiecărui șofer care va folosi RIDEPLAY (maximum 5). Fără acest pas, conectarea dă eroare.

### 3. GitHub

Creează un repository gol numit `rideplay` și dă-i acces aplicației Claude (la fel ca data trecută: github.com/apps/claude → Configure → adaugă repository-ul). Spune-mi și urc eu codul.

### 4. Vercel

1. **Add New → Project** → importă `rideplay`.
2. La **Environment Variables** adaugă:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | cheia `sb_secret_...` |
| `SUPABASE_PUBLISHABLE_KEY` | cheia `sb_publishable_...` |
| `SESSION_SECRET` | un șir aleator de minimum 32 de caractere |
| `SPOTIFY_CLIENT_ID` | din Spotify |
| `SPOTIFY_CLIENT_SECRET` | din Spotify |

3. **Deploy**. Notează adresa (de ex. `https://rideplay-xyz.vercel.app`) și adaug-o la **Redirect URIs** în Spotify (pasul 2), exact: `https://rideplay-xyz.vercel.app/api/spotify/callback`.
4. Verificare: deschide `https://ADRESA-TA/api/health`. Toate rândurile trebuie să spună `ok`.

### 5. Primul drum

1. Pe telefonul șoferului: deschide Spotify și pornește o melodie, apoi intră pe site → **Start a session** → Spotify → conectare → alege telefonul → numește sesiunea.
2. Pe alt telefon: scanează codul QR → **Join session** → caută și adaugă o melodie.

### Apple Music (opțional)

1. Cont [Apple Developer Program](https://developer.apple.com/programs/).
2. **Certificates, Identifiers & Profiles → Identifiers**: creează un **Media ID** cu MusicKit activat.
3. **Keys**: creează o cheie cu **Media Services (MusicKit, ShazamKit, Apple Music Feed)** legată de Media ID → descarcă fișierul `.p8` (se descarcă o singură dată).
4. În Vercel adaugă: `APPLE_TEAM_ID` (din pagina Membership), `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (tot textul din `.p8`, inclusiv liniile BEGIN/END) → **Redeploy**.

---

## Rulare locală

```bash
npm install
cp .env.example .env.local      # completează valorile
npm run dev
```

Deschide **http://127.0.0.1:3000** (nu `localhost`, pentru că Spotify nu acceptă `localhost`) și adaugă în Spotify redirect URI-ul `http://127.0.0.1:3000/api/spotify/callback`. Ca să testezi cu telefonul în aceeași rețea, ai nevoie de o adresă HTTPS (de exemplu Vercel).

---

## Cum e construită

- **Next.js 15 + React 19 + TypeScript + Tailwind CSS 4**, iconițe Lucide, animații Motion (respectă „reduced motion”), fontul Geist inclus local.
- **Supabase Postgres**: toată logica sesiunilor stă în funcții SQL (`supabase/rideplay.sql`) care pot fi apelate **doar** de server. Tabelele au Row Level Security fără politici publice. Token-urile sunt salvate doar ca hash SHA-256. Token-urile Spotify sunt criptate AES-256-GCM înainte de a ajunge în baza de date.
- **Timp real**: după fiecare schimbare, serverul trimite un semnal pe un canal Supabase Realtime cu nume secret. Semnalul nu conține date: fiecare ecran cere starea nouă prin API-ul autentificat. Fără cheia publishable, aplicația face actualizări la 3 secunde.
- **Spotify**: autorizare OAuth pe server (cheia secretă nu ajunge în browser), cu permisiuni minime: `user-read-playback-state`, `user-modify-playback-state`, `user-read-currently-playing`, `playlist-read-private`. Starea redării e citită cel mult o dată la 3 secunde pe sesiune, oricâți pasageri ar fi.
- **Siguranță**: protecție CSRF (verificarea originii), limitarea cererilor, detaliile melodiilor sunt luate de la Spotify/Apple (nu din browser), maximum 12 pasageri pe sesiune.

Structură: `app/` (pagini și API), `components/` (interfață), `lib/` (sesiuni, securitate, integrări în `lib/providers/`), `supabase/rideplay.sql`.

## Testat

Testat automat în Chromium cu un șofer (desktop și mobil) și doi pasageri pe telefoane separate, folosind baza de date reală (PostgreSQL) și simulatoare pentru Spotify și Apple Music. Scenarii verificate:
- crearea sesiunii, codul QR și intrarea pasagerilor;
- căutarea, deschiderea unui artist și adăugarea melodiilor (inclusiv blocarea dublurilor);
- comenzile play/pauză/înainte ajunse la Spotify;
- urmărirea melodiei curente și sărirea automată a melodiei scoase;
- toate permisiunile, link nou (cel vechi nu mai merge), scoaterea unui pasager, încheierea sesiunii;
- tema deschisă;
- fluxul Apple Music: token-ul de dezvoltator semnat ES256 și comenzile executate de playerul șoferului, cu raportarea erorilor reale.

## Înainte de o lansare publică

- Spotify cere afișarea logo-ului oficial lângă conținutul Spotify. Aplicația folosește acum doar numele, deci adaugă logo-urile din kiturile oficiale (Spotify Design Guidelines, Apple Music Identity Guidelines).
- Peste 5 șoferi pe Spotify e nevoie de „Extended Quota”, pe care Spotify o acordă doar companiilor înregistrate.
