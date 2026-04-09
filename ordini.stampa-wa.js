// ordini.stampa-wa.js - estratto da ordini.js

function ordStampaDblTap(btn, gi){
  if(_stampaDblGi === gi){
    // SECONDO TAP → WhatsApp
    clearTimeout(_stampaDblTimer);
    _stampaDblGi = null;
    btn.textContent = '🖨️ Stampa';
    btn.style.background = '';
    ordInviaWhatsApp(gi);
  } else {
    // PRIMO TAP → Stampa ricevuta
    if(_stampaDblTimer) clearTimeout(_stampaDblTimer);
    _stampaDblGi = gi;
    var ord = ordini[gi];
    if(ord) stampaRicevutaConSconti(ord);
    btn.textContent = '📱 WhatsApp?';
    btn.style.background = '#25d366';
    _stampaDblTimer = setTimeout(function(){
      _stampaDblGi = null;
      btn.textContent = '🖨️ Stampa';
      btn.style.background = '';
    }, 3000);
  }
}

// ── Ricevuta con sconti dettagliati ──────────────────────────────
function stampaRicevutaConSconti(ord){
  var items = ord.items || [];
  var h = '';
  h += '<div style="font-size:16px;font-weight:900;text-align:center;margin-bottom:4px;">FERRAMENTA RATTAZZI</div>';
  h += '<div style="font-size:10px;text-align:center;color:#666;margin-bottom:8px;">' + new Date().toLocaleString('it-IT') + '</div>';
  if(ord.nomeCliente) h += '<div style="font-size:13px;font-weight:700;text-align:center;margin-bottom:8px;">Cliente: ' + esc(ord.nomeCliente) + '</div>';
  if(ord.numero) h += '<div style="font-size:11px;text-align:center;color:#888;margin-bottom:6px;">Ordine #' + ord.numero + '</div>';
  h += '<div style="border-top:1px dashed #555;margin:6px 0;"></div>';

  var totaleRisparmio = 0;

  items.forEach(function(it){
    if(ordItemCongelato(it)) return;
    var pu = parsePriceIT(it.prezzoUnit);
    var q = parseFloat(it.qty || 0);
    var sub = (pu * q).toFixed(2);

    // Calcola prezzo originale e sconto
    var prezOrig = 0;
    var hasSconto = false;
    var scPct = 0;
    if(it._scontoApplicato && it._scontoApplicato > 0 && it._prezzoOriginale){
      prezOrig = parsePriceIT(it._prezzoOriginale);
      hasSconto = prezOrig > pu + 0.005;
      scPct = it._scontoApplicato;
    } else if(it._scaglioneAttivo && it._prezzoBase){
      prezOrig = parsePriceIT(it._prezzoBase);
      hasSconto = prezOrig > pu + 0.005;
      scPct = it._scaglioneAttivo.sconto || 0;
    }

    h += '<div style="padding:4px 0;border-bottom:1px solid #2a2a2a;">';
    h += '<div style="font-size:13px;font-weight:700;color:var(--text);">' + esc(it.desc || '') + '</div>';

    if(hasSconto){
      var savUnit = (prezOrig - pu).toFixed(2);
      var savTot = ((prezOrig - pu) * q).toFixed(2);
      totaleRisparmio += (prezOrig - pu) * q;

      var tipoSc = it.scampolo ? 'Scampolo' : (it.fineRotolo ? 'Rotolo' : 'Sconto');
      h += '<div style="font-size:10px;color:#f6ad55;font-weight:700;">' + tipoSc + ' -' + scPct + '%</div>';
      h += '<div style="display:flex;justify-content:space-between;font-size:11px;color:#888;">';
      h += '<span>' + q + ' ' + (it.unit || 'pz') + '</span>';
      h += '<span style="text-decoration:line-through;">€' + prezOrig.toFixed(2) + '</span>';
      h += '<span style="color:var(--accent);font-weight:900;">€' + pu.toFixed(2) + '</span>';
      h += '<span style="color:#f6ad55;">-€' + savUnit + '</span>';
      h += '</div>';
      h += '<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:900;color:var(--accent);">';
      h += '<span>Totale</span>';
      h += '<span style="text-decoration:line-through;color:#888;font-weight:600;">€' + (prezOrig * q).toFixed(2) + '</span>';
      h += '<span>€' + sub + '</span>';
      h += '<span style="color:#f6ad55;">-€' + savTot + '</span>';
      h += '</div>';
    } else {
      h += '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);">';
      h += '<span>' + q + ' ' + (it.unit || 'pz') + ' × €' + pu.toFixed(2) + '</span>';
      h += '<span style="font-weight:900;color:var(--accent);">€' + sub + '</span>';
      h += '</div>';
    }

    if(it.nota) h += '<div style="font-size:10px;color:var(--accent);font-style:italic;">📝 ' + esc(it.nota) + '</div>';
    h += '</div>';
  });

  h += '<div style="border-top:1px dashed #555;margin:6px 0;"></div>';
  h += '<div style="display:flex;justify-content:space-between;font-size:18px;font-weight:900;color:var(--accent);padding:4px 0;">';
  h += '<span>TOTALE</span><span>€ ' + (ord.totale || '0.00') + '</span></div>';

  if(totaleRisparmio > 0.01){
    h += '<div style="text-align:center;font-size:12px;color:#f6ad55;font-weight:800;padding:4px 0;">Risparmi: -€' + totaleRisparmio.toFixed(2) + '</div>';
  }

  if(ord.nota) h += '<div style="border-top:1px dashed #555;margin:6px 0;"></div><div style="font-size:11px;color:#666;font-style:italic;">' + esc(ord.nota) + '</div>';

  var ov = document.getElementById('ricevuta-overlay');
  document.getElementById('ricevuta-body').innerHTML = h;
  ov.classList.add('open');
}

// ── Invia ordine via WhatsApp ────────────────────────────────────
function ordInviaWhatsApp(gi){
  var ord = ordini[gi];
  if(!ord) return;
  var items = ord.items || [];

  var msg = '*FERRAMENTA RATTAZZI*\n';
  msg += '📋 Ordine' + (ord.numero ? ' #' + ord.numero : '') + '\n';
  msg += '👤 ' + (ord.nomeCliente || '—') + '\n';
  msg += '📅 ' + (ord.data || '') + ' ' + (ord.ora || '') + '\n';
  msg += '─────────────\n';

  var totaleRisparmio = 0;

  items.forEach(function(it){
    if(ordItemCongelato(it)) return;
    var pu = parsePriceIT(it.prezzoUnit);
    var q = parseFloat(it.qty || 0);
    var sub = (pu * q).toFixed(2);

    var prezOrig = 0;
    var hasSconto = false;
    var scPct = 0;
    if(it._scontoApplicato && it._scontoApplicato > 0 && it._prezzoOriginale){
      prezOrig = parsePriceIT(it._prezzoOriginale);
      hasSconto = prezOrig > pu + 0.005;
      scPct = it._scontoApplicato;
    } else if(it._scaglioneAttivo && it._prezzoBase){
      prezOrig = parsePriceIT(it._prezzoBase);
      hasSconto = prezOrig > pu + 0.005;
      scPct = it._scaglioneAttivo.sconto || 0;
    }

    msg += '• ' + (it.desc || '') + '\n';
    msg += '  ' + q + ' ' + (it.unit || 'pz');

    if(hasSconto){
      var savUnit = (prezOrig - pu).toFixed(2);
      var savTot = ((prezOrig - pu) * q).toFixed(2);
      totaleRisparmio += (prezOrig - pu) * q;
      var tipoSc = it.scampolo ? 'Scampolo' : (it.fineRotolo ? 'Rotolo' : 'Sconto');
      msg += ' × ~€' + prezOrig.toFixed(2) + '~ → *€' + pu.toFixed(2) + '* (' + tipoSc + ' -' + scPct + '%, -€' + savUnit + ')\n';
      msg += '  Totale: ~€' + (prezOrig * q).toFixed(2) + '~ → *€' + sub + '* (-€' + savTot + ')\n';
    } else {
      msg += ' × €' + pu.toFixed(2) + ' = *€' + sub + '*\n';
    }

    if(it.nota) msg += '  📝 ' + it.nota + '\n';
  });

  msg += '─────────────\n';
  msg += '*TOTALE: € ' + (ord.totale || '0.00') + '*\n';

  if(totaleRisparmio > 0.01){
    msg += '💰 _Risparmi: -€' + totaleRisparmio.toFixed(2) + '_\n';
  }

  if(ord.nota) msg += '\n📋 _' + ord.nota + '_';

  // Apri WhatsApp
  var url = 'https://wa.me/?text=' + encodeURIComponent(msg);
  window.open(url, '_blank');
}

// ── Imposta quantità minima per scaglione ────────────────────────
