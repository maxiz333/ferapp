// database.core.js - estratto da database.js

// [SECTION: DATABASE] ------------------------------------------------------
//  Costanti chiavi localStorage, variabili globali, dati di default
var SK=window.AppKeys.CURRENT,HK=window.AppKeys.HISTORY,RK=window.AppKeys.REMOVED,CK=window.AppKeys.CESTINO,CATK=window.AppKeys.CATEGORIE,MAGK=window.AppKeys.MAGAZZINO,MOVK=window.AppKeys.MOVIMENTI;
// CTK: chiave separata per i cartellini (NON sovrascritta da Firebase/rows)
var CTK=window.AppKeys.CARTELLINI;
var ctRows=[]; // array SOLO cartellini — separato da rows[] che è il database Firebase
var MAGEXT_K='magazzino_ext'; // nodo Firebase per i 14.000 articoli
var _magExtLoaded=false; // flag: articoli gi- caricati da Firebase
var lsGet=function(k,d){return window.AppStorage.get(k,d);};
var lsSet=function(k,v){
  window.AppStorage.set(k,v);
  if(typeof window!=='undefined' && typeof window.dispatchEvent==='function'){
    window.dispatchEvent(new CustomEvent('db-changed',{detail:{key:k}}));
  }
};

// [SECTION: UTILS] ---------------------------------------------------------
/** Converte stringa prezzo italiana (es. "12,50") in float */
function parsePriceIT(s){ return window.AppUtils.parsePriceIT(s); }

// Sconti forbice: rotolo = % fissa sul listino (non azzerare)
var SCONTO_ROTOLO_DEFAULT_PCT = 10;
var SCONTO_SCAMPOLO_DEFAULT_PCT = 30;
var SCONTO_SCAGLIONI_DEFAULT_PCT = 5;

/** UM con prezzo per unità base (kg, m, litro) e quantità nella UM di riga (es. g, cm, ml). */
function itemUsesPrezzoPerBaseUm(unit){
  var u = String(unit || '').toLowerCase();
  return u === 'kg' || u === 'g' || u === 'gr' || u === 'm' || u === 'mt' || u === 'cm' || u === 'ml' || u === 'lt';
}

/** Fattore: prezzoUnitàRiga = prezzoUnitàBase × fattore (es. g → 0,001 per €/kg). */
function itemUmToBasePriceFactor(unit){
  var u = String(unit || '').toLowerCase();
  if(u === 'kg' || u === 'm' || u === 'mt' || u === 'lt') return 1;
  if(u === 'g' || u === 'gr' || u === 'ml') return 0.001;
  if(u === 'cm') return 0.01;
  return 1;
}

function itemPrezzoBaseUmSuffix(unit){
  var u = String(unit || '').toLowerCase();
  if(u === 'kg' || u === 'g' || u === 'gr') return '€/kg';
  if(u === 'm' || u === 'mt' || u === 'cm') return '€/m';
  if(u === 'lt' || u === 'ml') return '€/l';
  return '€';
}

function itemUmQtyHint(unit){
  var u = String(unit || '').toLowerCase();
  if(u === 'kg') return 'kg';
  if(u === 'g' || u === 'gr') return 'g';
  if(u === 'm' || u === 'mt') return 'm';
  if(u === 'cm') return 'cm';
  if(u === 'lt') return 'l';
  if(u === 'ml') return 'ml';
  return '';
}

/** Testo per stampe (DDT, ricevuta, WA): es. "Prezzo base: 2,40 €/kg (qtà in g)". Vuoto se non c'è _prezzoUnitaBase valido. */
function itemRigaNotaPrezzoBasePlain(it){
  if(!it || !itemUsesPrezzoPerBaseUm(it.unit)) return '';
  if(it._prezzoUnitaBase == null || String(it._prezzoUnitaBase).trim() === '') return '';
  if(parsePriceIT(it._prezzoUnitaBase) <= 0) return '';
  return 'Prezzo base: ' + String(it._prezzoUnitaBase).trim() + ' ' + itemPrezzoBaseUmSuffix(it.unit) + ' (qtà in ' + itemUmQtyHint(it.unit) + ')';
}

/**
 * Sconto visualizzato sul prezzo per unità base (€/kg, €/m, €/l), stessa logica forbice della riga.
 * null se non applicabile.
 */
function itemBaseUmScontoDisplay(it){
  if(!it || !itemUsesPrezzoPerBaseUm(it.unit)) return null;
  var b0 = parsePriceIT(it._prezzoUnitaBase);
  if(b0 <= 0) return null;
  var sc = it._scontoApplicato || 0;
  var q = parseFloat(it.qty || 0);
  var scApplica = false;
  if(it._scaglionato && sc > 0){
    scApplica = q >= (it._scaglioneQta || 10);
  } else if((it.scampolo || it.fineRotolo) && sc > 0){
    scApplica = true;
  }
  var b1 = scApplica ? b0 * (1 - sc / 100) : b0;
  var hasSc = scApplica && b1 < b0 - 1e-9;
  return {
    b0: b0,
    b1: b1,
    hasSc: hasSc,
    savPerBase: hasSc ? (b0 - b1) : 0,
    suff: itemPrezzoBaseUmSuffix(it.unit),
    qh: itemUmQtyHint(it.unit)
  };
}

/** Formatta €/unità riga per la UI: evita "0,00" quando il prezzo è molto piccolo (es. €/g). */
function formatPrezzoUnitDisplay(n){
  var x = typeof n === 'number' ? n : parsePriceIT(n);
  if(!isFinite(x) || x < 0) x = 0;
  if(x === 0) return '0,00';
  var s;
  if(x >= 0.01) s = x.toFixed(2);
  else if(x >= 0.0001) s = x.toFixed(4);
  else if(x >= 0.00000001) s = x.toFixed(6);
  else s = Number(x).toExponential(2);
  return String(s).replace('.', ',');
}

/** Prezzo unitario con sconto: listino barrato sopra, finale grande verde sotto, risparmio (compat: classi ct-old--orig / ct-sub--final). */
function htmlPrezzoUnitScontoRiga(prezListino, prezFinale){
  var sav = prezListino - prezFinale;
  return '<span class="ct-prz-stack ct-prz-stack--unit">' +
    '<span class="ct-old--orig">€' + formatPrezzoUnitDisplay(prezListino) + '</span>' +
    '<span class="ct-sub--final">€' + formatPrezzoUnitDisplay(prezFinale) + '</span>' +
    '<span class="ct-prz-sconto-sav">-€' + formatPrezzoUnitDisplay(sav) + '</span>' +
    '</span>';
}

/** Totale riga con sconto: stesso impilamento verticale. */
function htmlTotaleScontoRiga(importoListino, importoFinale){
  var sav = importoListino - importoFinale;
  return '<span class="ct-prz-stack ct-prz-stack--tot">' +
    '<span class="ct-old--orig">€' + formatPrezzoUnitDisplay(importoListino) + '</span>' +
    '<span class="ct-sub--final">€' + formatPrezzoUnitDisplay(importoFinale) + '</span>' +
    '<span class="ct-prz-sconto-sav">-€' + formatPrezzoUnitDisplay(sav) + '</span>' +
    '</span>';
}

/** Prezzo listino (numerico): mai il prezzo già scontato se esiste _prezzoOriginale o rows[rowIdx] */
function listinoPrezzoNum(it){
  if(it._prezzoOriginale != null && String(it._prezzoOriginale).trim() !== ''){
    var po = parsePriceIT(it._prezzoOriginale);
    if(po > 0) return po;
  }
  if(it && itemUsesPrezzoPerBaseUm(it.unit) && it._prezzoUnitaBase != null && String(it._prezzoUnitaBase).trim() !== ''){
    var pb = parsePriceIT(it._prezzoUnitaBase);
    if(pb > 0) return pb * itemUmToBasePriceFactor(it.unit);
  }
  if(it.rowIdx != null && it.rowIdx !== '' && typeof rows !== 'undefined' && rows && rows[it.rowIdx] != null){
    var rn = parsePriceIT(rows[it.rowIdx].prezzo);
    if(rn > 0) return rn;
  }
  var pu = parsePriceIT(it.prezzoUnit);
  if(pu > 0) return pu;
  return 0;
}

/** Stringa da salvare in _prezzoOriginale (formato listino) */
function listinoPrezzoString(it){
  if(it && itemUsesPrezzoPerBaseUm(it.unit) && it._prezzoUnitaBase != null && String(it._prezzoUnitaBase).trim() !== ''){
    var pbs0 = parsePriceIT(it._prezzoUnitaBase);
    if(pbs0 > 0){
      var lineS0 = pbs0 * itemUmToBasePriceFactor(it.unit);
      if(lineS0 > 0) return String(lineS0).replace('.', ',');
    }
  }
  if(it.rowIdx != null && it.rowIdx !== '' && typeof rows !== 'undefined' && rows && rows[it.rowIdx] != null){
    var rp = rows[it.rowIdx].prezzo;
    if(rp != null && String(rp).trim() !== '' && parsePriceIT(rp) > 0) return String(rp);
  }
  if(it._prezzoOriginale != null && String(it._prezzoOriginale).trim() !== '' && parsePriceIT(it._prezzoOriginale) > 0) return String(it._prezzoOriginale);
  if(it.prezzoUnit != null && String(it.prezzoUnit).trim() !== '' && parsePriceIT(it.prezzoUnit) > 0) return String(it.prezzoUnit);
  return '';
}

/**
 * Garantisce _prezzoOriginale dal listino (rows → prezzoUnit). Non modifica rows[] / Firebase.
 * @param fillPrezzoUnit se true e prezzoUnit è vuoto/0, lo imposta al listino.
 */
function ensurePrezzoOriginaleDaListino(it, fillPrezzoUnit){
  var str = listinoPrezzoString(it);
  if(!str) return false;
  if(!it._prezzoOriginale || parsePriceIT(it._prezzoOriginale) <= 0) it._prezzoOriginale = str;
  if(fillPrezzoUnit && (!it.prezzoUnit || parsePriceIT(it.prezzoUnit) <= 0)) it.prezzoUnit = str;
  return true;
}

/** €/unità mostrato in totale riga ordine: usa prezzoUnit se valido, altrimenti listino + forbice */
function ordItemLineUnitSelling(it){
  var u = parsePriceIT(it.prezzoUnit);
  if(u > 0) return u;
  var p = listinoPrezzoNum(it);
  if(p <= 0) return 0;
  var sc = it._scontoApplicato || 0;
  if((it.scampolo || it.fineRotolo) && sc > 0) return p * (1 - sc / 100);
  if(it._scaglionato && sc > 0){
    var q = parseFloat(it.qty || 0);
    if(q >= (it._scaglioneQta || 10)) return p * (1 - sc / 100);
  }
  return p;
}

/** Riga congelata (rimossa dal banco ma tenuta in bozza/ordine). */
function ordItemCongelato(it){ return !!(it && it.congelato); }

/** Indici righe per lista ordini: articoli attivi prima, congelati sempre in fondo. */
function ordineIndiciOrdineDisplay(ord){
  return ordineIndiciItemsDisplay(ord.items||[]);
}
/** Stesso ordinamento attivi→congelati su un array items (es. overlay modifica). */
function ordineIndiciItemsDisplay(items){
  items=items||[];
  var out=[];
  for(var i=0;i<items.length;i++){ if(!ordItemCongelato(items[i])) out.push(i); }
  for(var j=0;j<items.length;j++){ if(ordItemCongelato(items[j])) out.push(j); }
  return out;
}

/** Totale € solo righe non congelate (tab ordini, cassa, stampa). */
function ordTotaleSenzaCongelati(ord){
  return (ord.items||[]).reduce(function(s,it){
    if(ordItemCongelato(it)) return s;
    return s + parsePriceIT(it.prezzoUnit)*parseFloat(it.qty||0);
  },0);
}

/** Solo articoli attivi — per sync carrello ↔ bozza. */
function ordItemsSoloAttiviDeep(items){
  return JSON.parse(JSON.stringify((items||[]).filter(function(it){ return !ordItemCongelato(it); })));
}

/** True se due righe ordine rappresentano lo stesso articolo (per undo rimozione carrello). */
function ordineItemMatchPerUndo(a,b){
  if(!a||!b) return false;
  return (a.desc||'')===(b.desc||'') && String(a.codM||'')===String(b.codM||'') && String(a.codF||'')===String(b.codF||'') &&
    Math.abs(parseFloat(a.qty||0)-parseFloat(b.qty||0))<0.0001;
}

/** Max righe cronologia operazioni su ordine (persistenza in ordini[]). */
var ORDINE_STORICO_MAX = 400;

/** Bozza attiva o ordine in modifica collegato al carrello — per cronologia. */
function ordinePerCarrelloStorico(cart){
  if(!cart||typeof ordini==='undefined'||!ordini) return null;
  if(cart.bozzaOrdId){
    var o=ordini.find(function(x){ return x.id===cart.bozzaOrdId; });
    if(o&&o.stato==='bozza') return o;
  }
  if(cart.ordId && cart.stato==='modifica'){
    return ordini.find(function(x){ return x.id===cart.ordId; })||null;
  }
  return null;
}

/** Aggiunge una riga alla cronologia ordine (più recente in testa). */
function ordineAppendStorico(ord, descrizione){
  if(!ord||!descrizione) return;
  if(!ord.storicoOperazioni) ord.storicoOperazioni = [];
  var d=new Date();
  ord.storicoOperazioni.unshift({
    at: d.toISOString(),
    label: d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
    msg: String(descrizione).slice(0,500)
  });
  if(ord.storicoOperazioni.length > ORDINE_STORICO_MAX) ord.storicoOperazioni.length = ORDINE_STORICO_MAX;
}

/** Legge e trimma il valore di un input per id */
function gf(id){ var el=document.getElementById(id); return el?(el.value||'').trim():''; }
var rows=[], removed=new Set(lsGet(RK,[])), cestino=lsGet(CK,[]);
var movimenti=lsGet(MOVK)||[];
var sortCol=null, sortDir=1, noteIdx=null, pendingImport=[];
var categorie=[], magazzino={};
var _epIdx=null, _epSnapshot=null, _epIsNew=false, _epFromCart=false;

var DEF=[]; // Cartellini partono sempre vuoti — si aggiungono via CSV o ricerca


// -- Scorta minima default = 1 ------------------------------
function getSoglia(i){
  var m=magazzino[i]||{};
  if(m.soglia!==undefined && m.soglia!=='' && m.soglia!==null) return Number(m.soglia);
  return 1; // default
}

function getQty(i){
  var m=magazzino[i]||{};
  return m.qty!==undefined&&m.qty!==''?Number(m.qty):null;
}

// Toast "sotto scorta"
var _toastTimer=null;
function showScortaToast(desc, qty, soglia){
  var el=document.getElementById('scorta-toast');
  if(!el) return;
  el.textContent='- SCORTA BASSA\n' + desc + '\nRimasti: ' + qty + ' | Min: ' + soglia;
  el.classList.add('show');
  if(_toastTimer) clearTimeout(_toastTimer);
  _toastTimer=setTimeout(function(){ el.classList.remove('show'); },4000);
}

// Controlla scorta dopo modifica qty e mostra toast se necessario
function checkScorta(i, nuovaQty, prevQty){
  var soglia=getSoglia(i);
  var desc=(rows[i]&&rows[i].desc)||'Articolo';
  // Avvisa solo se: nuova qty - sotto soglia E stava scendendo (vendita)
  if(nuovaQty !== null && nuovaQty <= soglia){
    if(prevQty === null || nuovaQty < prevQty || nuovaQty === 0){
      showScortaToast(desc, nuovaQty, soglia);
    }
  }
}

function autoSize(p){return window.AppUtils.autoSize(p);}

// Categorie default ferramenta
var CAT_DEFAULT=[
  {id:'vit',nome:'Viteria & Bulloneria',sub:['Viti autofilettanti','Viti per legno','Bulloni','Dadi e rondelle','Tirafondi','Ganci e occhielli']},
  {id:'chi',nome:'Chiodi & Ancoraggi',sub:['Chiodi lisci','Chiodi ramati','Tasselli','Ancore chimiche','Staffe']},
  {id:'ele',nome:'Elettrico',sub:['Cavi e fili','Prese e interruttori','Quadri elettrici','Lampadine','Fascette e passacavi','Nastro isolante','Tubi corrugati']},
  {id:'idr',nome:'Idraulica',sub:['Tubi e raccordi','Valvole e rubinetti','Sifoni e scarichi','Guarnizioni','Pompe']},
  {id:'edi',nome:'Edilizia',sub:['Cemento e malte','Reti e griglie','Teli e impermeabilizzanti','Viti da cartongesso','Profili']},
  {id:'ute',nome:'Utensileria',sub:['Utensili manuali','Utensili elettrici','Punte e frese','Accessori utensili','Misura e tracciatura']},
  {id:'ver',nome:'Verniciatura',sub:['Smalti e vernici','Primer e fondi','Pennelli e rulli','Carta vetrata','Nastro da carrozziere']},
  {id:'fis',nome:'Fissaggi & Colla',sub:['Siliconi','Colle bicomponenti','Nastri biadesivi','Schiume poliuretaniche','Sigillanti']},
  {id:'sic',nome:'Sicurezza & DPI',sub:['Mascherine','Guanti','Occhiali','Scarpe antinfortunio','Caschi']},
  {id:'gia',nome:'Giardinaggio',sub:['Decespugliatori','Tagliaerba','Tubi irrigazione','Attrezzi giardino']},
  {id:'fco',nome:'Ferramenta Comune',sub:['Cerniere','Serrature','Maniglie','Ganci e supporti','Guida e binari']},
  {id:'aut',nome:'Auto & Moto',sub:['Oli e lubrificanti','Accessori auto','Catene e cavi','Shampoo e pulizia']},
  {id:'alt',nome:'Altro',sub:['Varie']},
];

// --- TOGGLE TEMA CHIARO/SCURO -------------------------------------------
function toggleTheme(){
  var body=document.body;
  var isLight=body.classList.toggle('light-mode');
  localStorage.setItem(window.AppKeys.THEME, isLight?'light':'dark');
  _updateThemeBtn(isLight);
}
function _updateThemeBtn(isLight){
  var icon=document.getElementById('theme-icon');
  var label=document.getElementById('theme-label');
  if(icon)icon.textContent=isLight?'--':'-';
  if(label)label.textContent=isLight?'Tema scuro':'Tema chiaro';
}
function initTheme(){
  var t=localStorage.getItem(window.AppKeys.THEME);
  var isLight=(t==='light');
  if(isLight) document.body.classList.add('light-mode');
  _updateThemeBtn(isLight);
}

// --- CREA NUOVO ARTICOLO DAL CARRELLO -----------------------------------
// --- NUOVO ARTICOLO DA CARRELLO -------------------------------
function openNuovoArticoloDaCarrello(){
  ['nac-desc','nac-prezzo','nac-codf','nac-codm','nac-nota'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.value='';
  });
  var qty=document.getElementById('nac-qty');if(qty)qty.value=1;
  var unit=document.getElementById('nac-unit');if(unit)unit.value='pz';
  document.getElementById('nac-overlay').classList.add('open');
  setTimeout(function(){var d=document.getElementById('nac-desc');if(d)d.focus();},150);
}
function nacChiudi(){document.getElementById('nac-overlay').classList.remove('open');}
function nacConferma(){
  if(!activeCartId)return;
  var cart=carrelli.find(function(c){return c.id===activeCartId;});if(!cart)return;
  var desc=(document.getElementById('nac-desc')||{}).value||'';
  if(!desc.trim()){showToastGen('red','-- Inserisci una descrizione');return;}
  var prezzo=(document.getElementById('nac-prezzo')||{}).value||'0';
  var qty=parseFloat((document.getElementById('nac-qty')||{}).value)||1;
  var unit=(document.getElementById('nac-unit')||{}).value||'pz';
  var codF=(document.getElementById('nac-codf')||{}).value||'';
  var codM=(document.getElementById('nac-codm')||{}).value||'';
  var nota=(document.getElementById('nac-nota')||{}).value||'';
  (cart.items=cart.items||[]).push({desc:desc.trim(),codF:codF,codM:codM,prezzoUnit:prezzo,qty:qty,unit:unit,nota:nota,scampolo:false,hasScaglioni:false,scaglioni:[],_scaglioniAperti:false});
  saveCarrelli();nacChiudi();renderCartTabs();
  showToastGen('green','- Articolo aggiunto');
}


function init(){
  // rows = database Firebase (caricato da loadMagazzinoFB, non da SK)
  // ctRows = cartellini (chiave separata CTK)
  var savedCt = lsGet(CTK, null);
  ctRows = (savedCt && savedCt.length) ? savedCt : [];

  // SK era usato per i cartellini nelle versioni precedenti.
  // Se contiene dati vecchi e sono pochi (cartellini), migra a CTK poi svuota SK.
  var savedSK = lsGet(SK, null);
  if(savedSK && savedSK.length > 0 && savedSK.length <= 500 && !ctRows.length){
    // Migrazione: vecchi cartellini da SK -> CTK
    ctRows = savedSK;
    lsSet(CTK, ctRows);
    lsSet(SK, []);
    console.log('init: migrati '+ctRows.length+' cartellini da SK a CTK');
  } else if(savedSK && savedSK.length > 500){
    // SK corrotto (erano i 19.000 articoli Firebase salvati per errore) — azzera
    console.warn('init: SK corrotto ('+savedSK.length+' righe), azzerato');
    lsSet(SK, []);
  }

  // rows parte vuoto — verrà popolato da loadMagazzinoFB (Firebase)
  rows = [];

  categorie=lsGet(CATK,null)||CAT_DEFAULT.map(function(c){return Object.assign({},c,{sub:c.sub.slice()});});
  magazzino=lsGet(MAGK,{});
  // Precarica tutte le foto da IndexedDB in cache (poi ri-renderizza)
  idbPreloadAll().then(function(){ renderTable(); renderMagazzino(); renderCartTabs(); renderOrdini(); });
  renderTable(); genTags(); updateStats(); updateBadge(); updateStockBadge(); renderInventario(); updateCartBadge(); updateOrdBadge(); updateMovBadge();
  _undoReady = true; // da qui in poi _takeSnapshot - attiva
  setTimeout(checkAutoBackup, 2500);
  loadFatture();
  loadOrdFor();
  // Avvia sull'inventario
  goTab('t0');
}
function esc(s){return window.AppUtils.esc(s);}
function sel(id,val,opts,onch){
  return '<select id="'+id+'" onchange="'+onch+'">'+opts.map(function(o){return '<option value="'+o[0]+'"'+(o[0]===val?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>';
}

var GIORNALINI=[
  {val:'',label:'-',color:'#e5e7eb',text:'#666',nastro:'#6b7280'},
  {val:'rosso',label:'-',color:'#fee2e2',text:'#dc2626',nastro:'#dc2626'},
  {val:'giallo',label:'-',color:'#fef9c3',text:'#ca8a04',nastro:'#ca8a04'},
  {val:'verde',label:'-',color:'#dcfce7',text:'#15803d',nastro:'#15803d'},
  {val:'blu',label:'-',color:'#dbeafe',text:'#1d4ed8',nastro:'#1d4ed8'},
  {val:'viola',label:'-',color:'#f3e8ff',text:'#7c3aed',nastro:'#7c3aed'},
  {val:'arancio',label:'-',color:'#ffedd5',text:'#ea580c',nastro:'#ea580c'},
];

function getGiornalino(val){return GIORNALINI.find(function(g){return g.val===val;})||GIORNALINI[0];}

function selGiornalino(id,val,i){
  var g=getGiornalino(val);
  var opts=GIORNALINI.map(function(g){return '<option value="'+g.val+'"'+(g.val===val?' selected':'')+'>'+g.label+'</option>';}).join('');
  return '<select id="'+id+'" onchange="upd('+i+')" style="background:'+g.color+';color:'+g.text+';font-size:14px;padding:2px;">'+opts+'</select>';
}

// Paginazione tabella - performance con cataloghi grandi
var _tablePageSize = 300;
var _tableShowAll  = false;
var _filterIndices = null; // null = mostra tutto; array = indici filtrati
