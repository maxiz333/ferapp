// ══ CHIAVI STORAGE + WRAPPER JSON ═════════════════════════════════
(function(){
  var AppKeys = {
    CURRENT: 'cp4_current',
    HISTORY: 'cp4_history',
    REMOVED: 'cp4_removed',
    CESTINO: 'cp4_cestino',
    CATEGORIE: 'cp4_categorie',
    MAGAZZINO: 'cp4_magazzino',
    MOVIMENTI: 'cp4_movimenti',
    CARTELLINI: 'cp4_cartellini',
    CARRELLI: 'cp4_carrelli',
    ORDINI: 'cp4_ordini',
    CARRELLI_CESTINO: 'cp4_carrelli_cestino',
    ORDINI_ARCHIVIO: 'cp4_ordini_archivio',
    AUTH: 'cp4_auth',
    AUTH_SESSION: 'cp4_auth_session',
    APIKEY_FOTO: 'cp4_foto_apikey',
    FATTURE: 'cp4_fatture',
    ORDFORNITORI: 'cp4_ordfornitori',
    ORDINI_CESTINO: 'cp4_ordini_cestino',
    DDT_NUM: 'cp4_ddt_num',
    BACKUP_INTERVAL: 'cp4_backup_interval',
    BACKUP_LAST: 'cp4_backup_last',
    CLIENTI: 'cp4_clienti',
    FORNI_COLORE: 'cp4_forniColore',
    /** Anagrafica fornitori dinamica [{ id, nome, colore }] — sync Firebase settings/fornitori */
    SETTINGS_FORNITORI: 'cp4_settings_fornitori',
    ORD_FORN_STORICO: 'cp4_ord_forn_storico',
    ORD_FORN_STORICO_COLD: 'cp4_ord_forn_storico_cold',
    EDITOR: 'cp4_editor',
    GIORNOMI: 'cp4_giornomi',
    THEME: 'cp4_theme',
    ORD_COUNTER: 'cp4_ord_counter',
    DEVICE_ID: 'cp4_deviceId',
    DEVICE_NAME: 'cp4_deviceName',
    LAST_USER: 'cp4_lastUser'
  };

  function get(k, d){
    try{
      var v = localStorage.getItem(k);
      return v != null ? JSON.parse(v) : d;
    }catch(e){
      return d;
    }
  }

  function set(k, v){
    try{
      localStorage.setItem(k, JSON.stringify(v));
    }catch(e){}
  }

  window.AppKeys = AppKeys;
  window.AppStorage = { get: get, set: set };
})();
