try {
  if(!window) {
    window = {};
    //exports.console = console;
  }
} catch(e) {
  window = {};
  exports.console = console;
}

var persistence = (window && window.persistence) ? window.persistence : {};

if(!persistence.store) {
  persistence.store = {};
}

persistence.store.titanium = {};

persistence.store.titanium.config = function(persistence, dbname) {
  var conn = null;

  /**
   * Create a transaction
   *
   * @param callback,
   *            the callback function to be invoked when the transaction
   *            starts, taking the transaction object as argument
   */
  persistence.transaction = function (callback) {
    if(!conn) {
      throw new Error("No ongoing database connection, please connect first.");
    } else {
      conn.transaction(callback);
    }
  };

  ////////// Low-level database interface, abstracting from HTML5 and Gears databases \\\\
  persistence.db = persistence.db || {};

  persistence.db.conn = null;

  persistence.db.titanium = {};

  persistence.db.titanium.connect = function (dbname) {
    var that = {};
    var conn = Titanium.Database.open(dbname);

    that.transaction = function (fn) {
      fn(persistence.db.titanium.transaction(conn));
    };
    return that;
  };

  persistence.db.titanium.transaction = function (conn) {
    var that = {};
    that.executeSql = function (query, args, successFn, errorFn) {

      if(persistence.debug) {
        console.log(query, args);
      }
      try {
        var executeVarArgs = [query];
        if (args) {
          executeVarArgs = executeVarArgs.concat(args);
        };
        var rs = Function.apply.call(conn.execute, conn, executeVarArgs);
        if (successFn) {
          var results = [];
          if (rs) {
            while (rs.isValidRow()) {
              var result = {};
              for ( var i = 0; i < rs.fieldCount(); i++) {
                result[rs.fieldName(i)] = rs.field(i);
              }
              results.push(result);
              rs.next();
            }
            rs.close();
          };
          successFn(results);
        }
      } catch(e) {
        if (errorFn) {
          errorFn(null, e);
        };
      }
    };
    return that;
  };

  ///////////////////////// SQLite dialect

  persistence.store.titanium.sqliteDialect = {
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
    },

    typeMapper: {
      idType: persistence.store.sql.defaultTypeMapper.idType,
      classNameType: persistence.store.sql.defaultTypeMapper.classNameType,
      inVar: persistence.store.sql.defaultTypeMapper.inVar,
      outVar: persistence.store.sql.defaultTypeMapper.outVar,
      outId: persistence.store.sql.defaultTypeMapper.outId,
      inIdVar: persistence.store.sql.defaultTypeMapper.inIdVar,
      outIdVar: persistence.store.sql.defaultTypeMapper.outIdVar,
      entityIdToDbId: persistence.store.sql.defaultTypeMapper.entityIdToDbId,
      zeroPaddingMap: ['0000000000000000',
                       '000000000000000',
                       '00000000000000',
                       '0000000000000',
                       '000000000000',
                       '00000000000',
                       '0000000000',
                       '000000000',
                       '00000000',
                       '0000000',
                       '000000',
                       '00000',
                       '0000',
                       '000',
                       '00',
                       '0'],
      zeroPadded: function(val) {
        var result = val.toString();
        if (result.length < 16) {
          return persistence.store.titanium.sqliteDialect.typeMapper.zeroPaddingMap[result.length] + result;
        } else {
          return result;
        };
      },
      columnType: function(type) {
        if (type === 'BIGINT') {
          return 'TEXT';
        } else {
          return persistence.store.sql.defaultTypeMapper.columnType(type);
        };
      },
      dbValToEntityVal: function(val, type){
        if (val === null || val === undefined) {
          return val;
        } else if (type === 'BIGIN') {
          return parseInt(val);
        } else {
          return persistence.store.sql.defaultTypeMapper.dbValToEntityVal(val, type);
        }
      },
      entityValToDbVal: function(val, type){
        if (val === undefined || val === null) {
          return null;
        } else if (type === 'BIGINT') {
          return persistence.store.titanium.sqliteDialect.typeMapper.zeroPadded(val);
        } else {
          return persistence.store.sql.defaultTypeMapper.entityValToDbVal(val, type);
        };
      }
    }
  };

  // Configure persistence for generic sql persistence, using sqliteDialect
  persistence.store.sql.config(persistence, persistence.store.titanium.sqliteDialect);

  // Make the connection
  conn = persistence.db.titanium.connect(dbname);
  if(!conn) {
    throw new Error("No supported database found");
  }
};

try {
  exports.persistence = persistence;
} catch(e) {}
