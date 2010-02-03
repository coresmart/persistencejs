persistence.js
==============
`persistence.js` is a simple asynchronous Javascript object-relational mapper library. It works with the
HTML5 SQLite local database as well as Google Gears' database.

Schema definition
-----------------

Currently there is one global database connection, which is initialized with a `persistence.connect` call.
Its first argument is the database name, the second a database description and third the maximum database
size (in bytes):

    persistence.connect('testdb', 'My test db', 5 * 1024 * 1024);
        
A data model is declared using `persistence.define`. The following two definitions define a `Task` and
`Category` entity with a few simple properties. The property types are [SQLite types](http://www.sqlite.org/datatype3.html).
    
    var task = persistence.define('Task', {
        name: "TEXT",
        description: "TEXT",
        done: "BOOL"
    });

    var category = persistence.define('Category', {
        name: "TEXT"
    });

The returned values are constructor functions and can be used to create new instances of these entities
later:

    var myTask = task();
    var myCategory = category({name: "My category"});

Relationships between entities are defined using the constructor function's `hasMany` call:

    category.hasMany('tasks', task, 'category');
        
This defines a tasks property on category objects containing a `queryCollection` of `task`s,
it also defines an inverse relationship on `task` objects with the name `category`.

The defined entity definitions are synchronized (activated) with the database using a
`persistence.schemaSync` call, which takes a callback function (with the used transaction as an argument),
that is called when the schema synchronization has completed, the callback is optional.

    persistence.schemaSync();

Persisting objects
------------------

All objects retrieved from the databaase are automatically tracked for changes. New entities can be tracked
to be persisted by using the `persistence.add` function:
        
        var c = category({name: "Main category"});
        persistence.add(c);
        for ( var i = 0; i < 5; i++) {
            var t = task();
            t.name = 'Task ' + i;
            t.done = i % 2 == 0;
            t.category = c;
            persistence.add(t);
        }

All changes made to tracked objects can be flushed to the databse by using `persistence.flush`,
which takes a transaction object as argument. A new transaction can be started using
`persistence.transaction`:
    
    persistence.transaction(function(tx) {
        persistence.flush(tx);
    });
            
Querying
--------

    var allTasks = task.all().filter("done", '=', true).prefetch("category").order("name", false);
        
    persistence.transaction(function(tx) {
        allTasks.list(tx, function (results) {
            results.forEach(function (r) {
                console.log(r.name)
                window.task = r;
            });
        });
    });
