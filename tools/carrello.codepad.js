// --- NUOVO ARTICOLO DA CARRELLO -------------------------------
// --- RICERCA CODICE - NUMPAD GRANDE ---------------------------
var _codepadValue='';
var _codepadMode='codM'; // 'codM' = Mio Codice (default), 'codF' = Cod. Fornitore

function openCodeNumpad(){
  _codepadValue='';
  _codepadMode='codM';
  _codepadUpdateModeBtn();
  document.getElementById('codepad-display').textContent='_';
  document.getElementById('codepad-display').style.borderColor='var(--accent)';
  document.getElementById('codepad-display').style.color='var(--accent)';
  document.getElementById('codepad-match').innerHTML='<div style="color:#555;text-align:center;">Digita il Mio Codice...</div>';
  document.getElementById('code-numpad-overlay').style.display='flex';
}
function closeCodeNumpad(){
  document.getElementById('code-numpad-overlay').style.display='none';
  _codepadValue='';
}
function toggleCodepadMode(){
  _codepadMode=(_codepadMode==='codM')?'codF':'codM';
  _codepadUpdateModeBtn();
  _codepadValue='';
  _codepadUpdateDisplay();
  var label=_codepadMode==='codM'?'Digita il Mio Codice...':'Digita il Cod. Fornitore...';
  document.getElementById('codepad-match').innerHTML='<div style="color:#555;text-align:center;">'+label+'</div>';
}
function _codepadUpdateModeBtn(){
  var btn=document.getElementById('codepad-mode-btn');
  var disp=document.getElementById('codepad-display');
  if(_codepadMode==='codM'){
    btn.innerHTML='-- MIO CODICE';
    btn.style.borderColor='var(--accent)';
    btn.style.color='var(--accent)';
    btn.style.background='rgba(245,196,0,.12)';
    if(disp){disp.style.borderColor='var(--accent)';disp.style.color='var(--accent)';}
  } else {
    btn.innerHTML='- COD. FORNITORE';
    btn.style.borderColor='#fc8181';
    btn.style.color='#fc8181';
    btn.style.background='rgba(252,129,129,.12)';
    if(disp){disp.style.borderColor='#fc8181';disp.style.color='#fc8181';}
  }
}
function codepadPress(key){
  if(key==='C'){_codepadValue='';}
  else{_codepadValue+=key;}
  _codepadUpdateDisplay();
  _codepadLiveSearch();
}
function codepadBackspace(){
  _codepadValue=_codepadValue.slice(0,-1);
  _codepadUpdateDisplay();
  _codepadLiveSearch();
}
function _codepadUpdateDisplay(){
  var disp=document.getElementById('codepad-display');
  disp.textContent=_codepadValue||'_';
}
function _codepadLiveSearch(){
  var matchEl=document.getElementById('codepad-match');
  if(!_codepadValue||_codepadValue.length<2){
    var label=_codepadMode==='codM'?'Mio Codice':'Cod. Fornitore';
    matchEl.innerHTML='<div style="color:#555;text-align:center;">Digita almeno 2 caratteri ('+label+')...</div>';
    return;
  }
  // Database non ancora caricato
  if(!rows||!rows.length){
    matchEl.innerHTML='<div style="color:var(--accent);text-align:center;padding:8px;">⏳ Database in caricamento, attendi...</div>';
    return;
  }
  var code=_codepadValue.toLowerCase();
  var matches=[];
  for(var i=0;i<rows.length;i++){
    if(removed.has(String(i)))continue;
    var r=rows[i];
    if(!r)continue;
    var fieldVal=_codepadMode==='codM'?String(r.codM||'').toLowerCase():String(r.codF||'').toLowerCase();
    // Match esatto
    if(fieldVal===code){matches.unshift({r:r,i:i,exact:true});continue;}
    // Match parziale
    if(fieldVal.indexOf(code)>=0){matches.push({r:r,i:i,exact:false});}
  }
  if(!matches.length){
    matchEl.innerHTML='<div style="color:#e53e3e;text-align:center;padding:4px;">- Nessun codice trovato</div>';
    return;
  }
  var h='';
  matches.slice(0,4).forEach(function(m){
    var bgCol=m.exact?'rgba(56,161,105,0.15)':'#1a1a1a';
    var borderCol=m.exact?'#38a169':'#2a2a2a';
    h+='<div onclick="codepadAddItem('+m.i+')" style="background:'+bgCol+';border:1px solid '+borderCol+';border-radius:8px;padding:8px 10px;margin-bottom:4px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px;touch-action:manipulation;">';
    h+='<div style="flex:1;min-width:0;">';
    h+='<div style="font-size:12px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(m.r.desc)+'</div>';
    h+='<div style="font-size:10px;margin-top:2px;">';
    if(m.r.codM)h+='<span style="color:var(--accent);font-weight:700;">-- '+esc(m.r.codM)+'</span> ';
    if(m.r.codF)h+='<span style="color:#fc8181;font-weight:600;">- '+esc(m.r.codF)+'</span>';
    h+='</div></div>';
    h+='<div style="font-size:15px;font-weight:900;color:var(--accent);flex-shrink:0;">- '+esc(m.r.prezzo)+'</div>';
    h+='</div>';
  });
  if(matches.length>4)h+='<div style="font-size:10px;color:#555;text-align:center;">...e altri '+(matches.length-4)+'</div>';
  matchEl.innerHTML=h;
}
function codepadSearch(){
  if(!_codepadValue)return;
  var code=_codepadValue.toLowerCase();
  var found=null,foundIdx=-1;
  // Match esatto
  for(var i=0;i<rows.length;i++){
    if(removed.has(String(i)))continue;
    var r=rows[i];
    var fieldVal=_codepadMode==='codM'?(r.codM||'').toLowerCase():(r.codF||'').toLowerCase();
    if(fieldVal===code){found=r;foundIdx=i;break;}
  }
  // Fallback parziale
  if(!found){
    for(var i=0;i<rows.length;i++){
      if(removed.has(String(i)))continue;
      var r=rows[i];
      var fieldVal=_codepadMode==='codM'?(r.codM||'').toLowerCase():(r.codF||'').toLowerCase();
      if(fieldVal.indexOf(code)>=0){found=r;foundIdx=i;break;}
    }
  }
  if(found){
    codepadAddItem(foundIdx);
  } else {
    showToastGen('red','- Codice non trovato: '+_codepadValue);
  }
}
function codepadAddItem(rowIdx){
  cartAddItem(rowIdx);
  var desc=rows[rowIdx]?rows[rowIdx].desc:'';
  showToastGen('green','- '+desc);
  _codepadValue='';
  _codepadUpdateDisplay();
  document.getElementById('codepad-match').innerHTML='<div style="color:#38a169;text-align:center;padding:4px;">- Aggiunto! Digita il prossimo codice...</div>';
}
