// ordini.ddt.js - estratto da ordini.js

// ---------------------------------------------------------------
//  DDT - DOCUMENTO DI TRASPORTO (stampa A4)
// ---------------------------------------------------------------
var DDT_NUM_K = window.AppKeys.DDT_NUM;

function getNextDDTNum(){
  var n = parseInt(localStorage.getItem(DDT_NUM_K) || '0') + 1;
  localStorage.setItem(DDT_NUM_K, String(n));
  return n;
}

// Aliquota IVA standard utilizzata per il calcolo dell'imponibile sul DDT.
// I prezzi nel carrello sono memorizzati LORDI (IVA inclusa), quindi
// per ricavare il prezzo imponibile (netto) si divide per (1 + IVA/100).
var DDT_IVA_PERC = 22;
var _ddtLastPrintableHtml = '';

function _ddtFmtImp(n){
  // Formato italiano con virgola decimale (per stampa imponibili)
  if(!isFinite(n)) n = 0;
  return n.toFixed(2).replace('.', ',');
}

function _ddtEsc(s){
  if(s == null) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function _ddtCliente(cart){
  // Costruisce i campi del Destinatario sfruttando i dati di fatturazione
  // se presenti (cart.fatturaCliente: ragioneSociale, pivaCf, indirizzo,
  // citta, cap, provincia, sdiPec, telefono), altrimenti i campi base.
  var fc = cart && cart.fatturaCliente && typeof cart.fatturaCliente === 'object' ? cart.fatturaCliente : null;
  var nome = (fc && fc.ragioneSociale) ? fc.ragioneSociale : (cart && cart.nome ? cart.nome : '');
  var piva = (fc && fc.pivaCf) ? fc.pivaCf : (cart && cart.piva ? cart.piva : '');
  var indParts = [];
  if(fc){
    if(fc.indirizzo) indParts.push(fc.indirizzo);
    var cap = fc.cap ? String(fc.cap).trim() : '';
    var citta = fc.citta ? String(fc.citta).trim() : '';
    var prov = fc.provincia ? String(fc.provincia).trim() : '';
    var loc = '';
    if(cap) loc += cap + ' ';
    if(citta) loc += citta;
    if(prov) loc += ' (' + prov + ')';
    if(loc.trim()) indParts.push(loc.trim());
  }
  var indirizzo = indParts.length ? indParts.join(' - ') : (cart && cart.indirizzo ? cart.indirizzo : '');
  return { nome: nome, piva: piva, indirizzo: indirizzo };
}

function _ddtBuildPrintDoc(bodyHtml){
  return '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>DDT</title></head><body style="margin:0;background:#fff;">'
    + bodyHtml
    + '</body></html>';
}

function stampaDDTPrint(){
  if(!_ddtLastPrintableHtml){
    showToastGen('orange','Anteprima DDT non pronta');
    return;
  }
  var w = window.open('', '_blank');
  if(!w){
    showToastGen('orange','Popup bloccato: abilita popup per la stampa');
    return;
  }
  w.document.open();
  w.document.write(_ddtBuildPrintDoc(_ddtLastPrintableHtml));
  w.document.close();
  w.focus();
  setTimeout(function(){ w.print(); }, 180);
}

function stampaDDT(cartIdOrOrdId){
  // 1) Prova come cartId (carrello attivo/inviato).
  var cart = (carrelli||[]).find(function(c){ return c && c.id === cartIdOrOrdId; });
  // 2) Fallback: ordine inviato dalla tab Ordini (anche dopo che il carrello è stato chiuso).
  if(!cart){
    var ord = (typeof ordini !== 'undefined' ? ordini : []).find(function(o){ return o && o.id === cartIdOrOrdId; });
    if(ord){
      cart = {
        id: ord.id,
        ordId: ord.id,
        nome: ord.nomeCliente || '',
        items: ord.items || [],
        nota: ord.nota || '',
        fatturaRichiesta: !!ord.fatturaRichiesta,
        fatturaCliente: ord.fatturaCliente || null,
        tipo: ord.tipo || '',
        numeroFattura: ord.numeroFattura || '',
        scontoGlobale: ord.scontoGlobale || null
      };
    }
  }
  if(!cart || !(cart.items||[]).length){
    showToastGen('red','-- Carrello vuoto!');
    return;
  }

  // Per le fatture: riusa il numero fattura già archiviato (non incrementare il contatore DDT).
  var ddtNum;
  if(cart.tipo === 'fattura' && cart.numeroFattura){
    ddtNum = cart.numeroFattura;
  } else {
    ddtNum = getNextDDTNum();
  }
  var oggi = new Date();
  var dataStr = String(oggi.getDate()).padStart(2,'0') + '/' + String(oggi.getMonth()+1).padStart(2,'0') + '/' + oggi.getFullYear();
  var oraStr = String(oggi.getHours()).padStart(2,'0') + ':' + String(oggi.getMinutes()).padStart(2,'0');

  var cli = _ddtCliente(cart);
  var nomeCliente = cli.nome || '';
  var indirizzo = cli.indirizzo || '';
  var piva = cli.piva || '';
  var nota = cart.nota || '';

  // Calcolo righe articoli con prezzi IMPONIBILI (netti, senza IVA)
  var totaleImp = 0;
  var ivaFactor = 1 + (DDT_IVA_PERC/100);
  var righeData = [];

  (cart.items||[]).forEach(function(it){
    var puLordo = parsePriceIT(it.prezzoUnit);
    var qty     = parseFloat(it.qty || 1);
    var puNetto = puLordo / ivaFactor;
    var subNetto = puNetto * qty;
    totaleImp += subNetto;

    var codice = it.codM || it.codF || '';
    var unit = it.unit || 'pz';

    var descBase = _ddtEsc(it.desc || '');
    if(it.specs) descBase += ' <span style="color:#000;font-size:7.5px;font-weight:600;">(' + _ddtEsc(it.specs) + ')</span>';
    var pbDdt = itemRigaNotaPrezzoBasePlain(it);
    if(pbDdt) descBase += ' <span style="color:#000;font-size:7.5px;font-weight:600;">' + _ddtEsc(pbDdt) + '</span>';
    righeData.push({
      codice: _ddtEsc(codice),
      descHtml: descBase,
      um: _ddtEsc(unit),
      qty: qty,
      prezzoImp: _ddtFmtImp(puNetto),
      totaleImp: _ddtFmtImp(subNetto),
      prezzoVend: _ddtFmtImp(puLordo)
    });
  });
  // Estrae il numero civico finale (es. "VIA ZANOIA 4" → via="VIA ZANOIA", civico="4").
  function _ddtParseIndirizzo(s){
    s = String(s || '').trim();
    if(!s) return { via: '', civico: '' };
    var m = s.match(/^(.*?)\s+(\d[\w\/\.\-]*)\s*$/);
    if(m) return { via: m[1].trim(), civico: m[2].trim() };
    return { via: s, civico: '' };
  }

  function _ddtSetSubrowData(row, comuneStr, via, civico){
    if(!row) return;
    var doc = row.ownerDocument;
    var subs = row.querySelectorAll('.dest-subcell');
    function ensure(sub){
      if(!sub) return null;
      var l = sub.querySelector('.dest-subcell-line');
      if(!l){
        l = doc.createElement('span');
        l.className = 'dest-subcell-line';
        l.setAttribute('contenteditable', 'true');
        sub.insertBefore(l, sub.firstChild);
      }
      return l;
    }
    var l0 = ensure(subs[0]);
    var l1 = ensure(subs[1]);
    var l2 = ensure(subs[2]);
    if(l0) l0.textContent = comuneStr || '';
    if(l1) l1.textContent = via || '';
    if(l2) l2.textContent = civico || '';
  }

  function _ddtPopulateTemplate(doc){
    if(!doc) return false;
    var numEl = doc.querySelector('.doc-title-num');
    var dateEl = doc.querySelector('.doc-title-date');
    if(numEl) numEl.textContent = ddtNum;
    if(dateEl) dateEl.textContent = dataStr;

    // Ricava le parti strutturate del cliente (preferendo cart.fatturaCliente).
    var fc = (cart && cart.fatturaCliente && typeof cart.fatturaCliente === 'object') ? cart.fatturaCliente : null;
    var citta = fc && fc.citta ? String(fc.citta).trim() : '';
    var prov  = fc && fc.provincia ? String(fc.provincia).trim() : '';
    var indirizzoSrc = fc && fc.indirizzo ? String(fc.indirizzo).trim() : (cart && cart.indirizzo ? String(cart.indirizzo).trim() : '');
    var parsed = _ddtParseIndirizzo(indirizzoSrc);
    var comuneStr = citta + (prov ? ' (' + prov + ')' : '');
    var indirizzoLine = parsed.via;
    var civico = parsed.civico;

    // Ditta = prima .dest-field-line (l'unica nella sezione header destinatario insieme a Pagamento).
    var fields = doc.querySelectorAll('.hdr-dest .dest-field');
    var dittaLine = null, pagLine = null;
    for(var k = 0; k < fields.length; k++){
      var line = fields[k].querySelector('.dest-field-line');
      if(!line) continue;
      if(!dittaLine) dittaLine = line;
      else { pagLine = line; break; }
    }
    if(dittaLine) dittaLine.textContent = nomeCliente;
    if(pagLine) pagLine.textContent = piva ? ('P.IVA/C.F. ' + piva) : '';

    // Subrow Residenza / Luogo: data sopra le label Comune/Via/n.
    var rows = doc.querySelectorAll('.hdr-dest .dest-field-row');
    _ddtSetSubrowData(rows[0], comuneStr, indirizzoLine, civico);
    _ddtSetSubrowData(rows[1], comuneStr, indirizzoLine, civico);

    // Codice cliente (footer DDT): IdAnagrafica salvato dentro fatturaCliente.
    // Persistito sia nel carrello che nell'ordine Firebase, quindi sopravvive
    // alla chiusura della sessione.
    var codCli = doc.querySelector('.fld-codice-cliente');
    if(codCli){
      var idA = fc && fc.idAnagrafica ? String(fc.idAnagrafica) : '';
      if(idA) codCli.textContent = idA;
    }

    var trData = doc.querySelector('.fld-data-trasporto');
    var trOra  = doc.querySelector('.fld-ora-trasporto');
    if(trData) trData.textContent = dataStr;
    if(trOra)  trOra.textContent = oraStr;
    // Fallback per template legacy senza classi `.fld-*`.
    if(!trData || !trOra){
      var trDataOra = doc.querySelectorAll('.trasporto .tr-cell:nth-child(3) .cb-row span[style*="border-bottom"]');
      if(!trData && trDataOra[0]) trDataOra[0].textContent = dataStr;
      if(!trOra  && trDataOra[1]) trDataOra[1].textContent = oraStr;
    }

    var tbody = doc.querySelector('.art-table tbody');
    if(tbody){
      var rowsHtml = '';
      for(var i=0;i<righeData.length;i++){
        var r = righeData[i];
        rowsHtml += '<tr>'
          + '<td class="c-cod">'+r.codice+'</td>'
          + '<td class="c-desc">'+r.descHtml+'</td>'
          + '<td class="c-um">'+r.um+'</td>'
          + '<td class="c-qta">'+r.qty+'</td>'
          + '<td class="c-prz">'+r.prezzoImp+'</td>'
          + '<td class="c-tot">'+r.totaleImp+'</td>'
          + '<td class="c-extra">'+r.prezzoVend+'</td>'
          + '</tr>';
      }
      for(var j=righeData.length; j<25; j++){
        rowsHtml += '<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
      }
      tbody.innerHTML = rowsHtml;
    }

    if(nota){
      var ann = doc.querySelector('.footer-annotazioni');
      if(ann) ann.textContent = 'Annotazioni: ' + nota;
    }
    return true;
  }

  // ---- Overlay anteprima + barra Stampa/Chiudi (logica preservata) ----
  var ov = document.getElementById('ddt-print-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'ddt-print-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#888;overflow-y:auto;display:none;';
    document.body.appendChild(ov);
  }
  ov.innerHTML = ''
    + '<div id="ddt-print-bar" style="padding:8px;background:#333;display:flex;gap:8px;align-items:center;position:sticky;top:0;z-index:1;">'
    +   '<button onclick="stampaDDTPrint()" style="padding:10px 24px;border-radius:8px;border:none;background:#3182ce;color:#fff;font-size:14px;font-weight:800;cursor:pointer;">🖨️ Stampa DDT</button>'
    +   '<button onclick="chiudiDDT()" style="padding:10px 18px;border-radius:8px;border:1px solid #555;background:transparent;color:#fff;font-size:13px;cursor:pointer;">✖ Chiudi</button>'
    +   '<span style="color:#aaa;font-size:12px;margin-left:8px;">DDT N.' + ddtNum + ' - ' + _ddtEsc(nomeCliente || '—') + '</span>'
    + '</div>'
    + '<div style="padding:15px 0;">'
    +   '<iframe id="ddt-template-frame" src="ddt_rattazzi_finale.html?v=' + Date.now() + '" '
    +   'style="display:block;width:215mm;max-width:98vw;height:307mm;margin:0 auto;border:0;background:#fff;"></iframe>'
    + '</div>';

  var frame = document.getElementById('ddt-template-frame');
  if(frame){
    frame.onload = function(){
      try{
        var fdoc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
        if(!_ddtPopulateTemplate(fdoc)) throw new Error('Template non popolabile');
        _ddtLastPrintableHtml = fdoc && fdoc.documentElement ? fdoc.documentElement.outerHTML : '';
      }catch(e){
        console.warn('DDT template load error:', e);
        _ddtLastPrintableHtml = '';
        showToastGen('red','Errore caricamento template DDT');
      }
    };
  }
  ov.style.display = 'block';
  document.body.style.overflow = 'hidden';
  showToastGen('green','- DDT N.' + ddtNum + ' - premi Stampa');
}

function chiudiDDT(){
  var ov = document.getElementById('ddt-print-overlay');
  if(ov) ov.style.display = 'none';
  document.body.style.overflow = '';
}
