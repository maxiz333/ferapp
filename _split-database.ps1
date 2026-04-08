# Estrae database.js in moduli usando marker [SECTION: ...] (UTF-8, senza numeri di riga).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$srcPath = Join-Path $root 'database.js'
$utf8 = [System.Text.UTF8Encoding]::new($false)
$text = [System.IO.File]::ReadAllText($srcPath, $utf8)

function Write-Mod {
  param([string]$Name, [string]$Content)
  $p = Join-Path $root $Name
  $hdr = "// $Name - estratto da database.js`n`n"
  [System.IO.File]::WriteAllText($p, $hdr + $Content.TrimEnd() + "`n", $utf8)
}

function Get-Between {
  param([string]$StartMarker, [string]$EndMarker)
  $i = $text.IndexOf($StartMarker)
  if ($i -lt 0) { throw "Marker inizio non trovato: $StartMarker" }
  if ($null -eq $EndMarker -or $EndMarker -eq '') {
    return $text.Substring($i)
  }
  $j = $text.IndexOf($EndMarker, $i + $StartMarker.Length)
  if ($j -lt 0) { throw "Marker fine non trovato: $EndMarker" }
  return $text.Substring($i, $j - $i)
}

# Prefisso file: docblock + error handler + strict (prima di INDEXEDDB)
$pIndexed = $text.IndexOf('//  INDEXEDDB PER FOTO')
if ($pIndexed -lt 0) { throw 'INDEXEDDB PER FOTO non trovato' }
$prefix = $text.Substring(0, $pIndexed)

# database.idb.js: INDEXEDDB ... fino a UNDO (escluso)
$idb = $prefix + (Get-Between -StartMarker '//  INDEXEDDB PER FOTO' -EndMarker '// [SECTION: UNDO/REDO]')
Write-Mod -Name 'database.idb.js' -Content $idb
Write-Host "OK database.idb.js"

# database.undo.js
$undo = Get-Between -StartMarker '// [SECTION: UNDO/REDO]' -EndMarker '// [SECTION: DATABASE]'
Write-Mod -Name 'database.undo.js' -Content $undo
Write-Host "OK database.undo.js"

# database.core.js: DATABASE + UTILS (fino a CARTELLINI escluso)
$core = Get-Between -StartMarker '// [SECTION: DATABASE]' -EndMarker '// [SECTION: CARTELLINI]'
Write-Mod -Name 'database.core.js' -Content $core
Write-Host "OK database.core.js"

# database.cartellini.js
$cart = Get-Between -StartMarker '// [SECTION: CARTELLINI]' -EndMarker '// [SECTION: IMPORT/CSV]'
Write-Mod -Name 'database.cartellini.js' -Content $cart
Write-Host "OK database.cartellini.js"

# database.import-csv.js
$imp = Get-Between -StartMarker '// [SECTION: IMPORT/CSV]' -EndMarker '// [SECTION: MAGAZZINO]'
Write-Mod -Name 'database.import-csv.js' -Content $imp
Write-Host "OK database.import-csv.js"

# database.magazzino.js (resto file)
$magMarker = '// [SECTION: MAGAZZINO]'
$pm = $text.IndexOf($magMarker)
if ($pm -lt 0) { throw 'SECTION MAGAZZINO non trovata' }
$mag = $text.Substring($pm)
Write-Mod -Name 'database.magazzino.js' -Content $mag
Write-Host "OK database.magazzino.js"

Write-Host 'Split database completato.'
