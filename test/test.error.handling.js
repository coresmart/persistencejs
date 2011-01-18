// $ expresso -s test/test.error.handling.js

var assert = require('assert');
var persistence = require('../lib/persistence').persistence;
var persistenceStore = require('../lib/persistence.store.mysql');

persistenceStore.config(persistence, 'localhost', 3306, 'nodejs_mysql', 'test', 'test');

var InexistentTable = persistence.define('inexistent_table', {
  name: "TEXT"
});

var create = function(data, cb) {
  var session = persistenceStore.getSession();
  var inexistent_table = new InexistentTable(data);
  session.add(inexistent_table);
  session.flush(function(result, err) {
    session.close();
    cb && cb(err, result);
  });
};

module.exports = {
  'create fail': function(done) {
    create({
      name: 'test'
    }, function(err, result) {
      assert.isDefined(err);
      done();
    });
  }
};
