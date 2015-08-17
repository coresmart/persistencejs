try {
  if (!window) {
    window = {};
    //exports.console = console;
  }
} catch (e) {
  window = {};
  exports.console = console;
}

var persistence = (window && window.persistence) ? window.persistence : {};

if (!persistence.store) {
  persistence.store = {};
}

persistence.store.cordovasql = {};

/**
 * Configure the database connection (either sqliteplugin or websql)
 *
 * @param persistence
 * @param dbname
 * @param dbversion
 * @param description
 * @param size
 * @param backgroundProcessing
 * @param iOSLocation
 */
persistence.store.cordovasql.config = function (persistence, dbname, dbversion, description, size, backgroundProcessing, iOSLocation) {
  var conn = null;

  /**
   * Create a transaction
   *
   * @param callback
   *            the callback function to be invoked when the transaction
   *            starts, taking the transaction object as argument
   */
  persistence.transaction = function (callback) {
    if (!conn) {
      throw new Error("No ongoing database connection, please connect first.");
    } else {
      conn.transaction(callback);
    }
  };

  persistence.db = persistence.db || {};
  persistence.db.implementation = "unsupported";
  persistence.db.conn = null;

  /* Find out if sqliteplugin is loaded. Otherwise, we'll fall back to WebSql */
  if (window && 'sqlitePlugin' in window) {
    persistence.db.implementation = 'sqliteplugin';
  } else if (window && window.openDatabase) {
    persistence.db.implementation = "websql";
  } else {
    // Well, we are stuck!
  }

  /*
   * Cordova SqlitePlugin
   */
  persistence.db.sqliteplugin = {};

  /**
   * Connect to Sqlite plugin database
   *
   * @param dbname
   * @param backgroundProcessing
   * @param iOSLocation
   * @returns {{}}
   */
  persistence.db.sqliteplugin.connect = function (dbname, backgroundProcessing, iOSLocation) {
    var that = {};
    var conn = window.sqlitePlugin.openDatabase({name: dbname, bgType: backgroundProcessing, location: (iOSLocation || 0)});

    that.transaction = function (fn) {
      return conn.transaction(function (sqlt) {
        return fn(persistence.db.websql.transaction(sqlt));
      });
    };
    return that;
  };

  /**
   * Run transaction on Sqlite plugin database
   *
   * @param t
   * @returns {{}}
   */
  persistence.db.sqliteplugin.transaction = function (t) {
    var that = {};
    that.executeSql = function (query, args, successFn, errorFn) {
      if (persistence.debug) {
        console.log(query, args);
      }
      t.executeSql(query, args, function (_, result) {
        if (successFn) {
          var results = [];
          for (var i = 0; i < result.rows.length; i++) {
            results.push(result.rows.item(i));
          }
          successFn(results);
        }
      }, errorFn);
    };
    return that;
  };

  /*
   * WebSQL
   */
  persistence.db.websql = {};

  /**
   * Connect to the default WebSQL database
   *
   * @param dbname
   * @param dbversion
   * @param description
   * @param size
   * @returns {{}}
   */
  persistence.db.websql.connect = function (dbname, dbversion, description, size) {
    var that = {};
    var conn = openDatabase(dbname, dbversion, description, size);

    that.transaction = function (fn) {
      return conn.transaction(function (sqlt) {
        return fn(persistence.db.websql.transaction(sqlt));
      });
    };
    return that;
  };

  /**
   * Run transaction on WebSQL database
   *
   * @param t
   * @returns {{}}
   */
  persistence.db.websql.transaction = function (t) {
    var that = {};
    that.executeSql = function (query, args, successFn, errorFn) {
      if (persistence.debug) {
        console.log(query, args);
      }
      t.executeSql(query, args, function (_, result) {
        if (successFn) {
          var results = [];
          for (var i = 0; i < result.rows.length; i++) {
            results.push(result.rows.item(i));
          }
          successFn(results);
        }
      }, errorFn);
    };
    return that;
  };

  /**
   * Connect() wrapper
   *
   * @param dbname
   * @param dbversion
   * @param description
   * @param size
   * @param backgroundProcessing
   * @param iOSLocation
   * @returns {*}
   */
  persistence.db.connect = function (dbname, dbversion, description, size, backgroundProcessing, iOSLocation) {
    if (persistence.db.implementation == "sqliteplugin") {
      return persistence.db.sqliteplugin.connect(dbname, backgroundProcessing, iOSLocation);
    } else if (persistence.db.implementation == "websql") {
      return persistence.db.websql.connect(dbname, dbversion, description, size);
    }

    return null;
  };

  /**
   * Set the sqlite dialect
   *
   * @type {{createTable: createTable, createIndex: createIndex}}
   */
  persistence.store.cordovasql.sqliteDialect = {

    /**
     * columns is an array of arrays, e.g. [["id", "VARCHAR(32)", "PRIMARY KEY"], ["name", "TEXT"]]
     *
     * @param tableName
     * @param columns
     * @returns {string}
     */
    createTable: function (tableName, columns) {
      var tm = persistence.typeMapper;
      var sql = "CREATE TABLE IF NOT EXISTS `" + tableName + "` (";
      var defs = [];
      for (var i = 0; i < columns.length; i++) {
        var column = columns[i];
        defs.push("`" + column[0] + "` " + tm.columnType(column[1]) + (column[2] ? " " + column[2] : ""));
      }
      sql += defs.join(", ");
      sql += ')';
      return sql;
    },

    /**
     * columns is array of column names, e.g. ["id"]
     * @param tableName
     * @param columns
     * @param options
     * @returns {string}
     */
    createIndex: function (tableName, columns, options) {
      options = options || {};
      return "CREATE " + (options.unique ? "UNIQUE " : "") + "INDEX IF NOT EXISTS `" + tableName + "__" + columns.join("_") +
        "` ON `" + tableName + "` (" +
        columns.map(function (col) {
          return "`" + col + "`";
        }).join(", ") + ")";
    }
  };

  // Configure persistence for generic sql persistence, using sqliteDialect
  persistence.store.sql.config(persistence, persistence.store.cordovasql.sqliteDialect);

  // Make the connection
  conn = persistence.db.connect(dbname, dbversion, description, size, backgroundProcessing, iOSLocation);
  if (!conn) {
    throw new Error("No supported database found in this browser.");
  }
};

try {
  exports.persistence = persistence;
} catch (e) {
}
