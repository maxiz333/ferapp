// database.undo.js - estratto da database.js

// [SECTION: UNDO/REDO] -----------------------------------------------------
//  Snapshot globale prima di ogni salvataggio (max 20 step)
var _undoStack = [];
var _redoStack = [];
var _undoLock  = false; // evita snapshot ricorsivi durante restore

var _undoReady = false;

function _updateUndoButtons(){
  var btnB = document.getElementById('back-btn');
  var btnF = document.getElementById('forward-btn');
  if(btnB){
    btnB.style.opacity       = _undoStack.length ? '1' : '0.25';
    btnB.style.pointerEvents = _undoStack.length ? 'auto' : 'none';
  }
  if(btnF){
    btnF.style.opacity       = _redoStack.length ? '1' : '0.25';
    btnF.style.pointerEvents = _redoStack.length ? 'auto' : 'none';
  }
}

function _takeSnapshot(){
  if(_undoLock || !_undoReady) return;
  var snap = {
    rows:       JSON.stringify(rows||[]),
    magazzino:  JSON.stringify(magazzino||[]),
    ordini:     JSON.stringify(ordini||[]),
    carrelli:   JSON.stringify(carrelli||[]),
    categorie:  JSON.stringify(typeof categorie!=='undefined'?categorie:[]),
  };
  // Non salvare duplicati consecutivi
  if(_undoStack.length){
    var last = _undoStack[_undoStack.length-1];
    if(last.rows===snap.rows && last.ordini===snap.ordini && last.carrelli===snap.carrelli) return;
  }
  _undoStack.push(snap);
  if(_undoStack.length > 20) _undoStack.shift();
  _redoStack = []; // nuova modifica azzera il redo
  _updateUndoButtons();
}

function _restoreSnapshot(snap){
  _undoLock = true;
  rows       = JSON.parse(snap.rows);
  magazzino  = JSON.parse(snap.magazzino);
  ordini     = JSON.parse(snap.ordini);
  carrelli   = JSON.parse(snap.carrelli);
  if(snap.categorie) categorie = JSON.parse(snap.categorie);
  lsSet(SK,    rows);
  lsSet(MAGK,  magazzino);
  lsSet(ORDK,  ordini);
  lsSet(CARTK, carrelli);
  lsSet(CATK,  categorie);
  _undoLock = false;
  // Aggiorna la UI della tab attiva
  var active = document.querySelector('.tab-content.active');
  var aid = active ? active.id : '';
  if(aid==='t0' && typeof invRefreshT0 === 'function') invRefreshT0();
  else if(aid==='t0') renderInventario();
  if(aid==='tc') renderCartTabs();
  if(aid==='to') renderOrdini();
  if(aid==='t1'){ renderTable(); genTags(); }
  updateStats(); updateCartBadge(); updateOrdBadge();
  _updateUndoButtons();
}

function undoAction(){
  if(!_undoStack.length) return;
  var snap = _undoStack.pop();
  _redoStack.push({
    rows:      JSON.stringify(rows),
    magazzino: JSON.stringify(magazzino),
    ordini:    JSON.stringify(ordini),
    carrelli:  JSON.stringify(carrelli),
    categorie: JSON.stringify(categorie),
  });
  _restoreSnapshot(snap);
  showToastGen('green','- Modifica annullata');
}

function redoAction(){
  if(!_redoStack.length) return;
  var snap = _redoStack.pop();
  _undoStack.push({
    rows:      JSON.stringify(rows),
    magazzino: JSON.stringify(magazzino),
    ordini:    JSON.stringify(ordini),
    carrelli:  JSON.stringify(carrelli),
    categorie: JSON.stringify(categorie),
  });
  _restoreSnapshot(snap);
  showToastGen('green','- Modifica ripristinata');
}
