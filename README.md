persistence.js
==============
`persistence.js` is a simple asynchronous Javascript object-relational
mapper library. It works with the in-browser HTML5 SQLite database as
well as Google Gears' local data store. It may be used to develop
offline-capable web applications.

It has no dependencies on any other frameworks, other than the Google
Gears [initialization script](http://code.google.com/apis/gears/gears_init.js), 
in case you want to enable Gears support.

About asynchronous programming
------------------------------

In browsers, Javascript and the web page's rendering engine share
a single thread. The result of this is that only one thing can happen
at a time. If a database query would be performed _synchronously_,
like in many other programming environments like Java and PHP the
browser would freeze from the moment the query was issued until the
results came back. Therefore, many APIs in Javascript are defined as
_asynchronous_ APIs, which mean that they do not block when an
"expensive" computation is performed, but instead provide the call
with a function that will be invoked once the result is known. In the
meantime, the browser can perform other duties.

For instance, a synchronous database call call would look as follows:

    var results = db.query("SELECT * FROM Table");
    for(...) { ... }

The execution of the first statement could take half a second, during
which the browser doesn't do anything else. By contrast, the
asynchronous version looks as follows:

    db.query("SELECT * FROM Table", function(results) {
      for(...) { ... }
    });

Note that there will be a delay between the `db.query` call and the
result being available and that while the database is processing the
query, the execution of the Javascript continues. To make this clear,
consider the following program:
    
    db.query("SELECT * FROM Table", function(results) {
      console.log("hello");
    });
    console.log("world");

Although one could assume this would print "hello", followed by
"world", the result will likely be that "world" is printed before
"hello", because "hello" is only printed when the results from the
query are available. This is a tricky thing about asynchronous
programming that a Javascript developer will have to get used to.

Browser support
---------------

* Modern webkit browsers (Google Chrome and Safari)
* Firefox (through Google Gears)
* Android browser (tested on 1.6 and 2.1)
* iPhone browser (iPhone OS 3+)
* Palm WebOS (tested on 1.4.0)

There is also an experimental support for [Qt 4.7 Declarative UI framework (QML)](http://doc.trolltech.org/4.7-snapshot/declarativeui.html) which is an extension to JavaScript.

Internet Explorer is likely not supported (untested) because it
lacks `__defineGetter__` and `__defineSetter__` support, which
`persistence.js` uses heavily. This may change in IE 8.

Connecting to a database
-------------------------

There is one global database connection, which is
initialized with a `persistence.connect` call.  Its first argument is
the database name, the second a database description and third the
maximum database size (in bytes):

    persistence.connect('testdb', 'My test db', 5 * 1024 * 1024);

Schema definition
-----------------

A data model is declared using `persistence.define`. The following two
definitions define a `Task` and `Category` entity with a few simple
properties. The property types are based on [SQLite
types](http://www.sqlite.org/datatype3.html), currently supported
types are:

* `TEXT`: for textual data 
* `INT`: for numeric values
* `BOOL`: for boolean values (`true` or `false`)
* `DATE`: for date/time value (with precision of 1 second)
* `JSON`: a special type that can be used to store arbitrary
  [JSON](http://www.json.org) data. Note that this data can not be used
  to filter or sort in any sensible way. If internal changes are made to a `JSON`
  property, `persistence.js` may not register them. Therefore, a manual
  call to `anObj.markDirty('jsonPropertyName')` is required before calling
  `persistence.flush`.

Example use:
    
    var Task = persistence.define('Task', {
      name: "TEXT",
      description: "TEXT",
      done: "BOOL"
    });

    var Category = persistence.define('Category', {
      name: "TEXT",
      metaData: "JSON"
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
        
The first statement defines a `tasks` relationship on category objects
containing a `QueryCollection` (see the section on query collections
later) of `Task`s, it also defines an inverse relationship on `Task`
objects with the name `category`. The last two statements define a
many-to-many relationships between `Task` and `Tag`. `Task` gets a
`tags` property (a `QueryCollection`) containing all its tags and vice
versa, `Tag` gets a `tasks` property containing all of its tasks.

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
    category.metaData = {rating: 5};
    var tag = new Tag();
    tag.name = "work";

Many-to-one relationships are accessed using their specified name, e.g.:
    task.category = category;

One-to-many and many-to-many relationships are access and manipulated
through the `QueryCollection` API that will be discussed later:

    task.tags.add(tag);
    tasks.tags.remove(tag)l
    tasks.tags.list(tx, function(allTags) { console.log(allTags); });

Persisting/removing objects
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

Objects can also be removed from the database:

    persistence.remove(c);

All changes made to tracked objects can be flushed to the database by
using `persistence.flush`, which takes a transaction object and
callback function as arguments. A new transaction can be started using
`persistence.transaction`:
    
    persistence.transaction(function(tx) {
      persistence.flush(tx, function() {
        alert('Done flushing!');
      });
    });

For convenience, it is also possible to not specify a transaction or
callback, in that case a new transaction will be started
automatically. For instance:

    persistence.flush();
    // or, with callback
    persistence.flush(null, function() {
      alert('Done flushing');
    });

Note that when no callback is defined, the flushing still happens
asynchronously.

__Important__: Changes and new objects will not be persisted until you
explicitly call `persistence.flush()`. The exception to this rule is
using the `list(...)` method on a database `QueryCollection`, which also
flushes first, although this behavior may change in the future. 

Dumping and restoring data
--------------------------------

`persistence.dump` can be used to create an object containing a full
dump of a database. Naturally, it is adviced to only do this with
smaller databases. Example:

    persistence.dump(tx, [Task, Category], function(dump) {
      console.log(dump);
    });

When `null` is provided as a first argument a new transaction will be
started for the operation. If `null` is provided as second argument,
`dump` defaults to dumping _all_ defined entities.

The dump format is:
    
    {"entity-name": [list of instances],
     ...}

`persistence.load` is used to restore the dump produced by
`persistence.dump`. Usage:

    persistence.load(tx, dumpObj, function() {
      alert('Dump restored!');
    });

The `tx` argument can be `null` to automatically start a new
transaction. Note that `persistence.load` does not empty the database
first, it simply attempts to add all objects to the database. If
objects with, e.g. the same ID already exist, this will fail.

Similarly, `persistence.loadFromJson` and `persistence.dumpToJson`
respectively load and dump all the database's data as JSON strings.

Query collections
-----------------

A core concept of `persistence.js` is the `QueryCollection`. A
`QueryCollection` represents a (sometimes) virtual collection that can
be filtered, ordered or paginated. `QueryCollection`s are somewhate
inspired by [Google AppEngine's Query
class](http://code.google.com/appengine/docs/python/datastore/queryclass.html).
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
* `each(tx, eachCallback)`  
  Asynchronously fetches the results matching the formulated query.
  Once retrieved, the `eachCallback` function is invoked on each
  element of the result objects.
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

Bugs and Contributions
-----------------

If you find a bug, please [report it](http://yellowgrass.org/project/persistence.js).
or fork the project, fix the problem and send me a pull request. For
a list of planned features and open issues, have a look at the [issue
tracker](http://yellowgrass.org/project/persistence.js).

For support and discussion, please join the [persistence.js Google
Group](http://groups.google.com/group/persistencejs).

Thanks goes to [Fabio Rehm](http://github.com/fgrehm) and [Lukas
Berns](http://github.com/lukasberns) for their contributions.

License
-------

This work is licensed under the [MIT license](http://en.wikipedia.org/wiki/MIT_License).

Support this work
-----------------

You can support this project by flattering it:

<a href="http://flattr.com/thing/2510/persistence-js" target="_blank">
<img src="http://api.flattr.com/button/button-static-50x60.png" title="Flattr this" border="0" /></a>
