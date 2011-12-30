// $ expresso test.store.config.js

var assert = require('assert');
var persistence = require('../../lib/persistence').persistence;

var config = {
  adaptor: '',
  database: 'test',
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: ''
};

module.exports = {
  memory: function() {
    config.adaptor = 'memory';
    var persistenceStore = require('../../lib/persistence.store.config').init(persistence, config);
    var session = persistenceStore.getSession();
    session.close();
  },
  mysql: function() {
    config.adaptor = 'mysql';
    var persistenceStore = require('../../lib/persistence.store.config').init(persistence, config);
    var session = persistenceStore.getSession();
    session.close();
  },
  default: function() {
    var persistenceStore = require('../../lib/persistence.store.config').init(persistence, config);
    var session = persistenceStore.getSession();
    session.close();
  }
};
