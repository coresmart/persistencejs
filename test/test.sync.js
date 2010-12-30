$(document).ready(function(){
  persistence.store.websql.config(persistence, 'persistencetest', 'My db', 5 * 1024 * 1024);
  //persistence.store.memory.config(persistence);
  persistence.debug = true;

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

  Task.enableSync('/taskUpdates');
  Project.enableSync('/projectUpdates');
  Tag.enableSync('/tagUpdates');

  module("Setup");

  asyncTest("setting up local database", function() {
      persistence.reset(function() {
          persistence.schemaSync(function(){
              ok(true, 'came back from schemaSync');
              start();
            });
        });
    });

  asyncTest("setting up remote database", 1, function() {
      persistence.sync.getJSON('/reset', function(data) {
          same(data, {status: 'ok'}, "Remote reset");
          start();
        });
    });

  module("Sync");

  function noConflictsHandler(conflicts, updatesToPush, callback) {
    ok(false, "Should not go to conflict resolving");
    console.log("Conflicts: ", conflicts);
    callback();
  }

  asyncTest("initial sync of project", function() {
      Project.syncAll(noConflictsHandler, function() {
          ok(true, "Came back from sync");
          Project.syncAll(noConflictsHandler, function() {
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
      Task.syncAll(noConflictsHandler, function() {
          ok(true, "Came back from sync");
          Task.syncAll(noConflictsHandler, function() {
              ok(true, "Came back from second sync");
              Task.all().list(function(tasks) {
                  equals(tasks.length, 25, "25 tasks synced");
                  tasks.forEach(function(task) {
                      equals(false, task.done, "task not done");
                    });
                  start();
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
          Task.syncAll(noConflictsHandler, function() {
              ok(true, "Came back from sync");
              start();
            });
        });
    });

  function resetResync(callback) {
    persistence.reset(function() {
        persistence.schemaSync(function() {
            ok(true, "Database reset");

            Project.syncAll(noConflictsHandler, function() {
                ok(true, "Came back from project sync");
                Task.syncAll(noConflictsHandler, function() {
                    ok(true, "Came back from task sync");
                    callback();
                  });
              });
          });
      });
  }

  asyncTest("resetting local db and resyncing", function() {
      resetResync(function() {
          Task.all().filter("done", "=", true).count(function(n) {
              equals(n, 13, "right number of tasks done");
              start();
            });
        });
    });

  asyncTest("creating some new objects", function() {
      var p = new Project({name: "Locally created project"});
      persistence.add(p);
      for(var i = 0; i < 10; i++) {
        var t = new Task({name: "Local task " + i});
        p.tasks.add(t);
      }
      persistence.flush(function() {
          ok(true, "project and tasks added locally");
          Project.syncAll(noConflictsHandler, function() {
              ok(true, "returned from project sync");
              Task.syncAll(noConflictsHandler, function() {
                  ok(true, "returned from task sync");
                  p.tasks.list(function(tasks) {
                      equals(tasks.length, 10, 'check collection size');
                      tasks.forEach(function(task) {
                          task.done = true;
                        });
                      Task.syncAll(noConflictsHandler, function() {
                          start();
                        });
                    });
                });
            });
        });
    });

  asyncTest("resetting local db and resyncing", function() {
      resetResync(function() {
          Task.all().filter("done", "=", true).count(function(n) {
              equals(n, 23, "right number of tasks done.");
              start();
            });
        });
    });

  asyncTest("marking all tasks done remotely", function() {
      persistence.sync.getJSON('/markAllDone', function(data) {
          same(data, {status: 'ok'}, "Remote reset");
          Task.syncAll(noConflictsHandler, function() {
              ok(true, "Came back from sync");
              Task.all().filter("done", "=", true).count(function(n) {
                  equals(35, n, "all tasks were marked done and synced correctly");
                  start();
                });
            });
        });
    });

  module("Conflicts");

  asyncTest("prefer local conflict handler", 8, function() {
      persistence.sync.getJSON('/markAllUndone', function(data) {
          same(data, {status: 'ok'}, "Remote marking undone");
          Task.all().list(function(tasks) {
              for(var i = 0; i < tasks.length; i++) {
                if(i % 2 === 0) {
                  // Force a dirty flag
                  tasks[i].done = true;
                  tasks[i].done = false;
                  tasks[i].done = true;
                }
              }
              persistence.flush(function() {
                  Task.syncAll(function(conflicts, updatesToPush, callback) {
                      ok(true, "Conflict resolver called");
                      equals(conflicts.length, 18, "Number of conflicts");
                      console.log("Conflicts: ", conflicts);
                      persistence.sync.preferLocalConflictHandler(conflicts, updatesToPush, callback);
                    }, function() {
                      ok(true, "Came back from sync");
                      resetResync(function() {
                          Task.all().filter("done", "=", true).list(function(tasks) {
                              equals(tasks.length, 18, "Conflicts were properly resolved towards the server");
                              start();
                            });
                        });
                    });
                });
            });
        });
    });

  asyncTest("prefer remote conflict handler", 5, function() {
      persistence.sync.getJSON('/markAllUndone', function(data) {
          same(data, {status: 'ok'}, "Remote marking undone");
          Task.all().list(function(tasks) {
              for(var i = 0; i < tasks.length; i++) {
                if(i % 2 === 0) {
                  // Force a dirty flag
                  tasks[i].done = true;
                  tasks[i].done = false;
                  tasks[i].done = true;
                }
              }
              persistence.flush(function() {
                  Task.syncAll(function(conflicts, updatesToPush, callback) {
                      ok(true, "Conflict resolver called");
                      equals(conflicts.length, 18, "Number of conflicts");
                      console.log("Conflicts: ", conflicts);
                      persistence.sync.preferRemoteConflictHandler(conflicts, updatesToPush, callback);
                    }, function() {
                      ok(true, "Came back from sync");
                      Task.all().filter("done", "=", true).list(function(tasks) {
                          equals(tasks.length, 0, "Conflicts were properly resolved");
                          start();
                        });
                    });
                });
            });
        });
    });

  asyncTest("Object removal", function() {
      Task.all().list(function(tasks) {
          for(var i = 0; i < tasks.length; i++) {
            if(i % 2 === 0) {
              persistence.remove(tasks[i]);
            }
          }

          persistence.flush(function() {
              console.log("Now going to sync");
              Task.syncAll(noConflictsHandler, function() {
                  //Task.syncAll(noConflictsHandler, function() {
                      start();
                    //});
                });
            });
        });
    });
});
