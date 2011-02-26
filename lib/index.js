exports.persistence = require('./persistence');
exports.search = require('./persistence.search');
exports.store = {
  config: require('./persistence.store.config'),
  mysql: require('./persistence.store.mysql'),
  memory: require('./persistence.store.memory'),
  sql: require('./persistence.store.sql'),
  websql: require('./persistence.store.websql')
};
