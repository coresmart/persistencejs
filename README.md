persistence.js
==============
`persistence.js` is a simple asynchronous Javascript object-relational
mapper library. It works with the in-browser HTML5 SQLite database as
well as Google Gears' local data store. It may be used to develop
offline-capable web applications.

It has no dependencies on any other frameworks, other than the Google
Gears [initialization script](http://code.google.com/apis/gears/gears_init.js), 
in case you want to enable Gears support.

Browser support
---------------

* Modern webkit browsers (Google Chrome and Safari)
* Firefox (through Google Gears)
* Android browser (tested on 1.6 and 2.1)
* iPhone browser (iPhone OS 3+)

Internet Explorer is likely not supported (untested) because it
lacks `__defineGetter__` and `__defineSetter__` support, which
`persistence.js` uses heavily. This may change in IE 8.

Connecting to a database
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

    var Tag = persistence.define('Task', {
      name: "TEXT"
    });

The returned values are constructor functions and can be used to
create new instances of these entities later:


Relationships between entities are defined using the constructor
function's `hasMany` call:

    // This defines a one-to-many relationship:
    Category.hasMany('tasks', Task, 'category');
    // These two definitions define a many-to-many relationship
    Task.hasMany('tags', Tag, 'tasks');
    Tag.hasMany('tasks', Task, 'tags');
        
The first statement defines a `tasks` relationship on category objects containing a
`QueryCollection` (see the section on query collections later) of
`Task`s, it also defines an inverse relationship on `Task` objects
with the name `category`. The last two statements define a many-to-many
relationships between `Task` and `Tag`. `Task` gets a `tags` property
(a `QueryCollection`) containing all its tags and vice versa, `Tag`
gets a `tasks` property containing all of its tasks. 

The defined entity definitions are synchronized (activated) with the
database using a `persistence.schemaSync` call, which takes a callback
function (with a newly created transaction as an argument), that is called
when the schema synchronization has completed, the callback is
optional.

    persistence.schemaSync();
    // or
    persistence.schemaSync(function(tx) { 
      // tx is the transaction object of the transaction that was
      // automatically started
    });

Creating and manipulating objects
---------------------------------

New objects can be instantiated with the constructor functions.
Optionally, an object with initial property values can be passed as
well, or the properties may be set later:

    var task = new Task();
    var category = new Category({name: "My category"});
    var tag = new Tag();
    tag.name = "work";

Many-to-one relationships are accessed using their specified name, e.g.:
    task.category = category;

One-to-many and many-to-many relationships are access and manipulated
through the `QueryCollection` API that will be discussed later:

    task.tags.add(tag);
    tasks.tags.remove(tag)l
    tasks.tags.list(tx, function(allTags) { console.log(allTags); });

Persisting objects
------------------

Similar to [hibernate](http://www.hibernate.org), `persistence.js`
uses a tracking mechanism to determine which objects' changes have to
be persisted to the datase. All objects retrieved from the database
are automatically tracked for changes. New entities can be tracked to
be persisted using the `persistence.add` function:
        
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
using `persistence.flush`, which takes a transaction object and
callback function as arguments. A new transaction can be started using
`persistence.transaction`, but for convenience `persistence.flush` can
also start a transaction itself, if a `null` value is supplied for the
transaction:
    
    persistence.transaction(function(tx) {
      persistence.flush(tx, function() {
        alert('Done flushing!');
      });
    });
    // or:
    persistence.flush(null, function() {
      alert('Done flushing!');
    });

For convenience, it is also possible to not specify a transaction or callback, in that
case a new transaction will be started automatically. For instance:

    persistence.flush();
    // or, with callback
    persistence.flush(null, function() {
      alert('Done flushing');
    });

Note that when no callback is defined, the flushing still happens asynchronously.

__Important__: Changes and new objects will not be persisted until you
explicitly call `persistence.flush()`. The exception to this rule is
when using the `list(...)` method on a `QueryCollection`, which also
flushes first.

Query collections
-----------------

A core concept of `persistence.js` is the `QueryCollection`. A
`QueryCollection` represents a (sometimes) virtual collection that can
be filtered, ordered or paginated. `QueryCollection`s are somewhate inspired
by [Google AppEngine's Query class](http://code.google.com/appengine/docs/python/datastore/queryclass.html).
A `QueryCollection` has the following methods:

* `filter(property, operator, value)`  
  Returns a new `QueryCollection` that adds a filter, filtering a
  certain property based on an operator and value. Supported operators
  are '=', '!=', '<', '<=', '>' and '>='. Example: `.filter('done',
  '=', true)`
* `order(property, ascending)`  
  Returns a new `QueryCollection` that will order its results by the
  property specified in either an ascending (ascending === true) or
  descending (ascending === false) order.
* `limit(n)`  
  Returns a new `QueryCollection` that limits the size of the result
  set to `n` items. Useful for pagination.
* `skip(n)`  
  Returns a new `QueryCollection` that skips the first `n` results.
  Useful for pagination.
* `prefetch(rel)`  
  Returns a new `QueryCollection` that prefetches entities linked
  through relationship `rel`, note that this only works for one-to-one
  and many-to-one relationships.
* `list(tx, callback)`  
  Asynchronously fetches the results matching the formulated query.
  Once retrieved, the callback function is invoked with an array of
  entity objects as argument.
* `add(obj)`  
  Adds object `obj` to the collection.
* `remove(obj)`  
  Removes object `obj` from the collection.

Query collections are returned by:

* `EntityName.all()`, e.g. `Task.all()`
* one-to-many and many-to-many relationships, e.g. `task.tags`

Example:

    var allTasks = Task.all().filter("done", '=', true).prefetch("category").order("name", false).limit(10);
        
    allTasks.list(null, function (results) {
        results.forEach(function (r) {
            console.log(r.name)
            window.task = r;
        });
    });

Limitations
-----------

`persistence.js` is still in its early development stages and not
extensively tested so there may be many bugs. If you find a bug,
please report it to [me by mail](mailto:zef@zef.me), or fork the
project, fix the problem and send me a pull request.

Known issues:

* Google Gears has a synchronous database API, it is possible to
  create an asynchronous wrapper around it, but this is currently not
  part of `persistence.js`, therefore calls are currently performed
  synchronously, which may not have the best performance
  characteristics. This can possibly be fixed by using e.g.
  [WSPL](http://code.google.com/p/webstorageportabilitylayer/).

Plans:

* Implement non-persisted `QueryCollection`s, e.g. as a wrapper around
  regular Javascript arrays to provide similar functionality to other
  collections.
* Synchronization with (views on) remote databases.

License
-------

This work is licensed under the [MIT license](http://en.wikipedia.org/wiki/MIT_License).
