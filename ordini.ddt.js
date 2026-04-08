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

  var nomeCliente = cart.nome || '-';
  var indirizzo = cart.indirizzo || '';
  var piva = cart.piva || '';
  var nota = cart.nota || '';

  // Calcola totale
  var totale = 0;
  var righeHTML = '';
  (cart.items||[]).forEach(function(it, idx){
    var pu =  parsePriceIT(it.prezzoUnit);
    var qty = parseFloat(it.qty || 1);
    var sub = (pu * qty).toFixed(2);
    totale += pu * qty;
    var codice = it.codM || it.codF || '';
    var unit = it.unit || 'pz';
    righeHTML += '<tr>' +
      '<td style="padding:6px 8px;border:1px solid #999;font-size:11px;">' + esc(codice) + '</td>' +
      '<td style="padding:6px 8px;border:1px solid #999;font-size:11px;">' + esc(it.desc || '') + (it.specs ? '<br><i style="color:#666;font-size:10px;">' + esc(it.specs) + '</i>' : '') + '</td>' +
      '<td style="padding:6px 8px;border:1px solid #999;font-size:11px;text-align:center;">' + esc(unit) + '</td>' +
      '<td style="padding:6px 8px;border:1px solid #999;font-size:11px;text-align:center;font-weight:700;">' + qty + '</td>' +
      '<td style="padding:6px 8px;border:1px solid #999;font-size:11px;text-align:right;">&euro; ' + pu.toFixed(2) + '</td>' +
      '<td style="padding:6px 8px;border:1px solid #999;font-size:11px;text-align:right;font-weight:700;">&euro; ' + sub + '</td>' +
      '</tr>';
  });

  // Righe vuote per completare il modulo (minimo 15 righe visibili)
  var minRighe = 15;
  for(var r = (cart.items||[]).length; r < minRighe; r++){
    righeHTML += '<tr>' +
      '<td style="padding:6px 8px;border:1px solid #999;">&nbsp;</td>' +
      '<td style="padding:6px 8px;border:1px solid #999;">&nbsp;</td>' +
      '<td style="padding:6px 8px;border:1px solid #999;">&nbsp;</td>' +
      '<td style="padding:6px 8px;border:1px solid #999;">&nbsp;</td>' +
      '<td style="padding:6px 8px;border:1px solid #999;">&nbsp;</td>' +
      '<td style="padding:6px 8px;border:1px solid #999;">&nbsp;</td>' +
      '</tr>';
  }

  var html = '';
  // Stili inline nel contenuto
  html += '<style>';
  html += 'body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:12mm 15mm;font-size:11px;color:#111;}';
  html += '@media print{@page{size:A4 portrait;margin:10mm 12mm;}body{padding:0;}}';
  html += 'table{width:100%;border-collapse:collapse;}';
  html += '.header{display:flex;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #111;}';
  html += '.cedente{font-size:12px;line-height:1.5;}';
  html += '.cedente b{font-size:16px;letter-spacing:1px;}';
  html += '.ddt-info{text-align:right;font-size:12px;}';
  html += '.ddt-info .num{font-size:20px;font-weight:900;}';
  html += '.client-box{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;padding:10px;border:1px solid #999;border-radius:4px;}';
  html += '.client-box .label{font-size:9px;text-transform:uppercase;color:#666;margin-bottom:2px;}';
  html += '.client-box .value{font-size:12px;font-weight:600;min-height:16px;}';
  html += '.transport-row{display:flex;justify-content:space-between;margin-bottom:12px;padding:6px 10px;border:1px solid #999;border-radius:4px;font-size:10px;}';
  html += 'th{background:#e8e8e8;padding:6px 8px;border:1px solid #999;font-size:10px;text-transform:uppercase;font-weight:700;}';
  html += '.totale-row{text-align:right;padding:10px 0;font-size:14px;font-weight:900;}';
  html += '.footer{margin-top:20px;display:flex;justify-content:space-between;font-size:10px;color:#555;}';
  html += '.firma-box{border-top:1px solid #999;width:180px;text-align:center;padding-top:4px;margin-top:40px;}';
  html += '.note-box{margin-top:10px;padding:8px;border:1px solid #ccc;border-radius:4px;font-size:10px;color:#444;min-height:30px;}';
  html += '</style>';

  // -- HEADER --
  html += '<div class="header">';
  html += '<div class="cedente">';
  html += '<b>RATTAZZI</b> S.R.L.<br>';
  html += 'Via Ettore Piazza, 10<br>';
  html += '28064 CARPIGNANO SESIA (NO)<br>';
  html += 'Tel. 0321.825.145 - Fax 0321.825.917<br>';
  html += '<span style="font-size:10px;color:#555;">Cap. Soc. &euro; 116.000 i.v. &middot; Cod Fisc. e P.IVA 00093600039<br>Reg. Imprese Novara 00093600039 &middot; R.E.A. n. 89056</span>';
  html += '</div>';
  html += '<div class="ddt-info">';
  html += '<div style="font-size:11px;color:#555;">Documento di trasporto</div>';
  html += '<div class="num">N. ' + ddtNum + '</div>';
  html += '<div style="margin-top:6px;">del <b>' + dataStr + '</b></div>';
  html += '</div>';
  html += '</div>';

  // -- DATI CLIENTE --
  html += '<div class="client-box">';
  html += '<div><div class="label">Spett.le Ditta</div><div class="value">' + esc(nomeCliente) + '</div></div>';
  html += '<div><div class="label">P.IVA / Cod. Fiscale</div><div class="value">' + esc(piva) + '</div></div>';
  html += '<div style="grid-column:1/-1;"><div class="label">Residenza o domicilio</div><div class="value">' + esc(indirizzo) + '</div></div>';
  html += '</div>';

  // -- TRASPORTO --
  html += '<div class="transport-row">';
  html += '<div><span style="color:#666;">Trasporto a cura del:</span> <b>- Cedente</b> &nbsp; - Cessionario &nbsp; - Vettore</div>';
  html += '<div><span style="color:#666;">Causale:</span> <b>- Vendita</b></div>';
  html += '<div><span style="color:#666;">Data:</span> <b>' + dataStr + '</b> &nbsp; <span style="color:#666;">Ora:</span> <b>' + oraStr + '</b></div>';
  html += '</div>';

  // -- TABELLA ARTICOLI --
  html += '<table>';
  html += '<thead><tr>';
  html += '<th style="width:90px;">Codice</th>';
  html += '<th>Descrizione dei beni (Natura - Qualit&agrave;)</th>';
  html += '<th style="width:40px;">U.M.</th>';
  html += '<th style="width:55px;">Quantit&agrave;</th>';
  html += '<th style="width:70px;">Prezzo Unit.</th>';
  html += '<th style="width:75px;">Importo</th>';
  html += '</tr></thead>';
  html += '<tbody>' + righeHTML + '</tbody>';
  html += '</table>';

  // -- TOTALE --
  html += '<div class="totale-row">TOTALE: &euro; ' + totale.toFixed(2) + '</div>';

  // -- NOTE --
  if(nota){
    html += '<div class="note-box"><b>Note:</b> ' + esc(nota) + '</div>';
  }

  // -- FIRME --
  html += '<div class="footer">';
  html += '<div><div class="firma-box">Firma del cedente</div></div>';
  html += '<div><div class="firma-box">Firma del cessionario</div></div>';
  html += '<div><div class="firma-box">Firma del vettore</div></div>';
  html += '</div>';

  html += '<div style="text-align:center;margin-top:12px;font-size:8px;color:#aaa;">Documento generato da Gestionale Rattazzi &mdash; ' + dataStr + ' ' + oraStr + '</div>';
  

  // Mostra overlay DDT per stampa (no popup)
  var ov = document.getElementById('ddt-print-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'ddt-print-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#fff;overflow-y:auto;display:none;';
    document.body.appendChild(ov);
  }
  ov.innerHTML = '<div style="padding:8px;background:#333;display:flex;gap:8px;align-items:center;position:sticky;top:0;z-index:1;">' +
    '<button onclick="window.print()" style="padding:10px 24px;border-radius:8px;border:none;background:#3182ce;color:#fff;font-size:14px;font-weight:800;cursor:pointer;">-- Stampa DDT</button>' +
    '<button onclick="chiudiDDT()" style="padding:10px 18px;border-radius:8px;border:1px solid #555;background:transparent;color:#fff;font-size:13px;cursor:pointer;">- Chiudi</button>' +
    '<span style="color:#aaa;font-size:12px;margin-left:8px;">DDT N.' + ddtNum + ' - ' + esc(nomeCliente) + '</span>' +
    '</div>' +
    '<div id="ddt-content" style="padding:12mm 15mm;max-width:210mm;margin:0 auto;background:#fff;">' + html + '</div>';
  ov.style.display = 'block';
  document.body.style.overflow = 'hidden';
  showToastGen('green','- DDT N.' + ddtNum + ' - premi Stampa');
}

function chiudiDDT(){
  var ov = document.getElementById('ddt-print-overlay');
  if(ov) ov.style.display = 'none';
  document.body.style.overflow = '';
}
