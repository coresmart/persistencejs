// $ expresso -s test.error.handling.js

var assert = require('assert');
var persistence = require('../../lib/persistence').persistence;
var persistenceStore = require('../../lib/persistence.store.mysql');

persistenceStore.config(persistence, 'localhost', 3306, 'nodejs_mysql', 'test', 'test');

var InexistentTable = persistence.define('inexistent_table', {
  name: "TEXT"
});

var session = persistenceStore.getSession();

var create = function(data, cb) {
  var inexistent_table = new InexistentTable(data);
  session.add(inexistent_table);
  session.flush(function(err, result) {
    cb && cb(err, inexistent_table);
  });
};

var remove = function(inexistent_table, cb) {
  session.remove(inexistent_table);
  session.flush(function(err, result) {
    cb && cb(err, result);
  });
};

var temp;

module.exports = {
  'beforeAll': function(done) {
    session.transaction(function(tx) {
      tx.executeSql('FLUSH TABLES WITH READ LOCK;', function() {
        done();
      });
    });
  },
  'schemaSync fail': function(done) {
    session.schemaSync(function(err, tx) {
      assert.eql(true, err instanceof Error);
      done();
    });
  },
  'create fail': function(done) {
    create({
      name: 'test'
    }, function(err, result) {
      assert.eql(true, err instanceof Error);
      temp = result;
      done();
    });
  },
  'remove fail': function(done) {
    remove(temp, function(err, result) {
      assert.eql(true, err instanceof Error);
      done();
    });
  },
  'destroyAll fail': function(done) {
    InexistentTable.all(session).destroyAll(function(err, result) {
      assert.eql(true, err instanceof Error);
      done();
    });
  },
  'reset fail': function(done) {
    session.reset(function(err, result) {
      assert.eql(true, err instanceof Error);
      done();
    });
  },
  afterAll: function(done) {
    session.transaction(function(tx) {
      tx.executeSql('UNLOCK TABLES;', function() {
        session.close();
        done();
      });
    });
  }
};
