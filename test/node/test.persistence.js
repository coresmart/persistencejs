// Run $ node test.persistence.js

(function(){
  require('./qunit.log');
  var persistence = require('../../lib/persistence').persistence;
  var persistenceStore = require('../../lib/persistence.store.mysql');
  //var persistenceStore = require('../../lib/persistence.store.memory');
  persistenceStore.config(persistence, 'localhost', 3306, 'nodejs_mysql', 'test', 'test');

  //persistence.debug = true;
  persistence.debug = false;

  var startTime = new Date().getTime();

  var Project = persistence.define('Project', {
      name: "TEXT"
    });

  var Task = persistence.define('Task', {
      name: "TEXT",
      done: "BOOL",
      counter: "INT",
      dateAdded: "DATE",
      dateAddedInMillis: "BIGINT",
      metaData: "JSON"
    });

  var Tag = persistence.define('Tag', {
      name: "TEXT"
    });

  var UniqueIndexTest = persistence.define('UniqueIndexTest', {
      id1: "INT",
      id2: "INT",
      id3p1: "INT",
      id3p2: "INT"
    });

  UniqueIndexTest.index('id1');
  UniqueIndexTest.index('id2',{unique:true});
  UniqueIndexTest.index(['id3p1','id3p2'],{unique:true});


  Task.hasMany('tags', Tag, 'tasks');
  Tag.hasMany('tasks', Task, 'tags');
  Task.index('dateAdded');

  Project.hasMany('tasks', Task, 'project');

  var session = persistenceStore.getSession();

  QUnit.module("Setup");

  asyncTest("setting up database", 2, function() {
      session.schemaSync(function(err, tx){
          console.log(err);
          ok(true, 'schemaSync called callback function');
          ok(!err, 'without an error');
          start();
        });
    });

  QUnit.module("Entity manipulation", {
      setup: function() {
        stop();
        session.reset(function() {
            session.schemaSync(function() {
                start();
              });
          });
      }
    });

  test("Property default values", 6, function() {
      var t1 = new Task(session);
      QUnit.strictEqual(t1.name, "", "TEXT properties default to ''");
      QUnit.strictEqual(t1.done, false, "BOOL properties default to false");
      QUnit.strictEqual(t1.counter, 0, "INT properties default to 0");
      QUnit.strictEqual(t1.dateAdded, null, "DATE properties default to null");
      QUnit.strictEqual(t1.dateAddedInMillis, 0, "BIGINT properties default to 0");
      QUnit.strictEqual(t1.metaData, null, "JSON properties default to null");
    });

  test("Property value assignment", 6, function() {
      var session = persistenceStore.getSession();
      var t1 = new Task(session);
      var now = new Date();
      var meta = {starRating: 5};
      t1.name = "Task 1";
      t1.done = false;
      t1.counter = 7;
      t1.dateAdded = now;
      t1.dateAddedInMillis = now.getTime();
      t1.metaData = meta;
      QUnit.strictEqual(t1.name, 'Task 1', "Assignment for TEXT properties");
      QUnit.strictEqual(t1.done, false, "Assignment for BOOL properties");
      QUnit.strictEqual(t1.counter, 7, "Assignment for INT properties");
      QUnit.strictEqual(t1.dateAdded, now, "Assignment for DATE properties");
      QUnit.strictEqual(t1.dateAddedInMillis, now.getTime(), "Assignment for BIGINT properties");
      QUnit.strictEqual(t1.metaData, meta, "Assignment for JSON properties");
      session.close();
    });

  test("Property constructor property value assignment", 6, function() {
      var now = new Date();
      var meta = {starRating: 5};
      var t1 = new Task(session, {
          name: "Task 1",
          done: false,
          counter: 7,
          dateAdded: now,
          dateAddedInMillis: now.getTime(),
          metaData: meta
        });
      QUnit.strictEqual(t1.name, 'Task 1', "Assignment for TEXT properties");
      QUnit.strictEqual(t1.done, false, "Assignment for BOOL properties");
      QUnit.strictEqual(t1.counter, 7, "Assignment for INT properties");
      QUnit.strictEqual(t1.dateAdded, now, "Assignment for DATE properties");
      QUnit.strictEqual(t1.dateAddedInMillis, now.getTime(), "Assignment for BIGINT properties");
      QUnit.strictEqual(t1.metaData, meta, "Assignment for JSON properties");
    });

  asyncTest("Empty object persistence", function() {
      var t1 = new Task(session);
      session.add(t1);
      session.flush(function(err) {
          //session.clean();
          ok(!err, 'no error on flush');
          Task.all(session).one(function(err, t1db) {
              ok(!err, 'no error message');
              equals(t1db.id, t1.id, "TEXT properties default to ''");
              equals(t1db.name, "", "TEXT properties default to ''");
              equals(t1db.done, false, "BOOL properties default to false");
              equals(t1db.counter, 0, "INT properties default to 0");
              equals(t1db.dateAdded, null, "DATE properties default to null");
              equals(t1db.dateAddedInMillis, 0, "BIGINT properties default to 0");
              equals(t1db.metaData, null, "JSON properties default to null");
              start();
            });
        });
    });

  asyncTest("Object persistence", function() {
      var now = new Date();
      var meta = {starRating: 5};
      var t1 = new Task(session, {
          name: "Task 1",
          done: false,
          counter: 7,
          dateAdded: now,
          dateAddedInMillis: 1296802544867,
          metaData: meta
        });
      session.add(t1);
      session.flush(function(err) {
          ok(!err, 'no error on flush');
          session.clean();
          Task.all(session).one(function(err, t1db) {
              ok(!err, 'no error');
              equals(t1db.name, 'Task 1', "Persistence of TEXT properties");
              equals(t1db.done, false, "Persistence of BOOL properties");
              equals(t1db.counter, 7, "Persistence of INT properties");
              equals(Math.round(t1db.dateAdded.getTime()/1000)*1000, Math.round(now.getTime()/1000)*1000, "Persistence of DATE properties");
              equals(t1db.dateAddedInMillis, 1296802544867, "Persistence of BIGINT properties");
              same(t1db.metaData, meta, "Persistence of JSON properties");
              start();
            });
        });
    });

  asyncTest("Multiple objects", function() {
      var objs = [];
      var counter = 0;
      for(var i = 0; i < 25; i++) {
        var t = new Task(session, {name: "Task " + i});
        t.counter = counter;
        objs.push(t);
        session.add(t);
        counter++;
      }
      session.flush(function(err) {
          ok(!err, 'no error');
          Task.all(session).order('counter', true).list(function(err, results) {
              ok(!err, 'no error');
              for(var i = 0; i < 25; i++) {
                ok(results[i] === objs[i], 'Cache works OK');
              }
              //session.clean(); // Clean out local cache
              Task.all(session).order('counter', true).list(function(err, results) {
                  ok(!err, 'no error');
                  for(var i = 0; i < 25; i++) {
                    ok(results[i].id === objs[i].id, 'Retrieving from DB ok');
                  }
                  start();
                });
            });
        });
    });

  asyncTest("One-to-many", function() {
      var p = new Project(session, {name: "Some project"});
      session.add(p);
      p.tasks.list(function(err, tasks) {
          ok(!err, 'no error');
          equals(tasks.length, 0, "Initially, no tasks");
          var task1 = new Task(session, {name: "Do dishes"});
          var task2 = new Task(session, {name: "Laundry"});

          // Adding in two ways
          p.tasks.add(task1);
          task2.project = p;

          p.tasks.order('name', true).list(function(err, tasks) {
              ok(!err, 'no error');
              equals(tasks.length, 2, "Now two tasks");
              equals(tasks[0].id, task1.id, "Right tasks");
              equals(tasks[1].id, task2.id, "Right tasks");
              start();
            });
        });
    });

  asyncTest("Many-to-many", function() {
      var t = new Task(session, {name: "Some task"});
      session.add(t);
      t.tags.list(function(err, tags) {
          ok(!err, 'no error');
          equals(tags.length, 0, "Initially, no tags");
          var tag1 = new Tag(session, {name: "important"});
          var tag2 = new Tag(session, {name: "today"});
          t.tags.add(tag1);
          t.tags.add(tag2);
          t.tags.list(function(err, tags) {
              ok(!err, 'no error');
              equals(tags.length, 2, "2 tags added");
              var oneTag = tags[0];
              oneTag.tasks.list(function(err, tagTasks) {
                  ok(!err, 'no error');
                  equals(tagTasks.length, 1, "Tag has one task");
                  equals(tagTasks[0].id, t.id, "Correct task");
                  oneTag.tasks.remove(tagTasks[0]);
                  t.tags.count(function(err, cnt) {
                      ok(!err, 'no error');
                      equals(cnt, 1, "Tag removed task, task has only one tag left");
                      start();
                    });
                });
            });
        });
    });

  QUnit.module("Query collections", {
      setup: function() {
        stop();
        session.reset(function() {
            session.schemaSync(start);
          });
      }
    });

  function intFilterTests(coll, callback) {
    for(var i = 0; i < 25; i++) {
      var t = new Task(session, {name: "Task " + i, done: false});
      t.counter = i;
      coll.add(t);
    }
    coll.list(function(err, results) {
        ok(!err, 'no error');
        equals(results.length, 25, "Count items in collection");
        coll.filter("counter", ">", 10).list(function(err, results) {
            ok(!err, 'no error');
            equals(results.length, 14, "> filter test");
            coll.filter("counter", "in", [0, 1, 2]).list(function(err, results) {
                ok(!err, 'no error');
                equals(results.length, 3, "'in' filter test");
                coll.filter("counter", "not in", [0, 1]).list(function(err, results) {
                    ok(!err, 'no error');
                    equals(results.length, 23, "'not in' filter test");
                    coll.filter("counter", "!=", 0).list(function(err, results) {
                        ok(!err, 'no error');
                        equals(results.length, 24, "'!=' filter test");
                        callback();
                      });
                  });
              });
          });
      });
  }

  function textFilterTests(coll, callback) {
    var alphabet = 'abcdefghijklmnopqrstufwxyz';
    for(var i = 0; i <= 25; i++) {
      var t = new Task(session, {name: alphabet[i]});
      coll.add(t);
    }
    coll.list(function(err, results) {
        ok(!err, 'no error');
        equals(results.length, 26, "Count items in collection");
        coll.filter("name", "=", 'a').list(function(err, results) {
            ok(!err, 'no error');
            equals(results.length, 1, "= filter test");
            coll.filter("name", "!=", 'a').list(function(err, results) {
                ok(!err, 'no error');
                equals(results.length, 25, "!= filter test");
                coll.filter("name", ">", 'm').list(function(err, results) {
                    ok(!err, 'no error');
                    equals(results.length, 12, "> filter test");
                    coll.filter("name", "in", ["a", "b"]).list(function(err, results) {
                        ok(!err, 'no error');
                        equals(results.length, 2, "'in' filter test");
                        coll.filter("name", "not in", ["q", "x"]).list(function(err, results) {
                            ok(!err, 'no error');
                            equals(results.length, 24, "'not in' filter test");
                            callback();
                          });
                      });
                  });
              });
          });
      });
  }

  function boolFilterTests(coll, callback) {
    for(var i = 0; i < 24; i++) {
      var t = new Task(session, {name: "Task " + i, done: i % 2 === 0});
      coll.add(t);
    }
    coll.list(function(err, results) {
        ok(!err, 'no error');
        equals(results.length, 24, "Count items in collection");
        coll.filter("done", "=", true).list(function(err, results) {
            ok(!err, 'no error');
            equals(results.length, 12, "= filter test");
            coll.filter("done", "=", false).list(function(err, results) {
                ok(!err, 'no error');
                equals(results.length, 12, "= filter test");
                coll.filter("done", "!=", true).list(function(err, results) {
                    ok(!err, 'no error');
                    equals(results.length, 12, "'!=' filter test");
                    coll.filter("done", "!=", false).list(function(err, results) {
                        ok(!err, 'no error');
                        equals(results.length, 12, "'!=' filter test");
                        callback();
                      });
                  });
              });
          });
      });
  }

  function dateFilterTests(coll, callback) {
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
    coll.list(function(err, results) {
        ok(!err, 'no error');
        equals(results.length, 24, "Count items in collection");
        coll.filter("dateAdded", "=", dateInDays(1)).list(function(err, results) {
            ok(!err, 'no error');
            equals(results.length, 1, "= filter test");
            coll.filter("dateAdded", "!=", dateInDays(1)).list(function(err, results) {
                ok(!err, 'no error');
                equals(results.length, 23, "!= filter test");
                coll.filter("dateAdded", ">", dateInDays(12)).list(function(err, results) {
                    ok(!err, 'no error');
                    equals(results.length, 11, "> filter test");
                    start();
                  });
              })
          });
      });
  }

  asyncTest("Database INT filters", function() {
      for(var i = 0; i < 25; i++) {
        var t = new Task(session, {name: "Root task " + i, done: false});
        t.counter = i;
        session.add(t);
      }

      var p = new Project(session, {name: "My project"});
      session.add(p);
      intFilterTests(p.tasks, start);
    });

  asyncTest("Local INT filters", function() {
      var coll = new session.LocalQueryCollection();
      intFilterTests(coll, start);
    });

  asyncTest("Database TEXT filters", function() {
      var alphabet = 'abcdefghijklmnopqrstufwxyz';
      for(var i = 0; i <= 25; i++) {
        var t = new Task(session, {name: alphabet[i]});
        session.add(t);
      }

      var p = new Project(session, {name: "My project"});
      session.add(p);
      textFilterTests(p.tasks, start);
    });

  asyncTest("Local TEXT filters", function() {
      var coll = new session.LocalQueryCollection();
      textFilterTests(coll, start);
    });

  asyncTest("Database BOOL filters", function() {
      for(var i = 0; i < 25; i++) {
        var t = new Task(session, {name: "Root task " + i, done: false});
        t.counter = i;
        session.add(t);
      }

      var p = new Project(session, {name: "My project"});
      session.add(p);
      boolFilterTests(p.tasks, start);
    });

  asyncTest("Local BOOL filters", function() {
      var coll = new session.LocalQueryCollection();
      boolFilterTests(coll, start);
    });

  asyncTest("Database DATE filters", function() {
      var p = new Project(session, {name: "My project"});
      session.add(p);
      dateFilterTests(p.tasks, start);
    });

  asyncTest("Local DATE filters", function() {
      var coll = new session.LocalQueryCollection();
      dateFilterTests(coll, start);
    });


  function intOrderTests(coll, callback) {
    var tasks = [];
    for(var i = 0; i < 24; i++) {
      var t = new Task(session, {name: "Task " + i, counter: i});
      tasks.push(t);
      coll.add(t);
    }
    coll.order('counter', true).list(function(err, results) {
        ok(!err, 'no error');
        for(var i = 0; i < 24; i++) {
          equals(results[i].id, tasks[i].id, "order check, ascending");
        }
        tasks.reverse();
        coll.order('counter', false).list(function(err, results) {
            ok(!err, 'no error');
            for(var i = 0; i < 24; i++) {
              equals(results[i].id, tasks[i].id, "order check, descending");
            }
            callback();
          });
      });
  }

  function dateOrderTests(coll, callback) {
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
    coll.order('dateAdded', true).list(function(err, results) {
        for(var i = 0; i < 24; i++) {
          equals(results[i].id, tasks[i].id, "order check, ascending");
        }
        tasks.reverse();
        coll.order('dateAdded', false).list(function(err, results) {
            for(var i = 0; i < 24; i++) {
              equals(results[i].id, tasks[i].id, "order check, descending");
            }
            callback();
          });
      });
  }

  asyncTest("Database INT order", function() {
      var p = new Project(session, {name: "My project"});
      session.add(p);
      intOrderTests(p.tasks, start);
    });

  asyncTest("Local INT order", function() {
      var coll = new session.LocalQueryCollection();
      intOrderTests(coll, start);
    });

  asyncTest("Database DATE order", function() {
      var p = new Project(session, {name: "My project"});
      session.add(p);
      dateOrderTests(p.tasks, start);
    });

  asyncTest("Local DATE order", function() {
      var coll = new session.LocalQueryCollection();
      dateOrderTests(coll, start);
    });

  function collectionLimitTests(coll, callback) {
    var tasks = [];
    for(var i = 0; i < 24; i++) {
      var t = new Task(session, {name: "Task " + i, counter: i});
      tasks.push(t);
      coll.add(t);
    }
    coll.order("counter", true).limit(5).list(function(err, results) {
        ok(!err, 'no error');
        equals(results.length, 5, "Result length check");
        for(var i = 0; i < 5; i++) {
          equals(results[i].id, tasks[i].id, "limit check");
        }
        start();
      });
  }

  function collectionSkipTests(coll, callback) {
    var tasks = [];
    for(var i = 0; i < 24; i++) {
      var t = new Task(session, {name: "Task " + i, counter: i});
      tasks.push(t);
      coll.add(t);
    }
    coll.order("counter", true).skip(5).limit(5).list(function(err, results) {
        ok(!err, 'no error');
        equals(results.length, 5, "Result length check");
        for(var i = 5; i < 10; i++) {
          equals(results[i-5].id, tasks[i].id, "skip check");
        }
        start();
      });
  }

  asyncTest("Database limit", function() {
      collectionLimitTests(Task.all(session), start);
    });

  asyncTest("Local limit", function() {
      var coll = new session.LocalQueryCollection();
      collectionLimitTests(coll, start);
    });

  asyncTest("Database skip", function() {
      collectionSkipTests(Task.all(session), start);
    });

  asyncTest("Local skip", function() {
      var coll = new session.LocalQueryCollection();
      collectionSkipTests(coll, start);
    });

  QUnit.module("Dumping/restoring");

  asyncTest("Full dump/restore", function() {
      session.reset(function(err) {
          session.schemaSync(function(err) {
              for(var i = 0; i < 10; i++) {
                var t = new Task(session, {name: "Task " + i, dateAdded: new Date()});
                t.tags.add(new Tag(session, {name: "Some tag: " + i}));
                t.tags.add(new Tag(session, {name: "Another tag: " + i}));
                session.add(t);
              }
              session.flush(function() {
                  session.dumpToJson(function(err, dumps) {
                      ok(!err, 'no error');
                      session.reset(function() {
                          session.schemaSync(function() {
                              session.loadFromJson(dumps, function(err) {
                                  ok(!err, 'no error');
                                  Task.all(session).list(function(err, tasks) {
                                      ok(!err, 'no error');
                                      equals(tasks.length, 10, "tasks restored successfully");
                                      tasks[0].tags.list(function(err, tags) {
                                          ok(!err, 'no error');
                                          equals(tags.length, 2, "tags restored successfully");
                                          start();
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });

  asyncTest("Select dump/restore", function() {
      session.reset(function() {
          session.schemaSync(function() {
              var project = new Project(session, {name: "My project"});
              session.add(project);
              var tags = [];
              for(var i = 0; i < 5; i++) {
                var tag = new Tag(session, {name: "Tag " + i});
                session.add(tag);
                tags.push(tag);
              }
              for(var i = 0; i < 10; i++) {
                var task = new Task(session, {name: "Task " + i});
                task.done = true;
                task.tags = new session.LocalQueryCollection(tags);
                project.tasks.add(task);
              }
              Project.all(session).selectJSON(['id', 'name', 'tasks.[id,name]', 'tasks.tags.[id, name]'], function(err, result) {
                  ok(!err, 'no error');
                  session.reset(function() {
                      session.schemaSync(function() {
                          Project.fromSelectJSON(session, result[0], function(err, obj) {
                              ok(!err, 'no error');
                              session.add(obj);
                              Task.all(session).list(function(err, tasks) {
                                  ok(!err, 'no error');
                                  equals(tasks.length, 10, "number of restored tasks ok");
                                  tasks.forEach(function(task) {
                                      equals(task.done, false, "done still default value");
                                    });
                                  start();
                                });
                            });
                        });
                    });
                });
            });
        });
    });

  asyncTest("AND and OR filters", function() {
      session.reset(function() {
          session.schemaSync(function() {
              for(var i = 0; i < 10; i++) {
                var task = new Task(session, {name: "Task " + i});
                task.done = i % 2 === 0;
                session.add(task);
              }
              Task.all(session).filter("done", "=", true).or(new persistence.PropertyFilter("done", "=", false)).list(function(err, results) {
                  ok(!err, 'no error');
                  equals(results.length, 10, "right number of results");
                  Task.all(session).filter("done", "=", true).and(new persistence.PropertyFilter("done", "=", false)).list(function(err, results) {
                      ok(!err, 'no error');
                      equals(results.length, 0, "right number of results");
                      start();
                    });
                });
            });
        });
    });

  QUnit.module("Events");

  asyncTest("all collection", function() {
      session.reset(function() {
          session.schemaSync(function() {
              var allTasks = Task.all(session);
              var changesDetected = 0;
              allTasks.addEventListener('change', function() {
                  changesDetected++;
                });
              for(var i = 0; i < 10; i++) {
                var task = new Task(session, {name: "Task " + i});
                task.done = i % 2 === 0;
                Task.all(session).add(task);
              }
              equals(changesDetected, 10, "detected all changes");
              start();
            });
        });
    });

  asyncTest("filter collection", function() {
      session.reset(function() {
          session.schemaSync(function() {
              var allTasks = Task.all(session).filter("done", "=", true);
              var changesDetected = 0;
              allTasks.addEventListener('change', function() {
                  changesDetected++;
                });
              for(var i = 0; i < 10; i++) {
                var task = new Task(session, {name: "Task " + i});
                task.done = i % 2 === 0;
                Task.all(session).add(task);
              }
              equals(changesDetected, 5, "detected all changes");
              changesDetected = 0;
              Task.all(session).filter("done", "=", true).list(function(err, results) {
                  ok(!err, 'no error');
                  results.forEach(function(r) {
                      r.done = false;
                    });
                  equals(changesDetected, 5, "detected filter changes");
                  start();
                });
            });
        });
    });



    QUnit.module("Indexes");


    asyncTest("unique indexes", function() {
        session.reset(function() {
            session.schemaSync(function() {
                var o1 = new UniqueIndexTest(session, {"id1":101,"id2":102,"id3p1":103,"id3p2":104});

                // id1 is not unique
                var o2 = new UniqueIndexTest(session, {"id1":101,"id2":202,"id3p1":203,"id3p2":204});

                //shouldn't work, id2 is unique
                var o3 = new UniqueIndexTest(session, {"id1":301,"id2":102,"id3p1":303,"id3p2":304});

                // id3p1 itself is not unique
                var o4 = new UniqueIndexTest(session, {"id1":401,"id2":402,"id3p1":103,"id3p2":404});

                //shouldn't work, id3p1+id3p2 are unique
                var o5 = new UniqueIndexTest(session, {"id1":501,"id2":502,"id3p1":103,"id3p2":104});


                session.add(o1);
                session.add(o2);
                try {
                    //session.add(o3);
                } catch (e) {
                    console.log("err",e);
                }
                
                session.add(o4);
                try {
                    //session.add(o5);
                } catch (e) {
                    console.log("err",e);
                }


                UniqueIndexTest.all(session).order("id2",true).list(function(err, results) {
                    ok(!err, 'no error');
                    equals(3,results.length,"skipped 2 duplicate rows");
                    if (results.length==3) {
                        equals(102,results[0].id2);
                        equals(202,results[1].id2);
                        equals(402,results[2].id2);
                    }
                    session.close();
                    start();
                });
              });
          });
      });

})();
