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

function stampaDDT(cartId){
  var cart = carrelli.find(function(c){ return c.id === cartId; });
  if(!cart || !(cart.items||[]).length){
    showToastGen('red','-- Carrello vuoto!');
    return;
  }

  var ddtNum = getNextDDTNum();
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
  var righeHTML = '';
  var ivaFactor = 1 + (DDT_IVA_PERC/100);

  (cart.items||[]).forEach(function(it){
    var puLordo = parsePriceIT(it.prezzoUnit);
    var qty     = parseFloat(it.qty || 1);
    var puNetto = puLordo / ivaFactor;
    var subNetto = puNetto * qty;
    totaleImp += subNetto;

    var codice = it.codM || it.codF || '';
    var unit = it.unit || 'pz';

    var descBase = _ddtEsc(it.desc || '');
    if(it.specs) descBase += ' <span style="color:#444;font-size:7px;">(' + _ddtEsc(it.specs) + ')</span>';
    var pbDdt = itemRigaNotaPrezzoBasePlain(it);
    if(pbDdt) descBase += ' <span style="color:#444;font-size:7px;">' + _ddtEsc(pbDdt) + '</span>';

    righeHTML += ''
      + '<tr>'
      +   '<td class="c-cod">' + _ddtEsc(codice) + '</td>'
      +   '<td class="c-desc">' + descBase + '</td>'
      +   '<td class="c-um">' + _ddtEsc(unit) + '</td>'
      +   '<td class="c-qta">' + qty + '</td>'
      +   '<td class="c-prz">' + _ddtFmtImp(puNetto) + '</td>'
      +   '<td class="c-tot">' + _ddtFmtImp(subNetto) + '</td>'
      + '</tr>';
  });

  // Righe vuote: completiamo fino a riempire la pagina come nel template (22 righe)
  var minRighe = 22;
  for(var r = (cart.items||[]).length; r < minRighe; r++){
    righeHTML += '<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
  }

  // ----------------------------------------------------------------
  //  Costruzione documento HTML (template DDT v1 con logo originale)
  // ----------------------------------------------------------------
  var docCss = ''
    + '#ddt-doc *{margin:0;padding:0;box-sizing:border-box;}'
    + '#ddt-doc{font-family:Arial,sans-serif;font-size:10px;color:#000;background:#fff;}'
    + '#ddt-doc .page{width:210mm;min-height:297mm;background:#fff;margin:0 auto;padding:7mm 7mm 6mm 7mm;}'

    + '#ddt-doc .fl{display:inline-block;border-bottom:1px solid #000;height:12px;}'
    + '#ddt-doc .fl-xs{min-width:20px;}'
    + '#ddt-doc .fl-sm{min-width:42px;}'
    + '#ddt-doc .fl-md{min-width:68px;}'
    + '#ddt-doc .fl-lg{min-width:108px;}'
    + '#ddt-doc .fl-xl{min-width:148px;}'

    + '#ddt-doc .hdr-top{display:flex;border:1.5px solid #000;border-bottom:none;}'
    + '#ddt-doc .hdr-top-left{flex:0 0 52%;border-right:1.5px solid #000;padding:2px 6px;font-size:7.5px;font-weight:bold;text-transform:uppercase;letter-spacing:.5px;}'
    + '#ddt-doc .hdr-top-right{flex:1;padding:3px 8px;font-size:10px;font-weight:bold;display:flex;align-items:center;gap:3px;}'

    + '#ddt-doc .hdr-main{display:flex;border:1.5px solid #000;}'
    + '#ddt-doc .hdr-logo{flex:0 0 52%;border-right:1.5px solid #000;padding:5px 8px 7px 8px;}'
    + '#ddt-doc .logo-svg-wrap{display:flex;align-items:baseline;gap:5px;margin-bottom:2px;}'
    + '#ddt-doc .logo-srl{font-size:9.5px;font-weight:bold;letter-spacing:1.5px;color:#000;align-self:flex-end;margin-bottom:4px;}'
    + '#ddt-doc .logo-addr{font-size:7px;line-height:1.65;color:#111;}'

    + '#ddt-doc .hdr-dest{flex:1;padding:5px 10px;display:flex;flex-direction:column;gap:3px;}'
    + '#ddt-doc .dest-label{font-size:7.5px;font-weight:bold;text-transform:uppercase;letter-spacing:.4px;}'
    + '#ddt-doc .dest-name{font-size:10px;font-weight:700;line-height:1.2;margin-top:1px;}'
    + '#ddt-doc .dest-row{font-size:8px;display:flex;align-items:flex-end;gap:3px;margin-bottom:2px;}'
    + '#ddt-doc .dest-row .fl{flex:1;}'

    + '#ddt-doc .trasporto{display:flex;border:1.5px solid #000;border-top:none;}'
    + '#ddt-doc .tc{padding:3px 5px 4px 5px;border-right:1.5px solid #000;font-size:7.5px;}'
    + '#ddt-doc .tc:last-child{border-right:none;}'
    + '#ddt-doc .tc-title{font-weight:bold;font-size:7px;text-transform:uppercase;letter-spacing:.2px;display:block;margin-bottom:3px;}'
    + '#ddt-doc .cb-row{display:flex;gap:5px;align-items:center;flex-wrap:wrap;font-size:7.5px;}'
    + '#ddt-doc .cb-item{display:flex;align-items:center;gap:2px;}'
    + '#ddt-doc .cb{width:8px;height:8px;border:1px solid #000;display:inline-block;flex-shrink:0;text-align:center;line-height:7px;font-size:8px;font-weight:900;}'

    + '#ddt-doc .art-table{width:100%;border-collapse:collapse;border:1.5px solid #000;border-top:none;table-layout:fixed;}'
    + '#ddt-doc .art-table th{border:1px solid #000;padding:3px 3px;font-size:7.5px;font-weight:bold;text-align:center;background:#ebebeb;text-transform:uppercase;line-height:1.3;}'
    + '#ddt-doc .art-table td{border:1px solid #000;padding:0 3px;height:15px;font-size:8px;vertical-align:middle;overflow:hidden;}'
    + '#ddt-doc .art-table td.c-cod{width:17%;}'
    + '#ddt-doc .art-table td.c-desc{width:42%;}'
    + '#ddt-doc .art-table td.c-um{width:6%;text-align:center;}'
    + '#ddt-doc .art-table td.c-qta{width:6%;text-align:center;}'
    + '#ddt-doc .art-table td.c-prz{width:14%;text-align:right;}'
    + '#ddt-doc .art-table td.c-tot{width:15%;text-align:right;}'
    + '#ddt-doc .art-table th.c-cod{width:17%;}'
    + '#ddt-doc .art-table th.c-desc{width:42%;}'
    + '#ddt-doc .art-table th.c-um{width:6%;}'
    + '#ddt-doc .art-table th.c-qta{width:6%;}'
    + '#ddt-doc .art-table th.c-prz{width:14%;}'
    + '#ddt-doc .art-table th.c-tot{width:15%;}'

    + '#ddt-doc .totale-bar{display:flex;justify-content:flex-end;border:1.5px solid #000;border-top:none;}'
    + '#ddt-doc .totale-inner{padding:4px 8px;font-size:9px;font-weight:bold;display:flex;align-items:center;gap:6px;}'
    + '#ddt-doc .totale-val{display:inline-block;min-width:80px;border-bottom:1px solid #000;text-align:right;padding-right:4px;font-weight:900;}'

    + '#ddt-doc .footer-row{display:flex;border:1.5px solid #000;border-top:none;}'
    + '#ddt-doc .fc{flex:1;padding:4px 6px;border-right:1.5px solid #000;font-size:7.5px;min-height:33px;}'
    + '#ddt-doc .fc:last-child{border-right:none;}'
    + '#ddt-doc .fc-lbl{font-weight:bold;font-size:7px;text-transform:uppercase;display:block;margin-bottom:5px;}'
    + '#ddt-doc .annotazioni{border:1.5px solid #000;border-top:none;padding:3px 6px;min-height:20px;font-size:7.5px;}'
    + '#ddt-doc .copia{border:1.5px solid #000;border-top:none;text-align:center;font-size:8.5px;font-weight:bold;padding:3px;letter-spacing:1px;}'

    // Stili specifici per la stampa: nasconde la barra strumenti e il banner debug
    + '@media print{'
    +   '@page{size:A4;margin:0;}'
    +   'body{background:#fff !important;margin:0 !important;padding:0 !important;}'
    +   '#ddt-print-bar{display:none !important;}'
    +   '#ddt-debug-banner{display:none !important;}'
    +   '#ddt-print-overlay{position:static !important;background:#fff !important;overflow:visible !important;}'
    +   '#ddt-doc .page{margin:0 auto;box-shadow:none;}'
    + '}';

  // SVG logo RATTAZZI (triplo strato come da template originale)
  var logoSvg = ''
    + '<svg xmlns="http://www.w3.org/2000/svg" width="215" height="44" viewBox="0 0 215 44">'
    +   '<defs><style>.txt-outer{font-family:\'Arial Black\',Arial,sans-serif;font-size:38px;font-weight:900;}</style></defs>'
    +   '<text class="txt-outer" x="2" y="38" fill="#0d1960" stroke="#0d1960" stroke-width="9" stroke-linejoin="round" paint-order="stroke fill">RATTAZZI</text>'
    +   '<text class="txt-outer" x="2" y="38" fill="white" stroke="white" stroke-width="5" stroke-linejoin="round" paint-order="stroke fill">RATTAZZI</text>'
    +   '<text class="txt-outer" x="2" y="38" fill="white" stroke="#0d1960" stroke-width="1.5" stroke-linejoin="round" paint-order="stroke fill">RATTAZZI</text>'
    + '</svg>';

  // Helper per i checkbox del trasporto: renderizza con eventuale spunta
  function cb(checked, label){
    return '<div class="cb-item"><span class="cb">' + (checked ? '&#10003;' : '') + '</span> ' + label + '</div>';
  }

  // Riga "Spett.le" del destinatario: nome cliente in evidenza
  var destNameHtml = nomeCliente
    ? '<div class="dest-name">' + _ddtEsc(nomeCliente) + '</div>'
    : '<div class="dest-name" style="border-bottom:1px solid #000;min-height:14px;">&nbsp;</div>';

  // -------- COSTRUZIONE PAGINA --------
  var html = ''
    + '<style>' + docCss + '</style>'
    + '<div id="ddt-doc"><div class="page">'

    +   '<div class="hdr-top">'
    +     '<div class="hdr-top-left">Cedente</div>'
    +     '<div class="hdr-top-right">'
    +       'Documento di trasporto N.&nbsp;<span class="fl fl-sm" style="text-align:center;font-weight:900;">' + ddtNum + '</span>'
    +       '&nbsp;del&nbsp;<span class="fl fl-md" style="text-align:center;font-weight:700;">' + dataStr + '</span>'
    +     '</div>'
    +   '</div>'

    +   '<div class="hdr-main">'
    +     '<div class="hdr-logo">'
    +       '<div class="logo-svg-wrap">' + logoSvg + '<span class="logo-srl">S.R.L.</span></div>'
    +       '<div class="logo-addr">'
    +         'Via Ettore Piazza, 10 &nbsp;&ndash;&nbsp; 28064 CARPIGNANO SESIA (NO)<br>'
    +         'Tel. 0321.825.145 &nbsp;&ndash;&nbsp; Fax 0321.826.617<br>'
    +         'Cap. Soc. &euro; 116.000 i.v. &nbsp;&nbsp; Cod. Fisc. e P.IVA 00226580030<br>'
    +         'Reg. Imp. e CCIAA Novara 00226580030 &nbsp;&ndash;&nbsp; R.E.A. n. 60368'
    +       '</div>'
    +     '</div>'
    +     '<div class="hdr-dest">'
    +       '<div class="dest-label">Destinatario</div>'
    +       destNameHtml
    +       '<div class="dest-row">Residenza / Sede:&nbsp;<span class="fl fl-xl">' + _ddtEsc(indirizzo) + '</span></div>'
    +       '<div class="dest-row">Luogo di consegna:&nbsp;<span class="fl" style="min-width:112px;">' + _ddtEsc(indirizzo) + '</span></div>'
    +       '<div class="dest-row">P.IVA / C.F.:&nbsp;<span class="fl fl-lg">' + _ddtEsc(piva) + '</span></div>'
    +     '</div>'
    +   '</div>'

    +   '<div class="trasporto">'
    +     '<div class="tc" style="flex:1.1;">'
    +       '<span class="tc-title">Resa a / Consegnare a</span>'
    +       '<div class="cb-row">' + cb(true,'Consegnare') + cb(false,'Vettore') + '</div>'
    +     '</div>'
    +     '<div class="tc" style="flex:1.8;">'
    +       '<span class="tc-title">Causale del trasporto</span>'
    +       '<div class="cb-row">' + cb(true,'Vendita') + cb(false,'C/Lavoraz.') + cb(false,'Reso') + cb(false,'Omaggio') + '</div>'
    +     '</div>'
    +     '<div class="tc" style="flex:1.2;">'
    +       '<span class="tc-title">Aspetto dei beni</span>'
    +       '<span class="fl fl-lg" style="display:block;margin-top:3px;"></span>'
    +     '</div>'
    +     '<div class="tc" style="flex:1.3;">'
    +       '<span class="tc-title">Inizio trasporto e consegna</span>'
    +       '<div style="margin-top:3px;">Data:&nbsp;<span class="fl fl-sm" style="text-align:center;">' + dataStr + '</span></div>'
    +     '</div>'
    +     '<div class="tc" style="flex:0.6;">'
    +       '<span class="tc-title">Ora</span>'
    +       '<span class="fl fl-sm" style="display:block;margin-top:3px;text-align:center;">' + oraStr + '</span>'
    +     '</div>'
    +     '<div class="tc" style="flex:1;">'
    +       '<span class="tc-title">Pagamento</span>'
    +       '<span class="fl fl-lg" style="display:block;margin-top:3px;"></span>'
    +     '</div>'
    +   '</div>'

    +   '<table class="art-table">'
    +     '<thead><tr>'
    +       '<th class="c-cod">Codice</th>'
    +       '<th class="c-desc">Descrizione</th>'
    +       '<th class="c-um">U.M.</th>'
    +       '<th class="c-qta">Qt&agrave;</th>'
    +       '<th class="c-prz">Prezzo unit.<br>imponibile &euro;</th>'
    +       '<th class="c-tot">Totale<br>imponibile &euro;</th>'
    +     '</tr></thead>'
    +     '<tbody>' + righeHTML + '</tbody>'
    +   '</table>'

    +   '<div class="totale-bar">'
    +     '<div class="totale-inner">'
    +       'Totale documento imponibile &euro;:&nbsp;<span class="totale-val">' + _ddtFmtImp(totaleImp) + '</span>'
    +     '</div>'
    +   '</div>'

    +   '<div class="footer-row">'
    +     '<div class="fc" style="flex:2;"><span class="fc-lbl">Vettore</span><span class="fl fl-xl"></span></div>'
    +     '<div class="fc" style="flex:0.7;"><span class="fc-lbl">N. Colli</span><span class="fl fl-sm"></span></div>'
    +     '<div class="fc" style="flex:0.7;"><span class="fc-lbl">Kg</span><span class="fl fl-sm"></span></div>'
    +     '<div class="fc" style="flex:2;"><span class="fc-lbl">Firma Vettore</span></div>'
    +   '</div>'

    +   '<div class="footer-row">'
    +     '<div class="fc" style="flex:1;"><span class="fc-lbl">Firma ricevimento</span></div>'
    +     '<div class="fc" style="flex:1;"><span class="fc-lbl">Firma conducente</span></div>'
    +   '</div>'

    +   '<div class="annotazioni">'
    +     '<span style="font-weight:bold;font-size:7px;text-transform:uppercase;">Annotazioni</span>'
    +     (nota ? '<div style="margin-top:2px;font-size:8px;">' + _ddtEsc(nota) + '</div>' : '')
    +   '</div>'

    +   '<div class="copia">COPIA PER CEDENTE</div>'

    + '</div></div>';

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
    +   '<button onclick="window.print()" style="padding:10px 24px;border-radius:8px;border:none;background:#3182ce;color:#fff;font-size:14px;font-weight:800;cursor:pointer;">🖨️ Stampa DDT</button>'
    +   '<button onclick="chiudiDDT()" style="padding:10px 18px;border-radius:8px;border:1px solid #555;background:transparent;color:#fff;font-size:13px;cursor:pointer;">✖ Chiudi</button>'
    +   '<span style="color:#aaa;font-size:12px;margin-left:8px;">DDT N.' + ddtNum + ' - ' + _ddtEsc(nomeCliente || '—') + '</span>'
    + '</div>'
    + '<div id="ddt-debug-banner" style="background:#16a34a;color:#fff;text-align:center;font-weight:900;font-size:18px;padding:10px;letter-spacing:2px;">✅ NUOVO TEMPLATE DDT ATTIVO</div>'
    + '<div style="padding:15px 0;">' + html + '</div>';
  ov.style.display = 'block';
  document.body.style.overflow = 'hidden';
  showToastGen('green','- DDT N.' + ddtNum + ' - premi Stampa');
}

function chiudiDDT(){
  var ov = document.getElementById('ddt-print-overlay');
  if(ov) ov.style.display = 'none';
  document.body.style.overflow = '';
}
