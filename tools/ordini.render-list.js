// ordini.render-list.js - estratto da ordini.js

// [SECTION: ORDINI] --------------------------------------------------------
//  Render lista ordini, filtri, dettaglio ordine, vista cassa
function renderOrdini(){
  var list=document.getElementById('ord-list');if(!list)return;
  var isDesktop=window.matchMedia('(min-width: 769px)').matches;
  updateOrdCounter();
  _updateBozzaBadge();
  var searchVal=(document.getElementById('ord-search')||{}).value||'';
  var searchLow=searchVal.trim().toLowerCase();

  // Fonte unica: ordini[] arriva dal realtime Firebase (niente merge locale)

  // Bozze incluse nel flusso normale (filtro "nuovo" o "tutti")
  var filtered = ordini.filter(function(o){
    if(o.stato==='bozza'){
      // Le bozze appaiono solo in "nuovo" e "tutti"
      if(ordFiltro!=='nuovo' && ordFiltro!=='tutti') return false;
    } else {
      var statoNorm = (o.stato==='lavorazione') ? 'nuovo' : o.stato;
      if(ordFiltro!=='tutti' && statoNorm!==ordFiltro) return false;
    }
    if(!searchLow) return true;
    var hay=(o.nomeCliente||'');
    (o.items||[]).forEach(function(it){hay+=' '+(it.desc||'')+' '+(it.codF||'')+' '+(it.codM||'');});
    return hay.toLowerCase().indexOf(searchLow)>=0;
  });

  filtered.sort(function(a,b){return(b.createdAt||'').localeCompare(a.createdAt||'');});

  if(!filtered.length){
    list.innerHTML='<div style="text-align:center;padding:60px 20px;color:#444;"><div style="font-size:40px;margin-bottom:8px;">📋</div>'+(searchLow?'Nessun risultato':'Nessun ordine')+'</div>';
    return;
  }

  var SC={nuovo:'#f5c400',pronto:'#dd6b20',completato:'#38a169'};
  var SL={nuovo:'NUOVO',pronto:'PRONTO',completato:'COMPLETATO'};

  var h='';

  // Raggruppa per data
  var gruppi={},gruppiOrd=[];
  filtered.forEach(function(o){
    var dk=o.data||'—';
    var iso=o.createdAt||'';
    if(iso){
      var d=new Date(iso),oggi=new Date();oggi.setHours(0,0,0,0);
      var ieri=new Date(oggi);ieri.setDate(ieri.getDate()-1);
      var dD=new Date(d);dD.setHours(0,0,0,0);
      if(dD.getTime()===oggi.getTime())dk='OGGI';
      else if(dD.getTime()===ieri.getTime())dk='IERI';
      else dk=d.toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'}).toUpperCase();
    }
    if(!gruppi[dk]){gruppi[dk]=[];gruppiOrd.push(dk);}
    gruppi[dk].push(o);
  });

  // Render ordini raggruppati per data (include bozze nel flusso)
  gruppiOrd.forEach(function(dk){
    // ── SEPARATORE DATA — banda piena ──
    h+='<div class="ord-date-sep">';
    h+='<span class="ord-date-line"></span>';
    h+='<span class="ord-date-label">📅 '+esc(dk)+'</span>';
    h+='<span class="ord-date-line"></span>';
    h+='</div>';

    gruppi[dk].forEach(function(ord,idxInGroup){
      var gi=ordini.indexOf(ord);
      var ost=(ord.stato==='lavorazione') ? 'nuovo' : ord.stato;
      var lockInfo = ordIsLockedByOther(ord.id);
      var nArt=(ord.items||[]).length;
      var tot=ordTotaleSenzaCongelati(ord);

      var isBozza = (ost==='bozza');

      // ── Ex-bozza promossa a ordine: rosso se ancora 'nuovo' ──
      var _isExBozza = !!(ord.promozione);
      var sc = isBozza ? '#3182ce' : ((_isExBozza && ost==='nuovo') ? '#e53e3e' : (SC[ost]||'#555'));

      // ── CARD ORDINE — blocco massiccio con bordo colorato top ──
      var isCompleted = ost==='completato';
      var unlocked = ord.unlocked || false;

      // Non editabile solo se: completato (e non sbloccato) o bloccato da altro account
      var _canEdit = !(isCompleted && !unlocked) && !lockInfo;

      h+='<div class="ord-card'+(isCompleted&&!unlocked?' ord-card--done':'') + (_isExBozza&&ost==='nuovo'?' ord-card--exbozza':'')+'"'+(isBozza?' data-bozza-id="'+ord.id+'"':'')+' style="border-top:4px solid '+sc+';position:relative;" onclick="ordCardTapLock(event,\''+ord.id+'\')">';

      // OVERLAY LOCK - se un altro dispositivo sta lavorando
      if(lockInfo){
        h+='<div class="ord-lock-overlay" onclick="ordDblTap(this,\'force\',\''+ord.id+'\','+gi+')">';
        h+='<div class="ord-lock-msg">';
        h+='<div style="font-size:24px;margin-bottom:6px">🔒</div>';
        h+='<div style="font-size:14px;font-weight:800">IN LAVORAZIONE</div>';
        h+='<div style="font-size:10px;margin-top:8px;color:#666">Triplo tap per forzare</div>';
        h+='</div></div>';
      }

      // ── HEADER: banda colorata con stato ──
      var _bannerLabel = isBozza ? 'In lavorazione' : ((_isExBozza && ost==='nuovo') ? 'ORDINE IN ARRIVO' : SL[ost]);
      var _bannerTextCol = (ost==='nuovo' && !_isExBozza && !isBozza) ? '#111' : '#fff';
      h+='<div class="ord-card-stato" style="background:'+sc+';color:'+_bannerTextCol+'">';
      h+=_bannerLabel;
      if(ord.numero) h+=' — #'+ord.numero;
      if(ord.visto) h+='<span class="ord-visto-ico" title="Visto in ufficio">\uD83D\uDC41\uFE0F</span>';
      if(_isExBozza && ost!=='nuovo' && !isBozza){
        h+=' <span style="font-size:9px;opacity:.85;font-weight:700;letter-spacing:.25px;vertical-align:middle;color:#fca5a5;">ORDINE IN ARRIVO</span>';
      }
      if(ord.modificato){
        var diffTxt = (ord.modificheDiff && ord.modificheDiff.length) ? ord.modificheDiff.join('\\n') : '';
        h+=' <span onclick="event.stopPropagation();ordMostraModifiche(\''+ord.id+'\')" style="background:#553c9a;color:#e9d8fd;font-size:10px;padding:1px 7px;border-radius:8px;letter-spacing:.5px;font-weight:700;vertical-align:middle;cursor:pointer;" title="Vedi modifiche">✏️ MODIFICATO</span>';
      }
      h+='</div>';

      // ── CLIENTE + DATA ──
      h+='<div class="ord-card-cliente">';
      if(_canEdit){
        h+='<div class="ord-cliente-nome" onclick="ordEditCliente('+gi+')" style="cursor:pointer;" title="Tap per modificare">'+esc(ord.nomeCliente||'—')+'</div>';
      } else {
        h+='<div class="ord-cliente-nome">'+esc(ord.nomeCliente||'—')+'</div>';
      }
      h+='<div class="ord-cliente-meta">';
      h+=esc(ord.data||'')+(ord.ora?' · '+ord.ora:'');
      h+=' · '+nArt+' articol'+(nArt===1?'o':'i');
      h+='</div>';
      h+='</div>';

      // ── GRIGLIA ARTICOLI — header ──
      h+='<div class="ord-items-wrap">';
      h+='<div class="ord-grid ord-grid-head">';
      h+='<div class="ord-gh">Prodotto</div>';
      h+='<div class="ord-gh ord-gh-c">Qtà</div>';
      h+='<div class="ord-gh ord-gh-c">Prezzo</div>';
      h+='<div class="ord-gh ord-gh-c">Tot</div>';
      h+='</div>';

      // _canEdit — già calcolato sopra

      var indiciDisplay=(function(){
        var all=ordineIndiciOrdineDisplay(ord);
        var attivi=all.filter(function(ii){ return !ordItemCongelato((ord.items||[])[ii]); }).reverse();
        var congelati=all.filter(function(ii){ return ordItemCongelato((ord.items||[])[ii]); });
        return attivi.concat(congelati);
      })();
      indiciDisplay.forEach(function(ii, stripe){
        var it=ord.items[ii];
        var isFz=ordItemCongelato(it);
        var pu=parsePriceIT(it.prezzoUnit);
        var q=parseFloat(it.qty||0);
        var sub=isFz?'0.00':(pu*q).toFixed(2);
        var promoG = (typeof isPromoGItem === 'function') ? isPromoGItem(it) : false;

        // Calcola se c'è sconto attivo
        var prezOrigNum=0;
        var prezFinNum=pu;
        var hasSconto=false;
        var scOn=it.scampolo||it.fineRotolo||it._scaglionato||false;
        var scagAtt=it._scaglioneAttivo||null;
        if(scagAtt && it._prezzoBase){
          prezOrigNum=parsePriceIT(it._prezzoBase);
          hasSconto=prezOrigNum>prezFinNum+0.005;
        } else if((scOn||(it._scontoApplicato&&it._scontoApplicato>0))&&it._prezzoOriginale){
          prezOrigNum=parsePriceIT(it._prezzoOriginale);
          hasSconto=prezOrigNum>prezFinNum+0.005;
        }

        h+='<div class="ord-grid ord-grid-row'+(stripe%2===0?' ord-grid-even':' ord-grid-odd')+(isFz?' ord-grid-row--congelato':'')+'">';

        // Colonna prodotto: nome + codici sotto (codF editabile con dblclick)
        h+='<div class="ord-gc-desc">';
        h+='<div class="ord-item-name" onclick="openSchedaFromOrdine('+gi+','+ii+')" style="cursor:pointer;">'+esc(it.desc||'\u2014')+'</div>';
        if(isFz) h+='<div class="ord-congelato-badge">Rimosso dal banco</div>';
        var codes='';
        codes+='<div class="ord-item-codes-line">';
        if(it.codM) codes+='<span class="ord-code-mag">'+esc(it.codM)+'</span>';
        codes+='<span class="ord-code-forn'+(_canEdit&&!isFz?' ord-editable':'')+'"'+(_canEdit&&!isFz?' onclick="ordInlineEdit(this,'+gi+','+ii+',\'codF\')" title="Tap per modificare"':'')+'><span class="ord-code-forn-lbl">f.</span> '+esc(it.codF||'—')+'</span>';
        codes+='</div>';
        h+='<div class="ord-item-codes">'+codes+'</div>';
        if(it.nota) h+='<div class="ord-item-nota">📝 '+esc(it.nota)+'</div>';
        if(it.daOrdinare) h+='<div class="ord-item-daord">🚚 DA ORDINARE</div>';
        h+='</div>';

        // Quantità + unità + (opz.) prezzo base compatto
        h+='<div class="ord-gc-qty'+(_canEdit&&!isFz?' ord-editable':'')+'"'+(_canEdit&&!isFz?' onclick="ordInlineEdit(this,'+gi+','+ii+',\'qty\')" title="Tap per modificare"':'')+' style="display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;">';
        h+='<div style="display:flex;align-items:center;flex-wrap:wrap;gap:2px;">'+q;
        if(_canEdit&&!isFz){
          h+='<select class="ord-unit-select" onclick="event.stopPropagation()" onchange="ordSetUnit('+gi+','+ii+',this.value)">';
          var units=['pz','mt','m','kg','lt','cf','ml','gr','mm','cm','m\xB2','m\xB3'];
          units.forEach(function(u){ h+='<option value="'+u+'"'+(u===(it.unit||'pz')?' selected':'')+'>'+u+'</option>'; });
          h+='</select>';
        } else {
          h+='<span class="ord-unit">'+esc(it.unit||'pz')+'</span>';
        }
        h+='</div>';
        if(itemUsesPrezzoPerBaseUm(it.unit) && !isFz && _canEdit){
          var bdO=itemBaseUmScontoDisplay(it);
          var suffO=itemPrezzoBaseUmSuffix(it.unit);
          h+='<div class="ct-pb-inline" id="ord-pb-'+ord.id+'-'+ii+'" onclick="event.stopPropagation()">';
          h+='<span class="ct-pb-tag" title="Prezzo listino '+esc(suffO)+'">Base</span>';
          h+='<input type="text" class="ct-pb-inp" inputmode="decimal" ';
          h+='value="'+esc(it._prezzoUnitaBase||'')+'" placeholder="—" ';
          h+='oninput="ordInputPrezzoUnitaBase('+gi+','+ii+',this)" ';
          h+='onclick="event.stopPropagation();this.select()" />';
          h+='<span class="ct-pb-disc" id="ord-pb-disc-'+ord.id+'-'+ii+'">';
          if(bdO && bdO.hasSc){
            h+='<span class="ct-pb-struck">€'+formatPrezzoUnitDisplay(bdO.b0)+'</span>';
            h+='<span class="ct-pb-final">€'+formatPrezzoUnitDisplay(bdO.b1)+'</span>';
            h+='<span class="ct-pb-sav">-€'+formatPrezzoUnitDisplay(bdO.savPerBase)+'</span>';
          }
          h+='</span></div>';
        }
        h+='</div>';

        // Prezzo unitario — listino/sconto convertito (tap = edit)
        h+='<div class="ord-gc-price'+(_canEdit?' ord-editable':'')+'"'+(_canEdit?' onclick="ordInlineEdit(this,'+gi+','+ii+',\'price\')" title="Tap per modificare"':'')+'>';
        h+='<div id="ord-prz-strip-'+ord.id+'-'+ii+'">';
        if(isFz){
          h+='<span style="color:#888;">€'+formatPrezzoUnitDisplay(pu)+'</span>';
        } else if(hasSconto){
          h+=htmlPrezzoUnitScontoRiga(prezOrigNum, pu);
        } else {
          h+='<span class="ct-prz-single">€'+formatPrezzoUnitDisplay(pu)+'</span>';
        }
        if(promoG && typeof htmlPromoGBadge === 'function'){
          h+=htmlPromoGBadge();
        }
        h+='</div></div>';

        // Subtotale — con sconto sbarrato se presente
        h+='<div class="ord-gc-sub" id="ord-sub-'+ord.id+'-'+ii+'">';
        if(isFz){
          h+='<span style="font-size:12px;color:#666;font-weight:700;">—</span>';
        } else if(hasSconto){
          h+=htmlTotaleScontoRiga(prezOrigNum * q, parseFloat(sub));
        } else {
          h+='€'+sub;
        }
        h+='</div>'; // fine ord-gc-sub
        h+='</div>'; // fine ord-grid-row

        // Mini azioni articolo — forbici + nota (fuori dalla griglia, div separato)
        var scOn2 = it.scampolo||it.fineRotolo||it._scaglionato||false;
        var hasNota2 = !!(it.nota && it.nota.trim());
        var sc2 = it._scontoApplicato||0;
        var actClass = it._scaglionato ? 'ord-actions-scaglionato' : (it._tuttoRotolo||it.fineRotolo ? 'ord-actions-rotolo' : (it.scampolo ? 'ord-actions-scampolo' : ''));
        if(_canEdit&&!isFz){
          h+='<div class="ord-item-actions '+ actClass +'" style="display:flex;gap:4px;align-items:center;padding:2px 8px;">';
          // Forbici — ciclo: OFF→SCA→ROT→SCAG→OFF
          var forbLbl2 = '';
          if(it._scaglionato){
            forbLbl2 = isDesktop ? 'SCAGLIONI' : 'SCAG';
          } else if(it._tuttoRotolo || (scOn2 && it.fineRotolo)){
            forbLbl2 = isDesktop ? 'ROTOLO' : 'ROT';
          } else if(scOn2){
            forbLbl2 = isDesktop ? 'SCAMPOLO' : 'SCA';
          }
          var forbColor = it._scaglionato ? 'color:#63b3ed;border-color:#63b3ed44;background:#08082a;' : (scOn2||it._tuttoRotolo ? '' : '');
          h+='<button class="ord-mini-btn'+(scOn2||it._tuttoRotolo?' ord-mini-on':'')+'" style="'+forbColor+'" onclick="ordToggleScampolo('+gi+','+ii+')" title="Scampolo/Rotolo/Scaglionato">';
          h+='✂'+(forbLbl2?' '+forbLbl2:'')+'</button>';
          // % sconto inline
          if(scOn2||it._tuttoRotolo||it._scaglionato){
            h+='<input type="number" min="0" max="100" value="'+(sc2||'')+'" placeholder="%" class="ord-mini-pct" onchange="ordSetSconto('+gi+','+ii+',this.value)" onclick="event.stopPropagation();this.select()">';
            h+='<span style="font-size:9px;color:'+(it._scaglionato?'#63b3ed':'#68d391')+'">%</span>';
          }
          // Quantità minima scaglione
          if(it._scaglionato){
            h+='<span style="font-size:9px;color:#63b3ed;">da</span>';
            h+='<input type="number" min="1" value="'+(it._scaglioneQta||10)+'" placeholder="qty" class="ord-mini-pct" style="color:#63b3ed;border-color:#63b3ed44;" onchange="ordSetScaglioneQta('+gi+','+ii+',this.value)" onclick="event.stopPropagation();this.select()">';
            h+='<span style="font-size:9px;color:#63b3ed;">pz</span>';
          }
          // Nota articolo
          h+='<button class="ord-mini-btn'+(hasNota2?' ord-mini-on':'')+'" onclick="ordEditNota('+gi+','+ii+')" title="Nota" style="margin-left:auto">📝</button>';
          h+='<span class="ord-item-del" onclick="event.stopPropagation();ordDelItem(this,'+gi+','+ii+')" title="Rimuovi articolo">×</span>';
          h+='</div>';
        } else if(_canEdit&&isFz){
          h+='<div class="ord-item-actions" style="display:flex;gap:4px;align-items:center;padding:2px 8px;justify-content:flex-end;">';
          h+='<span class="ord-item-del" onclick="event.stopPropagation();ordDelItem(this,'+gi+','+ii+')" title="Elimina dalla bozza">×</span>';
          h+='</div>';
        } else if(hasNota2||scOn2){
          h+='<div style="padding:1px 8px;font-size:9px;color:#666;">';
          if(it._scaglionato&&sc2) h+='<span style="color:#63b3ed;">📦 Scaglionato -'+sc2+'% da '+(it._scaglioneQta||10)+'pz</span> ';
          else if(scOn2&&sc2) h+='<span>✂ -'+sc2+'%</span> ';
          if(hasNota2) h+='<span>📝 '+esc(it.nota)+'</span>';
          h+='</div>';
        }

      });

      h+='</div>';

      // Nota ordine — editabile se sbloccato, gialla fissa se bloccato
      if(_canEdit){
        h+='<div class="ord-nota-edit" style="padding:4px 12px;">';
        h+='<input type="text" class="ord-nota-input" value="'+esc(ord.nota||'')+'" placeholder="📋 Nota ordine..." onchange="ordSetNotaOrdine('+gi+',this.value)" onclick="event.stopPropagation()">';
        h+='</div>';
      } else if(ord.nota){
        h+='<div style="padding:6px 12px;font-size:13px;color:var(--accent);font-weight:700;white-space:pre-wrap;word-break:break-word;">📋 '+esc(ord.nota)+'</div>';
      }

      // ── TOTALE ORDINE — grande e visibile ──
      h+='<div class="ord-total-bar">';
      h+='<span class="ord-total-label">TOTALE</span>';
      h+='<span class="ord-total-value" id="ord-total-'+ord.id+'">€ '+tot.toFixed(2)+'</span>';
      h+='</div>';

      // ── AZIONI ──
      if(isCompleted && !unlocked){
        // Completato e bloccato: solo Sblocca, Stampa, Elimina
        h+='<div class="ord-actions">';
        h+='<button onclick="ordSbloccaFatto('+gi+')" class="ord-abtn ord-abtn--reopen">🔓 Sblocca</button>';
        h+='<button onclick="ordStampaDblTap(this,'+gi+')" class="ord-abtn ord-abtn--print">🖨️ Stampa</button>';
        h+='<button onclick="deleteOrdine('+gi+')" class="ord-abtn ord-abtn--del">🗑️ Elimina</button>';
        h+='</div>';
      } else {
        h+='<div class="ord-actions">';
        if(!isCompleted){
          h+='<button onclick="setStatoOrdine('+gi+',\'completato\')" class="ord-abtn ord-abtn--done">✅ Fatto</button>';
        } else {
          h+='<button onclick="ordRibloccaFatto('+gi+')" class="ord-abtn ord-abtn--done">🔒 Blocca</button>';
          h+='<button onclick="setStatoOrdine('+gi+',\'nuovo\')" class="ord-abtn ord-abtn--reopen">↩️ Riapri</button>';
        }
        h+='<button onclick="openCassa('+gi+')" class="ord-abtn ord-abtn--cassa">💰 Cassa</button>';
        h+='</div>';
        h+='<div class="ord-actions ord-actions-sec">';
        h+='<button onclick="ordStampaDblTap(this,'+gi+')" class="ord-abtn ord-abtn--print">🖨️ Stampa</button>';
        if(ost!=='pronto') h+='<button onclick="setStatoOrdine('+gi+',\'pronto\')" class="ord-abtn ord-abtn--ready">📦 Pronto</button>';
        h+='<button onclick="deleteOrdine('+gi+')" class="ord-abtn ord-abtn--del">🗑️ Elimina</button>';
        h+='</div>';
      }

      h+='</div>'; // fine ord-card

      // ── SPACER tra ordini — grande, con linea decorativa ──
      h+='<div class="ord-spacer"><div class="ord-spacer-line"></div></div>';
    });
  });

  list.innerHTML=h;
}

if(typeof window!=='undefined' && !window.__ORD_SYNC_ORDERS_BOUND__){
  window.__ORD_SYNC_ORDERS_BOUND__ = true;
  window.addEventListener('sync-orders', function(){
    if(typeof renderOrdini==='function') renderOrdini();
  });
}
if(typeof window!=='undefined' && !window.__ORD_DB_CHANGED_BOUND__){
  window.__ORD_DB_CHANGED_BOUND__ = true;
  window.addEventListener('db-changed', function(){
    if(typeof renderOrdini==='function') renderOrdini();
  });
}
