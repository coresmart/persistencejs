$(document).ready(function(){
  persistence.connect('persistencetest', 'My db', 5 * 1024 * 1024);
  persistence.db.log = true;

  var Project = persistence.define('Project', {
      name: "TEXT"
    });

  var Task = persistence.define('Task', {
      name: "TEXT",
      done: "BOOL"
    });

  var Tag = persistence.define('Tag', {
      name: "TEXT"
    });

  Task.hasMany('tags', Tag, 'tasks');
  Tag.hasMany('tasks', Task, 'tags');

  Project.hasMany('tasks', Task, 'project');

  Task.enableSync();
  Project.enableSync();
  Tag.enableSync();

  module("Setup");

  asyncTest("setting up local database", function() {
      persistence.reset(function() {
          persistence.schemaSync(function(tx){
              ok(tx.executeSql, 'schemaSync passed transaction as argument to callback');
              start();
            });
        });
    });

  asyncTest("setting up remote database", 1, function() {
      persistence.sync.get('/reset', function(resp) {
          var data = JSON.parse(resp);
          same(data, {status: 'ok'}, "Remote reset");
          start();
        });
    });

  module("Sync");

  asyncTest("initial sync of project", function() {
      persistence.sync.synchronize('/projectUpdates', Project, function(conflicts, updatesToPush, callback) {
          ok(false, "Should not go to conflict resolving");
          callback();
        }, function() {
          ok(true, "Came back from sync");
          persistence.sync.synchronize('/projectUpdates', Project, function(conflicts, updatesToPush, callback) {
              ok(false, "Should not go to conflict resolving");
              callback();
            }, function() {
              ok(true, "Came back from second sync");
              Project.all().list(function(projects) {
                  equals(projects.length, 1, "1 project synced");
                  var p = projects[0];
                  equals(p.name, "Main project", "project name");
                  start();
                });
            });
        });
    });

  asyncTest("initial sync of tasks", function() {
      persistence.sync.synchronize('/taskUpdates', Task, function(conflicts, updatesToPush, callback) {
          ok(false, "Should not go to conflict resolving");
          callback();
        }, function() {
          ok(true, "Came back from sync");
          persistence.sync.synchronize('/taskUpdates', Task, function(conflicts, updatesToPush, callback) {
              ok(false, "Should not go to conflict resolving");
              callback();
            }, function() {
              ok(true, "Came back from second sync");
              Task.all().list(function(tasks) {
                  equals(tasks.length, 25, "25 tasks synced");
                  tasks.forEach(function(task) {
                      equals(false, task.done, "task not done");
                    });
                  setTimeout(start, 1200); // Delay a bit
                });
            });
        });
    });

  asyncTest("setting some tasks to done and syncing again", function() {
      Task.all().list(function(tasks) {
          for(var i = 0; i < tasks.length; i++) {
            if(i % 2 === 0) {
              tasks[i].done = true;
            }
          }
          persistence.sync.synchronize('/taskUpdates', Task, function(conflicts, updatesToPush, callback) {
              ok(false, "Should not go to conflict resolving");
              callback();
            }, function() {
              ok(true, "Came back from sync");
              start();
            });
        });
    });

  asyncTest("resetting local db and resyncing", function() {
      persistence.reset(function() {
          persistence.schemaSync(function() {
              ok(true, "Database reset");

              persistence.sync.synchronize('/projectUpdates', Project, function(conflicts, updatesToPush, callback) {
                  ok(false, "Should not go to conflict resolving");
                  callback();
                }, function() {
                  ok(true, "Came back from projectsync");
                  persistence.sync.synchronize('/taskUpdates', Task, function(conflicts, updatesToPush, callback) {
                      ok(false, "Should not go to conflict resolving");
                      callback();
                    }, function() {
                      ok(true, "Came back from task sync");
                      Task.all().filter("done", "=", true).count(function(n) {
                          equals(13, n, "right number of tasks done.");
                          start();
                        });
                    });
                });
            });
        });
    });

  asyncTest("creating some new objects", function() {
      var p = new Project({name: "Locally created project"});
      persistence.add(p);
      for(var i = 0; i < 10; i++) {
        var t = new Task({"Local task " + i});
        p.tasks.add(t);
      }
      start();
    });
});
