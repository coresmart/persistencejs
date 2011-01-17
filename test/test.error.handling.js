var assert = require('assert');
var persistence = require('../lib/persistence').persistence;
var persistenceStore = require('../lib/persistence.store.mysql');

persistenceStore.config(persistence, 'localhost', 3306, 'nodejs_mysql', 'test', 'test');

var NotExist = persistence.define('NotExist', {
  name: "TEXT"
});

var create = function(data, cb) {
  var session = persistenceStore.getSession();
  var ne = new NotExist(data);
  session.add(ne);
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
