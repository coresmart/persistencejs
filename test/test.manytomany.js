console.profile();
persistence.connect('manytomany', 'My test db', 5 * 1024 * 1024);

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

persistence.schemaSync(function (tx) {
    var c = new Category( {
        name: "Main"
    });
    persistence.add(c);
    var tag = new Tag( {
        name: "urgent"
    });
    persistence.add(tag);
    for ( var i = 0; i < 5; i++) {
        var t = new Task();
        t.name = 'Task ' + i;
        t.done = i % 2 == 0;
        t.category = c;
        t.tags.add(tag);
        persistence.add(t);
    }

    persistence.flush(tx, function () {
        var allTasks = c.tasks.prefetch('category').filter("done", "=", true);
        console.log('here');

        allTasks.list(tx, function (results) {
            results.forEach(function (r) {
                console.log('[' + r.category.name + '] ' + r.name)
                window.task = r;
            });
            persistence.reset(tx);
            console.profileEnd();
        });
    });
});
