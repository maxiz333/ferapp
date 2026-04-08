// ui.foto.js - estratto da ui.js

// ══ UI & NAVIGAZIONE ═════════════════════════════════════════════
// [SECTION: AI/FOTO] -------------------------------------------------------
var _fotoBase64 = null;
//  Import articoli da foto (Gemini AI), overlay foto, API key
function openFotoOverlay(){
  fotoReset();
  document.getElementById('foto-overlay').classList.add('open');
  // Carica API key salvata
  var inp = document.getElementById('foto-apikey');
  if(inp){ inp.value = getMiaApiKey(); }
}
function closeFotoOverlay(){
  document.getElementById('foto-overlay').classList.remove('open');
  _fotoBase64 = null;
}
function fotoReset(){
  document.getElementById('foto-step1').style.display = '';
  document.getElementById('foto-step2').style.display = 'none';
  document.getElementById('foto-step3').style.display = 'none';
  var inp = document.getElementById('foto-input');
  if(inp) inp.value = '';
  _fotoBase64 = null;
}

function onFotoSelected(input){
  if(!input.files || !input.files[0]) return;
  var file = input.files[0];
  var reader = new FileReader();
  reader.onload = function(e){
    _fotoBase64 = e.target.result.split(',')[1];
    var mediaType = file.type || 'image/jpeg';
    document.getElementById('foto-preview').src = e.target.result;
    document.getElementById('foto-step1').style.display = 'none';
    document.getElementById('foto-step2').style.display = '';
    document.getElementById('foto-status').textContent = '- Analisi AI in corso...';
    elaboraFotoAI(_fotoBase64, mediaType);
  };
  reader.readAsDataURL(file);
}

async function elaboraFotoAI(base64, mediaType){
  var statusEl = document.getElementById('foto-status');
  try {
    var apiKey = getMiaApiKey();
    if(!apiKey){
      statusEl.textContent = '-- Inserisci la tua API key Google Gemini qui sopra';
      statusEl.style.color = '#f5c400';
      return;
    }
    statusEl.textContent = '- Analisi AI in corso...';
    statusEl.style.color = 'var(--muted)';

    var prompt = 'Sei un assistente per una ferramenta italiana. Analizza questa immagine (cartellino, etichetta o appunto) ed estrai le informazioni del prodotto. Rispondi SOLO con un JSON valido, senza testo aggiuntivo n- backtick, con questi campi (stringa vuota se non trovato): {"desc":"descrizione prodotto","prezzo":"es 1.50","codF":"codice fornitore","codM":"mio codice","marca":"marca","specs":"specifiche tecniche es M6x20 inox","note":"altre info utili"}';

    var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;

    var body = {
      contents: [{
        parts: [
          { inline_data: { mime_type: mediaType, data: base64 } },
          { text: prompt }
        ]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 512 }
    };

    var resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if(!resp.ok){
      var errData = await resp.json().catch(function(){ return {}; });
      var msg = (errData.error && errData.error.message) || ('HTTP ' + resp.status);
      throw new Error(msg);
    }

    var data = await resp.json();
    var text = '';
    try { text = data.candidates[0].content.parts[0].text || ''; } catch(e){}

    var clean = text.replace(/```json|```/g,'').trim();
    // Trova il primo { e l'ultimo }
    var start = clean.indexOf('{');
    var end   = clean.lastIndexOf('}');
    if(start >= 0 && end > start) clean = clean.slice(start, end+1);

    var obj = JSON.parse(clean);
    document.getElementById('foto-desc').value   = obj.desc   || '';
    document.getElementById('foto-prezzo').value = obj.prezzo || '';
    document.getElementById('foto-codf').value   = obj.codF   || '';
    document.getElementById('foto-codm').value   = obj.codM   || '';
    document.getElementById('foto-marca').value  = obj.marca  || '';
    document.getElementById('foto-specs').value  = obj.specs  || '';
    document.getElementById('foto-note').value   = obj.note   || '';
    document.getElementById('foto-step2').style.display = 'none';
    document.getElementById('foto-step3').style.display = '';
  } catch(err){
    statusEl.textContent = '- ' + (err.message || 'Impossibile analizzare. Riprova.');
    statusEl.style.color = '#e53e3e';
  }
}
function confermaDaFoto(){
    var desc = gf('foto-desc');
  if(!desc){ showToastOk('-- Inserisci almeno una descrizione'); return; }
  showConfirm('⚠️ Aggiungere "'+desc+'" come NUOVO articolo al database?', function(){
    var newRow = {
      desc: desc,
      codF: gf('foto-codf'),
      codM: gf('foto-codm'),
      prezzo: gf('foto-prezzo'),
      prezzoOld: '',
      note: gf('foto-note'),
      giornalino: '',
      priceHistory: [],
      data: new Date().toLocaleDateString('it-IT'),
      size: autoSize(gf('foto-prezzo'))
    };
    var ni = rows.length;
    rows.push(newRow);
    magazzino[ni] = {
      marca: gf('foto-marca'),
      specs: gf('foto-specs'),
      qty: 0,
      unit: 'pz',
      soglia: ''
    };
    lsSet(SK, rows);
    lsSet(MAGK, magazzino);
    closeFotoOverlay();
    renderInventario();
    updateStockBadge();
    showToastOk('✅ Articolo creato da foto!');
    setTimeout(function(){ openEditProdotto(ni); }, 200);
  });
}


// --- Gestione API key per Import da foto ----------------------------------
var APIKEY_K = window.AppKeys.APIKEY_FOTO;

function getMiaApiKey(){
  return localStorage.getItem(APIKEY_K) || '';
}
function salvaMiaApiKey(v){
  localStorage.setItem(APIKEY_K, v);
}
function mostraApiKey(){
  var inp = document.getElementById('foto-apikey');
  if(!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
}
