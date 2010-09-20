/**
 * This back-end depends on the node.js asynchronous MySQL driver as found on:
 * http://github.com/felixge/node-mysql/
 * Easy install using npm:
 *   npm install mysql
 */
var sys = require('sys');
var sql = require('persistencejs/persistence.store.sql');
var mysql = require('mysql');

var db, username, password;

function log(o) {
  sys.print(sys.inspect(o) + "\n");
}


exports.config = function(persistence, hostname, db, username, password) {
  exports.getSession = function() {
    var that = {};
    var conn = new mysql.Client();
    conn.host = hostname
    conn.user = username;
    conn.password = password;
    conn.database = db;
    conn.connect();

    var session = new persistence.Session(that);
    session.transaction = function (fn) {
      return fn(transaction(conn));
    };

    session.close = function() {
      conn.end();
      conn._connection.destroy();
    };
    return session;
  };

  function transaction(conn) {
    var that = {};
    that.executeSql = function (query, args, successFn, errorFn) {
      if(persistence.debug) {
        sys.print(query + "\n");
      }
      function cb(err, result) {
        if(err) {
          log(err.message);
          errorFn(null, err);
          return;
        }
        if (successFn) {
          successFn(result);
        }
      }
      if(!args) {
        conn.query(query, cb);
      } else {
        conn.query(query, args, cb);
      }
    };
    return that;
  }
  exports.mysqlDialect = {
    columnTypeToSql: function(type) {
      switch(type) {
      case 'JSON': return 'TEXT';
      case 'BOOL': return 'INT';
      case 'DATE': return 'INT';
      default: return type;
      }
    },

    // columns is an array of arrays, e.g.
    // [["id", "VARCHAR(32)", "PRIMARY KEY"], ["name", "TEXT"]]
    createTable: function(tableName, columns) {
      var sql = "CREATE TABLE IF NOT EXISTS `" + tableName + "` (";
      var defs = [];
      for(var i = 0; i < columns.length; i++) {
        var column = columns[i];
        defs.push("`" + column[0] + "` " + this.columnTypeToSql(column[1]) + (column[2] ? " " + column[2] : ""));
      }
      sql += defs.join(", ");
      sql += ')';
      return sql;
    },

    // columns is array of column names, e.g.
    // ["id"]
    createIndex: function(tableName, columns) {
      return "CREATE INDEX `" + tableName + "__" + columns.join("_") + 
             "` ON `" + tableName + "` (" + 
             columns.map(function(col) { return "`" + col + "`"; }).join(", ") + ")";
    }
  };

  sql.config(persistence, exports.mysqlDialect);
};

