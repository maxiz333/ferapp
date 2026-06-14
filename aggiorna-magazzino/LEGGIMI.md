# Aggiorna magazzino FerApp (~ogni 3 mesi)

Script PC standalone per allineare **magazzino_ext** su Firebase con l’export del gestionale, **senza cancellare** articoli esistenti.

## Cosa serve

1. **Node.js** installato sul PC (https://nodejs.org)
2. **Backup JSON** di `magazzino_ext` da Firebase Console
3. **File .txt** dal gestionale (formato pipe `|...|`)
4. **serviceAccountKey.json** (chiave Admin SDK Firebase) — **non condividerla**

## Cartelle

| Cartella / file | Uso |
|-----------------|-----|
| `backup/` | Metti qui il JSON esportato da Firebase (`magazzino_ext`) |
| `input/` | Metti qui il file .txt dal gestionale |
| `serviceAccountKey.json` | Chiave Firebase (scaricala dalla Console → Impostazioni progetto → Account di servizio) |
| `report.txt` | Anteprima umana del merge (creato dallo script 1) |
| `changes.json` | Solo le modifiche da caricare (creato dallo script 1) |

### Più file nella stessa cartella

- **`backup/`**: se ci sono più `.json`, viene usato **il più recente** (data modifica file).
- **`input/`**: stessa regola per i `.txt`.

Se vedi un avviso nel report, **tieni un solo file** nella cartella per evitare confusione.

## Passo 1 — Backup Firebase

1. Apri [Firebase Console](https://console.firebase.google.com) → Realtime Database
2. Nodo **`magazzino_ext`**
3. Esporta / scarica JSON (o backup completo e tieni solo quella parte)
4. Salva in `backup/` (es. `magazzino_ext-2026-06.json`)

## Passo 2 — File gestionale

Copia in `input/` qualsiasi `.txt` dal gestionale.

Formato atteso (pipe):

```
|-0100|A|905572|S| |  SERRATURE ELETTR E SICUREZZA |PZ|---------|-|
```

- `codM` = 3° campo, `desc` = 6° campo, `unit` = 7° campo
- Righe che iniziano con `#` vengono ignorate
- Encoding: lo script prova UTF-8, poi ISO-8859-1 (Windows italiano)

## Passo 3 — Anteprima (senza toccare Firebase)

Doppio clic su **`ESEGUI-1-ANTEPRIMA.bat`**

Leggi **`report.txt`**:

| Voce | Significato |
|------|-------------|
| Aggiornati | Stesso codM: cambiano solo descrizione (e unità se presente) |
| Nuovi | CodM non in Firebase: aggiunti **in fondo** con indice nuovo |
| Solo su Firebase | Restano **com’erano** (non vengono eliminati) |
| Invariati | Match ok, nessun cambiamento necessario |

**Non si toccano:** prezzo, codF, qty, campi `_m_*`, promo, barrato, ecc. sugli articoli già presenti.

## Passo 4 — Carica su Firebase

Solo se l’anteprima va bene: **`ESEGUI-2-CARICA.bat`**

- Chiede conferma digitando **si**
- Carica a **chunk da 500** con `.update()` (mai wipe dell’intero nodo)

## Passo 5 — Test in FerApp

1. Apri FerApp e attendi il sync magazzino
2. Cerca **2–3 codM aggiornati** nel report → controlla descrizione
3. Cerca **1 codM nuovo** → deve comparire in lista
4. Controlla un articolo **non nel file gestionale** → prezzo e qty devono essere identici a prima

## Regole merge (riepilogo)

1. Match per **codM normalizzato** (`00123` = `123`)
2. Esistente: aggiorna **desc** (+ **unit** se nel file); resto invariato
3. Nuovo nel file: append con prezzo vuoto, codF vuoto, barrato/promo no, size small, data oggi
4. Solo su Firebase: **non rimossi, non modificati**
5. **Mai** `.remove()` o `.set()` su tutto `magazzino_ext` — solo path singoli

## Problemi comuni

| Problema | Cosa fare |
|----------|-----------|
| `Nessun file .txt in input/` | Metti il file in `input/` |
| `Nessun file .json in backup/` | Metti l’export Firebase in `backup/` |
| Caratteri strani (à, è…) | Riesporta il txt o salva come UTF-8; lo script prova anche Latin-1 |
| `Manca serviceAccountKey.json` | Scarica chiave Admin SDK e mettila nella cartella |
| Upload rifiutato | Controlla regole Firebase e che la chiave sia del progetto giusto |

## Sicurezza

- **Non committare** `serviceAccountKey.json` né i file in `input/`
- Tieni una copia del backup JSON prima di ogni caricamento
