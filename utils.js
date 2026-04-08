// ══ UTILITÀ PURE CONDIVISE ═══════════════════════════════════════
(function(){
  function parsePriceIT(s){
    return parseFloat(String(s || '0').replace(',', '.')) || 0;
  }

  function autoSize(p){
    return parsePriceIT(p) < 100 ? 'small' : 'large';
  }

  function esc(s){
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function norm(s){
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function stem(w){
    if(w.length < 5) return w;
    var rules = [/zioni$/, /zione$/, /tori$/, /tore$/, /elli$/, /ella$/, /ello$/, /etti$/, /etta$/, /etto$/, /ali$/, /ale$/, /ori$/, /ore$/, /ari$/, /are$/, /ici$/, /ico$/, /ica$/, /osi$/, /oso$/, /nti$/, /nte$/, /oli$/, /ola$/, /olo$/];
    var stems = ['zion', 'zion', 'tor', 'tor', 'ell', 'ell', 'ell', 'ett', 'ett', 'ett', 'al', 'al', 'or', 'or', 'ar', 'ar', 'ic', 'ic', 'ic', 'os', 'os', 'nt', 'nt', 'ol', 'ol', 'ol'];
    for(var j = 0; j < rules.length; j++){
      if(rules[j].test(w)) return w.replace(rules[j], stems[j]);
    }
    return w.replace(/[aeiou]$/, '');
  }

  function lev(a, b){
    if(a === b) return 0;
    var dp = [];
    for(var i = 0; i <= b.length; i++){
      dp[i] = [i];
      for(var j = 1; j <= a.length; j++) dp[i][j] = i === 0 ? j : 0;
    }
    for(var bi = 1; bi <= b.length; bi++){
      for(var ai = 1; ai <= a.length; ai++){
        dp[bi][ai] = b[bi - 1] === a[ai - 1]
          ? dp[bi - 1][ai - 1]
          : 1 + Math.min(dp[bi - 1][ai - 1], dp[bi][ai - 1], dp[bi - 1][ai]);
      }
    }
    return dp[b.length][a.length];
  }

  function wordScore(qw, tw){
    if(qw === tw) return 100;
    if(tw.startsWith(qw)) return 85;
    if(qw.startsWith(tw) && tw.length >= 3) return 78;
    var qs = stem(qw), ts = stem(tw);
    if(qs && ts && qs === ts) return 72;
    if(qs && ts && ts.startsWith(qs) && qs.length >= 4) return 62;
    if(qw.length >= 5 && tw.length >= 4){
      var tol = qw.length <= 6 ? 1 : 2;
      if(lev(qw, tw) <= tol) return 55;
      if(qs.length >= 4 && ts.length >= 4 && lev(qs, ts) <= 1) return 45;
    }
    return 0;
  }

  function fuzzyScore(query, text){
    var q = norm(query), t = norm(text);
    if(!q) return 100;
    if(t.includes(q)) return 100;
    var qw = q.split(' ').filter(function(w){ return w.length > 1; });
    var tw = t.split(' ').filter(Boolean);
    if(!qw.length) return 0;
    var tot = 0;
    for(var wi = 0; wi < qw.length; wi++){
      var best = 0;
      for(var ti = 0; ti < tw.length; ti++){
        best = Math.max(best, wordScore(qw[wi], tw[ti]));
        if(best === 100) break;
      }
      if(best === 0) return 0;
      tot += best;
    }
    return tot / qw.length;
  }

  window.AppUtils = {
    parsePriceIT: parsePriceIT,
    autoSize: autoSize,
    esc: esc,
    norm: norm,
    stem: stem,
    lev: lev,
    wordScore: wordScore,
    fuzzyScore: fuzzyScore
  };
})();
