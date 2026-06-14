'use strict';

const fs = require('fs');
const path = require('path');
const {
  normalizeCodiceMagazzino,
  readFileWithEncoding,
  todayIt,
  pickNewestFile,
  loadMagazzinoBackup,
  maxNumericIndex,
} = require('./lib/utils.js');

const ROOT = __dirname;
const INPUT_DIR = path.join(ROOT, 'input');
const BACKUP_DIR = path.join(ROOT, 'backup');
const OUT_CHANGES = path.join(ROOT, 'changes.json');
const OUT_REPORT = path.join(ROOT, 'report.txt');

function parsePipeFile(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  const skipped = [];
  const dupCodM = new Map();

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const l = lines[i].trim();
    if (!l || l.startsWith('#')) continue;

    if (!l.startsWith('|') && l.split('|').length <= 5) {
      skipped.push({ lineNum, reason: 'formato non pipe', preview: l.slice(0, 60) });
      continue;
    }

    const parts = l.replace(/^\||\|$/g, '').split('|');
    if (parts.length < 7) {
      skipped.push({ lineNum, reason: 'colonne insufficienti', preview: l.slice(0, 60) });
      continue;
    }

    const codM = parts[2].trim();
    const desc = parts[5].replace(/\*/g, '').replace(/\^/g, '').trim();
    const unit = (parts[6] || 'PZ').trim();

    if (!desc && !codM) {
      skipped.push({ lineNum, reason: 'codM e desc vuoti', preview: l.slice(0, 60) });
      continue;
    }

    const norm = normalizeCodiceMagazzino(codM);
    if (!norm) {
      skipped.push({ lineNum, reason: 'codM non valido', preview: l.slice(0, 60) });
      continue;
    }

    if (dupCodM.has(norm)) {
      dupCodM.get(norm).push(lineNum);
    } else {
      dupCodM.set(norm, [lineNum]);
    }

    rows.push({ codM, desc, unit, norm, lineNum });
  }

  const duplicates = [];
  for (const [norm, lineNums] of dupCodM.entries()) {
    if (lineNums.length > 1) {
      duplicates.push({ norm, lineNums, kept: lineNums[lineNums.length - 1] });
    }
  }

  // Ultima riga vince per codM duplicato nel file
  const byNorm = new Map();
  for (const r of rows) byNorm.set(r.norm, r);

  return {
    items: Array.from(byNorm.values()),
    skipped,
    duplicates,
    totalLines: lines.length,
  };
}

function buildCodMIndex(magazzino) {
  const index = new Map();
  const dupInBackup = [];

  for (const [idx, art] of Object.entries(magazzino)) {
    if (!art || typeof art !== 'object') continue;
    const norm = normalizeCodiceMagazzino(art.codM);
    if (!norm) continue;
    if (index.has(norm)) {
      dupInBackup.push({ norm, indices: [index.get(norm).idx, idx] });
      continue;
    }
    index.set(norm, { idx, art });
  }

  return { index, dupInBackup };
}

function defaultNewArticle(codM, desc, unit) {
  const obj = {
    data: todayIt(),
    desc: desc || '',
    codF: '',
    codM: codM || '',
    prezzoOld: '',
    prezzo: '',
    barrato: 'no',
    promo: 'no',
    size: 'small',
    note: '',
    giornalino: '',
  };
  if (unit) obj.unit = unit.toLowerCase();
  return obj;
}

function runMerge() {
  const report = [];
  const log = (s) => report.push(s);

  log('=== MERGE MAGAZZINO FerApp (anteprima) ===');
  log('Generato: ' + new Date().toLocaleString('it-IT'));
  log('');

  const { file: backupFile, warnings: backupWarn } = pickNewestFile(BACKUP_DIR, '.json', 'backup');
  backupWarn.forEach((w) => log('ATTENZIONE: ' + w));
  log('Backup: ' + backupFile.name);

  const { file: inputFile, warnings: inputWarn } = pickNewestFile(INPUT_DIR, '.txt', 'input');
  inputWarn.forEach((w) => log('ATTENZIONE: ' + w));
  log('File gestionale: ' + inputFile.name);

  const magazzino = loadMagazzinoBackup(backupFile.full);
  if (!magazzino || typeof magazzino !== 'object') {
    throw new Error('Backup JSON non valido: atteso oggetto magazzino_ext.');
  }

  const backupCount = Object.keys(magazzino).length;
  log('Articoli nel backup Firebase: ' + backupCount);

  const { text, encoding } = readFileWithEncoding(inputFile.full);
  log('Encoding file input: ' + encoding);
  log('');

  const parsed = parsePipeFile(text);
  log('Righe file (totale): ' + parsed.totalLines);
  log('Articoli validi nel file (codM unici): ' + parsed.items.length);
  log('Righe saltate: ' + parsed.skipped.length);
  if (parsed.duplicates.length) {
    log('CodM duplicati nel file (usa ultima riga): ' + parsed.duplicates.length);
  }
  log('');

  const { index, dupInBackup } = buildCodMIndex(magazzino);
  if (dupInBackup.length) {
    log('ATTENZIONE: codM duplicati nel backup (match sul primo indice):');
    dupInBackup.slice(0, 20).forEach((d) => log('  ' + d.norm + ' -> indici ' + d.indices.join(', ')));
    if (dupInBackup.length > 20) log('  ... altri ' + (dupInBackup.length - 20));
    log('');
  }

  const updates = {};
  const updated = [];
  const added = [];
  const unchanged = [];
  let nextIdx = maxNumericIndex(magazzino) + 1;

  for (const item of parsed.items) {
    const hit = index.get(item.norm);

    if (hit) {
      const { idx, art } = hit;
      const basePath = 'magazzino_ext/' + idx;
      const delta = {};
      const changes = [];

      if (item.desc && item.desc !== (art.desc || '')) {
        delta.desc = item.desc;
        changes.push('desc');
      }

      if (item.unit) {
        const newUnit = item.unit.toLowerCase();
        const oldUnit = art.unit != null ? String(art.unit).toLowerCase() : '';
        if (newUnit !== oldUnit) {
          delta.unit = newUnit;
          changes.push('unit');
        }
      }

      if (changes.length) {
        for (const [k, v] of Object.entries(delta)) {
          updates[basePath + '/' + k] = v;
        }
        updated.push({
          idx,
          codM: art.codM,
          norm: item.norm,
          changes,
          oldDesc: art.desc || '',
          newDesc: delta.desc != null ? delta.desc : art.desc,
        });
      } else {
        unchanged.push({ idx, codM: art.codM, norm: item.norm });
      }
    } else {
      const newArt = defaultNewArticle(item.codM, item.desc, item.unit);
      const idx = nextIdx++;
      updates['magazzino_ext/' + idx] = newArt;
      added.push({ idx, codM: item.codM, norm: item.norm, desc: item.desc });
    }
  }

  const inputNorms = new Set(parsed.items.map((i) => i.norm));
  let onlyOnFirebase = 0;
  for (const { art } of index.values()) {
    const norm = normalizeCodiceMagazzino(art.codM);
    if (norm && !inputNorms.has(norm)) onlyOnFirebase++;
  }

  log('--- RIEPILOGO MERGE ---');
  log('Aggiornati (desc/unit):     ' + updated.length);
  log('Nuovi (append in coda):     ' + added.length);
  log('Invariati (match ok):       ' + unchanged.length);
  log('Solo su Firebase (intatti): ' + onlyOnFirebase);
  log('Path totali in changes.json: ' + Object.keys(updates).length);
  log('');

  if (updated.length) {
    log('--- AGGIORNAMENTI (max 30) ---');
    updated.slice(0, 30).forEach((u) => {
      log(
        '  [' + u.idx + '] codM=' + u.codM + ' (' + u.changes.join(', ') + ')' +
          '\n    prima: ' + (u.oldDesc || '(vuoto)').slice(0, 70) +
          '\n    dopo:  ' + (u.newDesc || '(vuoto)').slice(0, 70)
      );
    });
    if (updated.length > 30) log('  ... altri ' + (updated.length - 30) + ' aggiornamenti');
    log('');
  }

  if (added.length) {
    log('--- NUOVI ARTICOLI (max 30) ---');
    added.slice(0, 30).forEach((a) => {
      log('  [' + a.idx + '] codM=' + a.codM + ' — ' + (a.desc || '').slice(0, 60));
    });
    if (added.length > 30) log('  ... altri ' + (added.length - 30) + ' nuovi');
    log('');
  }

  if (parsed.skipped.length) {
    log('--- RIGHE SALTATE (max 15) ---');
    parsed.skipped.slice(0, 15).forEach((s) => {
      log('  riga ' + s.lineNum + ': ' + s.reason + ' — ' + s.preview);
    });
    if (parsed.skipped.length > 15) log('  ... altre ' + (parsed.skipped.length - 15));
    log('');
  }

  log('--- REGOLE APPLICATE ---');
  log('• Match per codM normalizzato');
  log('• Esistenti: solo desc (+ unit se presente); prezzo, codF, _m_*, qty preservati');
  log('• Nuovi: append con defaults (prezzo vuoto, codF vuoto, barrato/promo no, size small, data oggi)');
  log('• Articoli solo su Firebase: non toccati');
  log('• Nessun .remove() / .set() sull\'intero nodo — solo path singoli in changes.json');
  log('');
  log('Prossimo passo: controlla questo report, poi ESEGUI-2-CARICA.bat se tutto ok.');

  const changesDoc = {
    meta: {
      generatedAt: new Date().toISOString(),
      backupFile: backupFile.name,
      inputFile: inputFile.name,
      inputEncoding: encoding,
      backupArticles: backupCount,
      inputArticles: parsed.items.length,
      stats: {
        updated: updated.length,
        added: added.length,
        unchanged: unchanged.length,
        skippedLines: parsed.skipped.length,
        updatePaths: Object.keys(updates).length,
      },
    },
    updates,
  };

  fs.writeFileSync(OUT_CHANGES, JSON.stringify(changesDoc, null, 2), 'utf8');
  fs.writeFileSync(OUT_REPORT, report.join('\n'), 'utf8');

  console.log(report.join('\n'));
  console.log('\nScritti: ' + OUT_REPORT + ' e ' + OUT_CHANGES);
}

try {
  runMerge();
} catch (err) {
  console.error('ERRORE:', err.message);
  process.exit(1);
}
