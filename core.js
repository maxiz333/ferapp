/**
 * -----------------------------------------------------------------------
 *  RATTAZZI - app.js
 *  - CARRELLO: ricerca, numpad, sconto, scaglioni, DDT
 *  - ORDINI: lista, dettaglio, cassa, auto-refresh
 *  - MOVIMENTI: registrazione, filtri, report
 *  - AI/FOTO: import articoli da foto
 *  - UI: tema, ricerca globale, popup, backup, correlati
 *  - FORNITORI: ordini, fatture
 *  - FIREBASE: sync real-time
 * -----------------------------------------------------------------------
 */

// ══ VARIABILI GLOBALI ══════════════════════════════════════════════
var CARTK=window.AppKeys.CARRELLI, ORDK=window.AppKeys.ORDINI, CART_CK=window.AppKeys.CARRELLI_CESTINO;
var carrelli=lsGet(CARTK)||[], ordini=lsGet(ORDK)||[];
var carrelliCestino=lsGet(CART_CK)||[];
var activeCartId=null;
for(var _ci=carrelli.length-1;_ci>=0;_ci--){
  var _c=carrelli[_ci];
  if(_c&&_c.id!=='__dao_forn_staging__'&&!_c._daoFornStaging){ activeCartId=_c.id; break; }
}
var ordFiltro='nuovo';
var ORDK_ARCH=window.AppKeys.ORDINI_ARCHIVIO;
/** Archivio ordini completati (lazy: non leggiamo localStorage all'avvio se non serve). */
var ordiniArchivio;
var ordFornStorico=lsGet(window.AppKeys.ORD_FORN_STORICO,[]);

function getOrdiniArchivio(){
  if(ordiniArchivio===undefined||ordiniArchivio===null)
    ordiniArchivio=lsGet(ORDK_ARCH)||[];
  return ordiniArchivio;
}

/**
 * Mezzanotte del lunedì della settimana SCORSA (ms).
 * La tab attiva conserva la settimana corrente + tutta la settimana scorsa:
 * ciò che è più vecchio di questo cutoff "scivola" nello Storico.
 * La domenica è considerata parte della settimana che si chiude.
 */
function _ordCutoffArchivioMs(){
  var d = new Date();
  d.setHours(0, 0, 0, 0);
  var jsDay = d.getDay();                        // 0=Dom … 6=Sab
  var daLunedi = (jsDay === 0 ? 6 : jsDay - 1);  // distanza dal lunedì corrente
  d.setDate(d.getDate() - daLunedi - 7);         // lunedì della settimana scorsa
  return d.getTime();
}
/** Fallback se manca ogni data affidabile: 15 giorni fa → sempre oltre il cutoff (max 13 gg). */
var _ORD_COMPLETATO_FALLBACK_MS = 15 * 24 * 60 * 60 * 1000;

function _ordParseItalianDataMs(dataStr){
  var data = String(dataStr || '').trim();
  var m = data.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if(!m) return 0;
  var year = m[3].length === 2 ? ('20' + m[3]) : m[3];
  var d = new Date(Number(year), Number(m[2]) - 1, Number(m[1]));
  var t = d.getTime();
  return isNaN(t) ? 0 : t;
}

/** Timestamp completamento per il calcolo del cutoff di archiviazione (ms). */
function _ordCompletatoAtMs(o){
  if(!o) return 0;
  var candidates = [o.completatoAtISO, o.createdAt, o.dataISO];
  for(var i = 0; i < candidates.length; i++){
    var raw = candidates[i];
    if(!raw) continue;
    var t = new Date(raw).getTime();
    if(!isNaN(t) && t > 0) return t;
  }
  var fromData = _ordParseItalianDataMs(o.data);
  if(fromData) return fromData;
  return Date.now() - _ORD_COMPLETATO_FALLBACK_MS;
}

/**
 * Unione per id di due archivi ordini: nessun lato può cancellare ordini
 * archiviati dall'altro. In caso di id presente su entrambi vince il locale.
 * Le voci senza id vengono mantenute (dal remoto solo se non duplicate).
 */
function _ordArchMergeById(localArr, remoteArr){
  localArr = Array.isArray(localArr) ? localArr : [];
  remoteArr = Array.isArray(remoteArr) ? remoteArr : [];
  var localIds = {};
  localArr.forEach(function(o){ if(o && o.id != null) localIds[String(o.id)] = true; });
  var merged = localArr.slice();
  remoteArr.forEach(function(ro){
    if(!ro) return;
    if(ro.id != null && localIds[String(ro.id)]) return;
    merged.push(ro);
  });
  return merged;
}

/**
 * Push esplicito dell'archivio su shared/ordini_archivio via transaction
 * con merge per id: non viene mai "saltato" (a differenza del lsSet patchato,
 * che ignora il push quando _fbSharedSyncing è attivo) e non sovrascrive
 * ciecamente ordini archiviati da altri dispositivi.
 */
function _ordArchPushFirebase(){
  if(typeof _fbReady === 'undefined' || !_fbReady || !_fbDb) return;
  var localSnapshot = (getOrdiniArchivio() || []).slice();
  try{
    _fbDb.ref('shared/ordini_archivio').transaction(function(remoteRaw){
      var remoteArr = remoteRaw
        ? (Array.isArray(remoteRaw) ? remoteRaw : Object.values(remoteRaw)).filter(function(x){ return x != null; })
        : [];
      var merged = _ordArchMergeById(localSnapshot, remoteArr);
      return merged.length ? merged : null;
    }, function(err, committed, snap){
      if(err){ console.error('[ARCH] push archivio Firebase FALLITO:', err); return; }
      if(!committed) return;
      // Allinea anche lo stato locale al valore confermato (può contenere
      // ordini archiviati da altri dispositivi recuperati dal merge).
      try{
        var confirmed = snap && snap.val();
        if(confirmed){
          var arr = Array.isArray(confirmed) ? confirmed : Object.values(confirmed);
          arr = arr.filter(function(x){ return x != null; });
          ordiniArchivio = arr;
          if(typeof window !== 'undefined' && window.AppStorage) window.AppStorage.set(ORDK_ARCH, arr);
        }
      }catch(e){}
    }, false);
  }catch(e){ console.error('[ARCH] push archivio Firebase errore:', e); }
}
window._ordArchPushFirebase = _ordArchPushFirebase;

/**
 * Archivia gli ordini completati usciti dalle 2 settimane attive
 * (settimana corrente + settimana scorsa), dopo il sync Firebase.
 * Gli ordini "unlocked" vengono comunque archiviati se superano il cutoff.
 * @returns {number} quanti ordini spostati
 */
function eseguiArchiviazioneAutomatica(){
  if(!Array.isArray(ordini)) return 0;
  var cutoffMs = _ordCutoffArchivioMs();
  var daArch = [];
  ordini = ordini.filter(function(o){
    if(!o || o.stato !== 'completato') return true;
    var compAt = _ordCompletatoAtMs(o);
    if(compAt < cutoffMs){
      if(!o.completatoAtISO || isNaN(new Date(o.completatoAtISO).getTime())){
        o.completatoAtISO = new Date(compAt).toISOString();
      }
      if(o.unlocked === true) o.unlocked = false;
      daArch.push(o);
      return false;
    }
    return true;
  });
  if(!daArch.length) return 0;

  var prev = getOrdiniArchivio();
  if(!Array.isArray(prev)) prev = [];
  // Dedupe per id: un doppio giro non deve duplicare le card nello Storico.
  // NB: gli id rimossi da ordini[] (per il push con intentionalDelete) restano
  // quelli di TUTTI gli ordini filtrati, anche se già presenti in archivio.
  var prevIds = {};
  prev.forEach(function(o){ if(o && o.id != null) prevIds[String(o.id)] = true; });
  var daArchNuovi = daArch.filter(function(o){
    return !(o && o.id != null && prevIds[String(o.id)]);
  });
  ordiniArchivio = daArchNuovi.concat(prev);
  // Evita il set() cieco del lsSet patchato su shared/ordini_archivio:
  // il push lo fa SOLO _ordArchPushFirebase con merge per id (transaction).
  var _archPath = 'shared/ordini_archivio';
  var _hasFlag = (typeof _fbSharedSyncing !== 'undefined');
  var _flagPrec = _hasFlag ? _fbSharedSyncing[_archPath] : undefined;
  if(_hasFlag) _fbSharedSyncing[_archPath] = true;
  try{
    lsSet(ORDK_ARCH, ordiniArchivio);
  } finally {
    if(_hasFlag) _fbSharedSyncing[_archPath] = _flagPrec || false;
  }
  _ordArchPushFirebase();

  var ids = daArch.map(function(o){ return o.id; }).filter(Boolean);
  var opts = (typeof _ordSaveOptsForArchive === 'function')
    ? _ordSaveOptsForArchive(ids)
    : (ids.length ? { intentionalDelete: { ids: ids } } : null);

  if(typeof saveOrdini === 'function'){
    saveOrdini(opts || {});
  } else {
    lsSet(ORDK, ordini);
  }
  return daArch.length;
}
window.eseguiArchiviazioneAutomatica = eseguiArchiviazioneAutomatica;

/** True se l'ordine è segnato visto (boolean o valori legacy da Firebase/export). */
function _ordVistoCoerceBool(v){
  return v === true || v === 1 || v === 'true' || v === '1';
}
function ordVistoMostraIcona(o){
  return !!(o && _ordVistoCoerceBool(o.visto));
}

// Campo visto (ufficio → telefono): boolean esplicito per ordini legacy senza chiave
(function(){
  if(!Array.isArray(ordini)) return;
  var changed = false;
  ordini.forEach(function(o){
    if(!o || typeof o.visto === 'boolean') return;
    o.visto = _ordVistoCoerceBool(o.visto);
    changed = true;
  });
  if(changed) lsSet(ORDK, ordini);
})();

var _fb=null,_fbDb=null,_fbReady=false,_fbSyncing=false,_fbSyncingCart=false;

// Ripara dati da Firebase (converte oggetti in array)
function _fbFix(data){
  if(!data)return[];
  var arr=Array.isArray(data)?data:Object.values(data);
  arr=arr.filter(function(x){return x!=null;});
  arr.forEach(function(item){
    if(!item)return;
    if(!item.items)item.items=[];
    if(!Array.isArray(item.items))item.items=Object.values(item.items).filter(function(x){return x!=null;});
    item.items.forEach(function(it){
      if(it&&it.scaglioni&&!Array.isArray(it.scaglioni)){
        it.scaglioni=Object.values(it.scaglioni).filter(function(x){return x!=null;});
      }
    });
  });
  return arr;
}

// _fbPush / saveCarrelli / saveOrdini -> core.sync-save.js


// ══ FEEDBACK / TOAST / CONFIRM / BADGES ═══════════════════════════
// --- FEEDBACK (vibra + suono) ---------------------------------
function feedbackAdd(){
  // Vibrazione breve
  if(navigator.vibrate)navigator.vibrate(50);
  // Beep sottile
  try{
    var ctx=new(window.AudioContext||window.webkitAudioContext)();
    var osc=ctx.createOscillator();var gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    osc.frequency.value=1200;
    gain.gain.setValueAtTime(0.12,ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0,ctx.currentTime+0.1);
    osc.start();osc.stop(ctx.currentTime+0.1);
  }catch(e){}
}
function feedbackSend(){
  if(navigator.vibrate)navigator.vibrate([100,50,100]);
  try{
    var ctx=new(window.AudioContext||window.webkitAudioContext)();
    [0,150,300].forEach(function(d){
      var osc=ctx.createOscillator();var gain=ctx.createGain();
      osc.connect(gain);gain.connect(ctx.destination);
      osc.frequency.value=880;
      gain.gain.setValueAtTime(0,ctx.currentTime+d/1000);
      gain.gain.linearRampToValueAtTime(0.15,ctx.currentTime+d/1000+0.04);
      gain.gain.linearRampToValueAtTime(0,ctx.currentTime+d/1000+0.15);
      osc.start(ctx.currentTime+d/1000);osc.stop(ctx.currentTime+d/1000+0.2);
    });
  }catch(e){}
}

// --- NUMERO ORDINE PROGRESSIVO (giornaliero, riparte ogni giorno) ---
function _ordCounterDayKey(){
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function _ordOrderDayISO(ord){
  if(!ord) return '';
  if(typeof _ordGetFilterDateISO === 'function') return _ordGetFilterDateISO(ord);
  if(ord.dataISO) return ord.dataISO;
  if(ord.createdAt) return String(ord.createdAt).slice(0, 10);
  if(ord.data){
    var p = String(ord.data).trim().split('/');
    if(p.length === 3){
      var y = p[2].length === 2 ? ('20' + p[2]) : p[2];
      return y + '-' + p[1].padStart(2, '0') + '-' + p[0].padStart(2, '0');
    }
  }
  return '';
}

/** Massimo numero ordine già usato oggi (ordini attivi in memoria). */
function _ordMaxNumeroOggi(){
  var oggi = _ordCounterDayKey();
  var max = 0;
  (ordini || []).forEach(function(o){
    if(!o || o.numero == null || o.numero === '') return;
    if(_ordOrderDayISO(o) !== oggi) return;
    var n = parseInt(o.numero, 10);
    if(!isNaN(n) && n > max) max = n;
  });
  return max;
}

function getNextOrdNum(){
  var oggi = _ordCounterDayKey();
  var dayK = window.AppKeys.ORD_COUNTER + '_day';
  var lastDay = '';
  try{ lastDay = localStorage.getItem(dayK) || ''; }catch(e){}
  var stored = 0;
  if(lastDay === oggi){
    stored = parseInt(localStorage.getItem(window.AppKeys.ORD_COUNTER) || '0', 10);
    if(isNaN(stored)) stored = 0;
  }
  stored = Math.max(stored, _ordMaxNumeroOggi());
  var num = stored + 1;
  try{
    localStorage.setItem(window.AppKeys.ORD_COUNTER, String(num));
    localStorage.setItem(dayK, oggi);
  }catch(e){}
  return num;
}

/** True su layout “ufficio”: ≥768px (iPad/finestre affiancate) oppure PC con mouse e finestra non minuscola. */
function ordineUfficioIsWide(){
  try{
    if(window.matchMedia){
      if(window.matchMedia('(min-width: 768px)').matches) return true;
      try{
        if(window.matchMedia('(pointer: fine)').matches && window.matchMedia('(min-width: 480px)').matches) return true;
      }catch(e2){}
    }
  }catch(e){}
  return typeof window.innerWidth === 'number' && window.innerWidth >= 768;
}

/**
 * Segna ordine/bozza come visto dall’ufficio e sincronizza subito (Firebase + altri device).
 * Solo su schermo largo: il telefono in negozio non imposta mai visto.
 * @param {object|string} ordOrId ordine o id
 */
function ordineSegnaVistoSeUfficio(ordOrId){
  if(typeof ordini === 'undefined' || !ordini || !ordineUfficioIsWide()) return;
  try{
    var id = ordOrId && ordOrId.id ? ordOrId.id : ordOrId;
    if(!id) return;
    var ord = ordini.find(function(o){ return o && o.id === id; });
    if(!ord || ordVistoMostraIcona(ord)) return;
    ord.visto = true;
    if(typeof saveOrdini === 'function') saveOrdini();
  }catch(e){ console.warn('ordineSegnaVistoSeUfficio', e); }
}

/**
 * Dopo una modifica dal banco (schermo stretto = negozio), l'ufficio deve
 * rivedere l'ordine: azzera "visto" solo se era già segnato.
 * Su layout ufficio (largo) non fa nulla, così chi modifica dall'ufficio non
 * resetta l'indicatore inutilmente.
 */
function ordineResetVistoSeNegozio(ordOrId){
  if(typeof ordini === 'undefined' || !ordini || ordineUfficioIsWide()) return;
  try{
    var id = ordOrId && ordOrId.id ? ordOrId.id : ordOrId;
    if(!id) return;
    var ord = ordini.find(function(o){ return o && o.id === id; });
    if(!ord || !ordVistoMostraIcona(ord)) return;
    ord.visto = false;
  }catch(e){ console.warn('ordineResetVistoSeNegozio', e); }
}

// --- ULTIMO ARTICOLO AGGIUNTO (per ripeti) --------------------
var _lastAddedItem=null;

// --- TOAST ---------------------------------------------------
// _toastTimer gi- dichiarato nella sezione Magazzino (riusato qui)
var _TOAST_COLORS={green:'#38a169',purple:'#805ad5',blue:'#3182ce',red:'#e53e3e',orange:'#dd6b20'};

// --- CONFIRM DIALOG -------------------------------------------
var _confirmCb=null;

// --- BADGES ---------------------------------------------------
function updateCartBadge(){
  var b=document.getElementById('cart-badge');
  if(!b||!Array.isArray(carrelli))return;
  var n=carrelli.reduce(function(s,c){
    if(!c||!c.items) return s;
    if(c.id==='__dao_forn_staging__'||c._daoFornStaging) return s;
    if(typeof _cartIsStagingCart==='function'&&_cartIsStagingCart(c)) return s;
    return s+c.items.length;
  },0);
  b.textContent=n;b.style.display=n?'':'none';
}
function updateOrdBadge(){
  var n=ordini.filter(function(o){return o.stato==='nuovo';}).length;
  var b=document.getElementById('ord-badge');
  if(b){b.textContent=n;b.style.display=n?'':'none';}
}


// ══ NUMPAD GENERICO ═══════════════════════════════════════════════
// --- NUMPAD ---------------------------------------------------
var _numpadValue='';
var _numpadCallback=null;
var _numpadUnit='';

function openNumpad(label,currentVal,unit,callback){
  _numpadValue=String(currentVal||'');
  _numpadCallback=callback;
  _numpadUnit=unit||'';
  document.getElementById('numpad-label').textContent=label||'Quantit-';
  document.getElementById('numpad-display').textContent=_numpadValue||'0';
  document.getElementById('numpad-unit').textContent=_numpadUnit;
  document.getElementById('numpad-overlay').classList.add('open');
}
function closeNumpad(){
  document.getElementById('numpad-overlay').classList.remove('open');
  _numpadCallback=null;
}
function numpadPress(key){
  if(key==='C'){_numpadValue='';} 
  else if(key==='.'){if(_numpadValue.indexOf('.')<0)_numpadValue+='.';} 
  else{_numpadValue+=key;}
  document.getElementById('numpad-display').textContent=_numpadValue||'0';
}
function numpadConfirm(){
  var val=parseFloat(_numpadValue)||0;
  if(_numpadCallback)_numpadCallback(val);
  closeNumpad();
}

// _MAG_FIELDS / _fbSaveArticolo / wrap save+quickEditPrice -> core.sync-save.js
// _showLoadingBar / _updateLoadingBar / _hideLoadingBar -> core.loading.js

// loadMagazzinoFB -> core.magazzino-loader.js


// Blocchi estratti:
// - lock collaborativo ordini -> core.lock.js
// - autenticazione/ruoli/login -> core.auth.js


// Blocchi estratti:
// - _extractMagFromRows / esportaDatabaseCSV / fbSyncTuttoMagazzino -> core.magtools.js
// - modalità cassa (_cassaMode*) -> core.cassa.js
