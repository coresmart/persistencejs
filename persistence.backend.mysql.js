/**
 * This back-end depends on the node.js asynchronous MySQL driver as found on:
 * http://github.com/sidorares/nodejs-mysql-native
 */
var persistencejs = require('./persistence');
var persistence = persistencejs.persistence;
var sys = require('sys');
var mysql = require('./mysql/mysql');

persistencejs.console.log = function(s) {
  sys.print(sys.inspect(s) + "\n");
};

var db, username, password;

function log(o) {
  sys.print(sys.inspect(o) + "\n");
}

function configure(_db, _username, _password) {
  db = _db;
  username = _username;
  password = _password;
}

function getSession() {
  var that = {};
  var conn = new mysql.Connection('localhost', username, password, db);
  conn.connect();

  that.transaction = function (fn) {
    return fn(transaction(conn));
  };

  var session = new persistence.Session(that);
  session.close = function() {
    conn.close();
  };
  return session;
};

function transaction(conn) {
  var that = {};
  that.executeSql = function (query, args, successFn, errorFn) {
    if(persistence.db.log) {
      sys.print(query + "\n");
    }
    var queryArg;
    if(query.indexOf('?') != -1) {
      queryArg = [query].concat(args);
    } else {
      queryArg = query;
    }
    //log(queryArg);
    conn.query(queryArg, function (result) {
        if (successFn) {
          var results = [];
          if(result.records) {
            for ( var i = 0; i < result.records.length; i++) {
              results.push(result.toHash(result.records[i]));
            }
          }
          successFn(results);
        }
      }, function(err) {
        log(err);
        log(err.message);
        sys.print(err.stack);
        errorFn(null, err);
      });
  };
  return that;
}

exports.configure = configure;
exports.getSession = getSession;

