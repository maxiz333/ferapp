# Rattazzi — Istruzioni per Cursor

## Descrizione progetto
App web single-page per gestione cartellini prezzi e ordini per una ferramenta.
~19.000 articoli sincronizzati via Firebase Realtime Database.
Tab principali: Carrello (tc), Ordini (to), Inventario (t0), Magazzino (t11), Cartellini (t1), Fatture, Altro.
Due interfacce: Banco (vendita) e Ufficio (gestione).

---

## Architettura tecnica
- Vanilla JS puro — nessun bundler, nessun framework, nessun ES module
- Tutte le funzioni sono globali, chiamate da index.html tramite onclick="nomeFunzione()"
- File JS caricati con tag script in index.html in ordine preciso
- Backend: Firebase Realtime Database (ferramenta-2b546-default-rtdb.europe-west1.firebasedatabase.app)
- Persistenza locale: localStorage come backup secondario

---

## Variabili globali principali
- rows[] — 19.000 articoli (caricati da Firebase, NON da localStorage)
- magazzino[] — dati estesi articoli (qty, specs, marca, ecc.)
- ordini[] — lista ordini
- carrelli[] — lista carrelli attivi
- ctRows[] — cartellini selezionati per stampa (separato da rows[])
- activeCartId — ID carrello attivo
- _currentUser — utente loggato {key, nome, ruolo, colore}
- _roles — configurazione account {prop1, prop2, comm1, comm2}

---

## Nodi Firebase
- magazzino_ext — 19.000 articoli
- ordini — ordini sincronizzati real-time
- carrelli — carrelli attivi (solo non-inviati)
- auth — account, PIN, nomi, colori
- cartellini — lista cartellini
- ordiniLocks — lock collaborativo ordini
- accountBusy — stato occupato per account

---

## Account e ruoli
- prop1, prop2 — Proprietari (accesso totale)
- comm1, comm2 — Commessi (accesso limitato, non possono modificare ordini altrui)
- Auto-login via cp4_auth_session in localStorage
- PIN e nomi sincronizzati su Firebase nodo auth

---

## File stub (vuoti — codice spostato nei moduli)
I seguenti file esistono nella cartella ma sono vuoti o quasi:
- carrello.js, ordini.js, database.js, inventario.js, movimenti.js, ui.js
Non cercare codice in questi file.
- cartellini.js — al contrario NON e stato diviso, contiene tutto il codice cartellini

---

## REGOLA CRITICA — Firebase
Prima di qualsiasi operazione su Firebase (specialmente .remove() o .set() su nodi principali) mostrare cosa si intende fare e aspettare conferma esplicita.
Un .remove() errato ha cancellato tutto il database in passato.

## Funzione delicata
loadMagazzinoFB() in core.magazzino-loader.js carica 19.000 articoli in chunks con setTimeout(nextChunk, 0). Modifiche alla sua logica interna causano crash o freeze. Intervenire con estrema cautela.

---

## Aggiornamento automatico istruzioni
Alla fine di ogni sessione in cui vengono aggiunti moduli, risolti problemi o cambiata la struttura, aggiorna questo file ISTRUZIONI.md di conseguenza senza che l'utente debba chiederlo.
