module.exports = function(persistence, config) {

  if (config.username) config.user = config.username;
  if (config.hostname) config.host = config.hostname;
  if (config.db) config.database = config.db;

  var persistenceStore;
  switch (config.adaptor) {
    case 'memory':
      persistenceStore = require('./persistence.store.memory');
      persistenceStore.config(persistence, config.database);
      break;
    case 'sqlite':
      persistenceStore = require('./persistence.store.sqlite');
      persistenceStore.config(persistence, config.database);
      break;
    case 'mysql':
      // fall through
    default:
      persistenceStore = require('./persistence.store.mysql');
      persistenceStore.config(persistence,
                              config.host,
                              config.port,
                              config.database,
                              config.user,
                              config.password);
      break;
  }

  return persistenceStore;
};
