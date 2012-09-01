var stores = {
  memory: './persistence.store.memory',
  mysql: './persistence.store.mysql',
  sqlite3: './persistence.store.sqlite3'
};

var init = function(persistence, config, cb) {
  var setupStore = function (persistenceStore) {
    if (config.username) config.user = config.username;
    if (config.hostname) config.host = config.hostname;
    persistenceStore.config(persistence,
                            config.host,
                            config.port,
                            config.database,
                            config.user,
                            config.password);
    cb(null, persistenceStore);
  }

  var adaptorName = config.adaptor[config.adaptor] || config.adaptor.mysql;

  if (define != undefined) {
    require([adaptorName], setupStore);
  } else {
    setupStore(require(adaptorName));
  }
};

if (define != undefined) {
  define([], function () {
    return {init:init};
  });
} else {
  exports.init = init;
}
