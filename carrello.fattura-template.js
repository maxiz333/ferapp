// ══ FATTURA · ANTEPRIMA TEMPLATE DDT + RICERCA CLIENTI FIREBASE ══════════════
// Sostituisce il modulo dati fattura precedente con un'anteprima a schermo
// intero del template `ddt_rattazzi_finale.html`, una barra di ricerca
// agganciata al nodo Firebase `clienti` e auto-compilazione dei campi.
// La logica di calcolo dei prezzi netti dal carrello è preservata.

(function(){
  var FB_PATH = 'clienti';
  var FB_CONTATORE = 'contatore_fatture';
  var FB_FATTURE = 'fatture_emesse';

  // Esempi di seed: vengono pubblicati su Firebase la prima volta che il nodo
  // `clienti` è vuoto. Ogni record viene salvato con chiave = IdAnagrafica.
  var SAMPLE_CLIENTI = [
    { VecchioCodice: 'ASD SCI NAUTICO',     Indirizzo: 'VIA ZANOIA 4',         c5: 'OMEGNA',             Provincia: 'VB', IdAnagrafica: '13546' },
    { VecchioCodice: '.AGRIALL',            Indirizzo: 'VIA 25 APRILE 1',      c5: 'BRIONA',             Provincia: 'NO', IdAnagrafica: '13150' },
    { VecchioCodice: '.ALBERA GIOVANNI',    Indirizzo: 'CASCINA RAMELLA 1',    c5: 'MOMO',               Provincia: 'NO', IdAnagrafica: '2009'  },
    { VecchioCodice: '.ALLESINA LUIGIA',    Indirizzo: 'VIA GARODINO 1',       c5: 'PRATO SESIA',        Provincia: 'NO', IdAnagrafica: '2013'  },
    { VecchioCodice: '.AN FED SRL',         Indirizzo: 'CORSO DELLA VITTORIA 7',c5: 'NOVARA',             Provincia: 'NO', IdAnagrafica: '3609'  },
    { VecchioCodice: '',                    Indirizzo: 'VIA 11 FEBBRAIO 56',   c5: 'SAN PIETRO MOSEZZO', Provincia: 'NO', IdAnagrafica: '12969' },
    { VecchioCodice: '.ANTONINO NICASTRO ', Indirizzo: 'VIA SAN NICOLA 14',    c5: 'GELA',               Provincia: 'CL', IdAnagrafica: '12033' },
    { VecchioCodice: '.ARLONE MARCO',       Indirizzo: 'VIA RONCHETTI 6/BIS',  c5: 'VILLATA',            Provincia: 'VC', IdAnagrafica: '6017'  },
    { VecchioCodice: '.ASSOC.IRRIG.OVE',    Indirizzo: 'VIA DUOMO 2',          c5: 'VERCELLI',           Provincia: 'VC', IdAnagrafica: '3293'  },
    { VecchioCodice: 'AZ.AGR.APOSTOLO',     Indirizzo: 'VIA ZOPPIS 17',        c5: 'SIZZANO',            Provincia: 'NO', IdAnagrafica: '4473'  }
  ];

  // ── Stato locale ────────────────────────────────────────────────────────
  var _clientiCache = {};
  var _clientiLoaded = false;
  var _seedTried = false;
  var _activeCartId = null;
  var _selectedCli = null;
  var _fbInitTimer = null;
  var _contatoreFatture = 0;
  var _contatoreLoaded = false;

  // ── Firebase: aggancio al nodo `clienti` + seed iniziale se vuoto ───────
  function _initFirebaseClienti(){
    if(typeof firebase === 'undefined'){
      _fbInitTimer = setTimeout(_initFirebaseClienti, 800);
      return;
    }
    var ready = (typeof window._fbReady !== 'undefined') ? window._fbReady : (typeof _fbReady !== 'undefined' ? _fbReady : false);
    var db = (typeof window._fbDb !== 'undefined' && window._fbDb) ? window._fbDb : (typeof _fbDb !== 'undefined' ? _fbDb : null);
    if(!ready || !db){
      _fbInitTimer = setTimeout(_initFirebaseClienti, 600);
      return;
    }
    try{
      var ref = db.ref(FB_PATH);
      ref.on('value', function(snap){
        var d = snap.val();
        if(d && typeof d === 'object'){
          _clientiCache = d;
          _clientiLoaded = true;
        } else {
          _clientiCache = {};
          _clientiLoaded = true;
          if(!_seedTried){
            _seedTried = true;
            _seedSample(ref);
          }
        }
        // Aggiorna i risultati se il pannello è aperto
        var box = document.getElementById('fat-tpl-results');
        var sb = document.getElementById('fat-tpl-search');
        if(box && sb && box.style.display !== 'none'){
          _renderResults(sb.value);
        }
      });

      // Aggancio al contatore fatture (incrementato solo al salvataggio fattura).
      // Il valore è memorizzato come STRINGA (es. "57" o "2024/001") per preservare
      // eventuali prefissi anno/serie usati dall'utente.
      var refCnt = db.ref(FB_CONTATORE);
      refCnt.on('value', function(snap){
        var v = snap.val();
        _contatoreFatture = (v == null) ? '' : String(v);
        _contatoreLoaded = true;
        // Se l'overlay è aperto e il numero non è ancora stato modificato, aggiorna pre-fill.
        var doc = _frameDoc();
        if(doc){
          var numEl = doc.querySelector('.doc-title-num');
          if(numEl && numEl.dataset && numEl.dataset.fatPrefilled === '1' && !numEl.dataset.fatTouched){
            numEl.textContent = _nextFatturaNum();
          }
        }
      });
    }catch(e){
      console.warn('Fattura template · init Firebase clienti fallito:', e);
    }
  }

  // Restituisce il prossimo numero fattura in base all'ultimo salvato.
  // Mantiene il formato (prefisso, padding) incrementando l'ultimo gruppo numerico.
  // Es: "" → "1"   "57" → "58"   "2024/001" → "2024/002"   "F-099" → "F-100"
  function _nextFatturaNum(){
    var last = String(_contatoreFatture || '').trim();
    if(!last) return '1';
    var m = last.match(/(\d+)(?!.*\d)/);
    if(!m) return last + '-1';
    var num = m[1];
    var pad = num.length;
    var inc = (parseInt(num, 10) + 1).toString();
    if(inc.length < pad) inc = new Array(pad - inc.length + 1).join('0') + inc;
    return last.replace(/(\d+)(?!.*\d)/, inc);
  }

  // Salva su Firebase ESATTAMENTE la stringa che l'utente ha digitato, così il
  // prossimo pre-fill prosegue dalla stessa serie (gestione bolle cartacee esterne).
  function _setContatoreFromString(s){
    if(typeof firebase === 'undefined') return;
    var db = (typeof window._fbDb !== 'undefined' && window._fbDb) ? window._fbDb : (typeof _fbDb !== 'undefined' ? _fbDb : null);
    if(!db) return;
    var v = String(s == null ? '' : s).trim();
    if(!v) return;
    _contatoreFatture = v;
    try{ db.ref(FB_CONTATORE).set(v); }catch(e){ console.warn('contatore_fatture set err', e); }
  }

  function _seedSample(ref){
    try{
      var seed = {};
      SAMPLE_CLIENTI.forEach(function(c){
        var key = String(c.IdAnagrafica || ('cli_' + Date.now() + '_' + Math.floor(Math.random()*1000)));
        seed[key] = c;
      });
      ref.set(seed);
      console.log('Fattura template · nodo clienti seedato con ' + Object.keys(seed).length + ' record di esempio');
    }catch(e){
      console.warn('Fattura template · seed clienti fallito:', e);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  function _esc(s){
    if(s == null) return '';
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function _fmtImp(n){
    if(!isFinite(n)) n = 0;
    return n.toFixed(2).replace('.', ',');
  }

  function _searchClienti(q, limit){
    var s = String(q || '').trim().toLowerCase();
    var out = [];
    var keys = Object.keys(_clientiCache || {});
    for(var i = 0; i < keys.length; i++){
      var c = _clientiCache[keys[i]];
      if(!c || typeof c !== 'object') continue;
      if(!s){ out.push(c); continue; }
      var hay = ((c.VecchioCodice || '') + ' ' +
                 (c.Indirizzo || '') + ' ' +
                 (c.c5 || '') + ' ' +
                 (c.Provincia || '') + ' ' +
                 (c.IdAnagrafica || '')).toLowerCase();
      if(hay.indexOf(s) >= 0) out.push(c);
    }
    out.sort(function(a, b){
      var av = String(a.VecchioCodice || '\uFFFF').toLowerCase();
      var bv = String(b.VecchioCodice || '\uFFFF').toLowerCase();
      return av.localeCompare(bv);
    });
    return out.slice(0, limit || 50);
  }

  function _frameDoc(){
    var f = document.getElementById('fat-tpl-frame');
    if(!f) return null;
    try{
      return f.contentDocument || (f.contentWindow && f.contentWindow.document) || null;
    }catch(e){ return null; }
  }

  // ── Popolamento template ────────────────────────────────────────────────

  // Garantisce che ogni .dest-subcell abbia una .dest-subcell-line interna
  // (il template aggiornato la include già: questo è solo un fallback per
  // eventuali template più vecchi).
  function _ensureSubcellLines(doc){
    var subs = doc.querySelectorAll('.dest-subcell');
    for(var i = 0; i < subs.length; i++){
      var sc = subs[i];
      var line = sc.querySelector('.dest-subcell-line');
      if(!line){
        line = doc.createElement('span');
        line.className = 'dest-subcell-line';
        line.setAttribute('contenteditable', 'true');
        line.style.cssText = 'display:block;border-bottom:1px solid #0d2060;min-height:11px;margin-right:4px;font-size:8px;color:#0d2060;padding:0 1px;outline:none;';
        sc.insertBefore(line, sc.firstChild);
      } else if(!line.hasAttribute('contenteditable')){
        line.setAttribute('contenteditable', 'true');
      }
    }
  }

  // Rete di sicurezza: marca tutto come contenteditable anche se il template
  // non ne avesse una versione recente.
  function _setEditableEverywhere(doc){
    var sels = [
      '.dest-field-line',
      '.dest-subcell-line',
      '.doc-title-num',
      '.doc-title-date',
      '.footer-annotazioni',
      '.footer-firme-cell',
      '.footer-firma-vettore',
      '.footer-vettore-line',
      '.colli-line',
      '.cedente-label-right',
      '.footer-copia',
      '.fld-codice-cliente',
      '.fld-vettore',
      '.fld-data-trasporto',
      '.fld-ora-trasporto',
      '.fld-colli',
      '.fld-kg'
    ];
    sels.forEach(function(s){
      var els = doc.querySelectorAll(s);
      for(var i = 0; i < els.length; i++){
        els[i].setAttribute('contenteditable', 'true');
        if(!els[i].style.outline) els[i].style.outline = 'none';
      }
    });
  }

  // Calcola le righe da carrello con prezzo IMPONIBILE (netto) — IVA 22%.
  function _buildRigheNetto(cart){
    var IVA = 22;
    var ivaFactor = 1 + IVA/100;
    var righe = [];
    (cart && cart.items || []).forEach(function(it){
      var puLordo = (typeof parsePriceIT === 'function') ? parsePriceIT(it.prezzoUnit) : parseFloat(it.prezzoUnit || 0);
      if(!isFinite(puLordo)) puLordo = 0;
      var qty = parseFloat(it.qty || 1);
      if(!isFinite(qty)) qty = 0;
      var puNetto = ivaFactor ? puLordo / ivaFactor : 0;
      var subNetto = puNetto * qty;
      var codice = it.codM || it.codF || '';
      var unit = it.unit || 'pz';
      var desc = (it.desc || '') + (it.specs ? ' (' + it.specs + ')' : '');
      righe.push({
        codice: codice,
        desc: desc,
        um: unit,
        qty: qty,
        prezzoImp: _fmtImp(puNetto),
        totaleImp: _fmtImp(subNetto),
        prezzoVend: _fmtImp(puLordo)
      });
    });
    return righe;
  }

  function _populateRighe(doc, cart){
    var tbody = doc.querySelector('.art-table tbody');
    if(!tbody) return;
    var righe = _buildRigheNetto(cart);
    var ce = ' contenteditable="true"';
    var html = '';
    for(var i = 0; i < righe.length; i++){
      var r = righe[i];
      html += '<tr>'
        + '<td class="c-cod"' + ce + '>' + _esc(r.codice) + '</td>'
        + '<td class="c-desc"' + ce + '>' + _esc(r.desc) + '</td>'
        + '<td class="c-um"' + ce + '>' + _esc(r.um) + '</td>'
        + '<td class="c-qta"' + ce + '>' + _esc(String(r.qty)) + '</td>'
        + '<td class="c-prz"' + ce + '>' + _esc(r.prezzoImp) + '</td>'
        + '<td class="c-tot"' + ce + '>' + _esc(r.totaleImp) + '</td>'
        + '<td class="c-extra"' + ce + '>' + _esc(r.prezzoVend) + '</td>'
        + '</tr>';
    }
    var emptyRow = '<tr>'
      + '<td class="c-cod"' + ce + '></td>'
      + '<td class="c-desc"' + ce + '></td>'
      + '<td class="c-um"' + ce + '></td>'
      + '<td class="c-qta"' + ce + '></td>'
      + '<td class="c-prz"' + ce + '></td>'
      + '<td class="c-tot"' + ce + '></td>'
      + '<td class="c-extra"' + ce + '></td>'
      + '</tr>';
    for(var j = righe.length; j < 25; j++) html += emptyRow;
    tbody.innerHTML = html;
  }

  function _setDataNumero(doc, cart){
    var oggi = new Date();
    var dataStr = String(oggi.getDate()).padStart(2,'0') + '/' +
                  String(oggi.getMonth()+1).padStart(2,'0') + '/' +
                  oggi.getFullYear();
    var dateEl = doc.querySelector('.doc-title-date');
    if(dateEl && !(dateEl.textContent || '').trim()) dateEl.textContent = dataStr;

    // Numero documento: pre-compila col PROSSIMO numero fattura (mantiene editabile).
    // Se il carrello aveva già un numero salvato, usa quello.
    var numEl = doc.querySelector('.doc-title-num');
    if(numEl){
      var preset = (cart && cart.numeroFattura) ? String(cart.numeroFattura) : String(_nextFatturaNum());
      numEl.textContent = preset;
      try{
        numEl.dataset.fatPrefilled = '1';
        delete numEl.dataset.fatTouched;
        numEl.addEventListener('input', function(){ this.dataset.fatTouched = '1'; }, { once: true });
      }catch(e){}
    }
  }

  // Estrae il numero civico finale (es. "VIA ZANOIA 4" → via="VIA ZANOIA", civico="4";
  // "VIA RONCHETTI 6/BIS" → via="VIA RONCHETTI", civico="6/BIS").
  function _parseIndirizzo(s){
    s = String(s || '').trim();
    if(!s) return { via: '', civico: '' };
    var m = s.match(/^(.*?)\s+(\d[\w\/\.\-]*)\s*$/);
    if(m) return { via: m[1].trim(), civico: m[2].trim() };
    return { via: s, civico: '' };
  }

  function _parseComune(s){
    s = String(s || '').trim();
    var m = s.match(/^(.+?)\s*\(([A-Za-z]{1,3})\)\s*$/);
    if(m) return { citta: m[1].trim(), provincia: m[2].trim().toUpperCase() };
    return { citta: s, provincia: '' };
  }

  // Mappa cliente -> campi del template (Ditta / Comune+Provincia / Via / civico /
  // Codice cliente).
  // Scrive i dati DENTRO le .dest-subcell-line (sopra le etichette Comune/Via/n.),
  // nella .dest-field-line di Ditta e nella linea "Codice cliente" del footer.
  function _applyClienteToTemplate(doc, cli){
    if(!doc || !cli) return;
    _ensureSubcellLines(doc);

    var fields = doc.querySelectorAll('.hdr-dest .dest-field');
    // Ordine .dest-field nel nuovo template: 0=SPETTLe, 1=Ditta, 2=Pagamento.
    // Ditta è la 2ª .dest-field con .dest-field-line.
    var dittaLine = null;
    for(var k = 0; k < fields.length; k++){
      var line = fields[k].querySelector('.dest-field-line');
      if(line){ dittaLine = line; break; } // prima dest-field-line valida = Ditta
    }
    if(dittaLine) dittaLine.textContent = cli.VecchioCodice || '';

    // Subrow Residenza = primo .dest-field-row > .dest-subrow del template.
    var rows = doc.querySelectorAll('.hdr-dest .dest-field-row');
    var resRow = rows[0] || null;
    if(resRow){
      var subs = resRow.querySelectorAll('.dest-subcell');
      var comuneLine = subs[0] ? subs[0].querySelector('.dest-subcell-line') : null;
      var viaLine    = subs[1] ? subs[1].querySelector('.dest-subcell-line') : null;
      var numLine    = subs[2] ? subs[2].querySelector('.dest-subcell-line') : null;
      var prov = (cli.Provincia || '').trim();
      var citta = (cli.c5 || '').trim();
      var comStr = citta + (prov ? ' (' + prov + ')' : '');
      var parsedInd = _parseIndirizzo(cli.Indirizzo || '');
      if(comuneLine) comuneLine.textContent = comStr;
      if(viaLine) viaLine.textContent = parsedInd.via;
      if(numLine) numLine.textContent = parsedInd.civico;
    }

    // Codice cliente (footer DDT) ← IdAnagrafica.
    var codCli = doc.querySelector('.fld-codice-cliente');
    if(codCli) codCli.textContent = String(cli.IdAnagrafica || '');
  }

  // Legge i campi modificati dal template per salvarli.
  function _readClienteFromTemplate(doc){
    var fields = doc.querySelectorAll('.hdr-dest .dest-field');
    var dittaLine = null;
    for(var k = 0; k < fields.length; k++){
      var line = fields[k].querySelector('.dest-field-line');
      if(line){ dittaLine = line; break; }
    }
    var ditta = dittaLine ? (dittaLine.textContent || '').trim() : '';

    var rows = doc.querySelectorAll('.hdr-dest .dest-field-row');
    var resRow = rows[0] || null;
    var destRow = rows[1] || null;
    function readSub(row){
      var out = { comune: '', via: '', civico: '' };
      if(!row) return out;
      var subs = row.querySelectorAll('.dest-subcell');
      var l0 = subs[0] && subs[0].querySelector('.dest-subcell-line');
      var l1 = subs[1] && subs[1].querySelector('.dest-subcell-line');
      var l2 = subs[2] && subs[2].querySelector('.dest-subcell-line');
      if(l0) out.comune = (l0.textContent || '').trim();
      if(l1) out.via = (l1.textContent || '').trim();
      if(l2) out.civico = (l2.textContent || '').trim();
      return out;
    }
    var resData = readSub(resRow);
    var destData = readSub(destRow);
    var parsed = _parseComune(resData.comune);
    return {
      ragioneSociale: ditta,
      indirizzo: (resData.via + (resData.civico ? ' ' + resData.civico : '')).trim(),
      citta: parsed.citta,
      provincia: parsed.provincia,
      comuneRaw: resData.comune,
      residenza: resData,
      destinazione: destData
    };
  }

  // Restituisce uno snapshot di TUTTI i campi editabili del template visibile.
  // Si usa al salvataggio per archiviare ESATTAMENTE quello che è a schermo.
  function _readFullTemplateSnapshot(doc){
    if(!doc) return null;
    function txt(sel){
      var el = doc.querySelector(sel);
      return el ? (el.textContent || '').trim() : '';
    }
    var rows = doc.querySelectorAll('.hdr-dest .dest-field-row');
    function readSub(row){
      var out = { comune: '', via: '', civico: '' };
      if(!row) return out;
      var subs = row.querySelectorAll('.dest-subcell');
      var l0 = subs[0] && subs[0].querySelector('.dest-subcell-line');
      var l1 = subs[1] && subs[1].querySelector('.dest-subcell-line');
      var l2 = subs[2] && subs[2].querySelector('.dest-subcell-line');
      if(l0) out.comune = (l0.textContent || '').trim();
      if(l1) out.via = (l1.textContent || '').trim();
      if(l2) out.civico = (l2.textContent || '').trim();
      return out;
    }
    var fields = doc.querySelectorAll('.hdr-dest .dest-field');
    var dittaLine = null, pagLine = null;
    for(var k = 0; k < fields.length; k++){
      var line = fields[k].querySelector('.dest-field-line');
      if(!line) continue;
      if(!dittaLine) dittaLine = line;
      else { pagLine = line; break; }
    }
    var righe = [];
    var trs = doc.querySelectorAll('.art-table tbody tr');
    for(var i = 0; i < trs.length; i++){
      var tds = trs[i].querySelectorAll('td');
      var any = false;
      var row = { codice: '', desc: '', um: '', qty: '', prezzoImp: '', totaleImp: '', prezzoVend: '' };
      if(tds[0]) row.codice = (tds[0].textContent || '').trim();
      if(tds[1]) row.desc = (tds[1].textContent || '').trim();
      if(tds[2]) row.um = (tds[2].textContent || '').trim();
      if(tds[3]) row.qty = (tds[3].textContent || '').trim();
      if(tds[4]) row.prezzoImp = (tds[4].textContent || '').trim();
      if(tds[5]) row.totaleImp = (tds[5].textContent || '').trim();
      if(tds[6]) row.prezzoVend = (tds[6].textContent || '').trim();
      Object.keys(row).forEach(function(kk){ if(row[kk]) any = true; });
      if(any) righe.push(row);
    }
    return {
      numero: txt('.doc-title-num'),
      dataDoc: txt('.doc-title-date'),
      ditta: dittaLine ? (dittaLine.textContent || '').trim() : '',
      residenza: readSub(rows[0]),
      destinazione: readSub(rows[1]),
      pagamento: pagLine ? (pagLine.textContent || '').trim() : '',
      trasportoData: txt('.fld-data-trasporto'),
      trasportoOra: txt('.fld-ora-trasporto'),
      codiceCliente: txt('.fld-codice-cliente'),
      vettore: txt('.fld-vettore'),
      colli: txt('.fld-colli'),
      kg: txt('.fld-kg'),
      firmaVettore: txt('.footer-firma-vettore'),
      firme: (function(){
        var els = doc.querySelectorAll('.footer-firme-cell');
        return [els[0] ? (els[0].textContent||'').trim() : '', els[1] ? (els[1].textContent||'').trim() : ''];
      })(),
      annotazioni: txt('.footer-annotazioni'),
      copia: txt('.footer-copia'),
      righe: righe
    };
  }

  // ── Risultati ricerca ───────────────────────────────────────────────────
  function _renderResults(q){
    var box = document.getElementById('fat-tpl-results');
    if(!box) return;
    if(!_clientiLoaded){
      box.innerHTML = '<div class="fat-tpl-empty">Caricamento clienti da Firebase…</div>';
      return;
    }
    var list = _searchClienti(q, 25);
    if(!list.length){
      box.innerHTML = '<div class="fat-tpl-empty">Nessun cliente trovato</div>';
      return;
    }
    var h = '';
    list.forEach(function(c){
      var id = String(c.IdAnagrafica == null ? '' : c.IdAnagrafica);
      h += '<button type="button" class="fat-tpl-item" data-id="' + _esc(id) + '">'
        +    '<div class="fat-tpl-item-name">' + _esc(c.VecchioCodice || '(senza codice)') + '</div>'
        +    '<div class="fat-tpl-item-sub">' + _esc(c.Indirizzo || '—') + ' · '
        +      _esc(c.c5 || '') + (c.Provincia ? ' (' + _esc(c.Provincia) + ')' : '')
        +    '</div>'
        +  '</button>';
    });
    box.innerHTML = h;
    var btns = box.querySelectorAll('.fat-tpl-item');
    for(var i = 0; i < btns.length; i++){
      btns[i].onclick = function(){
        var id = this.getAttribute('data-id');
        var cli = _findClienteById(id);
        if(!cli) return;
        var doc = _frameDoc();
        if(doc) _applyClienteToTemplate(doc, cli);
        _selectedCli = cli;
        var sb = document.getElementById('fat-tpl-search');
        if(sb) sb.value = cli.VecchioCodice || cli.c5 || '';
        box.style.display = 'none';
      };
    }
  }

  function _findClienteById(id){
    if(!id) return null;
    if(_clientiCache && _clientiCache[id]) return _clientiCache[id];
    var keys = Object.keys(_clientiCache || {});
    for(var i = 0; i < keys.length; i++){
      var c = _clientiCache[keys[i]];
      if(c && String(c.IdAnagrafica || '') === String(id)) return c;
    }
    return null;
  }

  // ── Stili overlay ───────────────────────────────────────────────────────
  function _injectStyles(){
    if(document.getElementById('fat-tpl-styles')) return;
    var s = document.createElement('style');
    s.id = 'fat-tpl-styles';
    s.textContent = ''
      + '#fat-tpl-overlay{position:fixed;inset:0;z-index:10010;background:#888;display:none;flex-direction:column;}'
      + '#fat-tpl-bar{position:sticky;top:0;z-index:5;background:#181818;border-bottom:1px solid #2a2a2a;padding:8px 10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;}'
      + '#fat-tpl-search-wrap{flex:1;min-width:240px;position:relative;}'
      + '#fat-tpl-search{width:100%;padding:9px 12px;border-radius:8px;border:1px solid #333;background:#0f0f0f;color:#f0f0f0;font-size:13px;box-sizing:border-box;font-family:inherit;outline:none;}'
      + '#fat-tpl-search:focus{border-color:var(--accent,#f5c400);}'
      + '#fat-tpl-results{position:absolute;left:0;right:0;top:calc(100% + 4px);background:#111;border:1px solid #333;border-radius:8px;max-height:340px;overflow:auto;display:none;z-index:6;box-shadow:0 8px 24px rgba(0,0,0,.45);}'
      + '.fat-tpl-item{display:block;width:100%;text-align:left;border:none;border-bottom:1px solid #1f1f1f;background:transparent;color:#ddd;padding:8px 10px;cursor:pointer;font-family:inherit;}'
      + '.fat-tpl-item:hover{background:#1a1a1a;}'
      + '.fat-tpl-item:last-child{border-bottom:none;}'
      + '.fat-tpl-item-name{font-size:13px;font-weight:700;color:var(--accent,#f5c400);}'
      + '.fat-tpl-item-sub{font-size:11px;color:#888;margin-top:2px;}'
      + '.fat-tpl-empty{padding:10px;color:#888;font-size:12px;text-align:center;}'
      + '#fat-tpl-bar button{padding:9px 14px;border-radius:8px;border:1px solid #333;background:#1c1c1c;color:#ddd;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;}'
      + '#fat-tpl-bar button:hover{background:#262626;}'
      + '#fat-tpl-bar button.primary{background:var(--accent,#f5c400);color:#111;border-color:var(--accent,#f5c400);font-weight:900;}'
      + '#fat-tpl-bar button.primary:hover{filter:brightness(.95);}'
      + '#fat-tpl-bar button.danger{color:#e57373;border-color:#553030;}'
      + '#fat-tpl-frame-wrap{flex:1;overflow:auto;background:#888;padding:14px 0;}'
      + '#fat-tpl-frame{display:block;width:215mm;max-width:98vw;height:307mm;margin:0 auto;border:0;background:#fff;box-shadow:0 6px 22px rgba(0,0,0,.5);}'
      + '@media (max-width:520px){#fat-tpl-frame{height:540px;}}';
    document.head.appendChild(s);
  }

  // ── Apertura/chiusura ───────────────────────────────────────────────────
  function _openOverlay(cartId){
    _activeCartId = cartId;
    _injectStyles();

    var ov = document.getElementById('fat-tpl-overlay');
    if(!ov){
      ov = document.createElement('div');
      ov.id = 'fat-tpl-overlay';
      document.body.appendChild(ov);
    }
    ov.innerHTML = ''
      + '<div id="fat-tpl-bar">'
      +   '<div id="fat-tpl-search-wrap">'
      +     '<input id="fat-tpl-search" placeholder="🔎 Cerca cliente (ragione, indirizzo, comune, codice)..." autocomplete="off">'
      +     '<div id="fat-tpl-results"></div>'
      +   '</div>'
      +   '<button id="fat-tpl-save" class="primary">💾 Salva fattura</button>'
      +   '<button id="fat-tpl-clear">📄 Solo scontrino</button>'
      +   '<button id="fat-tpl-print">🖨️ Stampa</button>'
      +   '<button id="fat-tpl-close" class="danger">✕</button>'
      + '</div>'
      + '<div id="fat-tpl-frame-wrap">'
      +   '<iframe id="fat-tpl-frame" src="ddt_rattazzi_finale.html?fat=' + Date.now() + '"></iframe>'
      + '</div>';
    ov.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    var cart = (window.carrelli || []).find(function(c){ return c && c.id === cartId; });
    if(typeof window.ensureFatturaState === 'function') window.ensureFatturaState(cart);
    _selectedCli = null;
    if(cart && cart.fatturaCliente){
      var fc = cart.fatturaCliente;
      _selectedCli = {
        VecchioCodice: fc.ragioneSociale || '',
        Indirizzo:     fc.indirizzo || '',
        c5:            fc.citta || '',
        Provincia:     fc.provincia || '',
        IdAnagrafica:  fc.idAnagrafica || ''
      };
    }

    var sb = document.getElementById('fat-tpl-search');
    var box = document.getElementById('fat-tpl-results');
    if(sb && box){
      sb.addEventListener('focus', function(){ box.style.display = 'block'; _renderResults(sb.value); });
      sb.addEventListener('input', function(){ box.style.display = 'block'; _renderResults(sb.value); });
    }
    document.addEventListener('mousedown', _outsideHandler, true);

    document.getElementById('fat-tpl-close').onclick = _closeOverlay;
    document.getElementById('fat-tpl-clear').onclick = function(){
      if(!cart){ _closeOverlay(); return; }
      cart.fatturaRichiesta = false;
      cart.fatturaCliente = null;
      cart.salvaFatturaInRubrica = false;
      cart.tipo = '';
      delete cart.numeroFattura;
      if(typeof saveCarrelli === 'function') saveCarrelli();
      if(typeof renderCartTabs === 'function') renderCartTabs();
      if(typeof showToastGen === 'function') showToastGen('green', 'Modalità scontrino attiva');
      _closeOverlay();
    };
    document.getElementById('fat-tpl-save').onclick = function(){
      if(!cart){ _closeOverlay(); return; }
      var doc = _frameDoc();
      var read = doc ? _readClienteFromTemplate(doc) : null;
      var snap = doc ? _readFullTemplateSnapshot(doc) : null;
      var sel = _selectedCli || {};
      var ragSoc = (read && read.ragioneSociale) || sel.VecchioCodice || '';
      if(!ragSoc.trim()){
        if(typeof showToastGen === 'function') showToastGen('red', 'Inserisci la Ditta o seleziona un cliente');
        return;
      }
      var numFatt = (snap && snap.numero) ? String(snap.numero).trim() : String(_nextFatturaNum());
      // Aggiorna contatore Firebase con il numero effettivamente usato.
      _setContatoreFromString(numFatt);

      // IdAnagrafica: preferiamo ciò che è VISIBILE a schermo (snap.codiceCliente)
      // così, se l'utente ha sovrascritto il codice manualmente, il dato salvato
      // su Firebase è esattamente quello mostrato. Fallback al cliente selezionato.
      var idAnagSnap = (snap && snap.codiceCliente) ? String(snap.codiceCliente).trim() : '';
      var idAnagFinal = idAnagSnap || sel.IdAnagrafica || '';
      cart.fatturaRichiesta = true;
      cart.tipo = 'fattura';
      cart.numeroFattura = numFatt;
      cart.fatturaCliente = {
        ragioneSociale: ragSoc,
        pivaCf: '',
        indirizzo: (read && read.indirizzo) || sel.Indirizzo || '',
        citta: (read && read.citta) || sel.c5 || '',
        cap: '',
        provincia: (read && read.provincia) || sel.Provincia || '',
        sdiPec: '',
        telefono: '',
        idAnagrafica: idAnagFinal
      };

      // Archivia la fattura completa su Firebase /fatture_emesse.
      _archiveFatturaEmessa(cart, numFatt, sel, snap);

      if(typeof saveCarrelli === 'function') saveCarrelli();
      if(typeof renderCartTabs === 'function') renderCartTabs();
      if(typeof showToastGen === 'function') showToastGen('green', 'Fattura N. ' + numFatt + ' salvata');
      _closeOverlay();
    };
    document.getElementById('fat-tpl-print').onclick = function(){
      var doc = _frameDoc();
      if(!doc || !doc.documentElement){
        if(typeof showToastGen === 'function') showToastGen('orange', 'Template non pronto');
        return;
      }
      var w = window.open('', '_blank');
      if(!w){
        if(typeof showToastGen === 'function') showToastGen('orange', 'Popup bloccato: abilita popup per la stampa');
        return;
      }
      w.document.open();
      w.document.write('<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>DDT</title></head><body style="margin:0;background:#fff;">'
        + doc.documentElement.outerHTML
        + '</body></html>');
      w.document.close();
      w.focus();
      setTimeout(function(){ try{ w.print(); }catch(e){} }, 220);
    };

    var frame = document.getElementById('fat-tpl-frame');
    if(frame){
      frame.onload = function(){
        try{
          var doc = _frameDoc();
          if(!doc) return;
          _setDataNumero(doc, cart);
          _populateRighe(doc, cart || {});
          _ensureSubcellLines(doc);
          _setEditableEverywhere(doc);
          if(_selectedCli) _applyClienteToTemplate(doc, _selectedCli);
        }catch(e){
          console.warn('Fattura template · onload error:', e);
        }
      };
    }
  }

  // ── Archiviazione fattura emessa su Firebase ────────────────────────────
  function _archiveFatturaEmessa(cart, numero, sel, snapTpl){
    if(typeof firebase === 'undefined') return;
    var db = (typeof window._fbDb !== 'undefined' && window._fbDb) ? window._fbDb : (typeof _fbDb !== 'undefined' ? _fbDb : null);
    if(!db) return;
    try{
      var nowIso = new Date().toISOString();
      var idKey = 'fat_' + Date.now() + '_' + Math.floor(Math.random()*100000);
      var prodotti = JSON.parse(JSON.stringify(cart.items || []));
      var clienteFb = sel ? {
        IdAnagrafica: sel.IdAnagrafica || '',
        VecchioCodice: sel.VecchioCodice || '',
        Indirizzo: sel.Indirizzo || '',
        c5: sel.c5 || '',
        Provincia: sel.Provincia || ''
      } : null;
      var fatturaCli = cart.fatturaCliente ? JSON.parse(JSON.stringify(cart.fatturaCliente)) : null;
      // Estraiamo IdAnagrafica e numero bolla "manuale" come campi top-level
      // sul record `fatture_emesse` per consentire query veloci e ristampa.
      var idAnagrafica = (fatturaCli && fatturaCli.idAnagrafica) || (clienteFb && clienteFb.IdAnagrafica) || (snapTpl && snapTpl.codiceCliente) || '';
      var rec = {
        id: idKey,
        numero: String(numero),
        numeroFattura: String(numero),
        idAnagrafica: String(idAnagrafica || ''),
        createdAt: nowIso,
        cartId: cart.id || '',
        ordId: cart.ordId || '',
        nomeCarrello: cart.nome || '',
        clienteFirebase: clienteFb,
        fatturaCliente: fatturaCli,
        prodotti: prodotti,
        totale: (cart.items||[]).reduce(function(s,it){
          var pu = (typeof parsePriceIT === 'function') ? parsePriceIT(it.prezzoUnit) : parseFloat(it.prezzoUnit||0);
          var q = parseFloat(it.qty || 0);
          return s + (isFinite(pu*q) ? pu*q : 0);
        }, 0).toFixed(2),
        scontoGlobale: cart.scontoGlobale || null,
        nota: cart.nota || '',
        templateSnapshot: snapTpl || null,
        tipo: 'fattura'
      };
      db.ref(FB_FATTURE + '/' + idKey).set(rec);
    }catch(e){
      console.warn('Fattura template · archive fatture_emesse fallito:', e);
    }
  }

  function _outsideHandler(ev){
    var box = document.getElementById('fat-tpl-results');
    var sb = document.getElementById('fat-tpl-search');
    if(!box || !sb) return;
    if(ev.target === sb) return;
    if(box.contains(ev.target)) return;
    box.style.display = 'none';
  }

  function _closeOverlay(){
    var ov = document.getElementById('fat-tpl-overlay');
    if(ov) ov.style.display = 'none';
    document.body.style.overflow = '';
    document.removeEventListener('mousedown', _outsideHandler, true);
    _selectedCli = null;
    _activeCartId = null;
  }

  // ── Override + bootstrap ────────────────────────────────────────────────
  window.ctOpenFatturaClienteModal = function(cartId){ _openOverlay(cartId); };
  window.fatTemplateOpen = _openOverlay;
  window.fatTemplateGetClienti = function(){ return _clientiCache; };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', _initFirebaseClienti);
  } else {
    _initFirebaseClienti();
  }
})();
