// movimenti.backup.js - estratto da movimenti.js

// ------------------------------------------------------------------
//  FEATURE 7 - Backup automatico
// ------------------------------------------------------------------
var BAK_INT_K = window.AppKeys.BACKUP_INTERVAL;
var BAK_LAST_K = window.AppKeys.BACKUP_LAST;

function getBackupInterval() {
  var v = localStorage.getItem(BAK_INT_K);
  return v !== null ? parseInt(v) : 7;
}
function setBackupInterval(days) {
  localStorage.setItem(BAK_INT_K, String(days));
  renderBackupSettings();
}
function getLastBackupDate() { return localStorage.getItem(BAK_LAST_K) || null; }
function markBackupDone() { localStorage.setItem(BAK_LAST_K, new Date().toISOString().split('T')[0]); }

function checkAutoBackup() {
  var interval = getBackupInterval();
  if (interval === 0) return;
  var last = getLastBackupDate();
  if (!last) { markBackupDone(); return; }
  var days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
  if (days >= interval) {
    showToastGen('purple', '\uD83D\uDCBE Backup automatico in corso\u2026');
    setTimeout(function () { eseguiBackup(true); }, 800);
  }
}

function eseguiBackup(silent) {
  var data = {
    version: 4, date: new Date().toISOString(),
    rows: rows, magazzino: magazzino, categorie: categorie,
    movimenti: movimenti, ordini: ordini, carrelli: carrelli
  };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  var d = new Date();
  var ds = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  a.href = url; a.download = 'rattazzi_backup_' + ds + '.json';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  markBackupDone();
  showToastGen('green', silent ? '\u2705 Backup automatico completato' : '\u2705 Backup scaricato!');
  renderBackupSettings();
}

function renderBackupSettings() {
  var el = document.getElementById('backup-auto-settings');
  if (!el) return;
  var interval = getBackupInterval();
  var last = getLastBackupDate();
  var opts = [
    { v: 0, l: 'Disabilitato' }, { v: 1, l: '1 giorno' }, { v: 3, l: '3 giorni' },
    { v: 7, l: '7 giorni' }, { v: 14, l: '14 giorni' }, { v: 30, l: '30 giorni' }
  ];
  var selHtml = opts.map(function (o) {
    return '<option value="' + o.v + '"' + (interval === o.v ? ' selected' : '') + '>' + o.l + '</option>';
  }).join('');
  el.innerHTML =
    '<div style="background:#1e1e1e;border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:16px;">' +
    '<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">\uD83D\uDCBE Backup automatico</div>' +
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
    '<span style="font-size:12px;color:var(--text);">Frequenza:</span>' +
    '<select onchange="setBackupInterval(parseInt(this.value))" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:#111;color:var(--text);font-size:12px;">' +
    selHtml + '</select>' +
    '<button onclick="eseguiBackup(false)" style="padding:7px 14px;border-radius:8px;border:none;background:var(--accent);color:#111;font-size:12px;font-weight:700;cursor:pointer;">\u2B07\uFE0F Scarica ora</button>' +
    '</div>' +
    (last ? '<div style="font-size:10px;color:var(--muted);margin-top:6px;">Ultimo backup: ' + last + '</div>' : '<div style="font-size:10px;color:#777;margin-top:6px;">Nessun backup ancora effettuato</div>') +
    '</div>';
}

// ------------------------------------------------------------------
//  FEATURE 1 - Stampa lista riordino (apre finestra stampabile)
// ------------------------------------------------------------------
function stampaListaRiordino() {
  var sotto = [];
  rows.forEach(function (r, i) {
    if (removed.has(String(i))) return;
    var m = magazzino[i] || {};
    var qty = m.qty !== undefined && m.qty !== '' ? Number(m.qty) : null;
    var soglia = getSoglia(i);
    if (qty !== null && qty <= soglia) sotto.push({ r: r, m: m, i: i, qty: qty, soglia: soglia });
  });
  if (!sotto.length) { showToastGen('green', '\u2705 Nessun prodotto sotto scorta!'); return; }

  var gruppi = {};
  sotto.forEach(function (item) {
    var k = item.m.nomeFornitore || '(Fornitore non specificato)';
    if (!gruppi[k]) gruppi[k] = [];
    gruppi[k].push(item);
  });

  var oggi = new Date().toLocaleDateString('it-IT');
  var H = [];
  H.push('<!DOCTYPE html><html><head><meta charset="utf-8">');
  H.push('<title>Lista Riordino - ' + oggi + '</title>');
  H.push('<style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:20px}');
  H.push('h1{font-size:18px;margin-bottom:2px}h2{font-size:13px;margin:14px 0 5px;color:#555;border-bottom:1px solid #ccc;padding-bottom:3px}');
  H.push('table{width:100%;border-collapse:collapse;margin-bottom:10px}');
  H.push('th{background:#f0f0f0;padding:5px 7px;text-align:left;font-size:10px;border:1px solid #ccc}');
  H.push('td{padding:5px 7px;border:1px solid #ddd;vertical-align:top}');
  H.push('tr:nth-child(even){background:#fafafa}.qty{font-weight:bold;color:#c00}');
  H.push('@media print{@page{margin:15mm}button{display:none}}</style></head><body>');
  H.push('<div style="display:flex;justify-content:space-between;align-items:flex-start">');
  H.push('<div><h1>\uD83D\uDD34 Lista Riordino \u2014 Ferramenta Rattazzi</h1>');
  H.push('<p style="color:#777;margin:2px 0">' + oggi + '</p></div>');
  H.push('<div style="text-align:right;font-size:11px;color:#888"><b>' + sotto.length + '</b> articoli &nbsp; <b>' + Object.keys(gruppi).length + '</b> fornitori</div></div>');
  H.push('<button onclick="window.print()" style="margin:10px 0;padding:8px 16px;background:#c00;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;">\uD83D\uDDA8\uFE0F Stampa</button>');
  H.push('<hr style="margin:8px 0">');

  Object.keys(gruppi).sort().forEach(function (forn) {
    H.push('<h2>\uD83C\uDFE2 ' + forn + '</h2>');
    H.push('<table><thead><tr>');
    H.push('<th>Descrizione</th><th>Cod. Forn.</th><th>Mio Cod.</th><th>Specifiche</th><th>Posizione</th>');
    H.push('<th style="text-align:center">Qt&agrave; att.</th><th style="text-align:center">Scorta min.</th><th style="text-align:center">Da ordinare</th>');
    H.push('</tr></thead><tbody>');
    gruppi[forn].forEach(function (item) {
      var da = Math.max(0, item.soglia * 3 - item.qty);
      H.push('<tr>');
      H.push('<td>' + (item.r.desc || '&mdash;') + '</td>');
      H.push('<td style="color:#c00">' + (item.r.codF || '&mdash;') + '</td>');
      H.push('<td>' + (item.r.codM || '') + '</td>');
      H.push('<td style="color:#0a7a7a;font-style:italic">' + (item.m.specs || '') + '</td>');
      H.push('<td style="color:#888">' + (item.m.posizione || '') + '</td>');
      H.push('<td class="qty" style="text-align:center">' + item.qty + '&nbsp;' + (item.m.unit || 'pz') + '</td>');
      H.push('<td style="text-align:center">' + item.soglia + '</td>');
      H.push('<td style="text-align:center;font-weight:bold">' + da + '&nbsp;' + (item.m.unit || 'pz') + '</td>');
      H.push('</tr>');
    });
    H.push('</tbody></table>');
  });

  H.push('<div style="margin-top:16px;font-size:10px;color:#aaa">Generato da Ferramenta Rattazzi &mdash; ' + new Date().toLocaleString('it-IT') + '</div>');
  H.push('</body></html>');

  var w = window.open('', '_blank');
  if (!w) { showToastGen('blue', '\u26A0\uFE0F Abilita i popup nel browser per stampare'); return; }
  w.document.write(H.join(''));
  w.document.close();
  w.focus();
}
