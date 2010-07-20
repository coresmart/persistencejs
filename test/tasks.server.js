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
var parseUrl = require('url').parse;
var fs = require('fs'); 

var persistence = require('../persistence').persistence;
var persistenceBackend = require('../persistence.backend.mysql');

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
function htmlHeader(res, title) {
  res.write("<html><head><title>" + title + "</title></head><body>");
}
function htmlFooter(res) {
  res.write('<hr/><a href="/">Home</a>');
  res.write("</body></html>");
}

// Actions
function initDatabase(session, tx, req, res, callback) {
  htmlHeader(res, "Initializing database.");
  session.schemaSync(tx, function() {
      res.write("Done.");
      htmlFooter(res);
      callback();
    });
}

function resetDatabase(session, tx, req, res, callback) {
  htmlHeader(res, "Dropping all tables");
  session.reset(tx, function() {
      res.write('All tables dropped, <a href="/init">Click here to create fresh ones</a>');
      htmlFooter(res);
      callback();
    });
}

function showItems(session, tx, req, res, callback) {
  htmlHeader(res, "Tasks");
  res.write('<h1>Tasks</h1>');
  res.write('<ol>');
  Task.all(session).order("lastChange", false).list(tx, function(tasks) {
      for(var i = 0; i < tasks.length; i++) {
        var task = tasks[i];
        res.write('<li>' + (task.done ? "[X]" : "[_]") + ' <a href="/toggleDone?id=' + task.id + '">' + task.name + '</a></li>');
      }
      res.write('</ol>');
      res.write('<h1>Add task</h1>');
      res.write('<form action="/post" method="GET">');
      res.write('<p>Name: <input name="name"/></p>');
      res.write('<p><input type="submit" value="Add"/></p>');
      res.write('</form>');
      htmlFooter(res);
      callback();
    });
}

function post(session, tx, req, res, callback) {
  htmlHeader(res, "Created new task");
  var query = parseUrl(req.url, true).query;
  var task = new Task({name: query.name, done: false, lastChange: new Date()}, session);
  session.add(task);
  session.flush(tx, function() {
      res.write('<p>Task added.</p>');
      res.write('<a href="/">Go back</a>');
      htmlFooter(res);
      callback();
    });
}

function toggleDone(session, tx, req, res, callback) {
  htmlHeader(res, "Toggled");
  var query = parseUrl(req.url, true).query;
  Task.load(session, tx, query.id, function(task) {
      session.add(task);
      task.done = !task.done;
      task.lastChange = new Date();
      session.flush(tx, function() {
          res.write('<p>Task status toggled.</p>');
          res.write('<a href="/">Go back</a>');
          htmlFooter(res);
          callback();
        });
    });
}

function recentChanges(session, tx, req, res, callback) {
  if(req.method === 'GET') {
    pushChanges(session, tx, req, res, callback);
  } else {
    receiveChanges(session, tx, req, res, callback);
  }
}

function pushChanges(session, tx, req, res, callback) {
  log("Pushing changes.");
  var query = parseUrl(req.url, true).query;
  var since = query.since;
  Task.all(session).filter("lastChange", ">", since).list(tx, function(tasks) {
      var results = [];
      for(var i = 0; i < tasks.length; i++) {
        var taskData = tasks[i]._data;
        taskData.id = tasks[i].id;
        results.push(taskData);
      }
      res.write(JSON.stringify({now: new Date(), updates: results}));
      callback();
    });
}

function receiveChanges(session, tx, req, res, callback) {
  log("Receiving changes.");
  var body = '';
  req.addListener('data', function(chunk) {
      body += chunk.toString();
    });
  req.addListener('end', function() {
      var updates = JSON.parse(body);
      var allIds = [];
      var updateLookup = {};
      for(var i = 0; i < updates.length; i++) {
        allIds.push(updates[i].id);
        updateLookup[updates[i].id] = updates[i];
      }
      Task.all(session).filter("id", "in", allIds).list(tx, function(existingItems) {
          for(var i = 0; i < existingItems.length; i++) {
            var existingItem = existingItems[i];
            var updateItem = updateLookup[existingItem.id];
            for(var p in updateItem) {
              if(updateItem.hasOwnProperty(p)) {
                if(updateItem[p] !== existingItem[p]) {
                  existingItem[p] = updateItem[p];
                }
              }
            }
            delete updateLookup[existingItem.id];
          }
          // All new items
          for(var id in updateLookup) {
            if(updateLookup.hasOwnProperty(id)) {
              var update = updateLookup[id];
              delete update.id;
              var newItem = new Task(session, update);
              newItem.id = id;
              newItem.lastChange = new Date(newItem.lastChange);
              log("Adding new item.");
              log(newItem);
              session.add(newItem);
            }
          }
          session.flush(tx, function() {
              log("All is saved and done.");
              callback();
            });
        });
    });
  Task.all(session).one(tx, function() { });
}

var urlMap = {
  '/init': initDatabase,
  '/reset': resetDatabase,
  '/post': post,
  '/toggleDone': toggleDone,
  '/recentChanges': recentChanges,
  '/': showItems
};

function guessContentType(path) {
  if(path.indexOf('.html') !== -1) {
    return "text/html";
  } else if(path.indexOf('.js') !== -1) {
    return "text/javascript";
  } else {
    return "text/plain";
  }
}

var http = require('http');
http.createServer(function (req, res) {
  var parsed = parseUrl(req.url, true);
  var fn = urlMap[parsed.pathname];
  if(fn) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    var session = persistenceBackend.getSession();
    session.transaction(function(tx) {
        fn(session, tx, req, res, function() {
            session.close();
            res.end();
          });
      });
  } else {
    var path = req.url.substring(1);
    fs.stat(path, function(err, stats) { 
        if(err) {
          res.writeHead(200, {'Content-Type': "text/plain"});
          res.end("Not found: " + req.url);
          return;
        }
        res.writeHead(200, {'Content-Type': guessContentType(path), 'Content-Length': stats.size}); 
        var enc = 'binary', rz = 8*1024; 
        fs.open(path, 'r', 06660, function(err, fd) { 
            if (err) sys.puts(sys.inspect(err)); 
            var pos = 0; 
            function readChunk () { 
              fs.read(fd, rz, pos, enc, function(err, chunk, 
                  bytes_read) { 
                  if (err) sys.puts(sys.inspect(err)); 
                  if (chunk) { 
                    try { 
                      res.write(chunk, enc); 
                      pos += bytes_read; 
                      readChunk(); 
                    } catch (e) { 
                      fs.close(fd); 
                      sys.puts(sys.inspect(e)); 
                    } 
                  } 
                  else { 
                    res.end(); 
                    fs.close(fd, function (err) { 
                        if (err) sys.puts(sys.inspect(err)); 
                      }); 
                  } 
                }); 
            } 
            readChunk(); 
          }); 
      }); 
  }
}).listen(8888, "127.0.0.1");
console.log('Server running at http://127.0.0.1:8888/');
