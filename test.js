asyncorm.connect('testdb', 'My test db', 5 * 1024 * 1024);

var Task = asyncorm.define('Task', {
    name: "TEXT",
    description: "TEXT",
    done: "BOOL"
});

asyncorm.transaction(function (tx) {
    for ( var i = 0; i < 5; i++) {
        var task = new Task();
        task.name = 'Task ' + i;
        task.done = i % 2 == 0;
        console.log(task._dirtyProperties)
        asyncorm.add(task);
    }

    asyncorm.flush(tx, function () {
        var allTasks = Task.all().filter("done", '=', true).order(
                "name", false);
        allTasks.list(tx, function (results) {
            results.forEach(function (r) {
                console.log(r.name)
                r.done = !r.done;
            });
            asyncorm.reset(tx);
        });
    });
});