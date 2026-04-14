var AUTH_K = window.AppKeys.AUTH;
var _currentUser = null;

// Ruoli e permessi
var _defaultColors = { prop1:'#f5c400', prop2:'#f5c400', comm1:'#63b3ed', comm2:'#68d391' };
var _roles = {
  prop1: { nome:'Proprietario 1', ruolo:'proprietario', pin:'', colore:'#f5c400', tabs:'*' },
  prop2: { nome:'Proprietario 2', ruolo:'proprietario', pin:'', colore:'#f5c400', tabs:'*' },
  comm1: { nome:'Commesso 1', ruolo:'commesso', pin:'', colore:'#63b3ed',
    tabs:['tc','to','t0','t10','t1','t7','t9','t-ordfor'],
    altro:['atb-t11','atb-t10','atb-t12'],
    bottom:['tbb-tc','tbb-to','tbb-t0','tbb-t1','tbb-taltro']
  },
  comm2: { nome:'Commesso 2', ruolo:'commesso', pin:'', colore:'#68d391',
    tabs:['tc','to','t0','t10','t1','t7','t9','t-ordfor'],
    altro:['atb-t11','atb-t10','atb-t12'],
    bottom:['tbb-tc','tbb-to','tbb-t0','tbb-t1','tbb-taltro']
  }
};

// Carica PIN e nomi salvati da Firebase
function _authLoad(){
  var saved = lsGet(AUTH_K, null);
  if(saved){
    Object.keys(saved).forEach(function(k){
      if(_roles[k]){
        if(saved[k].pin) _roles[k].pin = saved[k].pin;
        if(saved[k].nome) _roles[k].nome = saved[k].nome;
        if(saved[k].colore) _roles[k].colore = saved[k].colore;
      }
    });
  }
  // Carica anche da Firebase — listener real-time così ogni device riceve aggiornamenti
  if(_fbReady && _fbDb){
    _fbDb.ref('auth').on('value', function(snap){
      var d = snap.val();
      if(d){
        Object.keys(d).forEach(function(k){
          if(_roles[k]){
            if(d[k].pin) _roles[k].pin = d[k].pin;
            if(d[k].nome) _roles[k].nome = d[k].nome;
            if(d[k].colore) _roles[k].colore = d[k].colore;
          }
        });
        _authSaveLocal();
        // Aggiorna schermata login se visibile
        _authRenderLogin();
        // Aggiorna header se loggato
        if(_currentUser && _roles[_currentUser.key]){
          _currentUser.nome = _roles[_currentUser.key].nome;
          _currentUser.colore = _roles[_currentUser.key].colore;
          _authUpdateHeader();
        }
      }
    });
  }
}

function _authSaveLocal(){
  var data = {};
  Object.keys(_roles).forEach(function(k){
    data[k] = { pin: _roles[k].pin, nome: _roles[k].nome, colore: _roles[k].colore || '' };
  });
  lsSet(AUTH_K, data);
}

function _authSaveFirebase(){
  _authSaveLocal();
  if(_fbReady && _fbDb){
    var data = {};
    Object.keys(_roles).forEach(function(k){
      data[k] = { pin: _roles[k].pin, nome: _roles[k].nome, colore: _roles[k].colore || '' };
    });
    try{ _fbDb.ref('auth').set(data); }catch(e){}
  }
}

// Schermata login
function _authShowLogin(){
  var ov = document.getElementById('auth-login-ov');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'auth-login-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;';
    document.body.appendChild(ov);
  }
  ov.style.display = 'flex';
  _authRenderLogin();
}

function _authRenderLogin(){
  var ov = document.getElementById('auth-login-ov');
  if(!ov || ov.style.display === 'none') return;
  var h = '<div style="text-align:center;max-width:340px;width:90%;">';
  h += '<div style="font-size:28px;font-weight:900;color:var(--accent);margin-bottom:6px;">RATTAZZI</div>';
  h += '<div style="font-size:12px;color:#555;margin-bottom:30px;">Seleziona il tuo account</div>';
  
  Object.keys(_roles).forEach(function(k){
    var r = _roles[k];
    var icon = r.ruolo === 'proprietario' ? '👑' : '👤';
    var col = r.colore || (r.ruolo === 'proprietario' ? '#f5c400' : '#888');
    h += '<div style="display:flex;gap:6px;margin-bottom:8px;align-items:stretch;">';
    // Pulsante account
    h += '<button onclick="_authSelectUser(\''+k+'\')" style="display:flex;align-items:center;gap:12px;flex:1;padding:14px 18px;border-radius:12px;border:1px solid #2a2a2a;background:#1a1a1a;cursor:pointer;touch-action:manipulation;text-align:left;">';
    h += '<span style="font-size:24px;">'+icon+'</span>';
    h += '<div style="flex:1"><div style="font-size:14px;font-weight:800;color:'+col+';">'+esc(r.nome)+'</div>';
    h += '<div style="font-size:10px;color:#555;text-transform:uppercase;">'+r.ruolo+'</div></div>';
    h += '<div style="width:8px;height:8px;border-radius:50%;background:'+col+';align-self:center;"></div>';
    h += '</button>';
    // Tasto modifica (solo se ha PIN, quindi account configurato)
    if(r.pin){
      h += '<button onclick="_authEditAccount(\''+k+'\')" style="padding:0 12px;border-radius:12px;border:1px solid #2a2a2a;background:#1a1a1a;cursor:pointer;color:#666;font-size:16px;" title="Modifica account">⚙️</button>';
    }
    h += '</div>';
  });
  
  // Bottone CASSA — accesso diretto senza PIN
  h += '<div style="margin-top:24px;border-top:1px solid #2a2a2a;padding-top:20px;">';
  h += '<button onclick="_cassaModeOpen()" style="display:flex;align-items:center;justify-content:center;gap:12px;width:100%;padding:16px 18px;border-radius:14px;border:2px solid #38a169;background:#38a16915;cursor:pointer;touch-action:manipulation;">';
  h += '<span style="font-size:28px;">💰</span>';
  h += '<div style="text-align:left;"><div style="font-size:16px;font-weight:900;color:#68d391;">CASSA</div>';
  h += '<div style="font-size:10px;color:#555;">Visualizza ordini e fai scontrini</div></div>';
  h += '</button></div>';

  h += '</div>';
  ov.innerHTML = h;
}

// Utente selezionato — mostra numpad PIN
function _authSelectUser(key){
  var r = _roles[key];
  if(!r) return;
  
  // Se non ha PIN, chiedi di crearlo
  if(!r.pin){
    _authSetupPin(key);
    return;
  }
  
  var ov = document.getElementById('auth-login-ov');
  var h = '<div style="text-align:center;max-width:300px;width:90%;">';
  h += '<div style="font-size:20px;font-weight:800;color:var(--accent);margin-bottom:4px;">'+esc(r.nome)+'</div>';
  h += '<div style="font-size:11px;color:#555;margin-bottom:20px;">Inserisci PIN</div>';
  h += '<div id="auth-pin-dots" style="display:flex;justify-content:center;gap:12px;margin-bottom:20px;">';
  h += '<span class="auth-dot"></span><span class="auth-dot"></span><span class="auth-dot"></span><span class="auth-dot"></span>';
  h += '</div>';
  h += '<div id="auth-pin-error" style="font-size:11px;color:#e53e3e;min-height:18px;margin-bottom:10px;"></div>';
  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:220px;margin:0 auto;">';
  for(var i=1;i<=9;i++) h += '<button class="auth-key" onclick="_authPinKey(\''+i+'\')">'+i+'</button>';
  h += '<button class="auth-key" onclick="_authBack()" style="font-size:12px;">←</button>';
  h += '<button class="auth-key" onclick="_authPinKey(\'0\')">0</button>';
  h += '<button class="auth-key" onclick="_authPinKey(\'del\')" style="font-size:11px;">⌫</button>';
  h += '</div>';
  h += '</div>';
  ov.innerHTML = h;
  
  ov._authKey = key;
  ov._authPin = '';
}

var _authPinBuffer = '';

function _authPinKey(k){
  var ov = document.getElementById('auth-login-ov');
  if(!ov) return;
  
  if(k === 'del'){
    _authPinBuffer = _authPinBuffer.slice(0,-1);
  } else {
    if(_authPinBuffer.length >= 4) return;
    _authPinBuffer += k;
  }
  
  // Aggiorna pallini
  var dots = document.querySelectorAll('.auth-dot');
  dots.forEach(function(d,i){ d.classList.toggle('auth-dot--on', i < _authPinBuffer.length); });
  
  // Se 4 cifre, verifica
  if(_authPinBuffer.length === 4){
    var key = ov._authKey;
    var r = _roles[key];
    if(_authPinBuffer === r.pin){
      // Login OK — salva sessione per auto-login al refresh
      _currentUser = { key:key, nome:r.nome, ruolo:r.ruolo, colore:r.colore||'' };
      _deviceName = r.nome;
      localStorage.setItem(window.AppKeys.DEVICE_NAME, r.nome);
      localStorage.setItem(window.AppKeys.LAST_USER, key);
      _authSaveSession(key);
      ov.style.display = 'none';
      _authApplyRole();
      _authUpdateHeader();
      showToastGen('green','Benvenuto '+r.nome+'!');
    } else {
      // PIN errato
      var err = document.getElementById('auth-pin-error');
      if(err) err.textContent = 'PIN errato';
      _authPinBuffer = '';
      setTimeout(function(){
        var dots2 = document.querySelectorAll('.auth-dot');
        dots2.forEach(function(d){ d.classList.remove('auth-dot--on'); });
      }, 300);
    }
  }
}

function _authBack(){
  _authPinBuffer = '';
  _authRenderLogin();
}

// Setup PIN per la prima volta
function _authSetupPin(key){
  var r = _roles[key];
  var nome = prompt('Nome per questo account:', r.nome);
  if(!nome) return;
  r.nome = nome.trim();
  
  var pin = prompt('Crea un PIN a 4 cifre:');
  if(!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)){ showToastGen('red','PIN deve essere 4 cifre'); return; }
  r.pin = pin;
  
  _authSaveFirebase();
  showToastGen('green','Account "'+r.nome+'" creato!');
  _authRenderLogin();
}

// ── Modifica Account (nome + colore) ──────────────────────────────────────
var _authColorPalette = [
  '#f5c400','#f6ad55','#fc8181','#e53e3e','#f687b3','#d53f8c',
  '#b794f4','#805ad5','#63b3ed','#3182ce','#4fd1c5','#38b2ac',
  '#68d391','#38a169','#a0aec0','#e2e8f0'
];

function _authEditAccount(key){
  var r = _roles[key];
  if(!r) return;
  var ov = document.getElementById('auth-login-ov');
  if(!ov) return;

  var col = r.colore || _defaultColors[key] || '#aaa';

  var h = '<div style="text-align:center;max-width:340px;width:90%;">';
  h += '<div style="font-size:18px;font-weight:900;color:'+col+';margin-bottom:4px;">⚙️ Modifica Account</div>';
  h += '<div style="font-size:10px;color:#555;text-transform:uppercase;margin-bottom:24px;">'+r.ruolo+'</div>';

  // Nome
  h += '<div style="text-align:left;margin-bottom:16px;">';
  h += '<label style="font-size:11px;color:#888;font-weight:700;display:block;margin-bottom:6px;">NOME</label>';
  h += '<input id="auth-edit-nome" type="text" value="'+esc(r.nome)+'" maxlength="20" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid #333;background:#1a1a1a;color:#fff;font-size:15px;font-weight:700;box-sizing:border-box;">';
  h += '</div>';

  // Colore
  h += '<div style="text-align:left;margin-bottom:20px;">';
  h += '<label style="font-size:11px;color:#888;font-weight:700;display:block;margin-bottom:8px;">COLORE</label>';
  h += '<div id="auth-color-grid" style="display:grid;grid-template-columns:repeat(8,1fr);gap:6px;">';
  _authColorPalette.forEach(function(c){
    var sel = (c.toLowerCase() === col.toLowerCase());
    h += '<div onclick="_authPickColor(\''+c+'\')" style="width:100%;aspect-ratio:1;border-radius:50%;background:'+c+';cursor:pointer;border:3px solid '+(sel?'#fff':'transparent')+';box-sizing:border-box;transition:border .15s;"></div>';
  });
  h += '</div>';
  h += '<div id="auth-color-preview" style="margin-top:10px;text-align:center;font-size:16px;font-weight:900;color:'+col+';">'+esc(r.nome)+'</div>';
  h += '</div>';

  // Pulsanti
  h += '<div style="display:flex;gap:10px;margin-top:8px;">';
  h += '<button onclick="_authBack()" style="flex:1;padding:12px;border-radius:10px;border:1px solid #333;background:transparent;color:#888;font-size:13px;cursor:pointer;">← Indietro</button>';
  h += '<button onclick="_authSaveEdit(\''+key+'\')" style="flex:1;padding:12px;border-radius:10px;border:none;background:#38a169;color:#fff;font-size:13px;font-weight:800;cursor:pointer;">✅ Salva</button>';
  h += '</div>';

  h += '</div>';
  ov.innerHTML = h;

  // Salva key e colore corrente
  ov._editKey = key;
  ov._editColor = col;
}

function _authPickColor(c){
  var ov = document.getElementById('auth-login-ov');
  if(!ov) return;
  ov._editColor = c;

  // Aggiorna bordi pallini
  var dots = document.querySelectorAll('#auth-color-grid > div');
  dots.forEach(function(d){
    d.style.borderColor = (d.style.background === c || d.style.backgroundColor === c) ? '#fff' : 'transparent';
  });
  // Workaround: match per valore esatto
  dots.forEach(function(d){
    var bg = d.style.background || d.style.backgroundColor;
    // Normalizza hex
    var match = (bg.toLowerCase().replace(/\s/g,'') === c.toLowerCase().replace(/\s/g,''));
    if(!match){
      // Prova rgb
      var tmpDiv = document.createElement('div');
      tmpDiv.style.color = c;
      document.body.appendChild(tmpDiv);
      var rgb = getComputedStyle(tmpDiv).color;
      document.body.removeChild(tmpDiv);
      match = (bg === rgb);
    }
    d.style.borderColor = match ? '#fff' : 'transparent';
  });

  // Preview
  var prev = document.getElementById('auth-color-preview');
  if(prev){
    prev.style.color = c;
    var inp = document.getElementById('auth-edit-nome');
    if(inp) prev.textContent = inp.value || '...';
  }
}

function _authSaveEdit(key){
  var ov = document.getElementById('auth-login-ov');
  if(!ov) return;
  var r = _roles[key];
  if(!r) return;

  var inp = document.getElementById('auth-edit-nome');
  var newNome = inp ? inp.value.trim() : r.nome;
  if(!newNome){ showToastGen('red','Inserisci un nome'); return; }

  var newColore = ov._editColor || r.colore;

  r.nome = newNome;
  r.colore = newColore;

  // Se è l'utente attualmente loggato, aggiorna anche _currentUser
  if(_currentUser && _currentUser.key === key){
    _currentUser.nome = newNome;
    _currentUser.colore = newColore;
    _deviceName = newNome;
    localStorage.setItem(window.AppKeys.DEVICE_NAME, newNome);
    _authUpdateHeader();
  }

  _authSaveFirebase();
  showToastGen('green','Account aggiornato!');
  _authRenderLogin();
}

// Applica visibilità tab in base al ruolo
function _authUpdateHeader(){
  var el = document.getElementById('app-header-subtitle');
  if(!el) return;
  if(_currentUser){
    var role = _roles[_currentUser.key];
    var col = (role && role.colore) ? role.colore : (_currentUser.ruolo === 'proprietario' ? '#f5c400' : '#aaa');
    el.textContent = _currentUser.nome;
    el.style.color = col;
  } else {
    el.textContent = 'Cartellini Prezzi';
    el.style.color = '';
  }
}

function _authApplyRole(){
  if(!_currentUser) return;
  var role = _roles[_currentUser.key];
  if(!role) return;
  _authUpdateHeader();
  
  // Proprietario vede tutto
  if(role.tabs === '*') return;
  
  // Nascondi tab nella bottom bar
  var allBottom = document.querySelectorAll('.tab-bottom-btn');
  allBottom.forEach(function(btn){
    var id = btn.id;
    if(role.bottom && role.bottom.indexOf(id) >= 0){
      btn.style.display = '';
    } else if(role.bottom){
      btn.style.display = 'none';
    }
  });
  
  // Nascondi bottoni nel menu Altro
  var allAltro = document.querySelectorAll('.altro-btn');
  allAltro.forEach(function(btn){
    var id = btn.id;
    if(!id) return;
    if(role.altro && role.altro.indexOf(id) >= 0){
      btn.style.display = '';
    } else if(role.altro){
      btn.style.display = 'none';
    }
  });
  
  // Theme toggle sempre visibile
  var themeBtn = document.getElementById('theme-toggle-btn');
  if(themeBtn) themeBtn.style.display = '';
}

// Auto-login se sessione attiva salvata
var _AUTH_SESSION_K = window.AppKeys.AUTH_SESSION;

function _authInit(){
  _authLoad();

  // Controlla se c'è una sessione attiva salvata
  var session = lsGet(_AUTH_SESSION_K, null);
  if(session && session.key && _roles[session.key] && _roles[session.key].pin){
    // Auto-login — salta la schermata PIN
    _currentUser = { key: session.key, nome: _roles[session.key].nome, ruolo: _roles[session.key].ruolo, colore: _roles[session.key].colore||'' };
    _deviceName = _currentUser.nome;
    localStorage.setItem(window.AppKeys.DEVICE_NAME, _currentUser.nome);
    _authApplyRole();
    _authUpdateHeader();
    // Nascondi overlay login se presente
    var ov = document.getElementById('auth-login-ov');
    if(ov) ov.style.display = 'none';
    return;
  }

  // Nessuna sessione — mostra login
  _authShowLogin();
}

function _authSaveSession(key){
  lsSet(_AUTH_SESSION_K, { key: key, at: new Date().toISOString() });
}

function _authClearSession(){
  localStorage.removeItem(_AUTH_SESSION_K);
}

function authLogout(){
  _authClearSession();
  _currentUser = null;
  _authUpdateHeader();
  // Ripristina visibilità di tutte le tab (reset permessi)
  var allBottom = document.querySelectorAll('.tab-bottom-btn');
  allBottom.forEach(function(btn){ btn.style.display = ''; });
  var allAltro = document.querySelectorAll('.altro-btn');
  allAltro.forEach(function(btn){ btn.style.display = ''; });
  // Chiudi menu Altro se aperto
  if(typeof closeAltroMenu === 'function') closeAltroMenu();
  // Mostra login
  _authShowLogin();
  showToastGen('blue','👋 Disconnesso');
}
