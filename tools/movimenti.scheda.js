// movimenti.scheda.js - estratto da movimenti.js

// ------------------------------------------------------------------
//  FEATURE 6 - Articoli correlati
// ------------------------------------------------------------------
function renderCorrelati(i) {
  var listEl = document.getElementById('ep-correlati-list');
  var selEl  = document.getElementById('ep-correlati-add');
  if (!listEl || !selEl) return;
  var m = magazzino[i] || {};
  var corr = m.correlati || [];
  var html = '';
  corr.forEach(function (ri) {
    if (!rows[ri]) return;
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:#1a1a1a;border-radius:6px;margin-bottom:4px;">';
    html += '<span style="font-size:12px;color:var(--text)">' + esc(rows[ri].desc || '-') + '</span>';
    html += '<span style="font-size:10px;color:#fc8181;margin-left:6px">' + esc(rows[ri].codF || '') + '</span>';
    html += '<button onclick="rimuoviCorrelato(' + i + ',' + ri + ')" style="background:none;border:none;color:#e53e3e;cursor:pointer;font-size:15px;padding:0 4px;margin-left:auto">\u00D7</button>';
    html += '</div>';
  });
  if (!html) html = '<div style="font-size:11px;color:#555;font-style:italic">Nessun articolo correlato</div>';
  listEl.innerHTML = html;

  selEl.innerHTML = '<option value="">+ Aggiungi correlato\u2026</option>';
  rows.forEach(function (r, ri) {
    if (removed.has(String(ri))) return;
    if (ri === i) return;
    if (corr.indexOf(ri) >= 0) return;
    var opt = document.createElement('option');
    opt.value = ri;
    opt.textContent = (r.desc || '-') + (r.codF ? ' [' + r.codF + ']' : '');
    selEl.appendChild(opt);
  });
}

function aggiungiCorrelato(i) {
  var selEl = document.getElementById('ep-correlati-add');
  if (!selEl || !selEl.value) return;
  var ri = parseInt(selEl.value);
  if (!magazzino[i]) magazzino[i] = {};
  if (!magazzino[i].correlati) magazzino[i].correlati = [];
  if (magazzino[i].correlati.indexOf(ri) < 0) {
    magazzino[i].correlati.push(ri);
    if (!magazzino[ri]) magazzino[ri] = {};
    if (!magazzino[ri].correlati) magazzino[ri].correlati = [];
    if (magazzino[ri].correlati.indexOf(i) < 0) magazzino[ri].correlati.push(i);
    lsSet(MAGK, magazzino);
  }
  selEl.value = '';
  renderCorrelati(i);
}

function rimuoviCorrelato(i, ri) {
  if (!magazzino[i] || !magazzino[i].correlati) return;
  magazzino[i].correlati = magazzino[i].correlati.filter(function (x) { return x !== ri; });
  if (magazzino[ri] && magazzino[ri].correlati) {
    magazzino[ri].correlati = magazzino[ri].correlati.filter(function (x) { return x !== i; });
  }
  lsSet(MAGK, magazzino);
  renderCorrelati(i);
}

// ------------------------------------------------------------------
//  FEATURE 3 - Prezzi a scaglioni
// ------------------------------------------------------------------
function renderScaglioni(i) {
  var el = document.getElementById('ep-scaglioni-list');
  if (!el) return;
  var m = magazzino[i] || {};
  var sc = m.scaglioni || [];
  var html = '';
  sc.forEach(function (s, si) {
    html += '<div style="display:flex;gap:5px;align-items:center;margin-bottom:5px;flex-wrap:wrap;">';
    html += '<span style="font-size:11px;color:var(--muted)">da</span>';
    html += '<input type="number" min="1" value="' + (s.da || '') + '" '
      + 'onchange="updSc(' + i + ',' + si + ',\'da\',this.value)" '
      + 'style="width:46px;padding:4px;border:1px solid var(--border);border-radius:5px;background:#111;color:var(--text);font-size:12px;text-align:center">';
    html += '<span style="font-size:11px;color:var(--muted)">a</span>';
    html += '<input type="number" min="1" placeholder="\u221E" value="' + (s.a || '') + '" '
      + 'onchange="updSc(' + i + ',' + si + ',\'a\',this.value)" '
      + 'style="width:46px;padding:4px;border:1px solid var(--border);border-radius:5px;background:#111;color:var(--text);font-size:12px;text-align:center">';
    html += '<span style="font-size:11px;color:var(--muted)">pz &rarr; &euro;</span>';
    html += '<input type="text" value="' + esc(s.prezzo || '') + '" '
      + 'onchange="updSc(' + i + ',' + si + ',\'prezzo\',this.value)" '
      + 'style="width:62px;padding:4px;border:1px solid var(--border);border-radius:5px;background:#111;color:var(--accent);font-size:13px;font-weight:700;text-align:right">';
    html += '<button onclick="delSc(' + i + ',' + si + ')" '
      + 'style="background:none;border:none;color:#e53e3e;cursor:pointer;font-size:16px;padding:0 2px">&times;</button>';
    html += '</div>';
  });
  el.innerHTML = html || '<div style="font-size:10px;color:#555;font-style:italic">Nessuno scaglione - cliccate + per aggiungerne uno</div>';
}

function addSc(i) {
  if (!magazzino[i]) magazzino[i] = {};
  if (!magazzino[i].scaglioni) magazzino[i].scaglioni = [];
  var sc = magazzino[i].scaglioni;
  var prevA = sc.length ? (sc[sc.length - 1].a || null) : null;
  sc.push({ da: prevA ? prevA + 1 : 1, a: null, prezzo: '' });
  lsSet(MAGK, magazzino);
  renderScaglioni(i);
}

function delSc(i, si) {
  if (!magazzino[i] || !magazzino[i].scaglioni) return;
  magazzino[i].scaglioni.splice(si, 1);
  lsSet(MAGK, magazzino);
  renderScaglioni(i);
}

function updSc(i, si, field, val) {
  if (!magazzino[i] || !magazzino[i].scaglioni) return;
  if (field === 'da' || field === 'a') {
    magazzino[i].scaglioni[si][field] = val === '' ? null : parseInt(val);
  } else {
    magazzino[i].scaglioni[si][field] = val;
  }
  lsSet(MAGK, magazzino);
}

function getPrezzoScaglione(i, qty) {
  var m = magazzino[i] || {};
  var sc = m.scaglioni || [];
  var q = parseFloat(qty) || 1;
  for (var si = 0; si < sc.length; si++) {
    var s = sc[si];
    if ((s.da === null || q >= s.da) && (s.a === null || q <= s.a) && s.prezzo) {
      return s.prezzo;
    }
  }
  return null;
}

// aggiungiScaglione / rimuoviScaglione / updateScaglione rimossi:
// usare addSc() / delSc() / updSc() definiti nella sezione FEATURE 3 sopra


// applicaScaglione(cartId,idx) rimossa - chiamava renderCartItems() non esistente
