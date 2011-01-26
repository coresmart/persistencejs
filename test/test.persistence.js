$(document).ready(function(){
  persistence.store.websql.config(persistence, 'persistencetest', 'My db', 5 * 1024 * 1024);
  //persistence.store.memory.config(persistence);
  persistence.debug = true;
  //persistence.debug = false;

  var startTime = new Date().getTime();

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

  window.Project = Project;
  window.Task = Task
  window.Project = Project;
  window.UniqueIndexTest = UniqueIndexTest;


  module("Setup");

  asyncTest("setting up database", 1, function() {
      persistence.schemaSync(function(tx){
          ok(true, 'schemaSync called callback function');
          start();
        });
    });

  module("Entity manipulation", {
      setup: function() {
        stop();
        persistence.reset(function() {
            persistence.schemaSync(start);
          });
      }
    });

  test("Property default values", 5, function() {
      var t1 = new Task();
      QUnit.strictEqual(t1.name, "", "TEXT properties default to ''");
      QUnit.strictEqual(t1.done, false, "BOOL properties default to false");
      QUnit.strictEqual(t1.counter, 0, "INT properties default to 0");
      QUnit.strictEqual(t1.dateAdded, null, "DATE properties default to null");
      QUnit.strictEqual(t1.metaData, null, "JSON properties default to null");
    });

  test("Property value assignment", 5, function() {
      var t1 = new Task();
      var now = new Date();
      var meta = {starRating: 5};
      t1.name = "Task 1";
      t1.done = false;
      t1.counter = 7;
      t1.dateAdded = now;
      t1.metaData = meta;
      QUnit.strictEqual(t1.name, 'Task 1', "Assignment for TEXT properties");
      QUnit.strictEqual(t1.done, false, "Assignment for BOOL properties");
      QUnit.strictEqual(t1.counter, 7, "Assignment for INT properties");
      QUnit.strictEqual(t1.dateAdded, now, "Assignment for DATE properties");
      QUnit.strictEqual(t1.metaData, meta, "Assignment for JSON properties");
    });

  test("Property constructor property value assignment", 5, function() {
      var now = new Date();
      var meta = {starRating: 5};
      var t1 = new Task({
          name: "Task 1",
          done: false,
          counter: 7,
          dateAdded: now,
          metaData: meta
        });
      QUnit.strictEqual(t1.name, 'Task 1', "Assignment for TEXT properties");
      QUnit.strictEqual(t1.done, false, "Assignment for BOOL properties");
      QUnit.strictEqual(t1.counter, 7, "Assignment for INT properties");
      QUnit.strictEqual(t1.dateAdded, now, "Assignment for DATE properties");
      QUnit.strictEqual(t1.metaData, meta, "Assignment for JSON properties");
    });

  asyncTest("Empty object persistence", function() {
      var t1 = new Task();
      persistence.add(t1);
      persistence.flush(function() {
          //persistence.clean();
          Task.all().one(function(t1db) {
              equals(t1db.id, t1.id, "TEXT properties default to ''");
              equals(t1db.name, "", "TEXT properties default to ''");
              equals(t1db.done, false, "BOOL properties default to false");
              equals(t1db.counter, 0, "INT properties default to 0");
              equals(t1db.dateAdded, null, "DATE properties default to null");
              equals(t1db.metaData, null, "JSON properties default to null");
              start();
            });
        });
    });

  asyncTest("Object persistence", function() {
      var now = new Date();
      var meta = {starRating: 5};
      var t1 = new Task({
          name: "Task 1",
          done: false,
          counter: 7,
          dateAdded: now,
          metaData: meta
        });
      persistence.add(t1);
      persistence.flush(function() {
          //persistence.clean();
          Task.all().one(function(t1db) {
              equals(t1db.name, 'Task 1', "Persistence of TEXT properties");
              equals(t1db.done, false, "Persistence of BOOL properties");
              equals(t1db.counter, 7, "Persistence of INT properties");
              equals(Math.round(t1db.dateAdded.getTime()/1000)*1000, Math.round(now.getTime()/1000)*1000, "Persistence of DATE properties");
              same(t1db.metaData, meta, "Persistence of JSON properties");
              start();
            });
        });
    });

  asyncTest("Multiple objects", function() {
      var objs = [];
      var counter = 0;
      for(var i = 0; i < 25; i++) {
        var t = new Task({name: "Task " + i});
        t.counter = counter;
        objs.push(t);
        persistence.add(t);
        counter++;
      }
      persistence.flush(function() {
          Task.all().order('counter', true).list(function(results) {
              for(var i = 0; i < 25; i++) {
                ok(results[i] === objs[i], 'Cache works OK');
              }
              //persistence.clean(); // Clean out local cache
              Task.all().order('counter', true).list(function(results) {
                  for(var i = 0; i < 25; i++) {
                    ok(results[i].id === objs[i].id, 'Retrieving from DB ok');
                  }
                  start();
                });
            });
        });
    });

  asyncTest("One-to-many", function() {
      var p = new Project({name: "Some project"});
      persistence.add(p);
      p.tasks.list(function(tasks) {
          equals(tasks.length, 0, "Initially, no tasks");
          var task1 = new Task({name: "Do dishes"});
          var task2 = new Task({name: "Laundry"});

          // Adding in two ways
          p.tasks.add(task1);
          task2.project = p;

          p.tasks.order('name', true).list(function(tasks) {
              equals(tasks.length, 2, "Now two tasks");
              equals(tasks[0].id, task1.id, "Right tasks");
              equals(tasks[1].id, task2.id, "Right tasks");
              start();
            });
        });
    });

  asyncTest("Many-to-many", function() {
      var t = new Task({name: "Some task"});
      persistence.add(t);
      t.tags.list(function(tags) {
          equals(tags.length, 0, "Initially, no tags");
          var tag1 = new Tag({name: "important"});
          var tag2 = new Tag({name: "today"});
          t.tags.add(tag1);
          t.tags.add(tag2);
          t.tags.list(function(tags) {
              equals(tags.length, 2, "2 tags added");
              var oneTag = tags[0];
              oneTag.tasks.list(function(tagTasks) {
                  equals(tagTasks.length, 1, "Tag has one task");
                  equals(tagTasks[0].id, t.id, "Correct task");
                  oneTag.tasks.remove(tagTasks[0]);
                  t.tags.count(function(cnt) {
                      equals(cnt, 1, "Tag removed task, task has only one tag left");
                      start();
                    });
                });
            });
        });
    });

  module("Query collections", {
      setup: function() {
        stop();
        persistence.reset(function() {
            persistence.schemaSync(start);
          });
      }
    });

  function intFilterTests(coll, callback) {
    for(var i = 0; i < 25; i++) {
      var t = new Task({name: "Task " + i, done: false});
      t.counter = i;
      coll.add(t);
    }
    coll.list(function(results) {
        equals(results.length, 25, "Count items in collection");
        coll.filter("counter", ">", 10).list(function(results) {
            equals(results.length, 14, "> filter test");
            coll.filter("counter", "in", [0, 1, 2]).list(function(results) {
                equals(results.length, 3, "'in' filter test");
                coll.filter("counter", "not in", [0, 1]).list(function(results) {
                    equals(results.length, 23, "'not in' filter test");
                    coll.filter("counter", "!=", 0).list(function(results) {
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
      var t = new Task({name: alphabet[i]});
      coll.add(t);
    }
    coll.list(function(results) {
        equals(results.length, 26, "Count items in collection");
        coll.filter("name", "=", 'a').list(function(results) {
            equals(results.length, 1, "= filter test");
            coll.filter("name", "!=", 'a').list(function(results) {
                equals(results.length, 25, "!= filter test");
                coll.filter("name", ">", 'm').list(function(results) {
                    equals(results.length, 12, "> filter test");
                    coll.filter("name", "in", ["a", "b"]).list(function(results) {
                        equals(results.length, 2, "'in' filter test");
                        coll.filter("name", "not in", ["q", "x"]).list(function(results) {
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
      var t = new Task({name: "Task " + i, done: i % 2 === 0});
      coll.add(t);
    }
    coll.list(function(results) {
        equals(results.length, 24, "Count items in collection");
        coll.filter("done", "=", true).list(function(results) {
            equals(results.length, 12, "= filter test");
            coll.filter("done", "=", false).list(function(results) {
                equals(results.length, 12, "= filter test");
                coll.filter("done", "!=", true).list(function(results) {
                    equals(results.length, 12, "'!=' filter test");
                    coll.filter("done", "!=", false).list(function(results) {
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
      var t = new Task({name: "Task " + i, dateAdded: dateInDays(i)});
      coll.add(t);
    }
    coll.list(function(results) {
        equals(results.length, 24, "Count items in collection");
        coll.filter("dateAdded", "=", dateInDays(1)).list(function(results) {
            equals(results.length, 1, "= filter test");
            coll.filter("dateAdded", "!=", dateInDays(1)).list(function(results) {
                equals(results.length, 23, "!= filter test");
                coll.filter("dateAdded", ">", dateInDays(12)).list(function(results) {
                    equals(results.length, 11, "> filter test");
                    start();
                  });
              })
          });
      });
  }

  asyncTest("Database INT filters", function() {
      for(var i = 0; i < 25; i++) {
        var t = new Task({name: "Root task " + i, done: false});
        t.counter = i;
        persistence.add(t);
      }

      var p = new Project({name: "My project"});
      persistence.add(p);
      intFilterTests(p.tasks, start);
    });

  asyncTest("Local INT filters", function() {
      var coll = new persistence.LocalQueryCollection();
      intFilterTests(coll, start);
    });

  asyncTest("Database TEXT filters", function() {
      var alphabet = 'abcdefghijklmnopqrstufwxyz';
      for(var i = 0; i <= 25; i++) {
        var t = new Task({name: alphabet[i]});
        persistence.add(t);
      }

      var p = new Project({name: "My project"});
      persistence.add(p);
      textFilterTests(p.tasks, start);
    });

  asyncTest("Local TEXT filters", function() {
      var coll = new persistence.LocalQueryCollection();
      textFilterTests(coll, start);
    });

  asyncTest("Database BOOL filters", function() {
      for(var i = 0; i < 25; i++) {
        var t = new Task({name: "Root task " + i, done: false});
        t.counter = i;
        persistence.add(t);
      }

      var p = new Project({name: "My project"});
      persistence.add(p);
      boolFilterTests(p.tasks, start);
    });

  asyncTest("Local BOOL filters", function() {
      var coll = new persistence.LocalQueryCollection();
      boolFilterTests(coll, start);
    });

  asyncTest("Database DATE filters", function() {
      var p = new Project({name: "My project"});
      persistence.add(p);
      dateFilterTests(p.tasks, start);
    });

  asyncTest("Local DATE filters", function() {
      var coll = new persistence.LocalQueryCollection();
      dateFilterTests(coll, start);
    });


  function intOrderTests(coll, callback) {
    var tasks = [];
    for(var i = 0; i < 24; i++) {
      var t = new Task({name: "Task " + i, counter: i});
      tasks.push(t);
      coll.add(t);
    }
    coll.order('counter', true).list(function(results) {
        for(var i = 0; i < 24; i++) {
          equals(results[i].id, tasks[i].id, "order check, ascending");
        }
        tasks.reverse();
        coll.order('counter', false).list(function(results) {
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
      var t = new Task({name: "Task " + i, dateAdded: dateInDays(i)});
      tasks.push(t);
      coll.add(t);
    }
    coll.order('dateAdded', true).list(function(results) {
        for(var i = 0; i < 24; i++) {
          equals(results[i].id, tasks[i].id, "order check, ascending");
        }
        tasks.reverse();
        coll.order('dateAdded', false).list(function(results) {
            for(var i = 0; i < 24; i++) {
              equals(results[i].id, tasks[i].id, "order check, descending");
            }
            callback();
          });
      });
  }

  asyncTest("Database INT order", function() {
      var p = new Project({name: "My project"});
      persistence.add(p);
      intOrderTests(p.tasks, start);
    });

  asyncTest("Local INT order", function() {
      var coll = new persistence.LocalQueryCollection();
      intOrderTests(coll, start);
    });

  asyncTest("Database DATE order", function() {
      var p = new Project({name: "My project"});
      persistence.add(p);
      dateOrderTests(p.tasks, start);
    });

  asyncTest("Local DATE order", function() {
      var coll = new persistence.LocalQueryCollection();
      dateOrderTests(coll, start);
    });

  function collectionLimitTests(coll, callback) {
    var tasks = [];
    for(var i = 0; i < 24; i++) {
      var t = new Task({name: "Task " + i, counter: i});
      tasks.push(t);
      coll.add(t);
    }
    coll.order("counter", true).limit(5).list(function(results) {
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
      var t = new Task({name: "Task " + i, counter: i});
      tasks.push(t);
      coll.add(t);
    }
    coll.order("counter", true).skip(5).limit(5).list(function(results) {
        equals(results.length, 5, "Result length check");
        for(var i = 5; i < 10; i++) {
          equals(results[i-5].id, tasks[i].id, "skip check");
        }
        start();
      });
  }

  asyncTest("Database limit", function() {
      collectionLimitTests(Task.all(), start);
    });

  asyncTest("Local limit", function() {
      var coll = new persistence.LocalQueryCollection();
      collectionLimitTests(coll, start);
    });

  asyncTest("Database skip", function() {
      collectionSkipTests(Task.all(), start);
    });

  asyncTest("Local skip", function() {
      var coll = new persistence.LocalQueryCollection();
      collectionSkipTests(coll, start);
    });

  module("Dumping/restoring");

  asyncTest("Full dump/restore", function() {
      persistence.reset(function() {
          persistence.schemaSync(function() {
              for(var i = 0; i < 10; i++) {
                var t = new Task({name: "Task " + i, dateAdded: new Date()});
                t.tags.add(new Tag({name: "Some tag: " + i}));
                t.tags.add(new Tag({name: "Another tag: " + i}));
                persistence.add(t);
              }
              persistence.flush(function() {
                  persistence.dumpToJson(function(dumps) {
                      persistence.reset(function() {
                          persistence.schemaSync(function() {
                              persistence.loadFromJson(dumps, function() {
                                  Task.all().list(function(tasks) {
                                      equals(tasks.length, 10, "tasks restored successfully");
                                      tasks[0].tags.list(function(tags) {
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
      persistence.reset(function() {
          persistence.schemaSync(function() {
              var project = new Project({name: "My project"});
              persistence.add(project);
              var tags = [];
              for(var i = 0; i < 5; i++) {
                var tag = new Tag({name: "Tag " + i});
                persistence.add(tag);
                tags.push(tag);
              }
              for(var i = 0; i < 10; i++) {
                var task = new Task({name: "Task " + i});
                task.done = true;
                task.tags = new persistence.LocalQueryCollection(tags);
                project.tasks.add(task);
              }
              Project.all().selectJSON(['id', 'name', 'tasks.[id,name]', 'tasks.tags.[id, name]'], function(result) {
                  persistence.reset(function() {
                      persistence.schemaSync(function() {
                          Project.fromSelectJSON(result[0], function(obj) {
                              persistence.add(obj);
                              Task.all().list(function(tasks) {
                                  equals(tasks.length, 10, "number of restored tasks ok");
                                  tasks.forEach(function(task) {
                                      equals(task.done, false, "done still default value");
                                    });
                                  start();
                                  console.log(new Date().getTime() - startTime);
                                });
                            });
                        });
                    });
                });
            });
        });
    });

  asyncTest("AND and OR filters", function() {
      persistence.reset(function() {
          persistence.schemaSync(function() {
              for(var i = 0; i < 10; i++) {
                var task = new Task({name: "Task " + i});
                task.done = i % 2 === 0;
                persistence.add(task);
              }
              Task.all().filter("done", "=", true).or(new persistence.PropertyFilter("done", "=", false)).list(function(results) {
                  equals(results.length, 10, "right number of results");
                  Task.all().filter("done", "=", true).and(new persistence.PropertyFilter("done", "=", false)).list(function(results) {
                      equals(results.length, 0, "right number of results");
                      start();
                    });
                });
            });
        });
    });

  module("Events");

  asyncTest("all collection", function() {
      persistence.reset(function() {
          persistence.schemaSync(function() {
              var allTasks = Task.all();
              var changesDetected = 0;
              allTasks.addEventListener('change', function() {
                  changesDetected++;
                });
              for(var i = 0; i < 10; i++) {
                var task = new Task({name: "Task " + i});
                task.done = i % 2 === 0;
                Task.all().add(task);
              }
              equals(10, changesDetected, "detected all changes");
              start();
            });
        });
    });

  asyncTest("filter collection", function() {
      persistence.reset(function() {
          persistence.schemaSync(function() {
              var allTasks = Task.all().filter("done", "=", true);
              var changesDetected = 0;
              allTasks.addEventListener('change', function() {
                  changesDetected++;
                });
              for(var i = 0; i < 10; i++) {
                var task = new Task({name: "Task " + i});
                task.done = i % 2 === 0;
                Task.all().add(task);
              }
              equals(5, changesDetected, "detected all changes");
              changesDetected = 0;
              Task.all().filter("done", "=", true).list(function(results) {
                  results.forEach(function(r) {
                      r.done = false;
                    });
                  equals(5, changesDetected, "detected filter changes");
                  start();
                });
            });
        });
    });
    
    
    
    module("Indexes");
    
    
    asyncTest("unique indexes", function() {
        
        persistence.reset(function() {
            
            persistence.schemaSync(function() {
                
                var o1 = new UniqueIndexTest({"id1":101,"id2":102,"id3p1":103,"id3p2":104});
                
                // id1 is not unique
                var o2 = new UniqueIndexTest({"id1":101,"id2":202,"id3p1":203,"id3p2":204});
                
                //shouldn't work, id2 is unique
                var o3 = new UniqueIndexTest({"id1":301,"id2":102,"id3p1":303,"id3p2":304});
                
                // id3p1 itself is not unique
                var o4 = new UniqueIndexTest({"id1":401,"id2":402,"id3p1":103,"id3p2":404});
                
                //shouldn't work, id3p1+id3p2 are unique
                var o5 = new UniqueIndexTest({"id1":501,"id2":502,"id3p1":103,"id3p2":104});
                
                
                persistence.add(o1);
                persistence.add(o2);
                try {
                    //persistence.add(o3);
                } catch (e) {
                    console.log("err",e);
                }
                
                persistence.add(o4);
                try {
                    //persistence.add(o5);
                } catch (e) {
                    console.log("err",e);
                }
                
                
                UniqueIndexTest.all().order("id2",true).list(function(results) {
                    equals(3,results.length,"skipped 2 duplicate rows");
                    if (results.length==3) {
                        equals(102,results[0].id2);
                        equals(202,results[1].id2);
                        equals(402,results[2].id2);
                    }
                    start();
                });
              });
          });
      });
    
});
