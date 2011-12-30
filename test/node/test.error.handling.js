// $ expresso -s test/test.error.handling.js

var assert = require('assert');
var persistence = require('../lib/persistence').persistence;
var persistenceStore = require('../lib/persistence.store.mysql');

persistenceStore.config(persistence, 'localhost', 3306, 'nodejs_mysql', 'test', 'test');

var InexistentTable = persistence.define('inexistent_table', {
  name: "TEXT"
});

var session = persistenceStore.getSession();

var create = function(data, cb) {
  var inexistent_table = new InexistentTable(data);
  session.add(inexistent_table);
  session.flush(function(result, err) {
    cb && cb(err, inexistent_table);
  });
};

var remove = function(inexistent_table, cb) {
  session.remove(inexistent_table);
  session.flush(function(result, err) {
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
    session.schemaSync(function(tx, err) {
      assert.isDefined(err);
      done();
    });
  },
  'create fail': function(done) {
    create({
      name: 'test'
    }, function(err, result) {
      assert.isDefined(err);
      temp = result;
      done();
    });
  },
  'remove fail': function(done) {
    remove(temp, function(err, result) {
      assert.isDefined(err);
      done();
    });
  },
  'destroyAll fail': function(done) {
    InexistentTable.all(session).destroyAll(function(result, err) {
      assert.isDefined(err);
      done();
    });
  },
  'reset fail': function(done) {
    session.reset(function(result, err) {
      assert.isDefined(err);
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
