persistence.js
==============
`persistence.js` is a simple asynchronous Javascript object-relational
mapper library. It works with the in-browser HTML5 SQLite database as
well as Google Gears' database. It has no dependencies on any other
frameworks, other than the Google Gears 
[initialization script](http://code.google.com/apis/gears/gears_init.js),
in case you want to enable Gears support.

Browser support
---------------

* Modern webkit browsers (Google Chrome and Safari)
* Firefox (through Google Gears)

Internet Explorer is likely not supported (untested) because it
lacks `__defineGetter__` and `__defineSetter__` support that
`persistence.js` uses heavily). This may change in IE 8.

Connecting to the database
-------------------------

Currently there is one global database connection, which is
initialized with a `persistence.connect` call.  Its first argument is
the database name, the second a database description and third the
maximum database size (in bytes):

    persistence.connect('testdb', 'My test db', 5 * 1024 * 1024);

Schema definition
-----------------

A data model is declared using `persistence.define`. The following two
definitions define a `Task` and `Category` entity with a few simple
properties. The property types are [SQLite types](http://www.sqlite.org/datatype3.html).
    
    var Task = persistence.define('Task', {
        name: "TEXT",
        description: "TEXT",
        done: "BOOL"
    });

    var Category = persistence.define('Category', {
        name: "TEXT"
    });

The returned values are constructor functions and can be used to
create new instances of these entities later:

    var task = new Task();
    var category = new Category({name: "My category"});

Relationships between entities are defined using the constructor
function's `hasMany` call:

    Category.hasMany('tasks', Task, 'category');
        
This defines a `tasks` relationship on category objects containing a
`QueryCollection` (see the section on query collections later) of
`Task`s, it also defines an inverse relationship on `Task` objects
with the name `category`.

The defined entity definitions are synchronized (activated) with the
database using a `persistence.schemaSync` call, which takes a callback
function (with the used transaction as an argument), that is called
when the schema synchronization has completed, the callback is
optional.

    persistence.schemaSync();
    // or
    persistence.schemaSync(function(tx) { 
      // tx is the transaction object of the transaction that was
      // automatically started
    });

Persisting objects
------------------

Similar to [hibernate](http://www.hibernate.org), `persistence.js`
uses a tracking mechanism to determine which objects' changes have to
be persisted to the datase. All objects retrieved from the database
are automatically tracked for changes. New entities can be tracked to
be persisted by using the `persistence.add` function:
        
        var c = new Category({name: "Main category"});
        persistence.add(c);
        for ( var i = 0; i < 5; i++) {
            var t = new Task();
            t.name = 'Task ' + i;
            t.done = i % 2 == 0;
            t.category = c;
            persistence.add(t);
        }

All changes made to tracked objects can be flushed to the database by
using `persistence.flush`, which takes a transaction object and callback function as
arguments. A new transaction can be started using
`persistence.transaction`:
    
    persistence.transaction(function(tx) {
        persistence.flush(tx, function() {
          alert('Done flushing!');
        });
    });

For convenience, it is also possible to not specify a transaction or callback, in that
case a new transaction will be started automatically. For instance:

    persistence.flush();
    // or, with callback
    persistence.flush(null, function() {
      alert('Done flushing');
    });

Note that when no callback is defined, the flushing still happens asynchronously.

Query collections
-----------------

A core concept of `persistence.js` is `QueryCollection`. A
`QueryCollection` represents a (sometimes) virtual collection that can
be filtered, ordered or paginated. `QueryCollection`s are somewhate inspired
by [Google AppEngine's Query class](http://code.google.com/appengine/docs/python/datastore/queryclass.html).
A `QueryCollection` has the following methods:

* `filter(property, operator, value)` returns a new `QueryCollection`
  that adds a filter, filtering a certain property based on an operator and value. Supported operators
  are '=', '!=', '<', '<=', '>' and '>='. Example: `.filter('done', '=', true)`
* `order(property, ascending)` returns a new `QueryCollection` that will order its results by the property
  specified in either an ascending (ascending === true) or descending (ascending === false) order.
* `list(tx, callback)` fetches the actual result set.


    var allTasks = Task.all().filter("done", '=', true).prefetch("category").order("name", false);
        
    persistence.transaction(function(tx) {
        allTasks.list(tx, function (results) {
            results.forEach(function (r) {
                console.log(r.name)
                window.task = r;
            });
        });
    });
