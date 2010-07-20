/**
 * This back-end depends on the node.js asynchronous MySQL driver as found on:
 * http://github.com/sidorares/nodejs-mysql-native
 */
var persistencejs = require('./persistence');
var persistence = persistencejs.persistence;
var sys = require('sys');
var createTCPClient = require('./mysql/client').createTCPClient;

/**
 * Based on websql.js from the MySQL Async driver
 * @TODO: Merge with wrapper code below
 */
function MySqlTransaction(connection)
{
  this.connection = connection;
}

MySqlTransaction.prototype.executeSql = function (query, args, rsCallback, errorCallback)
{
  var tx = this;
  try {
    var execCmd = this.connection.execute(query, args);
  } catch(e) {
    sys.print(sys.inspect(e));
  }
  var results = {};
  results.rows = [];
  this.connection.row_as_hash = true;
  tx.clean = true;
  //sys.print(sys.inspect(args));
  execCmd.addListener('row', function(r) {
      results.rows.push(r);
    });
  execCmd.addListener('end', function() {
      if (tx.clean && rsCallback) {
        tx.clean = true;
        rsCallback(tx, results);
      } 
    });
  execCmd.addListener('error', function(err)
    { 
      tx.clean = false;
      sys.print(sys.inspect(err));
      if (errorCallback) 
        errorCallback(tx, err);
      if (tx.onerror)
        tx.onerror(err); 
    });
  tx.last_exec_cmd = execCmd;
}

function openDatabase(db, user, password)
{
  var webdb = {};
  var connection = createTCPClient();
  connection.auth(db, user, password);
  connection.query('SET autocommit=1;');
  connection.auto_prepare = true;
  webdb.transaction = function(txCreated, txError)
  {
    var t = new MySqlTransaction(connection);
    t.onerror = txError;
    //connection.query('BEGIN');
    t.clean = true;
    txCreated(t);
    //var commit = connection.query("");
    //t.last_exec_cmd.addListener('end', function() {   
        //commit.sql = t.clean ? "COMMIT" : "ROLLBACK"
      //});
  }
  webdb.close = function() { 
    connection.close();
  };
  return webdb;
}

persistencejs.console.log = function(s) {
  sys.print(sys.inspect(s) + "\n");
};

var db, username, password;

function configure(_db, _username, _password) {
  db = _db;
  username = _username;
  password = _password;
}

function getSession() {
  var that = {};
  var conn = openDatabase(db, username, password);

  that.transaction = function (fn) {
    return conn.transaction(function (sqlt) {
        return fn(transaction(sqlt));
      });
  };

  var session = new persistence.Session(that);
  session.close = function() {
    conn.close();
  };
  return session;
};

function transaction(t) {
  var that = {};
  that.executeSql = function (query, args, successFn, errorFn) {
    if(persistence.db.log) {
      sys.print(query + "\n");
    }
    t.executeSql(query, args, function (_, result) {
        if (successFn) {
          var results = [];
          for ( var i = 0; i < result.rows.length; i++) {
            results.push(result.rows[i]);
          }
          successFn(results);
        }
      }, errorFn);
  };
  return that;
}

exports.configure = configure;
exports.getSession = getSession;

