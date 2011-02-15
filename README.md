persistence.js
==============
`persistence.js` is a asynchronous Javascript object-relational
mapper library. It can be used both in the web browser and on
the server using [node.js](http://nodejs.org). It currently
supports 4 types of data stores:

* [HTML5 WebSQL database](http://dev.w3.org/html5/webdatabase/), a
  somewhat controversial part of HTML5 that is supported in Webkit
  browsers, specifically on mobile devices, including iPhone, Android
  and Palm's WebOS. 
* [Google Gears](http://gears.google.com), a browser plug-in that adds
  a number of feature to the browser, including a in-browser database.
* [MySQL](http://www.mysql.com), using the
  [node-mysql](http://github.com/felixge/node-mysql), node.js module
  on the server.
* In-memory, as a fallback. Keeps the database in memory and is
  cleaned upon a page refresh (or server restart), unless saved to
  [localStorage](http://dev.w3.org/html5/webstorage/).

There is also an experimental support for [Qt 4.7 Declarative UI
framework
(QML)](http://doc.trolltech.org/4.7-snapshot/declarativeui.html) which
is an extension to JavaScript.

For browser use, `persistence.js` has no dependencies on any other
frameworks, other than the Google Gears [initialization
script](http://code.google.com/apis/gears/gears_init.js), in case you
want to enable Gears support.

Plug-ins
--------

There are a few `persistence.js` plug-ins available that add functionality:

* `persistence.search.js`, adds simple full-text search capabilities,
  see `docs/search.md` for more information.
* `persistence.migrations.js`, supports data migrations (changes to
  the database schema), see `docs/migrations.md` for more information.
* `persistence.sync.js`, supports database synchronization with a
  remote server, see `docs/sync.md` for more information.
* `jquery.persistence.js`, adds jQuery integration, including 
  jQuery-mobile ajax request interception and re-routing to persistencejs,
  see `docs/jquery.md` for more information and `demo/jquerymobile` for a 
  simple demo.

A Brief Intro to Async Programming
----------------------------------

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

Using persistence.js in the browser
===================================

Browser support
---------------

* Modern webkit browsers (Google Chrome and Safari)
* Firefox (through Google Gears)
* Opera
* Android browser (tested on 1.6 and 2.x)
* iPhone browser (iPhone OS 3+)
* Palm WebOS (tested on 1.4.0)
* Other browsers supporting `localStorage` (e.g. Firefox)

(The following is being worked on:)
Internet Explorer is likely not supported (untested) because it
lacks `__defineGetter__` and `__defineSetter__` support, which
`persistence.js` uses heavily. This may change in IE 9.

Setting up
----------

To use `persistence.js` you need to clone the git repository:

    git clone git://github.com/zefhemel/persistencejs.git

To use it you need to copy `lib/persistence.js` to your web directory,
as well as any data stores you want to use. Note that the `mysql` and
`websql` stores both depend on the `sql` store. A typical setup
requires you to copy at least `lib/persistence.js`,
`lib/persistence.store.sql.js` and `lib/persistence.store.websql.js` to your
web directory. You can then load them as follows:

    <script src="persistence.js" type="application/javascript"></script>
    <script src="persistence.store.sql.js" type="application/javascript"></script>
    <script src="persistence.store.websql.js" type="application/javascript"></script>

If you want to use the in-memory store (in combination with
`localStorage`) you also need the `persistence.store.memory.js`
included.


Setup your database
-------------------

You need to explicitly configure the data store you want to use,
configuration of the data store is store-specific. The WebSQL store
(which includes Google Gears support) is configured as follows:

    persistence.store.websql.config(persistence, 'yourdbname', 'A database description', 5 * 1024 * 1024);

The first argument is always supposed to be `persistence`. The second
in your database name (it will create it if it does not already exist,
the third is a description for you database, the last argument is the
maximum size of your database in bytes (5MB in this example).

The in-memory store
---------------------------------------

The in-memory store is offered as a fallback for browsers that do not
support any of the other supported stores (e.g. WebSQL or Gears). In
principal, it only keeps data in memory, which means that navigating
away from the page (including a reload or tab close) will result in
the loss of all data.

A way around this is using the `persistence.saveToLocalStorage` and
`persistence.loadFromLocalStorage` functions that can save the entire
database to the [localStorage](http://dev.w3.org/html5/webstorage/), which
is persisted indefinitely (similar to WebSQL).

If you're going to use the in-memory store, you can configure it as follows:

    persistence.store.memory.config(persistence);

Then, if desired, current data can be loaded from the localStorage using:

    persistence.loadFromLocalStorage(function() {
      alert("All data loaded!");
    });

And saved using:

    persistence.saveToLocalStorage(function() {
      alert("All data saved!");
    });

Drawbacks of the in-memory store:

* Performance: All actions that are typically performed by a database
  (sorting, filtering), are now all performed in-memory using
  Javascript.
* Limited database size: Loading and saving requires serialization of
  all data from and to JSON, which gets more expensive as your dataset
  grows. Most browsers have a maximum size of 5MB for `localStorage`.
* Synchronous behavior: Although the API is asynchronous, all
  persistence actions will be performed synchronously on the main
  Javascript thread, which may make the browser less responsive.

Schema definition
-----------------

A data model is declared using `persistence.define`. The following two
definitions define a `Task` and `Category` entity with a few simple
properties. The property types are based on [SQLite
types](http://www.sqlite.org/datatype3.html), specifically supported
types are (but any SQLite type is supported):

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
create new instances of these entities later.

It is possible to create indexes on one or more columns using
`EntityName.index`, for instance:

    Task.index('done');
    Task.index(['done', 'name']);

These indexes can also be used to impose unique constraints :

    Task.index(['done', 'name'],{unique:true});

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

There is also a migrations plugin you can check out, documentation can be found
in [persistence.migrations.docs.md](migrations/persistence.migrations.docs.md) file.

Mix-ins
-------

You can also define mix-ins and apply them to entities of the model. 

A mix-in definition is similar to an entity definition, except using
`defineMixin` rather than just `define`. For example:

    var Annotatable = persistence.defineMixin('Annotatable', {
      lastAnnotated: "DATE"
    });

You can define relationships between mix-in and entities. For example:

    // A normal entity
    var Note = persistence.define('Note', {
      text: "TEXT"
    });
  
    // relationship between a mix-in and a normal entity
    Annotatable.hasMany('notes', Note, 'annotated');

Once you have defined a mix-in, you can apply it to any entity of your model, 
with the `Entity.is(mixin)` method. For example:

    Project.is(Annotatable);
    Task.is(Annotatable);
    
Now, your `Project` and `Task` entities have an additional `lastAnnotated` property.
They also have a one to many relationship called `notes` to the `Note` entity. 
And you can also traverse the reverse relationship from a `Note` to its `annotated` object.

Note that `annotated` is a polymorphic relationship as it may yield either a `Project` 
or a `Task` (or any other entity which is `Annotatable').

Note: Prefetch is not allowed (yet) on a relationship that targets a mixin. In the example above
you cannot prefetch the `annotated` relationship when querying the `Note` entity.
    
Notes: this feature is very experimental at this stage. It needs more testing.
  Support for "is a" relationships (classical inheritance) is also in the works.

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
---------------------------

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
    persistence.flush(function() {
      alert('Done flushing');
    });

Note that when no callback is defined, the flushing still happens
asynchronously.

__Important__: Changes and new objects will not be persisted until you
explicitly call `persistence.flush()`. The exception to this rule is
using the `list(...)` method on a database `QueryCollection`, which also
flushes first, although this behavior may change in the future. 

Dumping and restoring data
--------------------------

The library supports two kinds of dumping and restoring data.

`persistence.dump` can be used to create an object containing a full
dump of a database. Naturally, it is adviced to only do this with
smaller databases. Example:

    persistence.dump(tx, [Task, Category], function(dump) {
      console.log(dump);
    });

The `tx` is left out, a new transaction will be started for the
operation. If the second argument is left out, `dump` defaults
to dumping _all_ defined entities.

The dump format is:
    
    {"entity-name": [list of instances],
     ...}

`persistence.load` is used to restore the dump produced by
`persistence.dump`. Usage:

    persistence.load(tx, dumpObj, function() {
      alert('Dump restored!');
    });

The `tx` argument can be left out to automatically start a new
transaction. Note that `persistence.load` does not empty the database
first, it simply attempts to add all objects to the database. If
objects with, e.g. the same ID already exist, this will fail.

Similarly, `persistence.loadFromJson` and `persistence.dumpToJson`
respectively load and dump all the database's data as JSON strings.

Entity constructor functions
----------------------------

The constructor function returned by a `persistence.define` call
cannot only be used to instantiate new objects, it also has some
useful methods of its own:

* `EntityName.all([session])` returns a query collection containing
all
  persisted instances of that object. The `session` argument is
  optional and only required when `persistence.js` is used in
  multi-session mode.
* `EntityName.load([session], [tx], id, callback)` loads an particular
  object from the database by id or returns `null` if it has not been
  found.
* `EntityName.findBy([session], [tx], property, value, callback)` searches
  for a particular object based on a property value (this is assumed to
  be unique), the callback function is called with the found object or
  `null` if it has not been found.
* `EntityName.index([col1, col2, ..., colN], options)` creates an index on a column
  of a combination of columns, for faster searching. If options.unique is true,
  the index will impose a unique constraint on the values of the columns.

And of course the methods to define relationships to other entities:

* `EntityName.hasMany(property, Entity, inverseProperty)` defines a
  1:N or N:M relationship (depending on the inverse property)
* `EntityName.hasOne(property, Entity)` defines a 1:1 or N:1
  relationship


Entity objects
--------------

Entity instances also have a few predefined properties and methods you
should be aware of:

* `obj.id`, contains the identifier of your entity, this is a
  automatically generated (approximation of a) UUID. You should
  never write to this property.
* `obj.fetch(prop, callback)`, if an object has a `hasOne`
   relationship to another which has not yet been fetched from the
   database (e.g. when `prefetch` wasn't used), you can fetch in manually
   using `fetch`. When the property object is retrieved the callback function
   is invoked with the result, the result is also cached in the entity
   object itself.
* `obj.selectJSON([tx], propertySpec, callback)`, sometime you need to extract
  a subset of data from an entity. You for instance need to post a
  JSON representation of your entity, but do not want to include all
  properties. `selectJSON` allows you to do that. The `propertySpec`
  arguments expects an array with property names. Some examples:
   * `['id', 'name']`, will return an object with the id and name property of this entity
   * `['*']`, will return an object with all the properties of this entity, not recursive
   * `['project.name']`, will return an object with a project property which has a name 
     property containing the project name (hasOne relationship)
   * `['project.[id, name]']`, will return an object with a project property which has an
     id and name property containing the project name (hasOne relationship)
   * `['tags.name']`, will return an object with an array `tags` property containing 
     objects each with a single property: name
       

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
  are '=', '!=', '<', '<=', '>', '>=', 'in' and 'not in'. Example:
  `.filter('done', '=', true)`
* `or(filter)`  
  Returns a new `QueryCollection` that contains items either matching
  the filters specified before calling `or`, or the filter represented
  in the argument. The `filter` argument is of a `Filter` type, there
  are three types of filters:
  - `persistence.PropertyFilter`, which filters on properties (internally called when `filter(...)` is used.  
    Example: `new persistence.PropertyFilter('done', '=', true)`
  - `persistence.AndFilter`, which is passed two filter objects as arguments, both of which should be true.
    Example: `new persistence.AndFilter(new persistence.PropertyFilter('done', '=', true), new persistence.PropertyFilter('archived', '=', true))`
  - `persistence.OrFilter`, which is passed two filter objects as arguments, one of which should be true.
    Example: `new persistence.OrFilter(new persistence.PropertyFilter('done', '=', true), new persistence.PropertyFilter('archived', '=', true))`
* `and(filter)`  
  same as `or(filter)` except that both conditions should hold for items to be in the collection. 
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
* `add(obj)`  
  Adds object `obj` to the collection.
* `remove(obj)`  
  Removes object `obj` from the collection.
* `list([tx], callback)`  
  Asynchronously fetches the results matching the formulated query.
  Once retrieved, the callback function is invoked with an array of
  entity objects as argument.
* `each([tx], eachCallback)`  
  Asynchronously fetches the results matching the formulated query.
  Once retrieved, the `eachCallback` function is invoked on each
  element of the result objects.
* `forEach([tx], eachCallback)`  
  Alias for `each`
* `one([tx], callback)`
  Asynchronously fetches the first element of the collection, or `null` if none.
* `destroyAll([tx], callback)`
  Asynchronously removes all the items in the collection. __Important__: this does
  not only remove the items from the collection, but removes the items themselves!
* `count([tx], callback)`
  Asynchronously counts the number of items in the collection. The arguments passed
  to the `callback` function is the number of items.

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

Using persistence.js on the server
==================================

Installing `persistence.js` on node is easy using [npm](http://npmjs.org):

    npm install persistencejs

Sadly the node.js server environment requires slight changes to
`persistence.js` to make it work with multiple database connections:

* A `Session` object needs to be passed as an extra argument to
  certain method calls, typically as a first argument.
* Methods previously called on the `persistence` object itself are now
  called on the `Session` object.

An example `node.js` application is included in `test/node-blog.js`. 

Setup
-----
You need to `require` two modules, the `persistence.js` library itself
and the MySQL backend module.

    var persistence = require('persistencejs/persistence').persistence;
    var persistenceStore = require('persistencejs/persistence.store.mysql');

Then, you configure the database settings to use:

    persistenceStore.config(persistence, 'localhost', 3306, 'dbname', 'username', 'password');

Subsequently, for every connection you handle (assuming you're
building a sever), you call the `persistenceStore.getSession()`
method:

    var session = persistenceStore.getSession();

This session is what you pass around, typically together with a
transaction object. Note that currently you can only have one
transaction open per session and transactions cannot be nested.

    session.transaction(function(tx) {
      ...
    });

Commit and Rollback
-------------------

`persistence.js` works in autocommit mode by default. 

You can override this behavior and enable explicit commit and rollback 
by passing true as first argument to `persistence.transaction`. 
You can then use the following two methods to control the transaction:

* `transaction.commit(session, callback)` commits the changes.
* `transaction.rollback(session, callback)` rollbacks the changes.

Typical code will look like:
 
    session.transaction(true, function(tx) {
      // create/update/delete objects
      modifyThings(session, tx, function(err, result) {
        if (err) {
          // something went wrong
          tx.rollback(session, function() {
            console.log('changes have been rolled back: ' + ex.message);
          });
        }
        else {
          // success
          tx.commit(session, function() {
            console.log('changes have been committed: ' result);
        });
      });
    });

Explicit commit and rollback is only supported on MySQL (server side) 
for now.

Defining your data model
------------------------

Defining your data model is done in exactly the same way as regular `persistence.js`:

    var Task = persistence.define('Task', {
      name: "TEXT",
      description: "TEXT",
      done: "BOOL"
    });

A `schemaSync` is typically performed as follows:

    session.schemaSync(tx, function() {
      ...
    });

Creating and manipulating objects
---------------------------------

Creating and manipulating objects is done much the same way as with
regular `persistence.js`, except that in the entity's constructor you
need to reference the `Session` again:

    var t = new Task(session);
    ...
    session.add(t);

    session.flush(tx, function() {
      ...
    });

Query collections
-----------------

Query collections work the same way as in regular `persistence.js`
with the exception of the `Entity.all()` method that now also requires
a `Session` to be passed to it:

    Task.all(session).filter('done', '=', true).list(tx, function(tasks) {
      ...
    });

Closing the session
-------------------

After usage, you need to close your session:

    session.close();

Bugs and Contributions
======================

If you find a bug, please [report
it](https://github.com/zefhemel/persistencejs/issues).  or fork the
project, fix the problem and send me a pull request. For a list of
planned features and open issues, have a look at the [issue
tracker](https://github.com/zefhemel/persistencejs/issues).

For support and discussion, please join the [persistence.js Google
Group](http://groups.google.com/group/persistencejs).

Thanks goes to the people listed in `AUTHORS` for their contributions.

If you use [GWT](http://code.google.com/webtoolkit/) (the Google Web
Toolkit), be sure to have a look at [Dennis Z. Jiang's GWT persistence.js
wrapper](http://github.com/dennisjzh/GwtMobile-Persistence)

License
=======

This work is licensed under the [MIT license](http://en.wikipedia.org/wiki/MIT_License).

Support this work
-----------------

You can support this project by flattering it:

<a href="http://flattr.com/thing/2510/persistence-js" target="_blank">
<img src="http://api.flattr.com/button/button-static-50x60.png" title="Flattr this" border="0" /></a>
