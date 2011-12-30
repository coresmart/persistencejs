persistence.sync.js
===================

`persystence.sync.js` is a `persistence.js` plug-in that adds data
synchronization with remote servers. It comes with a client-side
component (`persistence.sync.js`) and a sample server-side component
(`persistence.sync.server.js`) for use with
[node.js](http://nodejs.org). It should be fairly easy to implement
server-components using other languages, any contributions there
are welcome.

Client-side usage
-----------------

After including both `persistence.js` and `persistence.sync.js` in
your page, you can enable syncing on entities individually:

    var Task = persistence.define("Task", {
      name: "TEXT",
      done: "BOOL"
    });

    Task.enableSync('/taskChanges');

The argument passed to `enableSync` is the URI of the sync server
component.

To initiate a sync, the `EntityName.syncAll(..)` method is used. The method signature
is the following:

    EntityName.syncAll(conflictHandler, successCallback, errorCallback)

successCallback and errorCallback are optional. successCallback occurs after a
successful sync errorCallback occurs on error (I.E. a non-200 response code).

conflictHandler is called in the event of a conflict between local and remote data:

    function conflictHandler(conflicts, updatesToPush, callback) {
      // Decide what to do with the conflicts here, possibly add to updatesToPush
      callback();
    }

    EntityName.syncAll(conflictHandler, function() {
      alert('Done!');
    }, errorHandler);

There are two sample conflict handlers:

1. `persistence.sync.preferLocalConflictHandler`, which in case of a
   data conflict will always pick the local changes.
2. `persistence.sync.preferRemoteConflictHandler`, which in case of a
   data conflict will always pick the remote changes.

For instance:

    EntityName.syncAll(persistence.sync.preferLocalConflictHandler, function() {
      alert('Done!');
    }, errorCallback);

Note that you are responsible for syncing all entities and that there
are no database consistencies after a sync, e.g. if you only sync `Task`s that
refer to a `Project` object and that `Project` object has not (yet) been synced,
the database will be (temporarily) inconsistent.

Server-side (Java, Slim3, AppEngine)
------------------------------------

Roberto Saccon developed a [Java server-side implementation of
persistence sync using the Slim3
framework](http://github.com/rsaccon/Slim3PersistenceSync).

Server-side (node.js)
---------------------

The server must expose a resource located at the given URI that responds to:

* `GET` requests with a `since=<UNIX MS TIMESTAMP>` GET parameter that
  will return a JSON object with two properties:
  * `now`, the timestamp of the current time at the server (in ms since 1/1/1970)
  * `updates`, an array of objects updated since the timestamp
    `since`. Each object has at least an `id` and `_lastChange` field
    (in the same timestamp format).

  For instance:
      
      /taskChanges?since=1279888110373

      {"now":1279888110421,
       "updates": [
          {"id": "F89F99F7B887423FB4B9C961C3883C0A",
           "name": "Main project",
           "_lastChange": 1279888110370
          }
       ]
      }

* `POST` requests with as its body a JSON array of new/updated
  objects. Every object needs to have at least an `id` property.

  Example, posting to:

      /taskChanges

  with body:

      [{"id":"BDDF85807155497490C12D6DA3A833F1",
        "name":"Locally created project"}]

  The server is supposed to persist these changes (if valid).
  Internally the items must be assigned a `_lastChange` timestamp
  `TS`. If OK, the server will return a JSON object with "ok" as
  `status` and `TS` as `now`. _Note:_ it is important that the
  timestamp of all items and the one returned are the same.

      {"status": "ok", 
       "now": 1279888110797}


Server-side filtering
-------------------

In certain circumstances, it is not necessary or desired to push all records down to a client. A standard GET URI looks like this:
    
    app.get('/taskupdates', function(req, res) {
      persistenceSync.pushUpdates(req.conn, req.tx, Task, req.query.since, function(updates){
        res.send(updates);
      });
    });

The third parameter in `pushUpdates` is the Entity model. If you wish to filter, simply pass a Query Collection in its place.
    
    app.get('/taskupdates', function(req, res) {
      var taskCollection = Task.all(req.conn).filter('done','=',false);
      persistenceSync.pushUpdates(req.conn, req.tx, taskCollection, req.query.since, function(updates){
        res.send(updates);
      });
    });



Limitations
-----------

* This synchronization library synchronizes on a per-object granularity. It
  does not keep exact changes on a per-property basis, therefore
  conflicts may be introduced that need to be resolved.
* It does not synchronize many-to-many relationships at this point
* There may still be many bugs, I'm not sure.
       
