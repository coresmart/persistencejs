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

var persistence = require('persistencejs/persistence').persistence;
var persistenceStore = require('persistencejs/persistence.store.mysql');

// Database configuration
persistenceStore.config(persistence, 'localhost', 3306, 'nodejs_mysql', 'test', 'test');

// Switch off query logging:
//persistence.db.log = false;

function log(o) {
  sys.print(sys.inspect(o) + "\n");
}

// Data model
var Post = persistence.define('Post', {
    title: "TEXT",
    text: "TEXT",
    date: "DATE"
});
var Comment = persistence.define('Comment', {
    author: "TEXT",
    text: "TEXT",
    date: "DATE"
});

Post.hasMany('comments', Comment, 'post');

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
  htmlHeader(res, "Blog");
  res.write('<h1>Latest Posts</h1>');
  Post.all(session).order("date", false).list(tx, function(posts) {
      for(var i = 0; i < posts.length; i++) {
        var post = posts[i];
        res.write('<h2><a href="/show?id=' + post.id + '">' + post.title + '</a></h2>');
        res.write(post.text);
        res.write('<hr/>');
        res.write('Posted ' + post.date);
      }
      res.write('<h1>Create new post</h1>');
      res.write('<form action="/post" method="GET">');
      res.write('<p>Title: <input name="title"/></p>');
      res.write('<p><textarea name="text" cols="60" rows="8"></textarea></p>');
      res.write('<p><input type="submit" value="Post"/></p>');
      res.write('</form>');
      htmlFooter(res);
      callback();
    });
}

function showItem(session, tx, req, res, callback) {
  htmlHeader(res, "Blog");
  var query = parseUrl(req.url, true).query;
  Post.load(session, tx, query.id, function(post) {
      res.write('<h1>' + post.title + '</h1>');
      res.write(post.text);
      res.write('<hr/>');
      res.write('Posted ' + post.date);
      res.write('<h1>Comments</h1>');
      post.comments.order('date', true).list(tx, function(comments) {
        for(var i = 0; i < comments.length; i++) {
          var comment = comments[i];
          res.write('<h2>By ' + comment.author + '</h2>');
          res.write(comment.text);
          res.write('<hr/>');
          res.write('Posted ' + post.date);
        }
        res.write('<h1>Add a comment</h1>');
        res.write('<form action="/postComment" method="GET">');
        res.write('<input type="hidden" name="post" value="' + post.id + '"/>');
        res.write('<p>Your name: <input name="author"/></p>');
        res.write('<p><textarea name="text" cols="60" rows="8"></textarea></p>');
        res.write('<p><input type="submit" value="Post"/></p>');
        res.write('</form>');
        htmlFooter(res);
        callback();
      });
    });
}

function post(session, tx, req, res, callback) {
  htmlHeader(res, "Created new post");
  var query = parseUrl(req.url, true).query;
  var post = new Post(session, {title: query.title, text: query.text, date: new Date()});
  session.add(post);
  session.flush(tx, function() {
      res.write('<p>Post added.</p>');
      res.write('<a href="/">Go back</a>');
      htmlFooter(res);
      callback();
    });
}

function postComment(session, tx, req, res, callback) {
  htmlHeader(res, "Created new comment");
  var query = parseUrl(req.url, true).query;
  var comment = new Comment(session, {text: query.text, author: query.author, date: new Date()});
  Post.load(session, tx, query.post, function(post) {
      post.comments.add(comment);
      session.flush(tx, function() {
          res.write('<p>Comment added.</p>');
          res.write('<a href="/show?id=' + post.id + '">Go back</a>');
          htmlFooter(res);
          callback();
        });
    });
}

var urlMap = {
  '/init': initDatabase,
  '/reset': resetDatabase,
  '/post': post,
  '/postComment': postComment,
  '/show': showItem,
  '/': showItems
};

var http = require('http');
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  var parsed = parseUrl(req.url, true);
  var fn = urlMap[parsed.pathname];
  if(fn) {
    var session = persistenceStore.getSession();
    session.transaction(function(tx) {
      fn(session, tx, req, res, function() {
          session.close();
          res.end();
        });
    });
  } else {
    res.end("Not found: " + req.url);
  }
}).listen(8888, "127.0.0.1");
console.log('Server running at http://127.0.0.1:8888/');
