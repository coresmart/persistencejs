persistence.connect('testdbnm', 'My test db', 5 * 1024 * 1024);

var Task = persistence.define('Task', {
    name: "TEXT",
    description: "TEXT",
    done: "BOOL",
    completed: 'DATE'
});
var Category = persistence.define('Category', {
    name: "TEXT"
});
Category.hasMany('tasks', Task, 'category');

persistence.schemaSync(function (tx) {
    var c = new Category( {
        name: "Main category"
    });
    persistence.add(c);
    for ( var i = 0; i < 5; i++) {
        var t = new Task();
        t.name = 'Task ' + i;
        t.completed = new Date();
        t.done = i % 2 == 0;
        c.tasks.add(t);
        //c.tasks.remove(t);
        /*t.category = c;
        persistence.add(t);*/
    }

    persistence.flush(tx, function () {
        var allTasks = c.tasks.prefetch('category');

        allTasks.list(tx, function (results) {
            console.log('query executed OK')
            results.forEach(function (r) {
                console.log('[' + r.category.name + '] ' + r.name);
                console.log(t.completed);
              });
            //persistence.reset(tx);
          });
      });
});
