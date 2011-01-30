/**
 * This back-end depends on the node.js asynchronous MySQL driver as found on:
 * http://github.com/felixge/node-mysql/
 * Easy install using npm:
 *   npm install mysql
 */
var sys = require('sys');
var sql = require('./persistence.store.sql');
var mysql = require('mysql');

var db, username, password;

function log(o) {
  sys.print(sys.inspect(o) + "\n");
}


exports.config = function(persistence, hostname, port, db, username, password) {
  exports.getSession = function() {
    var that = {};
    var conn = new mysql.Client();
    conn.host = hostname;
    conn.port = port;
    conn.user = username;
    conn.password = password;
    conn.database = db;
    conn.connect();

    var session = new persistence.Session(that);
    session.transaction = function (explicitCommit, fn) {
      if (typeof arguments[0] === "function") {
        fn = arguments[0];
        explicitCommit = false;
      }
      var tx = transaction(conn);
      if (explicitCommit) {
        tx.executeSql("START TRANSACTION", null, function(){
          fn(tx)
        });
      }
      else 
        fn(tx);
    };

    session.close = function() {
      conn.end();
      //conn._connection.destroy();
    };
    return session;
  };

  function transaction(conn){
    var that = {};
    if(conn.ending) {
      throw new Error("Connection has been closed, cannot execute query.");
    }
    that.executeSql = function(query, args, successFn, errorFn){
      function cb(err, result){
        if (err) {
          log(err.message);
          that.errorHandler && that.errorHandler(err);
          errorFn && errorFn(null, err);
          return;
        }
        if (successFn) {
          successFn(result);
        }
      }
      if (persistence.debug) {
        sys.print(query + "\n");
        args && args.length > 0 && sys.print(args.join(",") + "\n")
      }
      if (!args) {
        conn.query(query, cb);
      }
      else {
        conn.query(query, args, cb);
      }
    }
    
    that.commit = function(session, callback){
      session.flush(that, function(){
        that.executeSql("COMMIT", null, callback);
      })
    }
    
    that.rollback = function(session, callback){
      that.executeSql("ROLLBACK", null, function() {
        session.clean();
        callback();
      });
    }
    return that;
  }
  
  exports.mysqlDialect = {
    // columns is an array of arrays, e.g.
    // [["id", "VARCHAR(32)", "PRIMARY KEY"], ["name", "TEXT"]]
    createTable: function(tableName, columns) {
      var tm = persistence.typeMapper;
      var sql = "CREATE TABLE IF NOT EXISTS `" + tableName + "` (";
      var defs = [];
      for(var i = 0; i < columns.length; i++) {
        var column = columns[i];
        defs.push("`" + column[0] + "` " + tm.columnType(column[1]) + (column[2] ? " " + column[2] : ""));
      }
      sql += defs.join(", ");
      sql += ') ENGINE=InnoDB DEFAULT CHARSET=utf8';
      return sql;
    },

    // columns is array of column names, e.g.
    // ["id"]
    createIndex: function(tableName, columns, options) {
      options = options || {};
      return "CREATE "+(options.unique?"UNIQUE ":"")+"INDEX `" + tableName + "__" + columns.join("_") + 
             "` ON `" + tableName + "` (" + 
             columns.map(function(col) { return "`" + col + "`"; }).join(", ") + ")";
    }
  };

  sql.config(persistence, exports.mysqlDialect);
};

