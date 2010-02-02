asyncorm.connect('testdb', 'My test db', 5 * 1024 * 1024);

var task = asyncorm.define('Task', {
    name: "TEXT",
    description: "TEXT",
    done: "BOOL"
});
var category = asyncorm.define('Category', {
    name: "TEXT"
});
category.hasMany('tasks', task, 'category');

asyncorm.schemaSync(function (tx) {
    var c = category({name: "Main category"});
    asyncorm.add(c);
    for ( var i = 0; i < 5; i++) {
        var t = task();
        t.name = 'Task ' + i;
        t.done = i % 2 == 0;
        t.category = c;
        asyncorm.add(t);
    }

    asyncorm.flush(tx, function () {
        var allTasks = task.all().filter("done", '=', true).prefetch("category")
                .order("name", false);

        allTasks.list(tx, function (results) {
            results.forEach(function (r) {
                console.log(r.name)
                window.task = r;
            });
            //asyncorm.reset(tx);
        });
    });
});