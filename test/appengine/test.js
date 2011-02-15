// Run with RingoJS: http://ringojs.org
// Set path below to AppEngine Java SDK path
var appEngineSdkPath = '/Users/zef/Software/appengine-java-sdk';

addToClasspath(appEngineSdkPath + "/lib/impl/appengine-api-stubs.jar");
addToClasspath(appEngineSdkPath + "/lib/impl/appengine-api.jar");
addToClasspath(appEngineSdkPath + "/lib/impl/appengine-api-labs.jar");
addToClasspath(appEngineSdkPath + "/lib/impl/appengine-api-stubs.jar");
addToClasspath(appEngineSdkPath + "/lib/testing/appengine-testing.jar");

var persistence = require('../../lib/persistence').persistence;
var persistenceStore = require('../../lib/persistence.store.appengine');
var assert = require("assert");

var JLocalDatastoreServiceTestConfig = com.google.appengine.tools.development.testing.LocalDatastoreServiceTestConfig;
var JLocalServiceTestHelper = com.google.appengine.tools.development.testing.LocalServiceTestHelper;

var helper = new JLocalServiceTestHelper(new JLocalDatastoreServiceTestConfig());


persistenceStore.config(persistence);

var Project = persistence.define('Project', {
    name: "TEXT"
  });

var Task = persistence.define('Task', {
    name: "TEXT",
    done: "BOOL",
    counter: "INT",
    dateAdded: "DATE",
    metaData: "JSON"
  });

var Tag = persistence.define('Tag', {
    name: "TEXT"
  });

Task.hasMany('tags', Tag, 'tasks');
Tag.hasMany('tasks', Task, 'tags');
Task.index('dateAdded');

Project.hasMany('tasks', Task, 'project');

function intFilterTests(session, coll, callback) {
  for(var i = 0; i < 25; i++) {
    var t = new Task(session, {name: "Task " + i, done: false});
    t.counter = i;
    coll.add(t);
  }
  coll.list(function(results) {
      assert.equal(results.length, 25, "Count items in collection");
      coll.filter("counter", ">", 10).list(function(results) {
          assert.equal(results.length, 14, "> filter test");
          coll.filter("counter", "in", [0, 1, 2]).list(function(results) {
              assert.equal(results.length, 3, "'in' filter test");
              coll.filter("counter", "!=", 0).list(function(results) {
                  assert.equal(results.length, 24, "'!=' filter test");
                  callback();
                });
            });
        });
    });
}

function textFilterTests(session, coll, callback) {
  var alphabet = 'abcdefghijklmnopqrstufwxyz';
  for(var i = 0; i <= 25; i++) {
    var t = new Task(session, {name: alphabet[i]});
    coll.add(t);
  }
  coll.list(function(results) {
      assert.equal(results.length, 26, "Count items in collection");
      coll.filter("name", "=", 'a').list(function(results) {
          assert.equal(results.length, 1, "= filter test");
          coll.filter("name", "!=", 'a').list(function(results) {
              assert.equal(results.length, 25, "!= filter test");
              coll.filter("name", ">", 'm').list(function(results) {
                  assert.equal(results.length, 12, "> filter test");
                  coll.filter("name", "in", ["a", "b"]).list(function(results) {
                      assert.equal(results.length, 2, "'in' filter test");
                      callback();
                    });
                });
            });
        });
    });
}

function boolFilterTests(session, coll, callback) {
  for(var i = 0; i < 24; i++) {
    var t = new Task(session, {name: "Task " + i, done: i % 2 === 0});
    coll.add(t);
  }
  coll.list(function(results) {
      assert.equal(results.length, 24, "Count items in collection");
      coll.filter("done", "=", true).list(function(results) {
          assert.equal(results.length, 12, "= filter test");
          coll.filter("done", "=", false).list(function(results) {
              assert.equal(results.length, 12, "= filter test");
              coll.filter("done", "!=", true).list(function(results) {
                  assert.equal(results.length, 12, "'!=' filter test");
                  coll.filter("done", "!=", false).list(function(results) {
                      assert.equal(results.length, 12, "'!=' filter test");
                      callback();
                    });
                });
            });
        });
    });
}

function dateFilterTests(session, coll, callback) {
  var now = new Date();

  function dateInDays(n) {
    var newDate = new Date(now.getTime());
    newDate.setDate(newDate.getDate()+n);
    return newDate;
  }

  for(var i = 0; i < 24; i++) {
    var t = new Task(session, {name: "Task " + i, dateAdded: dateInDays(i)});
    coll.add(t);
  }
  coll.list(function(results) {
      assert.equal(results.length, 24, "Count items in collection");
      coll.filter("dateAdded", "=", dateInDays(1)).list(function(results) {
          assert.equal(results.length, 1, "= filter test");
          coll.filter("dateAdded", "!=", dateInDays(1)).list(function(results) {
              assert.equal(results.length, 23, "!= filter test");
              coll.filter("dateAdded", ">", dateInDays(12)).list(function(results) {
                  assert.equal(results.length, 11, "> filter test");
                  callback();
                });
            })
        });
    });
}

function intOrderTests(session, coll, callback) {
  var tasks = [];
  for(var i = 0; i < 24; i++) {
    var t = new Task(session, {name: "Task " + i, counter: i});
    tasks.push(t);
    coll.add(t);
  }
  coll.order('counter', true).list(function(results) {
      for(var i = 0; i < 24; i++) {
        assert.equal(results[i].id, tasks[i].id, "order check, ascending");
      }
      tasks.reverse();
      coll.order('counter', false).list(function(results) {
          for(var i = 0; i < 24; i++) {
            assert.equal(results[i].id, tasks[i].id, "order check, descending");
          }
          callback();
        });
    });
}

function dateOrderTests(session, coll, callback) {
  var now = new Date();

  function dateInDays(n) {
    var newDate = new Date(now.getTime());
    newDate.setDate(newDate.getDate()+n);
    return newDate;
  }

  var tasks = [];
  for(var i = 0; i < 24; i++) {
    var t = new Task(session, {name: "Task " + i, dateAdded: dateInDays(i)});
    tasks.push(t);
    coll.add(t);
  }
  coll.order('dateAdded', true).list(function(results) {
      for(var i = 0; i < 24; i++) {
        assert.equal(results[i].id, tasks[i].id, "order check, ascending");
      }
      tasks.reverse();
      coll.order('dateAdded', false).list(function(results) {
          for(var i = 0; i < 24; i++) {
            assert.equal(results[i].id, tasks[i].id, "order check, descending");
          }
          callback();
        });
    });
}

function collectionLimitTests(session, coll, callback) {
  var tasks = [];
  for(var i = 0; i < 24; i++) {
    var t = new Task(session, {name: "Task " + i, counter: i});
    tasks.push(t);
    coll.add(t);
  }
  coll.order("counter", true).limit(5).list(function(results) {
      assert.equal(results.length, 5, "Result length check");
      for(var i = 0; i < 5; i++) {
        assert.equal(results[i].id, tasks[i].id, "limit check");
      }
      callback();
    });
}

function collectionSkipTests(session, coll, callback) {
  var tasks = [];
  for(var i = 0; i < 24; i++) {
    var t = new Task(session, {name: "Task " + i, counter: i});
    tasks.push(t);
    coll.add(t);
  }
  coll.order("counter", true).skip(5).limit(5).list(function(results) {
      assert.equal(results.length, 5, "Result length check");
      for(var i = 5; i < 10; i++) {
        assert.equal(results[i-5].id, tasks[i].id, "skip check");
      }
      callback();
    });
}



var tests = {
  testBasic: function() {
    helper.setUp();
    var session = persistenceStore.getSession();
    for(var i = 0; i < 10; i++) {
      var t = new Task(session, {name: "user " + i, done: i % 2 === 0, dateAdded: new Date()});
      session.add(t);
    }
    Task.all(session).filter("done", "=", true).order('dateAdded', false).list(function(results) {
        assert.equal(results.length, 5, "Correct number of completed tasks");
        session.close();
        helper.tearDown();
      });
  },
  testOneToMany: function() {
    helper.setUp();
    var session = persistenceStore.getSession();
    session.schemaSync(function() {
        var proj = new Project(session);
        proj.name = "Main";
        for(var i = 0; i < 10; i++) {
          var t = new Task(session, {name: "user " + i, done: i % 2 === 0, dateAdded: new Date()});
          proj.tasks.add(t);
        }
        for(var i = 0; i < 10; i++) {
          var t = new Task(session, {name: "non-proj user " + i, done: i % 2 === 0, dateAdded: new Date()});
          session.add(t);
        }
        proj.tasks.filter("done", "=", true).list(function(results) {
            assert.equal(results.length, 5, "Correct number of completed tasks");
            session.close();
            helper.tearDown();
          });
      });
  },
  testFetch: function() {
    helper.setUp();
    var session = persistenceStore.getSession();
    var proj = new Project(session);
    proj.name = "Main";
    for(var i = 0; i < 10; i++) {
      var t = new Task(session, {name: "user " + i, done: i % 2 === 0, dateAdded: new Date()});
      proj.tasks.add(t);
    }
    session.flush(function() {
        session.clean();
        Task.all(session).list(function(results) {
            results.forEach(function(r) {
                r.fetch('project', function(p) {
                    assert.equal(p.name, "Main", "Correct number of completed tasks");
                  });
              });
            session.close();
            helper.tearDown();
          });
      });
  },
  testDatabaseIntFilter: function() {
    helper.setUp();
    var session = persistenceStore.getSession();
    for(var i = 0; i < 25; i++) {
      var t = new Task(session, {name: "Root task " + i, done: false});
      t.counter = i;
      session.add(t);
    }

    var p = new Project(session, {name: "My project"});
    session.add(p);
    intFilterTests(session, p.tasks, function() {
        session.close();
        helper.tearDown();
      });
  },
  testDatabaseLocalIntFilter: function() {
    helper.setUp();
    var session = persistenceStore.getSession();
    var coll = new persistence.LocalQueryCollection();
    intFilterTests(session, coll, function() {
        session.close();
        helper.tearDown();
      });
  },
  testDatabaseTextFilter: function() {
    helper.setUp();
    var session = persistenceStore.getSession();
    var alphabet = 'abcdefghijklmnopqrstufwxyz';
    for(var i = 0; i <= 25; i++) {
      var t = new Task(session, {name: alphabet[i]});
      session.add(t);
    }
    var p = new Project(session, {name: "My project"});
    session.add(p);
    textFilterTests(session, p.tasks, function() {
        session.close();
        helper.tearDown();
      });
  },
  testDatabaseLocalTextFilter: function() {
    helper.setUp();
    var session = persistenceStore.getSession();
    var coll = new persistence.LocalQueryCollection();
    textFilterTests(session, coll, function() {
        session.close();
        helper.tearDown();
      });
  },
  testDatabaseBoolFilter: function() {
    helper.setUp();
    var session = persistenceStore.getSession();
    for(var i = 0; i < 25; i++) {
      var t = new Task(session, {name: "Root task " + i, done: false});
      t.counter = i;
      session.add(t);
    }

    var p = new Project(session, {name: "My project"});
    session.add(p);

    boolFilterTests(session, p.tasks, function() {
        session.close();
        helper.tearDown();
      });
  },

  testDatabaseDateFilter: function() {
    helper.setUp();
    var session = persistenceStore.getSession();
    var p = new Project(session, {name: "My project"});
    session.add(p);
    dateFilterTests(session, p.tasks, function() {
        session.close();
        helper.tearDown();
      });
  },

  testDatabaseIntOrder: function() {
    helper.setUp();
    var session = persistenceStore.getSession();
    var p = new Project(session, {name: "My project"});
    session.add(p);
    intOrderTests(session, p.tasks, function() {
        session.close();
        helper.tearDown();
      });
  },

  testDatabaseDateOrder: function() {
    helper.setUp();
    var session = persistenceStore.getSession();
    var p = new Project(session, {name: "My project"});
    session.add(p);
    dateOrderTests(session, p.tasks, function() {
        session.close();
        helper.tearDown();
      });
  },

  testCollectionLimit: function() {
    helper.setUp();
    var session = persistenceStore.getSession();
    collectionLimitTests(session, Task.all(session), function() {
        session.close();
        helper.tearDown();
      });
  },

  testCollectionSkip: function() {
    helper.setUp();
    var session = persistenceStore.getSession();
    collectionSkipTests(session, Task.all(session), function() {
        session.close();
        helper.tearDown();
      });
  },

  testJSON: function() {
    helper.setUp();
    var session = persistenceStore.getSession();
    var p = new Project(session, {name: 'A project'});
    for(var i = 0; i < 10; i++) {
      p.tasks.add(new Task(session, {name: "Some task " + i}));
    }
    p.selectJSON(['id', 'name', 'tasks.[id,name]'], function(json) {
        assert.equal(json.id, p.id, "id");
        assert.equal(json.name, p.name, "name");
        assert.equal(json.tasks.length, 10, "n tasks");
        session.close();
        helper.tearDown();
      });
  }
};

require('test').run(tests);
java.lang.System.exit(0);
