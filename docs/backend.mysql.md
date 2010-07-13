Node.js MySQL Back-end
============================

This library implements some wrappers to let `persistence.js` work
with a MySQL database in a [node.js](http://nodejs.org) environment.
Although not fully stable it is usable at this point using
[nodejs-mysql-native](http://github.com/sidorares/nodejs-mysql-native)
library (which you have to download and include in your project
manually). This library is a starting point to start adding more
back-ends to `persistence.js`, including NoSQL back-ends.

Sadly the node.js server environment requires slight changes to
`persistence.js` to make it work with multiple database connections:

* A `Session` object needs to be passed as an extra argument to
  certain method calls, typically as a last argument.
* Methods previously called on the `persistence` object itself are now
  called on the `Session` object.

An example node.js application is included in `test/node-blog.js`. 

Setup
-----
You need to `require` two modules, the `persistence.js` library itself
and the MySQL backend module. Also make sure the MySQL library
is located (or symlinked) from the current directory:

    var persistence = require('./persistence').persistence;
    var persistenceBackend = require('./persistence.backend.mysql');

Then, you configure the database settings to use:

    persistenceBackend.configure('database', 'username', 'password');

Subsequently, for every connection you handle (assuming you're
building a sever), you call the `persistenceBackend.getSession()`
method:

    var session = persistenceBackend.getSession();

This session is what you pass around, typically together with a
transaction object. Note that currently you can only have one
transaction open per session and transactions cannot be nested.

    session.transaction(function(tx) {
      ...
    });

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

Creating and manipulating objects is done much the same way as with regular `persistence.js`, except that in the entity's constructor you need to reference the `Session` again:

    var t = new Task({}, session);
    ...
    session.add(t);

    session.flush(tx, function() {
      ...
    });

Query collections
-----------------

Query collections work the same way as in regular `persistence.js` with the exception of the `Entity.all()` method that now also requires a `Session` to be passed to it:

    Task.all(session).filter('done', '=', true).list(tx, function(tasks) {
      ...
    });

Closing the session
-------------------

After usage, you need to close your session:

    session.close();
