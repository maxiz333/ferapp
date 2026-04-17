// anagrafica.clienti.js
// Gestione anagrafica clienti + collegamento opzionale fattura al carrello/ordini.
(function(){
  var AK = window.AppKeys || {};
  var ANAGK = AK.ANAGRAFICA_CLIENTI || 'cp4_anagrafica_clienti';
  var anagraficaClienti = lsGet(ANAGK, []);

  function saveAnagraficaClienti(){
    lsSet(ANAGK, anagraficaClienti);
  }

  function _norm(v){
    return String(v == null ? '' : v).trim();
  }

  function _normLower(v){
    return _norm(v).toLowerCase();
  }

  function _normalizeTaxCode(v){
    return _norm(v).replace(/\s+/g, '').toUpperCase();
  }

  function _normalizeCap(v){
    return _norm(v).replace(/[^\d]/g, '').slice(0, 5);
  }

  function _normalizePhone(v){
    return _norm(v).replace(/[^\d+]/g, '');
  }

  function _pick(src, keys){
    if(!src) return '';
    for(var i = 0; i < keys.length; i++){
      var k = keys[i];
      if(src[k] != null && _norm(src[k]) !== '') return src[k];
    }
    return '';
  }

  function normalizeClienteFiscale(raw){
    raw = raw || {};
    return {
      id: _norm(raw.id) || ('cli_' + Date.now() + '_' + Math.floor(Math.random() * 100000)),
      ragioneSociale: _norm(raw.ragioneSociale || raw.nome || raw.nomeCliente || ''),
      pivaCf: _normalizeTaxCode(raw.pivaCf || raw.piva || raw.partitaIva || raw.codiceFiscale || raw.cf || ''),
      indirizzo: _norm(raw.indirizzo || ''),
      citta: _norm(raw.citta || ''),
      cap: _normalizeCap(raw.cap || ''),
      provincia: _norm(raw.provincia || ''),
      sdiPec: _norm(raw.sdiPec || raw.sdi || raw.pec || ''),
      telefono: _normalizePhone(raw.telefono || raw.tel || raw.cellulare || ''),
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function _clienteScore(cli, q){
    if(!cli) return 0;
    var t = _normLower(q);
    if(!t) return 0;
    var rs = _normLower(cli.ragioneSociale);
    var tax = _normLower(cli.pivaCf);
    var city = _normLower(cli.citta);
    if(rs === t || tax === t) return 100;
    if(rs.indexOf(t) === 0 || tax.indexOf(t) === 0) return 80;
    if(rs.indexOf(t) >= 0 || tax.indexOf(t) >= 0) return 60;
    if(city.indexOf(t) >= 0) return 30;
    return 0;
  }

  function cercaClientiAnagrafica(query, limit){
    var lim = limit == null ? 12 : limit;
    var q = _norm(query);
    if(!q){
      return anagraficaClienti.slice().sort(function(a, b){
        return _normLower(a.ragioneSociale).localeCompare(_normLower(b.ragioneSociale));
      }).slice(0, lim);
    }
    return anagraficaClienti
      .map(function(cli){ return { cli: cli, score: _clienteScore(cli, q) }; })
      .filter(function(x){ return x.score > 0; })
      .sort(function(a, b){
        if(b.score !== a.score) return b.score - a.score;
        return _normLower(a.cli.ragioneSociale).localeCompare(_normLower(b.cli.ragioneSociale));
      })
      .map(function(x){ return x.cli; })
      .slice(0, lim);
  }

  function upsertClienteAnagrafica(raw){
    var cli = normalizeClienteFiscale(raw);
    var idx = -1;
    if(cli.pivaCf){
      idx = anagraficaClienti.findIndex(function(x){ return _normalizeTaxCode(x.pivaCf) === cli.pivaCf; });
    }
    if(idx < 0 && cli.ragioneSociale){
      idx = anagraficaClienti.findIndex(function(x){ return _normLower(x.ragioneSociale) === _normLower(cli.ragioneSociale); });
    }
    if(idx >= 0){
      var merged = Object.assign({}, anagraficaClienti[idx], cli, { id: anagraficaClienti[idx].id, updatedAt: new Date().toISOString() });
      anagraficaClienti[idx] = normalizeClienteFiscale(merged);
      saveAnagraficaClienti();
      return anagraficaClienti[idx];
    }
    anagraficaClienti.unshift(cli);
    saveAnagraficaClienti();
    return cli;
  }

  function _parseCsvLine(line){
    var out = [];
    var cur = '';
    var inQ = false;
    for(var i = 0; i < line.length; i++){
      var ch = line.charAt(i);
      if(ch === '"'){
        if(inQ && line.charAt(i + 1) === '"'){
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if(ch === ';' && !inQ){
        out.push(cur);
        cur = '';
      } else if(ch === ',' && !inQ){
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  function _toRowsFromCsv(text){
    var lines = String(text || '').split(/\r?\n/).filter(function(l){ return _norm(l) !== ''; });
    if(!lines.length) return [];
    var header = _parseCsvLine(lines[0]).map(function(h){ return _normLower(h); });
    var rows = [];
    for(var i = 1; i < lines.length; i++){
      var cols = _parseCsvLine(lines[i]);
      var obj = {};
      for(var j = 0; j < header.length; j++){
        obj[header[j]] = cols[j] == null ? '' : cols[j];
      }
      rows.push(obj);
    }
    return rows;
  }

  function _normalizeRowsFromInput(fileData){
    if(!fileData) return [];
    if(typeof fileData === 'string'){
      return _toRowsFromCsv(fileData);
    }
    if(Array.isArray(fileData)){
      if(!fileData.length) return [];
      if(Array.isArray(fileData[0])){
        var head = fileData[0].map(function(x){ return _normLower(x); });
        return fileData.slice(1).map(function(r){
          var o = {};
          for(var i = 0; i < head.length; i++) o[head[i]] = r[i];
          return o;
        });
      }
      return fileData;
    }
    if(fileData.rows && Array.isArray(fileData.rows)) return fileData.rows;
    return [];
  }

  function importaClientiDaPegaso(fileData){
    var rows = _normalizeRowsFromInput(fileData);
    var imported = 0;
    var skipped = 0;
    rows.forEach(function(r){
      var src = r || {};
      var candidate = {
        ragioneSociale: _pick(src, ['ragione sociale', 'ragione_sociale', 'cliente', 'nominativo', 'nome']),
        pivaCf: _pick(src, ['p.iva/codice fiscale', 'piva/cf', 'piva', 'partita iva', 'partita_iva', 'codice fiscale', 'codice_fiscale', 'cf']),
        indirizzo: _pick(src, ['indirizzo', 'via', 'indirizzo completo']),
        citta: _pick(src, ['città', 'citta', 'comune']),
        cap: _pick(src, ['cap']),
        provincia: _pick(src, ['provincia', 'prov']),
        sdiPec: _pick(src, ['sdi/pec', 'sdi', 'pec', 'codice sdi']),
        telefono: _pick(src, ['numero telefono', 'telefono', 'tel', 'cellulare'])
      };
      if(!_norm(candidate.ragioneSociale) && !_norm(candidate.pivaCf)){
        skipped++;
        return;
      }
      upsertClienteAnagrafica(candidate);
      imported++;
    });
    return { imported: imported, skipped: skipped, total: rows.length };
  }

  function _ensureFatturaState(cart){
    if(!cart) return;
    if(typeof cart.fatturaRichiesta !== 'boolean') cart.fatturaRichiesta = false;
    if(!cart.fatturaCliente || typeof cart.fatturaCliente !== 'object') cart.fatturaCliente = null;
    if(typeof cart.salvaFatturaInRubrica !== 'boolean') cart.salvaFatturaInRubrica = false;
  }

  function _clienteFormHtml(prefill){
    prefill = prefill || {};
    function v(k){ return esc(prefill[k] || ''); }
    return ''
      + '<div style="display:grid;grid-template-columns:1fr;gap:8px;">'
      + '<input id="fat-ragione" placeholder="Ragione Sociale" value="' + v('ragioneSociale') + '" class="fat-inp">'
      + '<input id="fat-tax" placeholder="P.IVA/Codice Fiscale" value="' + v('pivaCf') + '" class="fat-inp">'
      + '<input id="fat-ind" placeholder="Indirizzo" value="' + v('indirizzo') + '" class="fat-inp">'
      + '<div style="display:grid;grid-template-columns:1fr 80px 70px;gap:6px;">'
      + '<input id="fat-citta" placeholder="Città" value="' + v('citta') + '" class="fat-inp">'
      + '<input id="fat-cap" placeholder="CAP" value="' + v('cap') + '" class="fat-inp">'
      + '<input id="fat-prov" placeholder="Prov." value="' + v('provincia') + '" class="fat-inp">'
      + '</div>'
      + '<input id="fat-sdipec" placeholder="SDI / PEC" value="' + v('sdiPec') + '" class="fat-inp">'
      + '<input id="fat-tel" placeholder="Numero telefono" value="' + v('telefono') + '" class="fat-inp">'
      + '</div>';
  }

  function _getClienteFromForm(){
    return normalizeClienteFiscale({
      ragioneSociale: gf('fat-ragione'),
      pivaCf: gf('fat-tax'),
      indirizzo: gf('fat-ind'),
      citta: gf('fat-citta'),
      cap: gf('fat-cap'),
      provincia: gf('fat-prov'),
      sdiPec: gf('fat-sdipec'),
      telefono: gf('fat-tel')
    });
  }

  function ctOpenFatturaClienteModal(cartId){
    var cart = (carrelli || []).find(function(c){ return c.id === cartId; });
    if(!cart) return;
    _ensureFatturaState(cart);
    var ex = document.getElementById('fat-cliente-modal');
    if(ex) ex.remove();
    var overlay = document.createElement('div');
    overlay.id = 'fat-cliente-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.65);display:flex;align-items:flex-end;justify-content:center;';
    var current = cart.fatturaCliente || {};
    overlay.innerHTML = ''
      + '<div style="background:#131313;border:1px solid #2a2a2a;border-radius:14px 14px 0 0;max-width:680px;width:100%;padding:12px 12px 16px;max-height:92vh;overflow:auto;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">'
      + '<div style="font-weight:900;color:var(--accent);font-size:16px;">Fattura cliente</div>'
      + '<button id="fat-close" style="background:transparent;border:none;color:#888;font-size:20px;cursor:pointer;">✕</button>'
      + '</div>'
      + '<input id="fat-search" placeholder="Cerca in anagrafica (ragione sociale, P.IVA, città)..." class="fat-inp" style="margin-bottom:8px;">'
      + '<div id="fat-sug" style="display:grid;gap:6px;margin-bottom:10px;"></div>'
      + _clienteFormHtml(current)
      + '<label style="display:flex;align-items:center;gap:6px;margin-top:10px;font-size:12px;color:#bbb;">'
      + '<input id="fat-save-rubrica" type="checkbox"' + (cart.salvaFatturaInRubrica ? ' checked' : '') + '> Salva in rubrica al termine ordine'
      + '</label>'
      + '<div style="display:flex;gap:8px;margin-top:12px;">'
      + '<button id="fat-clear" style="flex:1;padding:10px;border-radius:9px;border:1px solid #3b3b3b;background:transparent;color:#bbb;">Solo scontrino</button>'
      + '<button id="fat-save" style="flex:1;padding:10px;border-radius:9px;border:none;background:var(--accent);color:#111;font-weight:800;">Salva fattura</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(overlay);

    function close(){ var e = document.getElementById('fat-cliente-modal'); if(e) e.remove(); }
    function renderSug(q){
      var box = document.getElementById('fat-sug');
      if(!box) return;
      var list = cercaClientiAnagrafica(q, 8);
      if(!list.length){
        box.innerHTML = '<div style="font-size:11px;color:#666;">Nessun cliente trovato. Inserisci manualmente per creare nuovo contatto.</div>';
        return;
      }
      var h = '';
      list.forEach(function(cli, idx){
        h += '<button type="button" data-i="' + idx + '" class="fat-sug-btn" style="text-align:left;padding:7px 8px;border-radius:8px;border:1px solid #2d2d2d;background:#181818;color:#ddd;">'
          + '<div style="font-size:12px;font-weight:700;">' + esc(cli.ragioneSociale || '—') + '</div>'
          + '<div style="font-size:10px;color:#888;">' + esc(cli.pivaCf || '—') + ' · ' + esc(cli.citta || '') + '</div>'
          + '</button>';
      });
      box.innerHTML = h;
      var btns = box.querySelectorAll('.fat-sug-btn[data-i]');
      for(var i = 0; i < btns.length; i++){
        btns[i].onclick = function(){
          var ix = parseInt(this.getAttribute('data-i'), 10);
          if(isNaN(ix) || !list[ix]) return;
          var cli = list[ix];
          document.getElementById('fat-ragione').value = cli.ragioneSociale || '';
          document.getElementById('fat-tax').value = cli.pivaCf || '';
          document.getElementById('fat-ind').value = cli.indirizzo || '';
          document.getElementById('fat-citta').value = cli.citta || '';
          document.getElementById('fat-cap').value = cli.cap || '';
          document.getElementById('fat-prov').value = cli.provincia || '';
          document.getElementById('fat-sdipec').value = cli.sdiPec || '';
          document.getElementById('fat-tel').value = cli.telefono || '';
        };
      }
    }

    overlay.onclick = function(ev){ if(ev.target === overlay) close(); };
    document.getElementById('fat-close').onclick = close;
    document.getElementById('fat-search').oninput = function(){ renderSug(this.value); };
    document.getElementById('fat-clear').onclick = function(){
      cart.fatturaRichiesta = false;
      cart.fatturaCliente = null;
      cart.salvaFatturaInRubrica = false;
      saveCarrelli();
      renderCartTabs();
      showToastGen('green', 'Modalità scontrino attiva');
      close();
    };
    document.getElementById('fat-save').onclick = function(){
      var cliente = _getClienteFromForm();
      if(!cliente.ragioneSociale){
        showToastGen('red', 'Inserisci almeno la Ragione Sociale');
        return;
      }
      cart.fatturaRichiesta = true;
      cart.fatturaCliente = cliente;
      cart.salvaFatturaInRubrica = !!document.getElementById('fat-save-rubrica').checked;
      saveCarrelli();
      renderCartTabs();
      showToastGen('green', 'Dati fattura salvati');
      close();
    };
    renderSug('');
  }

  function _ordFindById(ordineID){
    var id = _norm(ordineID);
    if(!id) return null;
    var ord = (ordini || []).find(function(o){ return o && o.id === id; });
    if(ord) return ord;
    if(typeof getOrdiniArchivio === 'function'){
      var arch = getOrdiniArchivio() || [];
      return arch.find(function(o){ return o && o.id === id; }) || null;
    }
    return null;
  }

  function preparaTemplateStampa(ordineID){
    var ord = _ordFindById(ordineID);
    if(!ord) return null;
    var righe = (ord.items || []).map(function(it){
      var qty = parseFloat(it.qty || 0) || 0;
      var prezzo = parsePriceIT(it.prezzoUnit || 0) || 0;
      return {
        nome: it.desc || '',
        codice: it.codM || it.codF || '',
        prezzo: Number(prezzo.toFixed(4)),
        quantita: Number(qty.toFixed(4)),
        totale: Number((prezzo * qty).toFixed(2))
      };
    });
    return {
      ordineID: ord.id,
      numeroOrdine: ord.numero || null,
      data: ord.dataISO || ord.data || '',
      cliente: ord.nomeCliente || '',
      totale: Number((parseFloat(ord.totale || 0) || 0).toFixed(2)),
      datiClienteFattura: ord.fatturaCliente || null,
      fatturaRichiesta: !!ord.fatturaRichiesta,
      righe: righe
    };
  }

  function _fmtMoney(n){
    var v = Number(n || 0);
    if(!isFinite(v)) v = 0;
    return '€ ' + v.toFixed(2);
  }

  function ctPreviewStampaFattura(cartId){
    var cart = (carrelli || []).find(function(c){ return c && c.id === cartId; });
    if(!cart || !cart.ordId){
      showToastGen('orange', 'Ordine non disponibile per la stampa');
      return;
    }
    var tpl = preparaTemplateStampa(cart.ordId);
    if(!tpl){
      showToastGen('red', 'Impossibile preparare il template di stampa');
      return;
    }
    var existing = document.getElementById('fat-print-preview');
    if(existing) existing.remove();
    var ov = document.createElement('div');
    ov.id = 'fat-print-preview';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.72);display:flex;align-items:flex-end;justify-content:center;';
    var cli = tpl.datiClienteFattura || {};
    var hRows = '';
    (tpl.righe || []).forEach(function(r, i){
      hRows += '<tr>'
        + '<td style="padding:6px;border-bottom:1px solid #2a2a2a;">' + (i + 1) + '</td>'
        + '<td style="padding:6px;border-bottom:1px solid #2a2a2a;">' + esc(r.nome || '') + '</td>'
        + '<td style="padding:6px;border-bottom:1px solid #2a2a2a;">' + esc(r.codice || '') + '</td>'
        + '<td style="padding:6px;border-bottom:1px solid #2a2a2a;text-align:right;">' + esc(String(r.quantita || 0)) + '</td>'
        + '<td style="padding:6px;border-bottom:1px solid #2a2a2a;text-align:right;">' + _fmtMoney(r.prezzo) + '</td>'
        + '<td style="padding:6px;border-bottom:1px solid #2a2a2a;text-align:right;font-weight:700;">' + _fmtMoney(r.totale) + '</td>'
        + '</tr>';
    });
    if(!hRows){
      hRows = '<tr><td colspan="6" style="padding:10px;text-align:center;color:#888;">Nessuna riga ordine</td></tr>';
    }
    var stampabile = ''
      + '<div style="font-family:Arial,sans-serif;color:#111;">'
      + '<h2 style="margin:0 0 8px 0;">Anteprima Fattura</h2>'
      + '<div style="font-size:12px;margin-bottom:8px;">Ordine: ' + esc(String(tpl.numeroOrdine || tpl.ordineID || '—')) + ' · Data: ' + esc(tpl.data || '') + '</div>'
      + '<div style="font-size:12px;margin-bottom:8px;"><b>Cliente:</b> ' + esc(cli.ragioneSociale || tpl.cliente || '—') + '</div>'
      + '<div style="font-size:12px;margin-bottom:8px;">P.IVA/CF: ' + esc(cli.pivaCf || '—') + ' · SDI/PEC: ' + esc(cli.sdiPec || '—') + '</div>'
      + '<div style="font-size:12px;margin-bottom:8px;">Indirizzo: ' + esc(cli.indirizzo || '—') + ', ' + esc(cli.cap || '') + ' ' + esc(cli.citta || '') + ' (' + esc(cli.provincia || '') + ')</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:12px;">'
      + '<thead><tr>'
      + '<th style="text-align:left;padding:6px;border-bottom:2px solid #444;">#</th>'
      + '<th style="text-align:left;padding:6px;border-bottom:2px solid #444;">Nome</th>'
      + '<th style="text-align:left;padding:6px;border-bottom:2px solid #444;">Codice</th>'
      + '<th style="text-align:right;padding:6px;border-bottom:2px solid #444;">Qtà</th>'
      + '<th style="text-align:right;padding:6px;border-bottom:2px solid #444;">Prezzo</th>'
      + '<th style="text-align:right;padding:6px;border-bottom:2px solid #444;">Totale</th>'
      + '</tr></thead>'
      + '<tbody>' + hRows + '</tbody>'
      + '</table>'
      + '<div style="margin-top:10px;text-align:right;font-weight:800;">Totale documento: ' + _fmtMoney(tpl.totale) + '</div>'
      + '</div>';
    ov.innerHTML = ''
      + '<div style="background:#121212;border:1px solid #2d2d2d;border-radius:14px 14px 0 0;max-width:900px;width:100%;max-height:92vh;overflow:auto;padding:12px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">'
      + '<div style="font-size:16px;font-weight:900;color:var(--accent);">Anteprima stampa fattura</div>'
      + '<div style="display:flex;gap:8px;">'
      + '<button id="fat-prev-print" style="padding:8px 12px;border-radius:8px;border:none;background:var(--accent);color:#111;font-weight:800;cursor:pointer;">🖨️ Stampa</button>'
      + '<button id="fat-prev-close" style="padding:8px 10px;border-radius:8px;border:1px solid #333;background:transparent;color:#bbb;cursor:pointer;">Chiudi</button>'
      + '</div></div>'
      + '<div id="fat-prev-sheet" style="background:#fff;border-radius:10px;padding:14px;overflow:auto;">' + stampabile + '</div>'
      + '</div>';
    document.body.appendChild(ov);
    function close(){ var e = document.getElementById('fat-print-preview'); if(e) e.remove(); }
    ov.onclick = function(ev){ if(ev.target === ov) close(); };
    document.getElementById('fat-prev-close').onclick = close;
    document.getElementById('fat-prev-print').onclick = function(){
      var win = window.open('', '_blank');
      if(!win){
        showToastGen('orange', 'Popup bloccato: abilita popup per la stampa');
        return;
      }
      win.document.write('<html><head><title>Anteprima Fattura</title></head><body style="margin:20px;font-family:Arial,sans-serif;">' + stampabile + '</body></html>');
      win.document.close();
      win.focus();
      setTimeout(function(){ win.print(); }, 150);
    };
  }

  function ctPreviewStampaProforma(cartId){
    var cart = (carrelli || []).find(function(c){ return c && c.id === cartId; });
    if(!cart){
      showToastGen('orange', 'Carrello non trovato');
      return;
    }
    var tpl = null;
    if(cart.ordId) tpl = preparaTemplateStampa(cart.ordId);
    var righe = [];
    var titolo = 'Anteprima Proforma/Scontrino';
    var infoOrd = cart.ordId || '—';
    var data = new Date().toISOString().slice(0, 10);
    var cliente = cart.nome || (tpl ? tpl.cliente : '') || 'Cliente banco';
    var totale = 0;
    if(tpl){
      righe = tpl.righe || [];
      totale = Number(tpl.totale || 0);
      infoOrd = tpl.numeroOrdine || tpl.ordineID || infoOrd;
      data = tpl.data || data;
    } else {
      righe = (cart.items || []).map(function(it){
        var q = parseFloat(it.qty || 0) || 0;
        var p = parsePriceIT(it.prezzoUnit || 0) || 0;
        var t = Number((q * p).toFixed(2));
        totale += t;
        return { nome: it.desc || '', codice: it.codM || it.codF || '', quantita: Number(q.toFixed(4)), prezzo: Number(p.toFixed(4)), totale: t };
      });
      totale = Number(totale.toFixed(2));
    }
    var existing = document.getElementById('fat-print-preview');
    if(existing) existing.remove();
    var ov = document.createElement('div');
    ov.id = 'fat-print-preview';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.72);display:flex;align-items:flex-end;justify-content:center;';
    var hRows = '';
    righe.forEach(function(r, i){
      hRows += '<tr>'
        + '<td style="padding:6px;border-bottom:1px solid #2a2a2a;">' + (i + 1) + '</td>'
        + '<td style="padding:6px;border-bottom:1px solid #2a2a2a;">' + esc(r.nome || '') + '</td>'
        + '<td style="padding:6px;border-bottom:1px solid #2a2a2a;">' + esc(r.codice || '') + '</td>'
        + '<td style="padding:6px;border-bottom:1px solid #2a2a2a;text-align:right;">' + esc(String(r.quantita || 0)) + '</td>'
        + '<td style="padding:6px;border-bottom:1px solid #2a2a2a;text-align:right;">' + _fmtMoney(r.prezzo) + '</td>'
        + '<td style="padding:6px;border-bottom:1px solid #2a2a2a;text-align:right;font-weight:700;">' + _fmtMoney(r.totale) + '</td>'
        + '</tr>';
    });
    if(!hRows) hRows = '<tr><td colspan="6" style="padding:10px;text-align:center;color:#888;">Nessuna riga</td></tr>';
    var stampabile = ''
      + '<div style="font-family:Arial,sans-serif;color:#111;">'
      + '<h2 style="margin:0 0 8px 0;">' + titolo + '</h2>'
      + '<div style="font-size:12px;margin-bottom:8px;">Ordine: ' + esc(String(infoOrd)) + ' · Data: ' + esc(data) + '</div>'
      + '<div style="font-size:12px;margin-bottom:8px;"><b>Cliente:</b> ' + esc(cliente) + '</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:12px;">'
      + '<thead><tr>'
      + '<th style="text-align:left;padding:6px;border-bottom:2px solid #444;">#</th>'
      + '<th style="text-align:left;padding:6px;border-bottom:2px solid #444;">Nome</th>'
      + '<th style="text-align:left;padding:6px;border-bottom:2px solid #444;">Codice</th>'
      + '<th style="text-align:right;padding:6px;border-bottom:2px solid #444;">Qtà</th>'
      + '<th style="text-align:right;padding:6px;border-bottom:2px solid #444;">Prezzo</th>'
      + '<th style="text-align:right;padding:6px;border-bottom:2px solid #444;">Totale</th>'
      + '</tr></thead><tbody>' + hRows + '</tbody></table>'
      + '<div style="margin-top:10px;text-align:right;font-weight:800;">Totale documento: ' + _fmtMoney(totale) + '</div>'
      + '</div>';
    ov.innerHTML = ''
      + '<div style="background:#121212;border:1px solid #2d2d2d;border-radius:14px 14px 0 0;max-width:900px;width:100%;max-height:92vh;overflow:auto;padding:12px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">'
      + '<div style="font-size:16px;font-weight:900;color:#d9d9d9;">Anteprima stampa proforma</div>'
      + '<div style="display:flex;gap:8px;">'
      + '<button id="pro-prev-print" style="padding:8px 12px;border-radius:8px;border:none;background:#d9d9d9;color:#111;font-weight:800;cursor:pointer;">🖨️ Stampa</button>'
      + '<button id="pro-prev-close" style="padding:8px 10px;border-radius:8px;border:1px solid #333;background:transparent;color:#bbb;cursor:pointer;">Chiudi</button>'
      + '</div></div>'
      + '<div style="background:#fff;border-radius:10px;padding:14px;overflow:auto;">' + stampabile + '</div>'
      + '</div>';
    document.body.appendChild(ov);
    function close(){ var e = document.getElementById('fat-print-preview'); if(e) e.remove(); }
    ov.onclick = function(ev){ if(ev.target === ov) close(); };
    document.getElementById('pro-prev-close').onclick = close;
    document.getElementById('pro-prev-print').onclick = function(){
      var win = window.open('', '_blank');
      if(!win){
        showToastGen('orange', 'Popup bloccato: abilita popup per la stampa');
        return;
      }
      win.document.write('<html><head><title>Anteprima Proforma</title></head><body style="margin:20px;font-family:Arial,sans-serif;">' + stampabile + '</body></html>');
      win.document.close();
      win.focus();
      setTimeout(function(){ win.print(); }, 150);
    };
  }

  window.anagraficaClienti = anagraficaClienti;
  window.saveAnagraficaClienti = saveAnagraficaClienti;
  window.normalizeClienteFiscale = normalizeClienteFiscale;
  window.cercaClientiAnagrafica = cercaClientiAnagrafica;
  window.upsertClienteAnagrafica = upsertClienteAnagrafica;
  window.importaClientiDaPegaso = importaClientiDaPegaso;
  window.ctOpenFatturaClienteModal = ctOpenFatturaClienteModal;
  window.preparaTemplateStampa = preparaTemplateStampa;
  window.ctPreviewStampaFattura = ctPreviewStampaFattura;
  window.ctPreviewStampaProforma = ctPreviewStampaProforma;
  window.ensureFatturaState = _ensureFatturaState;
})();
