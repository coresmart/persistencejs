/**
 * This module depends on the react-native asynchronous SQLite3 driver as found on:
 * https://github.com/almost/react-native-sqlite
 * Easy install using npm:
 *   npm install react-native-sqlite
 *   and follow the instructions provided in the README
 * @author Lukas Reichart
 */
var sys = {};
sys.print = console.log;
var sql = require('./persistence.store.sql');
var sqlite = require('react-native-sqlite');

var db, username, password;

function log(o) {
  sys.print(o + "\n");
}


exports.config = function(persistence, dbPath) {
  exports.getSession = function(cb) {
    var that = {};
    cb = cb || function() { };
    var conn = new sqlite.Database(dbPath, cb);

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

    session.close = function(cb) {
      cb = cb || function() {};
      conn.close(cb);
    };
    return session;
  };

  function transaction(conn){
    var that = {};
    // TODO: add check for db opened or closed
    that.executeSql = function(query, args, successFn, errorFn){
      var queryResult = [];
      function cb(err){
        if (err) {
          log(err.message);
          that.errorHandler && that.errorHandler(err);
          errorFn && errorFn(null, err);
          return;
        }
        if (successFn) {
          if( !queryResult ) {
            queryResult = [];
          }
          successFn(queryResult);
        }
      }
      function rowCallback(row) {
        queryResult.push(row);
      }
      if (persistence.debug) {
        console.log(query + "\n");
        //args && args.length > 0 && sys.print(args.join(",") + "\n")
      }
      if (!args) {
        conn.executeSQL(query, [], rowCallback, cb );
      }
      else {
        conn.executeSQL(query, args, rowCallback, cb );
      }
    }

    that.commit = function(session, callback){
      session.flush(that, function(){
        that.executeSQL("COMMIT", [], function(){}, callback);
      })
    }

    that.rollback = function(session, callback){
      that.executeSQL("ROLLBACK", [], function() {}, function() {
        session.clean();
        callback();
      });
    }
    return that;
  }

  ///////////////////////// SQLite dialect

  persistence.sqliteDialect = {
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
      sql += ')';
      return sql;
    },

    // columns is array of column names, e.g.
    // ["id"]
    createIndex: function(tableName, columns, options) {
      options = options || {};
      return "CREATE "+(options.unique?"UNIQUE ":"")+"INDEX IF NOT EXISTS `" + tableName + "__" + columns.join("_") +
        "` ON `" + tableName + "` (" +
        columns.map(function(col) { return "`" + col + "`"; }).join(", ") + ")";
    }
  };

  sql.config(persistence, persistence.sqliteDialect);
};

