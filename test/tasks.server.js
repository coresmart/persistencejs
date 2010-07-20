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
persistenceBackend.configure('tasks', 'test', 'test');

// Switch off query logging:
//persistence.db.log = false;

function log(o) {
  sys.print(sys.inspect(o) + "\n");
}

// Data model
var Task = persistence.define('Task', {
    name: "TEXT",
    done: "BOOL",
    lastChange: "DATE"
});

// HTML utilities
function htmlHeader(title) {
  return "<html><head><title>" + title + "</title></head><body>";
}

function htmlFooter() {
  return '<hr/><a href="/">Home</a></body></html>';
}

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
        //Task.all(req.conn).one(tx, function(){
            next();
          //});
      });
  }
);

// Actions
app.get('/init', function(req, res) {
    var html = htmlHeader("Initializing database.");
    req.conn.schemaSync(req.tx, function() {
        html += "Done.";
        html += htmlFooter();
        res.send(html);
      });
});


app.get('/reset', function(req, res) {
  var html = htmlHeader("Dropping all tables");
  req.conn.reset(req.tx, function() {
      html += 'All tables dropped, <a href="/init">Click here to create fresh ones</a>';
      html += htmlFooter();
      res.send(html);
    });
});

app.get('/', function(req, res) {
  var html = htmlHeader("Tasks");
  html += '<h1>Tasks</h1>';
  html += '<ol>';
  Task.all(req.conn).order("lastChange", false).list(req.tx, function(tasks) {
      for(var i = 0; i < tasks.length; i++) {
        var task = tasks[i];
        html += '<li>' + (task.done ? "[X]" : "[_]") + ' <a href="/toggleDone?id=' + task.id + '">' + task.name + '</a></li>';
      }
      html += '</ol>';
      html += '<h1>Add task</h1>';
      html += '<form action="/post" method="POST">';
      html += '<p>Name: <input name="name"/></p>';
      html += '<p><input type="submit" value="Add"/></p>';
      html += '</form>';
      html += htmlFooter();
      res.send(html);
    });
});

app.post('/post',  function(req, res) {
  var task = new Task(req.conn, {name: req.body.name, done: false, lastChange: new Date()});
  req.conn.add(task);
  req.conn.flush(req.tx, function() {
      res.redirect('/');
    });
});

app.get('/toggleDone', function(req, res) {
  Task.load(req.conn, req.tx, req.params.get.id, function(task) {
      req.conn.add(task);
      task.done = !task.done;
      task.lastChange = new Date();
      req.conn.flush(req.tx, function() {
          res.redirect('/');
        });
    });
});

app.get('/recentChanges',  function(req, res) {
    persistenceSync.pushUpdates(req.conn, req.tx, Task, req.params.get.since, function(updates) {
        res.send(updates);
      });
});

app.post('/recentChanges',  function(req, res) {
    persistenceSync.receiveUpdates(req.conn, req.tx, Task, req.body, undefined, function() {
        res.send({status: 'ok'});
      });
  });


app.listen(8888);

console.log('Server running at http://127.0.0.1:8888/');
