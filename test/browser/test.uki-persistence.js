$(document).ready(function(){
  persistence.store.websql.config(persistence, 'persistencetest', 'My db', 5 * 1024 * 1024);
  //persistence.store.memory.config(persistence);
  persistence.debug = true;

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

  Project.hasMany('tasks', Task, 'project');

  window.Project = Project;
  window.Task = Task
  window.Project = Project;

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
    QUnit.strictEqual(t1.name(), "", "TEXT properties default to ''");
    QUnit.strictEqual(t1.done(), false, "BOOL properties default to false");
    QUnit.strictEqual(t1.counter(), 0, "INT properties default to 0");
    QUnit.strictEqual(t1.dateAdded(), null, "DATE properties default to null");
    QUnit.strictEqual(t1.metaData(), null, "JSON properties default to null");
  });

  test("Property value assignment", 5, function() {
    var t1 = new Task();
    var now = new Date();
    var meta = {starRating: 5};
    t1.name("Task 1");
    t1.done(false);
    t1.counter(7);
    t1.dateAdded(now);
    t1.metaData(meta);
    QUnit.strictEqual(t1.name(), 'Task 1', "Assignment for TEXT properties");
    QUnit.strictEqual(t1.done(), false, "Assignment for BOOL properties");
    QUnit.strictEqual(t1.counter(), 7, "Assignment for INT properties");
    QUnit.strictEqual(t1.dateAdded(), now, "Assignment for DATE properties");
    QUnit.strictEqual(t1.metaData(), meta, "Assignment for JSON properties");
  }); 

  test("Property contructor property value assignment", 5, function() {
    var now = new Date();
    var meta = {starRating: 5};
    var t1 = new Task({
        name: "Task 1",
        done: false,
        counter: 7,
        dateAdded: now,
        metaData: meta
      });
    QUnit.strictEqual(t1.name(), 'Task 1', "Assignment for TEXT properties");
    QUnit.strictEqual(t1.done(), false, "Assignment for BOOL properties");
    QUnit.strictEqual(t1.counter(), 7, "Assignment for INT properties");
    QUnit.strictEqual(t1.dateAdded(), now, "Assignment for DATE properties");
    QUnit.strictEqual(t1.metaData(), meta, "Assignment for JSON properties");
  });

  asyncTest("Empty object persistence", function() {
    var t1 = new Task();
    persistence.add(t1);
    persistence.flush(function() {
      Task.all().one(function(t1db) {
        equals(t1db.id, t1.id, "TEXT properties default to ''");
        equals(t1db.name(), "", "TEXT properties default to ''");
        equals(t1db.done(), false, "BOOL properties default to false");
        equals(t1db.counter(), 0, "INT properties default to 0");
        equals(t1db.dateAdded(), null, "DATE properties default to null");
        equals(t1db.metaData(), null, "JSON properties default to null");
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
        equals(t1db.name(), 'Task 1', "Persistence of TEXT properties");
        equals(t1db.done(), false, "Persistence of BOOL properties");
        equals(t1db.counter(), 7, "Persistence of INT properties");
        equals(Math.round(t1db.dateAdded().getTime()/1000)*1000, Math.round(now.getTime()/1000)*1000, "Persistence of DATE properties");
        same(t1db.metaData(), meta, "Persistence of JSON properties");
        start();
      });
    });
  });    
      
  asyncTest("Multiple objects", function() {
    var objs = [];
    var counter = 0;
    for(var i = 0; i < 25; i++) {
      var t = new Task({name: "Task " + i});
      t.counter(counter);
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
    p.tasks().list(function(tasks) {
      equals(tasks.length, 0, "Initially, no tasks");
      var task1 = new Task({name: "Do dishes"});
      var task2 = new Task({name: "Laundry"});
    
      // Adding in two ways
      p.tasks().add(task1);
      task2.project(p);
    
      p.tasks().order('name', true).list(function(tasks) {
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
    t.tags().list(function(tags) {
      equals(tags.length, 0, "Initially, no tags");
      var tag1 = new Tag({name: "important"});
      var tag2 = new Tag({name: "today"});
      t.tags().add(tag1);
      t.tags().add(tag2);
      t.tags().list(function(tags) {
        equals(tags.length, 2, "2 tags added");
        var oneTag = tags[0];
        oneTag.tasks().list(function(tagTasks) {
          equals(tagTasks.length, 1, "Tag has one task");
          equals(tagTasks[0].id, t.id, "Correct task");
          oneTag.tasks().remove(tagTasks[0]);
          t.tags().list(function(newTags) {
            equals(newTags.length, 1, "Tag removed task, task has only one tag left");
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
      t.counter(i);
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
                equals(results.length, 23, "= filter test");
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
         t.counter(i);
         persistence.add(t);
       }
  
       var p = new Project({name: "My project"});
       persistence.add(p);
       intFilterTests(p.tasks(), start);
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
      textFilterTests(p.tasks(), start);
    });
  
  asyncTest("Local TEXT filters", function() {
      var coll = new persistence.LocalQueryCollection();
      textFilterTests(coll, start);
    });
  
  asyncTest("Database BOOL filters", function() {
      for(var i = 0; i < 25; i++) {
        var t = new Task({name: "Root task " + i, done: false});
        t.counter(i);
        persistence.add(t);
      }
  
      var p = new Project({name: "My project"});
      persistence.add(p);
      boolFilterTests(p.tasks(), start);
    });
  
  asyncTest("Local BOOL filters", function() {
      var coll = new persistence.LocalQueryCollection();
      boolFilterTests(coll, start);
    });
  
  asyncTest("Database DATE filters", function() {
      var p = new Project({name: "My project"});
      persistence.add(p);
      dateFilterTests(p.tasks(), start);
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
       intOrderTests(p.tasks(), start);
     });
   
   asyncTest("Local INT order", function() {
       var coll = new persistence.LocalQueryCollection();
       intOrderTests(coll, start);
     });         
  
  asyncTest("Database DATE order", function() {
      var p = new Project({name: "My project"});
      persistence.add(p);
      dateOrderTests(p.tasks(), start);
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
});
