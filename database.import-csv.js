// database.import-csv.js - estratto da database.js

// [SECTION: IMPORT/CSV] ----------------------------------------------------
//  Importazione CSV/TXT cartellini e magazzino, parser RFC4180, padding codici
function onDrop(e,sezione){
  e.preventDefault();
  var dz=sezione==='magazzino'?document.getElementById('drop-zone-mag'):document.getElementById('drop-zone');
  if(dz)dz.classList.remove('over');
  var f=e.dataTransfer.files[0];
  if(f) readCSV(f,sezione||'cartellini');
}
function onFileIn(e,sezione){
  var f=e.target.files[0];
  if(f) readCSV(f,sezione||'cartellini');
}
var _csvSezione='cartellini'; // traccia quale sezione sta importando
function readCSV(f,sezione){
  _csvSezione=sezione||'cartellini';
  var name=f.name.toLowerCase();
  if(!name.endsWith('.csv')&&!name.endsWith('.txt')){showToastGen('red','-- Carica un file .csv o .txt');return;}
  showToastGen('blue','- Lettura file in corso-');
  var r=new FileReader();
  r.onload=function(ev){
    setTimeout(function(){ parseCSV(ev.target.result); },50);
  };
  // Prova UTF-8, poi fallback ISO-8859-1 (Windows italiani)
  r.onerror=function(){showToastGen('red','- Errore lettura file');};
  r.readAsText(f,'UTF-8');
}

// Parser CSV RFC 4180 robusto: gestisce virgolette, separatori ; e ,
function _parseCSVLine(line, sep){
  var result=[], cur='', inQ=false;
  for(var i=0;i<line.length;i++){
    var c=line[i];
    if(inQ){
      if(c==='"'){
        if(i+1<line.length&&line[i+1]==='"'){cur+='"';i++;}
        else inQ=false;
      } else { cur+=c; }
    } else {
      if(c==='"'){inQ=true;}
      else if(c===sep){result.push(cur.trim());cur='';}
      else {cur+=c;}
    }
  }
  result.push(cur.trim());
  return result;
}
function _padCodF(cod){
  if(!cod)return cod;
  var trimmed=cod.trim();
  // Trova il primo trattino - tutto prima - il prefisso numerico da paddare
  var dashIdx=trimmed.indexOf('-');
  if(dashIdx>=0){
    var prefix=trimmed.slice(0,dashIdx).replace(/^0*/,'');
    var suffix=trimmed.slice(dashIdx+1);
    return prefix.padStart(5,'0')+'-'+suffix;
  }
  // Nessun trattino: se - tutto numerico, padda comunque a 5 cifre
  if(/^\d+$/.test(trimmed)){
    return trimmed.replace(/^0*/,'').padStart(5,'0');
  }
  return trimmed;
}

function parseCSV(text){
  // Normalizza line endings e rimuove BOM UTF-8
  text=text.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  var allLines=text.split('\n');
  // Rileva separatore: punto e virgola o virgola
  var headerRaw=allLines[0]||'';
  var sep=headerRaw.indexOf(';')>=0?';':',';
  var header=headerRaw.toLowerCase();

  // Filtra righe vuote rispettando RFC4180 (virgolette multiriga non supportate nel split)
  var lines=allLines.filter(function(l){return l.trim();});
  if(lines.length<2){showToastGen('red','- File vuoto o non valido');return;}

  // -- Formato pipe | (gestionale inventario) --
  // Riconosce file con righe tipo: |00001|A|0201002|N|*|BTE MA ...|PZ|000000,00|N|
  var firstDataLine = lines.find(function(l){ return l.trim() && !l.startsWith('#'); }) || '';
  if(firstDataLine.trim().startsWith('|') || (firstDataLine.split('|').length > 5)){
    pendingImportDB=[];pendingImportCartellini=[];
    var pipeRows = lines.filter(function(l){ return l.trim() && !l.startsWith('#'); });
    var CHUNK=500, idx=0;
    function processPipeChunk(){
      var end=Math.min(idx+CHUNK, pipeRows.length);
      for(;idx<end;idx++){
        var l=pipeRows[idx].trim();
        if(!l.startsWith('|')) continue;
        // Rimuove il | iniziale e finale, poi splitta
        var parts=l.replace(/^\||\|$/g,'').split('|');
        // Struttura: [0]=indice [1]=tipo [2]=codM [3]=gruppo [4]=carSpec [5]=desc [6]=unit [7]=qty [8]=inventariato
        if(parts.length < 7) continue;
        var codM    = parts[2].trim();
        var desc    = parts[5].replace(/\*/g,'').replace(/\^/g,'').trim();
        var unit    = (parts[6]||'PZ').trim();
        var qtyRaw  = (parts[7]||'0').trim().replace(',','.');
        var qty     = parseFloat(qtyRaw)||0;
        if(!desc && !codM) continue;
        pendingImportDB.push({
          desc: desc,
          codF: '',        // non presente nel file
          codM: codM,
          qty:  qty,
          pa:   '',        // non presente
          pv:   '',        // non presente
          unit: unit,
          giornalino: ''
        });
      }
      if(idx < pipeRows.length){
        showToastGen('blue','- Elaborazione- '+idx+'/'+pipeRows.length);
        setTimeout(processPipeChunk, 10);
      } else {
        _finalizzaImportPipe();
      }
    }
    processPipeChunk();
    return;
  }

  // -- Nuovo formato (con colonna Giornalino) --
  if(header.indexOf('giornalino')>=0){
    var cols=_parseCSVLine(lines[0],sep).map(function(c){return c.toLowerCase().replace(/\s+/g,'');});
    var ci={};cols.forEach(function(c,i){ci[c]=i;});
    var iNome=ci['nomeprodotto']!=null?ci['nomeprodotto']:0;
    var iCodF=ci['codicefornitore']!=null?ci['codicefornitore']:1;
    var iCodM=ci['codicemagazzino']!=null?ci['codicemagazzino']:2;
    var iQty=ci['quantit-']!=null?ci['quantit-']:(ci['quantita']!=null?ci['quantita']:3);
    var iPA=ci['prezzoacquisto']!=null?ci['prezzoacquisto']:4;
    var iPV=ci['prezzovendita']!=null?ci['prezzovendita']:5;
    var iG=ci['giornalino']!=null?ci['giornalino']:6;
    var iUnit=ci['unitamisura']!=null?ci['unitamisura']:(ci['unita']!=null?ci['unita']:-1);

    pendingImportDB=[];pendingImportCartellini=[];
    var dataRows=lines.slice(1);
    // Processing a chunk per non bloccare UI su file grandi
    var CHUNK=500, idx=0;
    function processChunk(){
      var end=Math.min(idx+CHUNK,dataRows.length);
      for(;idx<end;idx++){
        var c=_parseCSVLine(dataRows[idx],sep);
        var nome=(c[iNome]||'').trim();
        if(!nome)continue;
        var codF=_padCodF((c[iCodF]||'').trim());
        var codM=(c[iCodM]||'').trim();
        var qty=parseFloat((c[iQty]||'0').replace(',','.'))||0;
        var pa=(c[iPA]||'').trim().replace(',','.');
        var pv=(c[iPV]||'').trim().replace(',','.');
        var giorn=(c[iG]||'').trim().toLowerCase();
        var unit=(iUnit>=0 && c[iUnit]) ? (c[iUnit]||'').trim().toLowerCase() : '';
        pendingImportDB.push({desc:nome,codF:codF,codM:codM,qty:qty,pa:pa,pv:pv,giornalino:giorn,unit:unit});
        if(giorn==='si'||giorn==='s-'){
          var colonParts=giorn.split(':');
          var coloreGiorn=(colonParts.length>1&&colonParts[1].trim())?colonParts[1].trim():'rosso';
          pendingImportCartellini.push({
            data:new Date().toLocaleDateString('it-IT'),
            desc:nome,codF:codF,codM:codM,
            prezzoOld:'',prezzo:pv||'0',
            note:'',barrato:'no',promo:'no',size:'',
            giornalino:coloreGiorn
          });
        }
      }
      if(idx<dataRows.length){
        showToastGen('blue','- Elaborazione- '+idx+'/'+dataRows.length);
        setTimeout(processChunk,10);
      } else {
        _finalizzaImportNuovo();
      }
    }
    processChunk();
    return;
  }

  // -- Vecchio formato (punto e virgola, solo cartellini) --
  pendingImportDB=null;pendingImportCartellini=null;
  pendingImport=lines.slice(1).map(function(l){
    var c=_parseCSVLine(l,sep);
    var prezzoOld=(c[4]||'').trim();
    return {data:(c[0]||'').trim(),desc:(c[1]||'').trim(),codF:_padCodF((c[2]||'').trim()),codM:(c[3]||'').trim(),prezzoOld:prezzoOld,prezzo:(c[5]||'').trim(),note:(c[6]||'').trim(),barrato:prezzoOld?'si':'no',promo:'no',size:''};
  }).filter(function(r){return r.prezzo;});
  pendingImport.forEach(function(r){if(!r.size) r.size=autoSize(r.prezzo);});
  if(!pendingImport.length){showToastGen('red','- Nessun dato valido');return;}
  var h='<table style="width:100%;border-collapse:collapse;font-size:11px;"><tr style="background:#1e3a5f;color:#fff;"><th style="padding:4px">Data</th><th>Descrizione</th><th>Cod.Forn.</th><th>Mio Cod.</th><th>- Vec.</th><th>- Nuovo</th><th>Note</th></tr>';
  pendingImport.forEach(function(r){h+='<tr style="border-bottom:1px solid #eee"><td style="padding:3px">'+r.data+'</td><td>'+r.desc+'</td><td>'+r.codF+'</td><td>'+r.codM+'</td><td>'+r.prezzoOld+'</td><td><b>'+r.prezzo+'</b></td><td style="color:var(--muted);font-size:10px">'+r.note+'</td></tr>';});
  document.getElementById('imp-wrap').innerHTML=h+'</table>';
  document.getElementById('imp-prev').style.display='block';
}

function _finalizzaImportPipe(){
  if(!pendingImportDB||!pendingImportDB.length){showToastGen('red','- Nessun dato valido nel file');return;}
  var h='<div style="margin-bottom:8px;font-size:12px;color:#68d391;font-weight:700;">- '+pendingImportDB.length+' articoli trovati</div>';
  h+='<div style="font-size:11px;color:#f6ad55;background:#2a1800;border-left:3px solid #f6ad55;padding:6px 10px;border-radius:6px;margin-bottom:8px;">-- Solo giacenze - i prezzi vanno aggiunti manualmente. Gli articoli gi- presenti verranno aggiornati.</div>';
  h+='<table style="width:100%;border-collapse:collapse;font-size:10px;"><tr style="background:#0d2a0d;color:#68d391;"><th style="padding:4px;text-align:left;">Cod. Magazzino</th><th style="text-align:left;">Descrizione</th><th>U.M.</th><th>Giacenza</th></tr>';
  pendingImportDB.slice(0,200).forEach(function(r){
    h+='<tr style="border-bottom:1px solid #1a3a1a;"><td style="padding:3px;color:var(--accent);">'+esc(r.codM)+'</td><td style="color:var(--text);">'+esc(r.desc)+'</td><td style="color:#aaa;text-align:center;">'+esc(r.unit||'PZ')+'</td><td style="color:#68d391;font-weight:700;text-align:center;">'+r.qty+'</td></tr>';
  });
  if(pendingImportDB.length>200) h+='<tr><td colspan="4" style="padding:6px;color:#555;text-align:center;">-e altri '+(pendingImportDB.length-200)+' articoli</td></tr>';
  h+='</table>';
  // Mostra nella sezione magazzino
  document.getElementById('imp-wrap-mag').innerHTML=h;
  document.getElementById('imp-prev-mag').style.display='block';
  pendingImport=null;
  showToastGen('green','- '+pendingImportDB.length+' articoli pronti - premi Importa in Magazzino');
}

function _finalizzaImportNuovo(){
  if(!pendingImportDB.length){showToastGen('red','⚠ Nessun dato valido');return;}
  pendingImportCartellini.forEach(function(r){if(!r.size)r.size=autoSize(r.prezzo);});
  var tot = pendingImportDB.length;
  var h='<div style="margin-bottom:8px;font-size:12px;color:var(--accent);font-weight:700;">📋 '+tot+' prodotti &nbsp;|&nbsp; 🏷️ '+pendingImportCartellini.length+' cartellini &nbsp; <span style="font-size:10px;color:#555;font-weight:400;">— clicca una cella per modificare</span></div>';
  var inpStyle = 'background:transparent;border:none;color:inherit;font-size:10px;width:100%;padding:2px 0;font-family:inherit;';
  h+='<table style="width:100%;border-collapse:collapse;font-size:10px;"><tr style="background:#1e3a5f;color:#fff;"><th style="padding:4px;text-align:left;">Nome</th><th>Cod.F</th><th>Cod.M</th><th>U.M.</th><th>Qty</th><th>€ Acq.</th><th>€ Vend.</th><th>🏷️</th><th></th></tr>';
  var max = Math.min(tot, 200);
  for(var ri = 0; ri < max; ri++){
    var r = pendingImportDB[ri];
    var gColor = r.giornalino || '';
    var bg = gColor ? '#1a2a00' : 'transparent';
    h+='<tr id="csv-row-'+ri+'" style="border-bottom:1px solid #333;background:'+bg+';">';
    h+='<td style="padding:3px;"><input style="'+inpStyle+'color:var(--text);" value="'+esc(r.desc)+'" onchange="pendingImportDB['+ri+'].desc=this.value"></td>';
    h+='<td><input style="'+inpStyle+'color:#fc8181;" value="'+esc(r.codF)+'" onchange="pendingImportDB['+ri+'].codF=this.value"></td>';
    h+='<td><input style="'+inpStyle+'color:var(--accent);" value="'+esc(r.codM)+'" onchange="pendingImportDB['+ri+'].codM=this.value"></td>';
    h+='<td><input style="'+inpStyle+'color:#63b3ed;width:30px;" value="'+esc(r.unit||'pz')+'" onchange="pendingImportDB['+ri+'].unit=this.value"></td>';
    h+='<td><input type="number" style="'+inpStyle+'color:var(--text);width:40px;" value="'+r.qty+'" onchange="pendingImportDB['+ri+'].qty=parseFloat(this.value)||0"></td>';
    h+='<td><input style="'+inpStyle+'color:var(--text);width:45px;" value="'+esc(r.pa)+'" onchange="pendingImportDB['+ri+'].pa=this.value"></td>';
    h+='<td><input style="'+inpStyle+'color:var(--text);font-weight:700;width:45px;" value="'+esc(r.pv)+'" onchange="pendingImportDB['+ri+'].pv=this.value"></td>';
    h+='<td><input style="'+inpStyle+'color:#38a169;width:40px;" value="'+esc(gColor)+'" onchange="pendingImportDB['+ri+'].giornalino=this.value"></td>';
    h+='<td><button onclick="_csvRemoveRow('+ri+')" style="background:transparent;border:none;color:#e53e3e;font-size:14px;cursor:pointer;padding:0 4px;" title="Rimuovi riga">✕</button></td>';
    h+='</tr>';
  }
  if(tot>200) h+='<tr><td colspan="9" style="padding:6px;color:#888;text-align:center;">…e altri '+(tot-200)+' prodotti (non modificabili)</td></tr>';
  h+='</table>';
  document.getElementById('imp-wrap').innerHTML=h;
  document.getElementById('imp-prev').style.display='block';
  pendingImport=null;
  showToastGen('green','📋 '+tot+' righe lette — modifica se necessario, poi conferma');
}

// Rimuove una riga dalla preview CSV e rigenera la tabella
function _csvRemoveRow(idx){
  if(!pendingImportDB || idx < 0 || idx >= pendingImportDB.length) return;
  pendingImportDB.splice(idx, 1);
  // Rimuovi anche da pendingImportCartellini se c'era
  if(pendingImportCartellini && pendingImportCartellini.length){
    pendingImportCartellini = pendingImportCartellini.filter(function(c){
      return pendingImportDB.some(function(r){ return r.codM === c.codM; });
    });
  }
  if(!pendingImportDB.length){
    cancelImp();
    showToastGen('yellow','Tutte le righe rimosse');
    return;
  }
  _finalizzaImportNuovo();
}
var pendingImportDB=null;
var pendingImportCartellini=null;

// -- Conferma import SOLO MAGAZZINO (formato pipe) --
function confirmImpMag(){
  if(!pendingImportDB||!pendingImportDB.length){showToastGen('red','-- Nessun dato da importare');return;}
  if(!_fbReady){showToastGen('red','-- Firebase non connesso - ricarica la pagina');return;}

  // Salva i dati PRIMA di chiamare cancelImpMag (che azzera pendingImportDB)
  var daImportare=pendingImportDB.slice();
  cancelImpMag();

  showToastGen('blue','- Caricamento su Firebase in corso-');

  // Costruisce l'array completo da salvare
  var existing={};
  rows.forEach(function(r){if(r.codM)existing[r.codM]=r;});

  var totali=daImportare.length;
  daImportare.forEach(function(r){
    if(existing[r.codM]){
      // Aggiorna esistente
      var old=existing[r.codM];
      if(r.desc&&!old.desc)old.desc=r.desc;
      if(r.unit)old.unit=r.unit.toLowerCase();
    } else {
      // Nuovo articolo
      existing[r.codM]={
        desc:r.desc,codF:'',codM:r.codM,
        prezzo:'',prezzoOld:'',barrato:'no',promo:'no',
        size:'small',data:new Date().toLocaleDateString('it-IT'),
        note:'',giornalino:'',
        unit:(r.unit||'pz').toLowerCase()
      };
    }
  });

  var finalArr=Object.values(existing);

  // Carica su Firebase a chunk da 500 per non bloccare
  var CHUNK=500, idx=0;
  var updates={};

  function uploadChunk(){
    var end=Math.min(idx+CHUNK, finalArr.length);
    for(;idx<end;idx++){
      updates[MAGEXT_K+'/'+idx]=finalArr[idx];
    }
    if(idx<finalArr.length){
      showToastGen('blue','- Upload- '+idx+'/'+finalArr.length);
      setTimeout(uploadChunk,20);
    } else {
      // Scrivi tutto in un colpo su Firebase
      _fbDb.ref().update(updates,function(err){
        if(err){
          showToastGen('red','- Errore Firebase: '+err.message);
        } else {
          rows=finalArr;
          _magExtLoaded=true;
          lsSet(SK,rows);
          renderInventario();updateStats();updateStockBadge();
          goTab('t0');
          showToastGen('green','- '+finalArr.length+' articoli salvati su Firebase!');
        }
      });
    }
  }
  uploadChunk();
}
function cancelImpMag(){
  pendingImportDB=null;
  document.getElementById('imp-prev-mag').style.display='none';
  var fi=document.getElementById('fi-mag');if(fi)fi.value='';
}

function confirmImp(){
  // -- Nuovo formato (database + cartellini) --
  if(pendingImportDB&&pendingImportDB.length){
    // 1. Aggiorna/aggiungi al database (base: desc, codM, codF)
    pendingImportDB.forEach(function(r){
      var existIdx=-1;
      rows.forEach(function(row,i){
        if(removed.has(String(i)))return;
        if(r.codM&&row.codM===r.codM){existIdx=i;return;}
        if(r.codF&&row.codF===r.codF){existIdx=i;return;}
      });

      if(existIdx>=0){
        var old=rows[existIdx];
        if(r.pv)old.prezzo=r.pv;
        old.codF=r.codF||old.codF;
        old.codM=r.codM||old.codM;
        old.desc=r.desc||old.desc;
        var m=magazzino[existIdx]||{};
        if(r.qty>0)m.qty=r.qty;
        if(r.pa)m.prezzoAcquisto=r.pa;
        magazzino[existIdx]=m;
      } else {
        // Articolo NON trovato nel database — NON aggiungere (database protetto)
        console.warn('[IMPORT] Articolo non trovato, saltato:', r.codM, r.desc);
      }
    });
    lsSet(SK,rows);lsSet(MAGK,magazzino);

    // 2. Cartellini (solo Giornalino=S-) - mantiene il colore giornalino dal CSV
    if(pendingImportCartellini&&pendingImportCartellini.length){
      pendingImportCartellini.forEach(function(r){
        // Il colore giornalino - gi- memorizzato in r.giornalino (es. 'rosso', 'verde', 'blu'-)
        // Se non - un colore valido tra quelli noti, usa 'rosso' come fallback
        var coloreValido=['rosso','verde','blu','giallo','viola','arancio'];
        var colore=r.giornalino&&coloreValido.indexOf(r.giornalino)>=0?r.giornalino:'rosso';
        rows.forEach(function(row,i){
          if(!removed.has(String(i))&&(row.codM===r.codM||row.codF===r.codF)){
            // Assegna solo se non aveva gi- un colore giornalino
            if(!row.giornalino) row.giornalino=colore;
          }
        });
      });
    }

    save();renderTable();genTags();updateStats();updateStockBadge();
    var msg='- Database: '+pendingImportDB.length+' prodotti aggiornati';
    if(pendingImportCartellini&&pendingImportCartellini.length){
      msg+=' | -- '+pendingImportCartellini.length+' nei cartellini';
    }
    showToastGen('green',msg);
    cancelImp();goTab('t0');
    return;
  }

  // -- Vecchio formato (solo cartellini) --
  rows=pendingImport.map(function(r){return Object.assign({},r);});
  removed.clear();lsSet(RK,[]);save();renderTable();genTags();cancelImp();goTab('t1');updateStats();
  showToastGen('green','- Importati '+rows.length+' articoli');
}
function cancelImp(){pendingImport=[];document.getElementById('imp-prev').style.display='none';var fi=document.getElementById('fi');if(fi)fi.value='';var fi2=document.getElementById('fi-ct');if(fi2)fi2.value='';var ip2=document.getElementById('imp-prev-ct');if(ip2)ip2.style.display='none';}
function dlTemplate(){
  var csv='NomeProdotto;CodiceFornitore;CodiceMagazzino;UnitaMisura;Quantita;PrezzoAcquisto;PrezzoVendita;Giornalino\nVite 4x40 inox;00020-13/8;0329013;pz;100;1,20;3,50;\nTubo rame 22mm;04170-14/3;0308114;mt;50;2,80;6,90;rosso\n';
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));a.download='template_cartellini.csv';a.click();
}

// ══ SINCRONIZZA CSV → DATABASE ═══════════════════════════════════════════════
// Prende i dati dal CSV caricato (pendingImportDB) e aggiorna il database:
// codF, prezzo (con storico max 5), prezzoAcquisto, qty — con data modifica
function syncCsvAlDatabase(){
  if(!pendingImportDB || !pendingImportDB.length){
    showToastGen('red','⚠️ Nessun CSV caricato — carica prima un file');
    return;
  }
  var oggi = new Date().toLocaleDateString('it-IT');
  var stats = { prezzi:0, codF:0, qty:0, acq:0, nuovi:0, unit:0, nonTrovati:0 };

  pendingImportDB.forEach(function(r){
    if(!r.codM && !r.codF) return;
    // Cerca articolo nel database
    var dbIdx = -1;
    for(var i = 0; i < rows.length; i++){
      if(!rows[i]) continue;
      if(r.codM && rows[i].codM === r.codM){ dbIdx = i; break; }
      if(r.codF && rows[i].codF === r.codF){ dbIdx = i; break; }
    }

    if(dbIdx >= 0){
      var row = rows[dbIdx];
      var m = magazzino[dbIdx] || {};
      var changed = false;

      // 1. Codice fornitore
      if(r.codF && r.codF !== row.codF){
        row.codF = r.codF;
        changed = true;
        stats.codF++;
      }

      // 2. Prezzo vendita (con storico)
      var pv = r.pv || '';
      if(pv && pv !== row.prezzo){
        if(row.prezzo){
          // Archivia prezzo corrente
          row.prezzoOld = row.prezzo;
          if(!row.priceHistory) row.priceHistory = [];
          row.priceHistory.unshift({ prezzo: row.prezzo, data: row.data || '' });
          if(row.priceHistory.length > 5) row.priceHistory.length = 5;
        }
        row.prezzo = pv;
        row.data = oggi;
        row.size = (typeof autoSize === 'function') ? autoSize(pv) : row.size;
        changed = true;
        stats.prezzi++;
      }

      // 3. Prezzo acquisto
      var pa = r.pa || '';
      if(pa && pa !== (m.prezzoAcquisto||'')){
        m.prezzoAcquisto = pa;
        m.prezzoAcquistoData = oggi;
        changed = true;
        stats.acq++;
      }

      // 4. Quantità
      if(r.qty > 0 && r.qty !== m.qty){
        m.qty = r.qty;
        m.qtyData = oggi;
        changed = true;
        stats.qty++;
      }

      // 5. Unità di misura
      if(r.unit && r.unit !== (m.unit||'pz')){
        m.unit = r.unit;
        changed = true;
        stats.unit++;
      }

      // 6. Giornalino
      if(r.giornalino && r.giornalino !== row.giornalino){
        row.giornalino = r.giornalino;
        changed = true;
        if(!stats.giorn) stats.giorn = 0;
        stats.giorn++;
      }

      if(changed){
        magazzino[dbIdx] = m;
        if(typeof _fbSaveArticolo === 'function') _fbSaveArticolo(dbIdx);
      }
    } else {
      // Articolo NON trovato — NON aggiungere (database protetto)
      stats.nonTrovati++;
    }
  });

  lsSet(SK, rows);
  lsSet(MAGK, magazzino);
  updateStats(); updateStockBadge();

  // Messaggio riepilogo
  var parts = [];
  if(stats.prezzi) parts.push(stats.prezzi + ' prezzi');
  if(stats.codF) parts.push(stats.codF + ' cod.forn.');
  if(stats.qty) parts.push(stats.qty + ' quantità');
  if(stats.acq) parts.push(stats.acq + ' pr.acquisto');
  if(stats.nuovi) parts.push(stats.nuovi + ' nuovi articoli');
  if(stats.unit) parts.push(stats.unit + ' unità misura');
  if(stats.nonTrovati) parts.push('⚠️ ' + stats.nonTrovati + ' non trovati (saltati)');
  if(stats.giorn) parts.push(stats.giorn + ' giornalino');
  if(parts.length){
    showToastGen('green', '✅ Database aggiornato: ' + parts.join(' · '));
  } else {
    showToastGen('yellow', 'Nessuna modifica — i dati erano già aggiornati');
  }
}

// Tab primarie (nav bar visibile)
var _PRIMARY_TABS = ['t0','t1','tc','to','tfat'];

function _updateBackBtn(id){ _updateUndoButtons(); }
function goBack(){ undoAction(); }
function goForward(){ redoAction(); }

function goTab(id){
  goTabDirect(id);
}
function goTabDirect(id){
  if(_PRIMARY_TABS.indexOf(id)>=0) _lastPrimaryTab=id;
  if((id==='t0'||id==='t1') && typeof loadMagazzinoFB==='function') loadMagazzinoFB();
  _updateBackBtn(id);
  document.querySelectorAll('.tab-content').forEach(function(t){t.classList.remove('active');});
  document.querySelectorAll('.tab-bottom-btn').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('.altro-btn').forEach(function(b){b.classList.remove('active-tab');});
  var el=document.getElementById(id);
  if(el) el.classList.add('active');
  closeAltroMenu();
  if(['tfor','t2','t3'].indexOf(id) >= 0){
    // Dal popup Fatture - evidenzia Fatture nella tab bar
    var fatBtn = document.getElementById('tbb-tfat');
    if(fatBtn) fatBtn.classList.add('active');
  } else if(['t4','t6','t10','t11','t12','tmov'].indexOf(id) >= 0){
    // Tab secondaria - evidenzia -- Altro nella tab bar
    var altroBtn = document.getElementById('tbb-taltro');
    if(altroBtn) altroBtn.classList.add('active');
    var atbEl = document.getElementById('atb-'+id);
    if(atbEl) atbEl.classList.add('active-tab');
  } else if(['t7','t9'].indexOf(id) >= 0){
    // Dal popup Cartellini - evidenzia Cartellini nella tab bar
    var cartBtn = document.getElementById('tbb-t1');
    if(cartBtn) cartBtn.classList.add('active');
  } else {
    var tbb=document.getElementById('tbb-'+id);
    if(tbb) tbb.classList.add('active');
  }
  if(window.scrollTo) window.scrollTo(0,0);
  if(id==='t2') renderHist();
  if(id==='t4') renderCestino();
  if(id==='t7') renderPromo();
  if(id==='t9'){renderEditorPreview();renderGiornaliniRename();}
  if(id==='t10') renderNoteTab();
  if(id==='t0') renderInventario();
  if(id==='t1'){ renderTable(); genTags(); }
  if(id==='t11') renderMagazzino();
  if(id==='tc') renderCartTabs();
  if(id==='to'){renderOrdini();}
  if(id==='tmov'){renderMovimenti();}
  if(id==='t6'){renderBackupSettings();}
  if(id==='t12') renderCatTree();
  if(id==='tfat') renderFatture();
  if(id==='tfor') renderFornitori();
}

function renderPromo(){
  var conGiorn=rows.filter(function(r,i){return r.giornalino&&!removed.has(String(i));});
  var empty=document.getElementById('promo-empty');
  var listaEl=document.getElementById('giorn-lista');
  var tbl=document.getElementById('promo-table');
  var tags=document.getElementById('promo-tags');
  var badge=document.getElementById('pb2');
  badge.textContent=conGiorn.length;
  badge.style.display=conGiorn.length>0?'inline':'none';
  if(!conGiorn.length){
    empty.style.display='block';
    listaEl.innerHTML=''; tbl.innerHTML=''; tags.innerHTML='';
    return;
  }
  empty.style.display='none';

  // raggruppa per giornalino
  var gruppi={};
  rows.forEach(function(r,i){
    if(!r.giornalino||removed.has(String(i))) return;
    if(!gruppi[r.giornalino]) gruppi[r.giornalino]=[];
    gruppi[r.giornalino].push({r:r,i:i});
  });

  var listaH='<p style="font-size:12px;font-weight:bold;color:#1e3a5f;margin-bottom:10px;">-- Lista articoli - spunta quando hai messo il cartellino</p>';
  var tagsH='';

  Object.keys(gruppi).forEach(function(k){
    var g=getGiornalino(k);
    var items=gruppi[k];
    var label=g.label+' '+getNomeGiornalino(k);
    var idxArr=items.map(function(x){return x.i;});

    // -- LISTA SPUNTE --
    listaH+='<div style="margin-bottom:16px;border-radius:8px;overflow:hidden;border:2px solid '+g.text+'40;">';
    listaH+='<div style="background:'+g.color+';border-left:4px solid '+g.text+';padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">';
    listaH+='<span style="font-size:13px;font-weight:bold;color:'+g.text+';">'+label+'</span>';
    listaH+='<span id="cnt-'+k+'" style="font-size:11px;color:'+g.text+';background:white;padding:2px 10px;border-radius:10px;font-weight:bold;">0 / '+items.length+'</span>';
    listaH+='</div><ul style="list-style:none;padding:0;margin:0;">';

    items.forEach(function(item){
      var r=item.r, idx=item.i;
      listaH+='<li id="li-'+k+'-'+idx+'" style="padding:10px 14px;border-bottom:1px solid '+g.color+';display:flex;align-items:center;gap:10px;background:white;">'+
        '<input type="checkbox" id="sp-'+k+'-'+idx+'" onchange="toggleSpunta(\''+k+'\','+idx+',this)" '+
        'style="width:22px;height:22px;flex-shrink:0;cursor:pointer;accent-color:'+g.text+';">'+
        '<label for="sp-'+k+'-'+idx+'" style="flex:1;cursor:pointer;">'+
          '<span style="font-size:13px;font-weight:500;display:block;">'+esc(r.desc)+'</span>'+
          '<span style="font-size:11px;color:var(--muted);">'+esc(r.codF)+(r.codM?' - '+esc(r.codM):'')+'</span>'+
        '</label>'+
        '<span style="font-size:15px;font-weight:bold;color:'+g.text+';white-space:nowrap;">- '+esc(r.prezzo)+'</span>'+
      '</li>';
    });

    listaH+='</ul><div style="background:'+g.color+'88;padding:8px 12px;display:flex;gap:6px;flex-wrap:wrap;">'+
      '<button onclick="spuntaTutti(\''+k+'\',['+idxArr.join(',')+'])" '+
      'style="background:'+g.text+';color:#fff;border:none;padding:7px 12px;border-radius:5px;cursor:pointer;font-size:12px;min-height:36px;">- Spunta tutti</button>'+
      '<button onclick="deSpuntaTutti(\''+k+'\',['+idxArr.join(',')+'])" '+
      'style="background:#6b7280;color:#fff;border:none;padding:7px 12px;border-radius:5px;cursor:pointer;font-size:12px;min-height:36px;">- Azzera</button>'+
      '</div></div>';

    // -- CARTELLINI --
    tagsH+='<div style="margin-bottom:16px;">'+
      '<div style="background:'+g.color+';border-left:4px solid '+g.text+';padding:6px 12px;border-radius:6px;font-size:12px;font-weight:bold;color:'+g.text+';margin-bottom:6px;">'+label+'</div>'+
      buildTagsHTML(items.map(function(x){return x.r;}))+'</div>';
  });

  listaEl.innerHTML=listaH;
  tbl.innerHTML='';
  tags.innerHTML='<p style="font-size:12px;font-weight:bold;color:#1e3a5f;margin:20px 0 8px;border-top:2px solid #e5e7eb;padding-top:16px;">-- Cartellini per giornalino:</p>'+tagsH;

  // Ripristina spunte da sessionStorage
  Object.keys(gruppi).forEach(function(k){
    var saved=JSON.parse(sessionStorage.getItem('sp_'+k)||'[]');
    saved.forEach(function(idx){
      var cb=document.getElementById('sp-'+k+'-'+idx);
      if(cb){cb.checked=true; applicaSpunta(k,idx,true);}
    });
    aggiornaContatore(k, gruppi[k].length);
  });
}

function toggleSpunta(colore,idx,cb){
  applicaSpunta(colore,idx,cb.checked);
  var saved=JSON.parse(sessionStorage.getItem('sp_'+colore)||'[]');
  if(cb.checked){ if(!saved.includes(idx)) saved.push(idx); }
  else { saved=saved.filter(function(x){return x!==idx;}); }
  sessionStorage.setItem('sp_'+colore,JSON.stringify(saved));
  var totale=rows.filter(function(r,i){return r.giornalino===colore&&!removed.has(String(i));}).length;
  aggiornaContatore(colore,totale);
}

function applicaSpunta(colore,idx,checked){
  var li=document.getElementById('li-'+colore+'-'+idx);
  if(!li) return;
  if(checked){
    li.style.background='#f0fdf4';
    li.style.opacity='0.55';
    var lbl=li.querySelector('label');
    if(lbl) lbl.style.textDecoration='line-through';
  } else {
    li.style.background='white';
    li.style.opacity='1';
    var lbl=li.querySelector('label');
    if(lbl) lbl.style.textDecoration='none';
  }
}

function aggiornaContatore(colore,totale){
  var cnt=document.getElementById('cnt-'+colore);
  if(!cnt) return;
  var spuntati=document.querySelectorAll('[id^="sp-'+colore+'-"]:checked').length;
  cnt.textContent=spuntati+' / '+totale;
  var g=getGiornalino(colore);
  cnt.style.background=spuntati===totale&&totale>0?'#dcfce7':'white';
  cnt.style.color=spuntati===totale&&totale>0?'#15803d':g.text;
}

function spuntaTutti(colore,idxArr){
  idxArr.forEach(function(idx){
    var cb=document.getElementById('sp-'+colore+'-'+idx);
    if(cb&&!cb.checked){cb.checked=true; applicaSpunta(colore,idx,true);}
  });
  sessionStorage.setItem('sp_'+colore,JSON.stringify(idxArr));
  aggiornaContatore(colore,idxArr.length);
}

function deSpuntaTutti(colore,idxArr){
  idxArr.forEach(function(idx){
    var cb=document.getElementById('sp-'+colore+'-'+idx);
    if(cb&&cb.checked){cb.checked=false; applicaSpunta(colore,idx,false);}
  });
  sessionStorage.removeItem('sp_'+colore);
  aggiornaContatore(colore,idxArr.length);
}

function removeGiornalino(idx){
  if(!rows[idx]) return;
  rows[idx].giornalino='';
  var s=document.getElementById('gi'+idx);
  if(s) s.value='';
  updRowColor(idx);
  save(); renderPromo(); updateStats();
}

function showPrevPromo(){
  var promo=rows.filter(function(r,i){return r.giornalino&&!removed.has(String(i));});
  if(!promo.length){showToastGen('red','-- Nessun articolo con giornalino');return;}
  document.getElementById('pc').innerHTML=buildTagsHTML(promo);
  document.getElementById('pov').classList.add('open');
  _scalePrevContainer();
}

function updatePromoBadge(){
  var promo=rows.filter(function(r,i){return r.giornalino&&!removed.has(String(i));});
  var badge=document.getElementById('pb2');
  if(!badge) return;
  badge.textContent=promo.length;
  badge.style.display=promo.length>0?'inline':'none';
}

// -- CERCA STORICO -------------------
function searchHistory(){
  var q=(document.getElementById('sh-query')||{}).value||'';
  var res=document.getElementById('sh-results');
  if(!res) return;
  var allRows=rows.concat(cestino);
  var filtered=q.trim()?allRows.filter(function(r){
    var t=[r.desc,r.codF,r.codM].join(' ').toLowerCase();
    return t.includes(q.toLowerCase());
  }):allRows;
  if(!filtered.length){res.innerHTML='<p style="color:#aaa;font-size:12px;text-align:center;padding:20px;">Nessun risultato.</p>';return;}
  var h='';
  filtered.forEach(function(r){
    var hist=r.priceHistory||[];
    var histH=hist.length?hist.map(function(h){
      return '<span style="font-size:10px;color:var(--muted);background:#f0f0f0;padding:2px 6px;border-radius:4px;margin-right:4px;">'+h.data+': <b>-'+h.prezzo+'</b></span>';
    }).join(''):'<span style="font-size:10px;color:#ccc;">Nessuna modifica</span>';
    h+='<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:8px;">'+
      '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;">'+
      '<div><b style="font-size:12px;color:#1e3a5f;">'+esc(r.desc)+'</b><br>'+
      '<span style="font-size:11px;color:var(--muted);">Cod.Forn: '+esc(r.codF)+'&nbsp;&nbsp;Mio Cod: '+esc(r.codM)+'</span></div>'+
      '<span style="font-size:18px;font-weight:900;color:#dc2626;">- '+esc(r.prezzo)+'</span></div>'+
      '<div style="margin-top:8px;"><span style="font-size:10px;color:#666;font-weight:bold;">Storico: </span>'+histH+'</div>'+
      '</div>';
  });
  res.innerHTML=h;
}

// -- EDITOR CARTELLINI -------------------
var editorSettings={priceColor:'#000000',borderColor:'#aaaaaa',smW:67,smH:38,lgW:94,lgH:39,barrato:false,shape:'',frame:'',frameColor:'#aaaaaa',promoText:'PROMO',bg:'#ffffff'};

function loadEditorSettings(){
  var s=lsGet(window.AppKeys.EDITOR,null);
  if(s) editorSettings=Object.assign(editorSettings,s);
  document.getElementById('ec-price-color').value=editorSettings.priceColor;
  document.getElementById('ec-border-color').value=editorSettings.borderColor;
  document.getElementById('ec-sm-w').value=editorSettings.smW;
  document.getElementById('ec-sm-h').value=editorSettings.smH;
  document.getElementById('ec-lg-w').value=editorSettings.lgW;
  document.getElementById('ec-lg-h').value=editorSettings.lgH;
  document.getElementById('ec-barrato').checked=editorSettings.barrato;
  var fc=document.getElementById('ec-frame-color');
  if(fc) fc.value=editorSettings.frameColor||'#aaaaaa';
  var pt=document.getElementById('ec-promo-text');
  if(pt) pt.value=editorSettings.promoText||'PROMO';
  // Aggiorna stato bottoni shape
  document.querySelectorAll('.ec-shape-btn').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-shape')===(editorSettings.shape||''));
  });
  // Aggiorna stato bottoni frame
  document.querySelectorAll('.ec-frame-btn').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-frame')===(editorSettings.frame||''));
  });
  // Aggiorna stato bottoni promo text
  document.querySelectorAll('.ec-promo-txt-btn').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-val')===(editorSettings.promoText||'PROMO'));
  });
  // Aggiorna stato bottoni bg
  document.querySelectorAll('.ec-bg-btn').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-val')===(editorSettings.bg||'#ffffff'));
  });
  // Aggiorna slider font/border
  var sliders=[
    {id:'ec-price-font-sm',label:'ec-price-font-sm-val',unit:'pt',def:26},
    {id:'ec-price-font-lg',label:'ec-price-font-lg-val',unit:'pt',def:32},
    {id:'ec-promo-font',label:'ec-promo-font-val',unit:'pt',def:6},
    {id:'ec-oldprice-font',label:'ec-oldprice-font-val',unit:'pt',def:10},
    {id:'ec-border-width',label:'ec-border-width-val',unit:'px',def:0.5}
  ];
  sliders.forEach(function(sl){
    var inp=document.getElementById(sl.id);
    var lbl=document.getElementById(sl.label);
    var val=editorSettings[sl.id]!==undefined?editorSettings[sl.id]:sl.def;
    if(inp) inp.value=val;
    if(lbl) lbl.textContent=val+sl.unit;
  });
}

function applyEditor(){
  editorSettings.priceColor=document.getElementById('ec-price-color').value;
  editorSettings.borderColor=document.getElementById('ec-border-color').value;
  editorSettings.smW=parseInt(document.getElementById('ec-sm-w').value)||67;
  editorSettings.smH=parseInt(document.getElementById('ec-sm-h').value)||38;
  editorSettings.lgW=parseInt(document.getElementById('ec-lg-w').value)||94;
  editorSettings.lgH=parseInt(document.getElementById('ec-lg-h').value)||39;
  editorSettings.barrato=document.getElementById('ec-barrato').checked;
  var fc=document.getElementById('ec-frame-color');
  if(fc) editorSettings.frameColor=fc.value;
  lsSet(window.AppKeys.EDITOR,editorSettings);
  applyEditorCSS();
  renderEditorPreview();
  genTags();
}

function applyEditorCSS(){
  var s=document.getElementById('editor-style');
  if(!s){s=document.createElement('style');s.id='editor-style';document.head.appendChild(s);}
  var smW=editorSettings.smW, smH=editorSettings.smH;
  var lgW=editorSettings.lgW, lgH=editorSettings.lgH;
  var smRatio=(smW/smH).toFixed(4);
  var lgRatio=(lgW/lgH).toFixed(4);
  var shape=editorSettings.shape||'';
  var frame=editorSettings.frame||'';
  var fCol=editorSettings.frameColor||editorSettings.borderColor||'#aaaaaa';
  var promoTxt=editorSettings.promoText||'PROMO';
  var bg=editorSettings.bg||'#ffffff';
  // Slider values
  var priceFontSm=editorSettings['ec-price-font-sm']||26;
  var priceFontLg=editorSettings['ec-price-font-lg']||32;
  var promoFont=editorSettings['ec-promo-font']||6;
  var oldPriceFont=editorSettings['ec-oldprice-font']||10;
  var borderW=editorSettings['ec-border-width']!=null?editorSettings['ec-border-width']:0.5;

  var css='';
  // Bordo, colore prezzo, sfondo, spessore bordo
  css+='.tag-small,.tag-large{border:'+borderW+'px solid '+editorSettings.borderColor+'!important;background:'+bg+'!important;}';
  css+='.tpr{color:'+editorSettings.priceColor+'!important;}';
  // Font sizes da slider
  css+='.tag-small .tpr{font-size:'+priceFontSm+'pt!important;}';
  css+='.tag-large .tpr{font-size:'+priceFontLg+'pt!important;}';
  css+='.top2{font-size:'+oldPriceFont+'pt!important;}';
  // Dimensioni
  css+='.tag-small{width:'+smW+'mm!important;height:'+smH+'mm!important;aspect-ratio:'+smRatio+'!important;}';
  css+='.tag-large{width:'+lgW+'mm!important;height:'+lgH+'mm!important;aspect-ratio:'+lgRatio+'!important;}';
  // Prezzo centrato
  css+='.tpa{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:.5mm;padding:0 2mm;}';
  css+='.tpr{display:block;text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}';

  // ── Forma ──
  css+='.tag-small,.tag-large{border-radius:0!important;clip-path:none!important;}';
  if(shape==='rounded'){
    css+='.tag-small,.tag-large{border-radius:4mm!important;}';
  } else if(shape==='pill'){
    css+='.tag-small,.tag-large{border-radius:12mm!important;padding-left:5mm!important;padding-right:5mm!important;}';
  } else if(shape==='ticket'){
    // Ticket: punta a sinistra — NO clip-path, usa SVG-like via bordo + inset
    // Metodo: nascondi overflow, aggiungi padding sinistro, disegna la punta con ::after
    css+='.tag-small,.tag-large{border-left:none!important;border-radius:0 2mm 2mm 0!important;padding-left:6mm!important;position:relative!important;}';
    css+='.tag-small::after,.tag-large::after{content:"";position:absolute;left:0;top:0;width:0;height:0;border-style:solid;border-color:transparent '+editorSettings.borderColor+' transparent transparent;z-index:5;pointer-events:none;}';
    css+='.tag-small::after{border-width:'+((smH/2))+'mm 3.5mm '+((smH/2))+'mm 0;}';
    css+='.tag-large::after{border-width:'+((lgH/2))+'mm 3.5mm '+((lgH/2))+'mm 0;}';
  }

  // ── Cornice ──
  if(frame==='double'){
    css+='.tag-small,.tag-large{outline:1px solid '+fCol+';outline-offset:-2.5mm;}';
  } else if(frame==='dotted'){
    css+='.tag-small,.tag-large{outline:1.5px dotted '+fCol+';outline-offset:-2mm;}';
  } else if(frame==='elegant'){
    css+='.tag-small,.tag-large{outline:0.8px solid '+fCol+';outline-offset:-2mm;box-shadow:inset 0 0 0 1mm '+bg+',inset 0 0 0 1.4mm '+fCol+';}';
  } else if(frame==='deco'){
    css+='.tag-small,.tag-large{outline:1.2px solid '+fCol+';outline-offset:-1.8mm;}';
  }

  // ── Ribbon PROMO — resta dentro il tag (overflow:hidden) ──
  // Il ribbon è ruotato a 35deg nell'angolo in alto a destra.
  // Più il font cresce, più il ribbon è alto → serve più spazio diagonale.
  // Calcoliamo width e posizione per restare sempre nel rettangolo.
  var txtLen=promoTxt.length;
  var smPromoFont= promoFont;
  var lgPromoFont= promoFont+1;
  // Padding verticale del ribbon proporzionale al font
  var ribbonPad = Math.max(0.8, promoFont * 0.18);
  // Larghezza ribbon: deve coprire la diagonale — più larga con font grandi
  // e con testi lunghi, ma limitata alla diagonale del tag
  var smDiag = Math.sqrt(smW*smW + smH*smH);
  var lgDiag = Math.sqrt(lgW*lgW + lgH*lgH);
  var smRibbonW = Math.min(smDiag * 0.55, Math.max(20, txtLen * promoFont * 0.5));
  var lgRibbonW = Math.min(lgDiag * 0.55, Math.max(24, txtLen * (promoFont+1) * 0.5));
  // Right offset: centra il testo sulla diagonale, si sposta verso dentro con font grandi
  var smRight = -(smRibbonW * 0.22) + (promoFont - 6) * 0.3;
  var lgRight = -(lgRibbonW * 0.22) + (promoFont - 6) * 0.3;
  // Top: scende un po' con font grandi per restare dentro
  var smTop = Math.max(1, 5 - (promoFont - 6) * 0.5);
  var lgTop = Math.max(1.5, 5.5 - (promoFont - 6) * 0.5);

  css+='.tag-small.cp::before,.tag-large.cp::before{content:"'+promoTxt.replace(/"/g,'\\"')+'"!important;padding:'+ribbonPad.toFixed(1)+'mm 0!important;}';
  css+='.tag-small.cp::before{font-size:'+smPromoFont+'pt!important;width:'+smRibbonW.toFixed(1)+'mm!important;right:'+smRight.toFixed(1)+'mm!important;top:'+smTop.toFixed(1)+'mm!important;}';
  css+='.tag-large.cp::before{font-size:'+lgPromoFont+'pt!important;width:'+lgRibbonW.toFixed(1)+'mm!important;right:'+lgRight.toFixed(1)+'mm!important;top:'+lgTop.toFixed(1)+'mm!important;}';

  // Stampa
  css+='@media print{';
  css+='.tag-small{width:'+smW+'mm!important;height:'+smH+'mm!important;max-width:'+smW+'mm!important;max-height:'+smH+'mm!important;}';
  css+='.tag-large{width:'+lgW+'mm!important;height:'+lgH+'mm!important;max-width:'+lgW+'mm!important;max-height:'+lgH+'mm!important;}';
  css+='}';

  s.textContent=css;
}

function renderEditorPreview(){
  var prev=document.getElementById('ec-preview');
  if(!prev) return;
  var sample=[
    {data:'09-03-2026',desc:'Esempio Articolo',codF:'00020-13/8',codM:'0329013',prezzoOld:'5,00',prezzo:'3,20',barrato:editorSettings.barrato?'si':'no',promo:'si',size:'small',note:'',giornalino:'rosso'},
    {data:'09-03-2026',desc:'Articolo Grande',codF:'04170-14/3',codM:'0308114',prezzoOld:'',prezzo:'139,00',barrato:'no',promo:'no',size:'large',note:''}
  ];
  prev.innerHTML=buildTagsHTML(sample);
}

function resetEditor(){
  editorSettings={priceColor:'#000000',borderColor:'#aaaaaa',smW:67,smH:38,lgW:94,lgH:39,barrato:false,shape:'',frame:'',frameColor:'#aaaaaa',promoText:'PROMO',bg:'#ffffff'};
  lsSet(window.AppKeys.EDITOR,editorSettings);
  loadEditorSettings();
  applyEditorCSS();
  renderEditorPreview();
  genTags();
}

// ── Funzioni editor: Forma, Cornice, Testo Promo, Sfondo ────────────
function ec_setShape(val){
  editorSettings.shape=val;
  document.querySelectorAll('.ec-shape-btn').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-shape')===val);
  });
  lsSet(window.AppKeys.EDITOR,editorSettings);
  applyEditorCSS();
  renderEditorPreview();
  genTags();
}

function ec_setFrame(val){
  editorSettings.frame=val;
  document.querySelectorAll('.ec-frame-btn').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-frame')===val);
  });
  lsSet(window.AppKeys.EDITOR,editorSettings);
  applyEditorCSS();
  renderEditorPreview();
  genTags();
}

function ec_setPromoText(val){
  editorSettings.promoText=val||'PROMO';
  var inp=document.getElementById('ec-promo-text');
  if(inp && inp.value!==val) inp.value=val;
  document.querySelectorAll('.ec-promo-txt-btn').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-val')===val);
  });
  lsSet(window.AppKeys.EDITOR,editorSettings);
  applyEditorCSS();
  renderEditorPreview();
  genTags();
}

function ec_setBg(val){
  editorSettings.bg=val||'#ffffff';
  document.querySelectorAll('.ec-bg-btn').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-val')===val);
  });
  lsSet(window.AppKeys.EDITOR,editorSettings);
  applyEditorCSS();
  renderEditorPreview();
  genTags();
}

// ── Slider font size / border width ─────────────────────────────────
function ec_updateSliderVal(sliderId, labelId, unit){
  var slider=document.getElementById(sliderId);
  var label=document.getElementById(labelId);
  if(!slider||!label) return;
  label.textContent=slider.value+unit;
  // Salva nei settings
  editorSettings[sliderId]=parseFloat(slider.value);
  lsSet(window.AppKeys.EDITOR,editorSettings);
  applyEditorCSS();
  renderEditorPreview();
  genTags();
}

// resetAI rimossa - stub vuoto non pi- necessario

// -- RINOMINA GIORNALINI -------------------
var giornaliniNomi={};

function loadGiornaliniNomi(){
  var s=lsGet(window.AppKeys.GIORNOMI,null);
  if(s) giornaliniNomi=s;
}

function getNomeGiornalino(val){
  return giornaliniNomi[val]||val.charAt(0).toUpperCase()+val.slice(1);
}

function renderGiornaliniRename(){
  var div=document.getElementById('giornalini-rename');
  if(!div) return;
  var h='';
  GIORNALINI.filter(function(g){return g.val;}).forEach(function(g){
    var nome=giornaliniNomi[g.val]||'';
    h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">'+
      '<span style="font-size:18px;">'+g.label+'</span>'+
      '<input type="text" placeholder="'+g.val.charAt(0).toUpperCase()+g.val.slice(1)+'" value="'+esc(nome)+'" '+
      'oninput="saveGiornaliniNome(\''+g.val+'\',this.value)" '+
      'style="flex:1;padding:5px 8px;border:1px solid #ccc;border-radius:4px;font-size:13px;">'+
      '</div>';
  });
  div.innerHTML=h;
}

function saveGiornaliniNome(val,nome){
  if(nome.trim()) giornaliniNomi[val]=nome.trim();
  else delete giornaliniNomi[val];
  lsSet(window.AppKeys.GIORNOMI,giornaliniNomi);
  // aggiorna label nella tab promo se aperta
  renderPromo();
}

function autoW(el){
  var canvas=autoW._c||(autoW._c=document.createElement('canvas'));
  var ctx=canvas.getContext('2d');
  ctx.font='16px Arial';
  var w=ctx.measureText(el.value||'').width;
  el.style.width=Math.max(120,w+20)+'px';
}

function renderNoteTab(){
  var list=document.getElementById('note-list');
  var empty=document.getElementById('note-empty');
  // raccoglie articoli con nota, esclude cestino
  var withNote=rows.map(function(r,i){return {r:r,i:i};}).filter(function(o){
    return o.r.note && o.r.note.trim() && !removed.has(String(o.i));
  });
  updateNoteBadge();
  if(withNote.length===0){
    empty.style.display='block';
    list.innerHTML='';
    return;
  }
  empty.style.display='none';
  list.innerHTML=withNote.map(function(o){
    var r=o.r, i=o.i;
    // Separa nota da posizione: formato "nota|||posizione"
    var parts=(r.note||'').split('|||');
    var notaTxt=parts[0]||'';
    var posTxt=parts[1]||'';
    var giorn=r.giornalino?'<span style="font-size:10px;background:rgba(245,196,0,.15);color:var(--accent);border-radius:5px;padding:1px 6px;margin-left:6px;">- '+r.giornalino+'</span>':'';
    return '<div class="note-card" id="nc-'+i+'">'
      +'<div class="note-card-header">'
        +'<div style="flex:1">'
          +'<div class="note-card-title">'+(r.desc||'(senza descrizione)')+giorn+'</div>'
          +'<div class="note-card-meta">'+
            (r.codF?'<span style="color:var(--accent)">'+r.codF+'</span> - ':'')
            +(r.codM?r.codM+' - ':'')
            +'<span style="color:var(--muted)">'+r.data+'</span>'
          +'</div>'
        +'</div>'
        +'<div class="note-card-price">- '+r.prezzo+'</div>'
      +'</div>'
      // NOTA principale
      +'<textarea class="note-textarea" id="nt-'+i+'" placeholder="Nota articolo..." onchange="autoSaveNote('+i+')" oninput="autoSaveNote('+i+')">'+escHtml(notaTxt)+'</textarea>'
      // POSIZIONE (sotto-nota piccola)
      +'<input type="text" class="note-pos" id="np-'+i+'" value="'+escHtml(posTxt)+'" placeholder="- Posizione (es: Scaffale A3, Corsia 2...)" onchange="autoSaveNote('+i+')" oninput="autoSaveNote('+i+')">'
      +'<div style="display:flex;align-items:center;margin-top:8px;">'
        +'<button class="note-save-btn" onclick="saveNoteCard('+i+')">- Salva</button>'
        +'<span class="note-saved" id="ns-'+i+'">- Salvato!</span>'
        +'<button style="margin-left:auto;background:none;border:none;color:#e53e3e;font-size:12px;cursor:pointer;padding:4px 8px;" onclick="deleteNoteCard('+i+')">-- Cancella nota</button>'
      +'</div>'
    +'</div>';
  }).join('');
}

function escHtml(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

var _noteTimer={};
function autoSaveNote(i){
  clearTimeout(_noteTimer[i]);
  _noteTimer[i]=setTimeout(function(){saveNoteCard(i,true);},800);
}

function saveNoteCard(i,silent){
  var ta=document.getElementById('nt-'+i);
  var pos=document.getElementById('np-'+i);
  if(!ta||!rows[i]) return;
  var nota=ta.value.trim();
  var posizione=(pos?pos.value.trim():'');
  rows[i].note=nota+(posizione?'|||'+posizione:'');
  save();
  // aggiorna icona nella tabella principale
  var btn=document.querySelector('#tb tr[data-idx="'+i+'"] .ni');
  if(btn) btn.textContent=rows[i].note?'--':'-';
  updateNoteBadge();
  if(!silent){
    var ns=document.getElementById('ns-'+i);
    if(ns){ns.style.opacity='1';setTimeout(function(){ns.style.opacity='0';},1800);}
  }
}

function deleteNoteCard(i){
  if(!rows[i]) return;
  rows[i].note='';
  save();
  var btn=document.querySelector('#tb tr[data-idx="'+i+'"] .ni');
  if(btn) btn.textContent='-';
  renderNoteTab();
}

function updateNoteBadge(){
  var n=rows.filter(function(r,i){return r.note&&r.note.trim()&&!removed.has(String(i));}).length;
  var b=document.getElementById('note-badge');
  if(b){b.textContent=n;b.style.display=n?'inline':'none';}
}



// -----------------------------------------------
//  POSIZIONE (overlay - dalla tab Dati)
// -----------------------------------------------
var posIdx=null;
var _noteSnapshot=null;
var _posSnapshot=null;
var _sogliaSnapshot=null;

function openPos(i){
  posIdx=i;
  var m=magazzino[i]||{};
  _posSnapshot={specs:m.specs||'',posizione:m.posizione||'',soglia:m.soglia,prezzoAcquisto:m.prezzoAcquisto||''};
  document.getElementById('pm-desc').textContent=rows[i]?rows[i].desc||'':'';
  document.getElementById('pm-specs').value=m.specs||'';
  document.getElementById('pm-pos').value=m.posizione||'';
  var sqEl=document.getElementById('pm-soglia');if(sqEl) sqEl.value=m.soglia!==undefined?m.soglia:'';
  var acqEl=document.getElementById('pm-acq');if(acqEl) acqEl.value=m.prezzoAcquisto||'';
  document.getElementById('pm').classList.add('open');
}

function savePos(){
  if(posIdx===null) return;
  if(!magazzino[posIdx]) magazzino[posIdx]={};
  magazzino[posIdx].specs=document.getElementById('pm-specs').value.trim();
  magazzino[posIdx].posizione=document.getElementById('pm-pos').value.trim();
  var sqEl=document.getElementById('pm-soglia');if(sqEl){var sv=sqEl.value.trim();magazzino[posIdx].soglia=sv===''?'':Number(sv);}
  var acqEl=document.getElementById('pm-acq');if(acqEl) magazzino[posIdx].prezzoAcquisto=acqEl.value.trim();
  lsSet(MAGK,magazzino);
  updateStockBadge();
  renderInventario();
  // aggiorna icona nella tabella
  var btn=document.querySelector('#tb tr[data-idx="'+posIdx+'"] button[title="Specifiche / Posizione"]');
  if(btn) btn.textContent=(magazzino[posIdx].specs||magazzino[posIdx].posizione)?'--':'-';
  _posSnapshot=null;
  document.getElementById('pm').classList.remove('open');
  posIdx=null;
}

function closePos(){
  if(_posSnapshot!==null && posIdx!==null){
    if(!magazzino[posIdx]) magazzino[posIdx]={};
    magazzino[posIdx].specs=_posSnapshot.specs;
    magazzino[posIdx].posizione=_posSnapshot.posizione;
    magazzino[posIdx].soglia=_posSnapshot.soglia;
    magazzino[posIdx].prezzoAcquisto=_posSnapshot.prezzoAcquisto;
    lsSet(MAGK,magazzino);
    updateStockBadge();
  }
  _posSnapshot=null;
  document.getElementById('pm').classList.remove('open');
  posIdx=null;
}
