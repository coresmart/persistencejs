/**
 * Copyright (c) 2010 Zef Hemel <zef@zef.me>
 * 
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 *
 *
 * Requirements:
 * node.js
 * npm install connect
 * npm install express
 */
var sys = require('sys');
var connect = require('connect');
var express = require('express');

var persistence = require('../../lib/persistence').persistence;
var persistenceStore = require('../../lib/persistence.store.mysql');
var persistenceSync = require('../../lib/persistence.sync.server');

// Database configuration
persistenceStore.config(persistence, 'localhost', 3306, 'synctest', 'test', 'test');

// Switch off query logging:
//persistence.db.log = false;

function log(o) {
  sys.print(sys.inspect(o) + "\n");
}

persistenceSync.config(persistence);

// Data model
var Project = persistence.define('Project', {
    name: "TEXT"
  });

var Task = persistence.define('Task', {
    name: "TEXT",
    done: "BOOL"
  });

var Tag = persistence.define('Tag', {
    name: "TEXT"
  });

Task.hasMany('tags', Tag, 'tasks');
Tag.hasMany('tasks', Task, 'tags');

Project.hasMany('tasks', Task, 'project');

Project.enableSync();
Task.enableSync();
Tag.enableSync();

var app = express.createServer(
  //connect.logger(), 
  connect.bodyDecoder(), 
  connect.staticProvider('../browser'),
  function(req, res, next) {
    var end = res.end;

    req.conn = persistenceStore.getSession();
    res.end = function() {
      req.conn.close();
      end.apply(res, arguments);
    };
    req.conn.transaction(function(tx) {
        req.tx = tx;
        next();
      });
  }
);

function generateDummyData(session) {
  var p = new Project(session, {name: "Main project"});
  session.add(p);
  for(var i = 0; i < 25; i++) {
    var t = new Task(session, {name: "Task " + i, done: false});
    p.tasks.add(t);
  }
}

// Actions
app.get('/reset', function(req, res) {
  req.conn.reset(req.tx, function() {
      req.conn.schemaSync(req.tx, function() {
          generateDummyData(req.conn);
          req.conn.flush(req.tx, function() {
              res.send({status: "ok"});
            });
        });
    });
});

app.get('/projectUpdates',  function(req, res) {
    persistenceSync.pushUpdates(req.conn, req.tx, Project, req.query.since, function(updates) {
        res.send(updates);
      });
});

app.post('/projectUpdates',  function(req, res) {
    persistenceSync.receiveUpdates(req.conn, req.tx, Project, req.body, function(result) {
        res.send(result);
      });
  });

app.get('/taskUpdates',  function(req, res) {
    persistenceSync.pushUpdates(req.conn, req.tx, Task, req.query.since, function(updates) {
        res.send(updates);
      });
});

app.post('/taskUpdates',  function(req, res) {
    persistenceSync.receiveUpdates(req.conn, req.tx, Task, req.body, function(result) {
        res.send(result);
      });
  });

app.get('/tagUpdates',  function(req, res) {
    persistenceSync.pushUpdates(req.conn, req.tx, Tag, req.query.since, function(updates) {
        res.send(updates);
      });
});

app.post('/tagUpdates',  function(req, res) {
    persistenceSync.receiveUpdates(req.conn, req.tx, Tag, req.body, function(result) {
        res.send(result);
      });
  });

app.get('/markAllDone', function(req, res) {
    Task.all(req.conn).list(req.tx, function(tasks) {
        tasks.forEach(function(task) {
            task.done = true;
          });
        req.conn.flush(req.tx, function() {
            res.send({status: 'ok'});
          });
      });
});

app.get('/markAllUndone', function(req, res) {
    Task.all(req.conn).list(req.tx, function(tasks) {
        tasks.forEach(function(task) {
            task.done = false;
          });
        req.conn.flush(req.tx, function() {
            res.send({status: 'ok'});
          });
      });
});

app.listen(8888);

console.log('Server running at http://127.0.0.1:8888/');
