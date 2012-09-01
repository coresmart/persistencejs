if (define != undefined) {
  define(['./persistence', './persistence.store.config'], function (persistence, StoreConfig) {
    persistence.StoreConfig = StoreConfig;
    return persistence;
  });
} else {
  module.exports = require('./persistence').persistence;
  module.exports.StoreConfig = require('./persistence.store.config');
}
