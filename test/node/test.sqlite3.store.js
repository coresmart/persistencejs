// $ expresso -s test.sqlite3.store.js

var assert = require('assert');
var persistence = require('../../lib/persistence').persistence;
var persistenceStore = require('../../lib/persistence.store.sqlite3');

var dbPath = __dirname + '/test-sqlite3.db';
persistenceStore.config(persistence, dbPath);

var Task = persistence.define('Task', {
  username: 'TEXT'
});

var data = {
  username: 'test'
};

var data2 = {
  username: 'test2'
};

var task, task2, session;

// remove test database
function removeDb() {
  try {
    require('fs').unlinkSync(dbPath);
  } catch (err) {
  }
}

module.exports = {
  init: function(done) {
    removeDb();
    session = persistenceStore.getSession(function () {
      session.schemaSync(done);
    });
  },
  add: function(done) {
    task = new Task(session, data);
    session.add(task);
    session.flush(function(result, err) {
      assert.ifError(err);
      done();
    });
  },
  get: function(done) {
    Task.findBy(session, 'id', task.id, function(task) {
      assert.equal(task.username, data.username);
      done();
    });
  },
  update: function(done) {
    task.username = 'test2';
    Task.findBy(session, 'id', task.id, function(task) {
      assert.equal(task.username, 'test2');
      done();
    });
  },
  remove: function(done) {
    session.remove(task);
    session.flush(function(result, err) {
      assert.ifError(err);
      Task.findBy(session, 'id', task.id, function(task) {
        assert.equal(task, null);
        done();
      });
    });
  },
  addMultiple: function(done) {
    task = new Task(session, data);
    session.add(task);
    task2 = new Task(session, data2);
    session.add(task2);
    session.flush(function(result, err) {
      assert.ifError(err);
      var count = 0;
      Task.all(session).order('username', true).each(function(row) {
        count++;
        if (count == 1) {
          assert.equal(row.username, data.username);
        }
        if (count == 2) {
          assert.equal(row.username, data2.username);
          done();
        }
      });
    });
  },
  afterAll: function(done) {
    session.close(function() {
      removeDb();
      done();
    });
  }
};
