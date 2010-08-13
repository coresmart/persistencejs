/**
 * This back-end depends on the node.js asynchronous MySQL driver as found on:
 * http://github.com/stevebest/node-mysql
 * Easy install using npm:
 *   npm install mysql
 */
var persistencejs = require('./persistence');
var persistence = persistencejs.persistence;
var sql = require('./persistence.store.sql');
var sys = require('sys');
var mysql = require('mysql');

persistencejs.console.log = function(s) {
  sys.print(sys.inspect(s) + "\n");
};

var db, username, password;

function log(o) {
  sys.print(sys.inspect(o) + "\n");
}

exports.config = function(persistence, hostname, db, username, password) {

  exports.getSession = function() {
    var that = {};
    var conn = new mysql.Connection(hostname, username, password, db);
    conn.connect();

    var session = new persistence.Session(that);
    session.transaction = function (fn) {
      return fn(transaction(conn));
    };

    session.close = function() {
      conn.close();
    };
    return session;
  };

  function transaction(conn) {
    var that = {};
    that.executeSql = function (query, args, successFn, errorFn) {
      if(persistence.debug) {
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

