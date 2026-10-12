# 📅 Calendario Esami PLUS

> **Sviluppato e ideato da Luco_dC**  
> *In collaborazione con CoScienze Associazione*

Una **Progressive Web App (PWA)** moderna, reattiva e completamente client-side ideata per aiutare gli studenti a consultare, cercare e monitorare gli appelli d'esame universitari direttamente dal proprio smartphone o computer.

---

## 🌟 Caratteristiche Principali

- 🔍 **Ricerca Istantanea con Autocomplete**: Cerca qualsiasi materia in tempo reale.
- 👨‍🏫 **Selezione Docente**: Mostra tutti i professori associati a una determinata cattedra con un comodo sistema a chip interattivi.
- ⏳ **Countdown Intelligente**: Ogni esame salvato mostra i giorni e le ore rimanenti al giorno della prova.
- 📅 **Ordinamento Cronologico**: Gli esami salvati vengono ordinati automaticamente mostrando per primo quello temporalmente più vicino.
- ✍️ **Inserimento Prove Intercorso**: Possibilità di aggiungere manualmente qualsiasi prova o parziale non presente nel calendario ufficiale.
- 📲 **Sincronizzazione Multi-Dispositivo (QR Code & Link)**: Sincronizza istantaneamente il tuo calendario esami tra PC e smartphone (o browser differenti) semplicemente inquadrando un QR Code a schermo, senza registrazione o account.
- 📤 **Condivisione Esami (WhatsApp/Telegram)**: Invia la lista formattata dei tuoi prossimi esami ai colleghi di studio in 1 click.
- 🗑️ **Svuota Tutto con Conferma**: Cancella in sicurezza tutti i promemoria salvati a fine sessione.
- 📱 **Installabile come App (PWA)**: Supporto per installazione desktop (Windows/Mac) e mobile (Android/iOS) con icona dedicata.
- 📶 **Supporto Offline**: Grazie al Service Worker integrato, l'app e i calendari possono essere consultati anche in assenza di connessione internet.
- 🔒 **Privacy Totale**: Nessun dato personale o esame salvato lascia il dispositivo dell'utente (`localStorage`).

---

## 📁 Struttura della Repository

```
CalendarioPLUS/
├── calendario/
│   ├── calendario.pdf       # File PDF della sessione d'esami attuale
│   └── ISTRUZIONI.txt       # Guida tecnica e manuale di sostituzione PDF
├── index.html               # Struttura della WebApp e configurazioni meta/PWA
├── style.css                # Foglio di stile personalizzato (Palette CoScienze)
├── app.js                   # Motore di estrazione PDF.js, gestione stato ed eventi
├── sw.js                    # Service Worker (gestione cache e offline)
├── manifest.json            # Descrittore per installazione PWA
├── logo.png                 # Logo identificativo dell'app
├── package.json             # Metadati di progetto (Author: Luco_dC)
└── README.md                # Questa documentazione
```

---

## 🔄 Come aggiornare il calendario per la nuova sessione

1. Entra nella cartella `calendario/`.
2. Sostituisci il vecchio file inserendo il nuovo PDF rilasciato dall'ateneo.
3. Rinomina il nuovo file in:
   ```
   calendario.pdf
   ```
4. Esegui il commit e il push su GitHub:
   ```bash
   git add .
   git commit -m "Aggiornamento calendario nuova sessione"
   git push origin main
   ```
L'applicazione scaricherà in tempo reale la nuova versione senza problemi di cache per tutti gli utenti.

---

## 🛠️ Note per gli Sviluppatori

- **Framework**: Vanilla JavaScript (Zero dipendenze esterne di build).
- **Libreria PDF**: [PDF.js](https://mozilla.github.io/pdf.js/) via CDN.
- **Strategia Caching**: Nel Service Worker `sw.js` le chiamate ai file `.pdf` utilizzano la strategia **Network-First** (scarica online l'ultima versione, usa la cache solo offline).

---

## 👤 Autore

Progetto ideato e sviluppato con dedizione da **[Luco_dC](https://github.com/lucadomenico1)**.  
Tutti i diritti riservati.
