# Rilievo Incendi — PWA per censimento piante danneggiate

App mobile-first (iPhone) per il censimento rapido di piante danneggiate da incendio:
una mano, pochi tocchi, pulsanti grandi, funzionamento **completamente offline**.

## Comandi

```bash
npm install       # prima volta
npm run dev       # sviluppo su http://localhost:5173
npm run build     # build di produzione in dist/ (PWA con service worker)
npm run preview   # anteprima della build
```

## Installazione su iPhone

1. Pubblica la cartella `dist/` su un hosting HTTPS qualsiasi (Netlify, Vercel, GitHub Pages…).
   Il service worker richiede HTTPS (o localhost).
2. Apri l'URL in **Safari** su iPhone.
3. Condividi → **Aggiungi a schermata Home**.
4. Da quel momento l'app si apre a schermo intero e funziona **senza connessione**:
   tutti i dati restano sul telefono (IndexedDB) e ogni tocco è salvato immediatamente.

## Funzioni (MVP)

- **Pratiche**: titolo, cliente, Comune, località, data incendio/sopralluogo, tecnico, note.
- **Unità di rilievo**: pianta singola, filare, siepe, gruppo, parcella — specie, cultivar, età,
  anno impianto, n. teorico, distanza, sesto. Per la siepe il n. teorico è calcolato
  (lunghezza ÷ distanza) e modificabile.
- **Censimento pianta per pianta**: 5 pulsantoni SANA/LIEVE/MEDIA/GRAVE/DISTRUTTA;
  un tocco = salva, numera, registra ora e GPS (secondo la modalità scelta), vibra* e conferma.
  ANNULLA ULTIMA, FOTO, DETTAGLIO, PAUSA sempre a portata di pollice.
- **Modalità siepe/filare**: rappresentazione lineare colorata a segmenti (es. `35–62 distrutte`)
  e assegnazione di una classe a un intervallo di piante in un'unica operazione.
- **Modalità gruppo**: CONTA RAPIDO (tocco = +1, pressione lunga = −1) e MODULO con
  verifica che la somma delle classi coincida col totale.
- **Dettaglio pianta**: chioma, fogliame, fusto/corteccia, colletto, capacità di recupero,
  esito tecnico (con possibilità di forzare classe ed esito manualmente), note.
- **Foto**: georiferite, associate alla pianta o al gruppo, salvate offline.
- **Classi personalizzabili**: nome, descrizione, intervallo % indicativo, colore,
  esito tecnico predefinito (gli intervalli NON sono automaticamente validi per tutte le specie).
- **Riepilogo**: teoriche/censite/mancanti, distribuzione per classe con grafico,
  percentuali danneggiate/gravi/distrutte/da sostituire, danno medio, da monitorare/da sostituire.
- **Mappa del rilievo** (Leaflet): piante colorate per classe di danno, punti inizio/fine
  filare, foto georiferite, sfondo satellitare (Esri) o stradale (OSM). Le tessere delle zone
  già visitate restano in cache e visibili anche offline.

\* la vibrazione usa `navigator.vibrate`, non supportata da iOS Safari: su iPhone la conferma
è il flash visivo al centro dello schermo.

## Non ancora implementato (prossime milestone)

- Stima economica con formule visibili e mancata funzione (M2)
- Controllo qualità pre-chiusura (M2)
- Export dati, report (M3)

## Stack

React 18 · TypeScript · Vite · vite-plugin-pwa (Workbox) · Dexie (IndexedDB) ·
Zod + React Hook Form · nessun backend: 100% offline sul dispositivo.
