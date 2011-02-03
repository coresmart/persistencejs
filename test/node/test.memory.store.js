var persistence = require('../../lib/persistence').persistence;
require('../../lib/persistence.store.memory').config(persistence);
var assert = require('assert');

var Task = persistence.define('Task', {
  username: 'TEXT'
});

var data = {
  username: 'test'
};
persistence.schemaSync();
var task = new Task(data);
persistence.add(task);
persistence.flush(function(result, err) {
  persistence.remove(task);
  persistence.flush(function(result, err) {
    Task.findBy('id', task.id, function(task) {
      assert.equal(task, null);
    });
  });
});
