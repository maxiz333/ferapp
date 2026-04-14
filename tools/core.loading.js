// ── Barra di caricamento database ────────────────────────────────────────────
function _showLoadingBar(msg){
  var bar = document.getElementById('_db-loading-bar');
  if(!bar){
    bar = document.createElement('div');
    bar.id = '_db-loading-bar';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;height:4px;background:rgba(0,0,0,.4);';
    bar.innerHTML = '<div id="_db-loading-fill" style="height:100%;width:5%;background:linear-gradient(90deg,var(--accent),#ff9800);transition:width .4s ease;border-radius:0 2px 2px 0;box-shadow:0 0 8px rgba(245,196,0,.5);"></div>';
    document.body.appendChild(bar);
  }
  bar.style.display = 'block';
  // Pannello testo caricamento — appare sotto l'header
  var lbl = document.getElementById('_db-loading-lbl');
  if(!lbl){
    lbl = document.createElement('div');
    lbl.id = '_db-loading-lbl';
    lbl.style.cssText = [
      'position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:9998;',
      'background:rgba(0,0,0,.82);border:1px solid var(--accent);border-radius:12px;',
      'padding:10px 20px;display:flex;align-items:center;gap:10px;',
      'color:var(--accent);font-size:13px;font-weight:700;letter-spacing:.4px;',
      'box-shadow:0 4px 20px rgba(0,0,0,.6);pointer-events:none;white-space:nowrap;'
    ].join('');
    lbl.innerHTML = '<span id="_db-spin" style="font-size:18px;animation:_dbspin 1s linear infinite;display:inline-block;">⏳</span> <span id="_db-msg">Caricamento database...</span>';
    // Aggiungi animazione spin
    if(!document.getElementById('_db-spin-style')){
      var st = document.createElement('style');
      st.id = '_db-spin-style';
      st.textContent = '@keyframes _dbspin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}';
      document.head.appendChild(st);
    }
    document.body.appendChild(lbl);
  }
  lbl.style.display = 'flex';
  var msgEl = document.getElementById('_db-msg');
  if(msgEl) msgEl.textContent = msg || 'Caricamento database...';
}
function _updateLoadingBar(pct){
  var fill = document.getElementById('_db-loading-fill');
  if(fill) fill.style.width = Math.max(5, pct) + '%';
  var msgEl = document.getElementById('_db-msg');
  if(msgEl) msgEl.textContent = 'Database: ' + pct + '% — attendere...';
}
function _hideLoadingBar(){
  var fill = document.getElementById('_db-loading-fill');
  if(fill) fill.style.width = '100%';
  setTimeout(function(){
    var bar = document.getElementById('_db-loading-bar');
    var lbl = document.getElementById('_db-loading-lbl');
    if(bar) bar.style.display = 'none';
    if(lbl){ lbl.style.display = 'none'; }
  }, 700);
}
