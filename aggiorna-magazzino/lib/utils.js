'use strict';

const fs = require('fs');
const path = require('path');

/** Come normalizeCodiceMagazzino in database.core.js (00123 == 123). */
function normalizeCodiceMagazzino(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) {
    const n = String(parseInt(s, 10));
    return n === 'NaN' ? '' : n;
  }
  return s.toLowerCase().replace(/\s+/g, '');
}

function readFileWithEncoding(filePath) {
  const buf = fs.readFileSync(filePath);
  const utf8 = buf.toString('utf8');
  if (!utf8.includes('\uFFFD')) {
    return { text: utf8, encoding: 'utf-8' };
  }
  return { text: buf.toString('latin1'), encoding: 'iso-8859-1' };
}

function todayIt() {
  return new Date().toLocaleDateString('it-IT');
}

function listFilesByExt(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(ext))
    .map((f) => {
      const full = path.join(dir, f);
      return { name: f, full, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

function pickNewestFile(dir, ext, label) {
  const files = listFilesByExt(dir, ext);
  if (!files.length) {
    throw new Error(`Nessun file ${ext} in ${dir}. Vedi LEGGIMI.md.`);
  }
  const warnings = [];
  if (files.length > 1) {
    warnings.push(
      `Trovati ${files.length} file ${ext} in ${label}/. Uso il più recente: ${files[0].name}` +
        `\n  (Altri: ${files.slice(1).map((f) => f.name).join(', ')})` +
        '\n  Per evitare ambiguità, lascia un solo file nella cartella.'
    );
  }
  return { file: files[0], warnings };
}

function loadMagazzinoBackup(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (raw && typeof raw === 'object' && raw.magazzino_ext && typeof raw.magazzino_ext === 'object') {
    return raw.magazzino_ext;
  }
  return raw;
}

function maxNumericIndex(mag) {
  let max = -1;
  for (const k of Object.keys(mag)) {
    const n = parseInt(k, 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return max;
}

module.exports = {
  normalizeCodiceMagazzino,
  readFileWithEncoding,
  todayIt,
  listFilesByExt,
  pickNewestFile,
  loadMagazzinoBackup,
  maxNumericIndex,
};
