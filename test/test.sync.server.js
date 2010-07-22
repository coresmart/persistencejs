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
 * USAGE:
 * On first run, be sure to initialize the database first: http://localhost:8888/init
 * otherwise the application will hang (because the select query fails). After that,
 * just visit http://localhost:8888/
 */
var sys = require('sys');
var connect = require('connect');
var express = require('express');

var persistence = require('../persistence').persistence;
var persistenceBackend = require('../persistence.backend.mysql');
var persistenceSync = require('../persistence.sync.server');

// Database configuration
persistenceBackend.configure('synctest', 'test', 'test');

// Switch off query logging:
//persistence.db.log = false;

function log(o) {
  sys.print(sys.inspect(o) + "\n");
}

persistenceSync.setupSync(persistence);

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
  connect.staticProvider('.'),
  function(req, res, next) {
    var end = res.end;

    req.conn = persistenceBackend.getSession();
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
    persistenceSync.pushUpdates(req.conn, req.tx, Project, req.params.get.since, function(updates) {
        res.send(updates);
      });
});

app.post('/projectUpdates',  function(req, res) {
    persistenceSync.receiveUpdates(req.conn, req.tx, Project, req.body, undefined, function() {
        res.send({status: 'ok'});
      });
  });

app.get('/taskUpdates',  function(req, res) {
    persistenceSync.pushUpdates(req.conn, req.tx, Task, req.params.get.since, function(updates) {
        res.send(updates);
      });
});

app.post('/taskUpdates',  function(req, res) {
    persistenceSync.receiveUpdates(req.conn, req.tx, Task, req.body, undefined, function() {
        res.send({status: 'ok'});
      });
  });

app.get('/tagUpdates',  function(req, res) {
    persistenceSync.pushUpdates(req.conn, req.tx, Tag, req.params.get.since, function(updates) {
        res.send(updates);
      });
});

app.post('/tagUpdates',  function(req, res) {
    persistenceSync.receiveUpdates(req.conn, req.tx, Tag, req.body, undefined, function() {
        res.send({status: 'ok'});
      });
  });

app.get('/markAllDone', function(req, res) {
    Task.all(req.conn).list(req.tx, function(tasks) {
        tasks.forEach(function(task) {
            task.done = true;
          });
        req.conn.flush(req.tx, function() {
            res.send({status: 'ok'});
            log("--------------------------");
          });
      });
});

app.listen(8888);

console.log('Server running at http://127.0.0.1:8888/');
