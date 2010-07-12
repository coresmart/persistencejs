var persistence = require('../persistence').persistence;
var persistenceBackend = require('../persistence.backend.mysql');
var sys = require('sys');

persistenceBackend.configure('nodejs_mysql', 'test', 'test');

var session = persistenceBackend.getSession();

// Switch off query logging:
//persistence.db.log = false;

function log(s) {
  sys.print(s + "\n");
}

log("Connected.");

var Task = persistence.define('Task', {
    name: "TEXT",
    description: "TEXT",
    done: "BOOL"
});
var Tag = persistence.define('Tag', {
    name: "TEXT"
});
var Category = persistence.define('Category', {
    name: "TEXT"
});
// N:M
Task.hasMany('tags', Tag, 'tasks');
Tag.hasMany('tasks', Task, 'tags');
// 1:N
Category.hasMany('tasks', Task, 'category');

session.schemaSync(function () {
    var c = new Category( {
        name: "Main"
    }, session);
    session.add(c);
    var tag = new Tag( {
        name: "urgent"
    }, session);
    session.add(tag);
    for ( var i = 0; i < 5; i++) {
        var t = new Task({}, session);
        t.name = 'Task ' + i;
        t.done = i % 2 == 0;
        t.category = c;
        t.tags.add(tag);
        session.add(t);
    }

    session.flush(null, function () {
        var allTasks = c.tasks.prefetch('category').filter("done", "=", true);

        allTasks.list(null, function (results) {
            results.forEach(function (r) {
                log('[' + r.category.name + '] ' + r.name);
            });
            //persistence.reset();
        });
    });
});

