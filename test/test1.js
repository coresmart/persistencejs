persistence.connect('testdb', 'My test db', 5 * 1024 * 1024);

var Task = persistence.define('Task', {
    name: "TEXT",
    description: "TEXT",
    done: "BOOL"
});
var Category = persistence.define('Category', {
    name: "TEXT"
});
Task.hasMany('subTasks', Task, 'parentTask');
Category.hasMany('tasks', Task, 'categories');
Task.hasMany('categories', Category, 'tasks');

persistence.schemaSync(function (tx) {
    var c = new Category( {
        name: "Main category"
    });
    persistence.add(c);
    var superTask = new Task({name: "Super task"});
    for ( var i = 0; i < 5; i++) {
        var t = new Task();
        t.name = 'Task ' + i;
        t.done = i % 2 == 0;
        t.parentTask = superTask;
        //c.tasks.add(t);
        //c.tasks.remove(t);
        /*t.category = c;
        persistence.add(t);*/
    }

    persistence.flush(tx, function () {
        //persistence.reset(tx);
        var allTasks = c.tasks;

        allTasks.list(tx, function (results) {
            console.log('query executed OK')
            results.forEach(function (r) {
                console.log('[' + r.parentTask.name + '] ' + r.name)
                window.task = r;
            });
        });
    });
});