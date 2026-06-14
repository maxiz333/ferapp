'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = __dirname;
const CHANGES_FILE = path.join(ROOT, 'changes.json');
const SERVICE_ACCOUNT = path.join(ROOT, 'serviceAccountKey.json');
const CHUNK_SIZE = 500;
const FB_MAG_PATH = 'magazzino_ext';

function askConfirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function chunkObject(obj, size) {
  const keys = Object.keys(obj);
  const chunks = [];
  for (let i = 0; i < keys.length; i += size) {
    const batch = {};
    for (let j = i; j < Math.min(i + size, keys.length); j++) {
      const k = keys[j];
      batch[k] = obj[k];
    }
    chunks.push(batch);
  }
  return chunks;
}

async function runUpload() {
  if (!fs.existsSync(CHANGES_FILE)) {
    throw new Error('Manca changes.json — esegui prima ESEGUI-1-ANTEPRIMA.bat');
  }
  if (!fs.existsSync(SERVICE_ACCOUNT)) {
    throw new Error('Manca serviceAccountKey.json nella cartella aggiorna-magazzino/');
  }

  const doc = JSON.parse(fs.readFileSync(CHANGES_FILE, 'utf8'));
  const updates = doc.updates || {};
  const paths = Object.keys(updates);

  if (!paths.length) {
    console.log('Nessuna modifica da caricare. changes.json è vuoto.');
    return;
  }

  const meta = doc.meta || {};
  console.log('=== CARICA SU FIREBASE ===');
  console.log('Backup usato:   ' + (meta.backupFile || '?'));
  console.log('File gestionale:' + (meta.inputFile || '?'));
  console.log('Generato:       ' + (meta.generatedAt || '?'));
  if (meta.stats) {
    console.log('Aggiornati:     ' + (meta.stats.updated || 0));
    console.log('Nuovi:          ' + (meta.stats.added || 0));
  }
  console.log('Path da scrivere: ' + paths.length);
  console.log('');
  console.log('Sicurezza: usa solo .update() a chunk da ' + CHUNK_SIZE + '.');
  console.log('NON verrà cancellato o sovrascritto l\'intero nodo ' + FB_MAG_PATH + '.');
  console.log('');

  const answer = await askConfirm('Confermi il caricamento su Firebase? (si/no): ');
  if (answer !== 'si' && answer !== 's' && answer !== 'yes' && answer !== 'y') {
    console.log('Operazione annullata.');
    return;
  }

  const admin = require('firebase-admin');
  const serviceAccount = require(SERVICE_ACCOUNT);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL:
        serviceAccount.databaseURL ||
        'https://ferramenta-2b546-default-rtdb.europe-west1.firebasedatabase.app',
    });
  }

  const db = admin.database();
  const ref = db.ref();
  const chunks = chunkObject(updates, CHUNK_SIZE);

  console.log('Upload in ' + chunks.length + ' chunk...');

  for (let i = 0; i < chunks.length; i++) {
    await ref.update(chunks[i]);
    console.log('  chunk ' + (i + 1) + '/' + chunks.length + ' ok (' + Object.keys(chunks[i]).length + ' path)');
  }

  console.log('');
  console.log('Caricamento completato.');
  console.log('Apri FerApp e verifica qualche articolo aggiornato e uno nuovo.');
}

runUpload().catch((err) => {
  console.error('ERRORE:', err.message);
  process.exit(1);
});
