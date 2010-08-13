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

persistence.store.websql = {};

(function() {

    var generatedTables = {}; // set


    /**
     * Connect to a database
     * 
     * @param dbname
     *            the name of the database
     * @param description
     *            a human-readable description of the database
     * @param size
     *            the maximum size of the database in bytes
     * @param version
     *            the database version
     */
    function Store(dbname, description, size, version) {
      this.conn = persistence.db.connect(dbname, description, size);
      if(!this.conn) {
        throw "No supported database found in this browser.";
      }
    };

    persistence.store.websql = Store;

    /**
     * Create a transaction
     * 
     * @param callback,
     *            the callback function to be invoked when the transaction
     *            starts, taking the transaction object as argument
     */
    Store.prototype.transaction = function (callback) {
      if(!this.conn) {
        throw "No ongoing database connection, please connect first.";
      } else {
        this.conn.transaction(callback);
      }
    };

    function columnTypeToSqliteType(type) {
      switch(type) {
      case 'JSON': return 'TEXT';
      case 'BOOL': return 'INT';
      case 'DATE': return 'INT';
      default: return type;
      }
    }

    /**
     * Synchronize the data model with the database, creates table that had not
     * been defined before
     * 
     * @param tx
     *            transaction object to use (optional)
     * @param callback
     *            function to be called when synchronization has completed,
     *            takes started transaction as argument
     */
    Store.prototype.schemaSync = function (tx, callback, emulate) {
      var args = argspec.getArgs(arguments, [
          { name: "tx", optional: true, check: persistence.isTransaction, defaultValue: null },
          { name: "callback", optional: true, check: argspec.isCallback(), defaultValue: function(){} },
          { name: "emulate", optional: true, check: argspec.hasType('boolean') }
        ]);
      tx = args.tx;
      callback = args.callback;
      emulate = args.emulate;

      if(!tx) {
        var store = this;
        this.transaction(function(tx) { store.schemaSync(tx, callback, emulate); });
        return;
      }
      var queries = [], meta, rowDef, otherMeta, tableName;

      var entityMeta = persistence.getEntityMeta();
      for (var entityName in entityMeta) {
        if (entityMeta.hasOwnProperty(entityName)) {
          meta = entityMeta[entityName];
          rowDef = '';
          for (var prop in meta.fields) {
            if (meta.fields.hasOwnProperty(prop)) {
              rowDef += "`" + prop + "` " + columnTypeToSqliteType(meta.fields[prop]) + ", ";
            }
          }
          for (var rel in meta.hasOne) {
            if (meta.hasOne.hasOwnProperty(rel)) {
              otherMeta = meta.hasOne[rel].type.meta;
              rowDef += rel + " VARCHAR(32), ";
              queries.push( [
                  //"CREATE INDEX IF NOT EXISTS `" + meta.name + "_" + rel + "_" + otherMeta.name
                  "CREATE INDEX `" + meta.name + "_" + rel + "_" + otherMeta.name
                  + "` ON `" + meta.name + "` (`" + rel + "`)", null ]);
            }
          }
          for (var rel in meta.hasMany) {
            if (meta.hasMany.hasOwnProperty(rel) && meta.hasMany[rel].manyToMany) {
              tableName = meta.hasMany[rel].tableName;
              if (!generatedTables[tableName]) {
                var otherMeta = meta.hasMany[rel].type.meta;
                queries.push( [
                    //"CREATE INDEX IF NOT EXISTS `" + tableName + "_" + meta.name + "_" + rel + "` ON `"
                    "CREATE INDEX `" + tableName + "_" + meta.name + "_" + rel + "` ON `"
                    + tableName + "` (`" + meta.name + "_" + rel + "`)", null ]);
                queries.push( [
                    //"CREATE INDEX IF NOT EXISTS `" + tableName + "_" + otherMeta.name + "_"
                    "CREATE INDEX `" + tableName + "_" + otherMeta.name + "_"
                    + meta.hasMany[rel].inverseProperty + "` ON `" + tableName + "` (`"
                    + otherMeta.name + "_" + meta.hasMany[rel].inverseProperty + "`)", null ]);
                queries.push( [
                    "CREATE TABLE IF NOT EXISTS `" + tableName + "` (`" + meta.name + "_" + rel
                    + "` VARCHAR(32), `" + otherMeta.name + '_'
                    + meta.hasMany[rel].inverseProperty + "` VARCHAR(32))", null ]);
                generatedTables[tableName] = true;
              }
            }
          }
          rowDef = rowDef.substring(0, rowDef.length - 2);
          generatedTables[meta.name] = true;
          queries.push( [
              "CREATE TABLE IF NOT EXISTS `" + meta.name + "` ( id VARCHAR(32) PRIMARY KEY, " + rowDef + ")",
              null ]);
        }
      }
      if(emulate) {
        // Done
        callback(tx);
      } else {
        var fns = persistence.schemaSyncHooks;
        for(var i = 0; i < fns.length; i++) {
          fns[i](tx);
        }
        executeQueriesSeq(tx, queries, function() {
            callback(tx);
          });
      }
    };

    /**
     * Persists all changes to the database
     * 
     * @param session
     *            session object
     * @param tx
     *            transaction to use
     * @param callback
     *            function to be called when done
     */
    Store.prototype.flush = function (session, tx, callback) {
      var store = this;
      if(!tx) {
        this.transaction(function(tx) { store.flush(session, tx, callback); });
        return;
      }
      var fns = persistence.flushHooks;
      for(var i = 0; i < fns.length; i++) {
        fns[i](session, tx);
      }

      var persistObjArray = [];
      for (var id in session.trackedObjects) {
        if (session.trackedObjects.hasOwnProperty(id)) {
          persistObjArray.push(session.trackedObjects[id]);
        }
      }
      var removeObjArray = [];
      for (var id in session.objectsToRemove) {
        if (session.objectsToRemove.hasOwnProperty(id)) {
          removeObjArray.push(session.objectsToRemove[id]);
          delete session.trackedObjects[id]; // Stop tracking
        }
      }
      session.objectsToRemove = {};
      if(callback) {
        function removeOneObject() {
          var obj = removeObjArray.pop();
          remove(obj, tx, function () {
              if (removeObjArray.length > 0) {
                removeOneObject();
              } else if (callback) {
                callback();
              }
            });
        }
        function persistOneObject () {
          var obj = persistObjArray.pop();
          save(session, obj, tx, function () {
              if (persistObjArray.length > 0) {
                persistOneObject();
              } else if(removeObjArray.length > 0) {
                removeOneObject();
              } else if (callback) {
                callback();
              }
            });
        }
        if (persistObjArray.length > 0) {
          persistOneObject();
        } else if(removeObjArray.length > 0) {
          removeOneObject();
        } else if(callback) {
          callback();
        }
      } else { // More efficient
        for(var i = 0; i < persistObjArray.length; i++) {
          save(session, persistObjArray[i], tx);
        }
        for(var i = 0; i < removeObjArray.length; i++) {
          remove(removeObjArray[i], tx);
        }
      }
    };

    /**
     * Remove all tables in the database (as defined by the model)
     */
    Store.prototype.reset = function (session, tx, callback) {
      var args = argspec.getArgs(arguments, [
          { name: "tx", optional: true, check: persistence.isTransaction, defaultValue: null },
          { name: "callback", optional: true, check: argspec.isCallback(), defaultValue: function(){} }
        ]);
      tx = args.tx;
      callback = args.callback;

      var session = this;
      if(!tx) {
        this.transaction(function(tx) { session.reset(tx, callback); });
        return;
      }
      // First sync the schema
      session.schemaSync(tx, function() {
          var tableArray = [];
          for (var p in generatedTables) {
            if (generatedTables.hasOwnProperty(p)) {
              tableArray.push(p);
            }
          }
          function dropOneTable () {
            var tableName = tableArray.pop();
            tx.executeSql("DROP TABLE " + tableName, null, function () {
                if (tableArray.length > 0) {
                  dropOneTable();
                } else {
                  if(callback) callback();
                }
              });
          }
          if(tableArray.length > 0) {
            dropOneTable();
          } else {
            if(callback) callback();
          }

          session.clean();
          generatedTables = {};
        }, true);
    };

    /**
     * Converts a database row into an entity object
     */
    persistence.rowToEntity = function (entityName, row, prefix) {
      prefix = prefix || '';
      if (this.trackedObjects[row[prefix + "id"]]) { // Cached version
        return this.trackedObjects[row[prefix + "id"]];
      }
      var rowMeta = persistence.getMeta(entityName);
      var ent = persistence.define(entityName); // Get entity
      if(!row[prefix+'id']) { // null value, no entity found
        return null;
      }
      var o = new ent();
      o.id = row[prefix + 'id'];
      o._new = false;
      for ( var p in row) {
        if (row.hasOwnProperty(p)) {
          if (p.substring(0, prefix.length) === prefix) {
            var prop = p.substring(prefix.length);
            if (prop != 'id') {
              o._data[prop] = this.dbValToEntityVal(row[p], rowMeta.fields[prop]);
            }
          }
        }
      }
      return o;
    }

    /**
     * Converts a value from the database to a value suitable for the entity
     * (also does type conversions, if necessary)
     */
    persistence.dbValToEntityVal = function (val, type) {
      if(val === null || val === undefined) {
        return val;
      }
      switch (type) {
      case 'DATE':
        // SQL is in seconds and JS in miliseconds
        return new Date(parseInt(val, 10) * 1000);
      case 'BOOL':
        return val == 1;
        break;
      case 'JSON':
        if(val) {
          return JSON.parse(val);
        } else {
          return val;
        }
        break;
      default:
        return val;
      }
    }

    /**
     * Converts an entity value to a database value (inverse of
     *   dbValToEntityVal)
     */
    persistence.entityValToDbVal = function (val, type) {
      if (val === undefined || val === null) {
        return null;
      } else if (type === 'JSON' && val) {
        return JSON.stringify(val);
      } else if (val.id) {
        return val.id;
      } else if (type === 'BOOL') {
        return val ? 1 : 0;
      } else if (type === 'DATE' || val.getTime) {
        // In order to make SQLite Date/Time functions work we should store
        // values in seconds and not as miliseconds as JS Date.getTime()
        return Math.round(val.getTime() / 1000);
      } else {
        return val;
      }
    };

    /**
     * Internal function to persist an object to the database
     * this function is invoked by persistence.flush()
     */
    function save (session, obj, tx, callback) {
      var meta = persistence.getMeta(obj._type);
      var properties = [];
      var values = [];
      var qs = [];
      var propertyPairs = [];
      if(obj._new) { // Mark all properties dirty
        for (var p in meta.fields) {
          if(meta.fields.hasOwnProperty(p)) {
            obj._dirtyProperties[p] = true;
          }
        }
      } 
      for ( var p in obj._dirtyProperties) {
        if (obj._dirtyProperties.hasOwnProperty(p)) {
          properties.push("`" + p + "`");
          values.push(persistence.entityValToDbVal(obj._data[p], meta.fields[p]));
          qs.push('?');
          propertyPairs.push("`" + p + "` = ?");
        }
      }
      var additionalQueries = [];
      for(var p in meta.hasMany) {
        if(meta.hasMany.hasOwnProperty(p)) {
          additionalQueries = additionalQueries.concat(persistence.get(obj, p).persistQueries());
        }
      }
      executeQueriesSeq(tx, additionalQueries, function() {
          if (properties.length === 0) { // Nothing changed
            if(callback) callback();
            return;
          }
          obj._dirtyProperties = {};
          if (obj._new) {
            properties.push('id');
            values.push(obj.id);
            qs.push('?');
            var sql = "INSERT INTO `" + obj._type + "` (" + properties.join(", ") + ") VALUES (" + qs.join(', ') + ")";
            obj._new = false;
            tx.executeSql(sql, values, callback);
          } else {
            var sql = "UPDATE `" + obj._type + "` SET " + propertyPairs.join(',') + " WHERE id = '" + obj.id + "'";
            tx.executeSql(sql, values, callback);
          }
        });
    }

    function remove (obj, tx, callback) {
      var queries = [["DELETE FROM `" + obj._type + "` WHERE id = '" + obj.id + "'", null]];
      var meta = persistence.getMeta(obj._type);
      for (var rel in meta.hasMany) {
        if (meta.hasMany.hasOwnProperty(rel) && meta.hasMany[rel].manyToMany) {
          var tableName = meta.hasMany[rel].tableName;
          //var inverseProperty = meta.hasMany[rel].inverseProperty;
          queries.push(["DELETE FROM `" + tableName + "` WHERE `" + meta.name + '_' + rel + "` = '" + obj.id + "'", null]);
        }
      }
      executeQueriesSeq(tx, queries, callback);
    }

    /**
     * Utility function to execute a series of queries in an asynchronous way
     * @param tx the transaction to execute the queries on
     * @param queries an array of [query, args] tuples
     * @param callback the function to call when all queries have been executed
     */
    function executeQueriesSeq (tx, queries, callback) {
      // queries.reverse();
      var callbackArgs = [];
      for ( var i = 3; i < arguments.length; i++) {
        callbackArgs.push(arguments[i]);
      }
      function executeOne () {
        var queryTuple = queries.pop();

        var oneFn = function () {
          if (queries.length > 0) {
            executeOne();
          } else if (callback) {
            callback.apply(null, callbackArgs);
          }
        };
        tx.executeSql(queryTuple[0], queryTuple[1], oneFn, function(_, err) {
            console.log(err.message);
            oneFn();
          });
      }
      if (queries.length > 0) {
        executeOne();
      } else if (callback) {
        callback.apply(this, callbackArgs);
      }
    }

    persistence.executeQueriesSeq = executeQueriesSeq;


    // Filters

    persistence.NullFilter.prototype.sql = function (alias, values) {
      return "1=1";
    };

    persistence.AndFilter.prototype.sql = function (alias, values) {
      return "(" + this.left.sql(alias, values) + " AND "
      + this.right.sql(alias, values) + ")";
    };

    persistence.PropertyFilter.prototype.sql = function (alias, values) {
      if (this.operator === '=' && this.value === null) {
        return "`" + alias + '`.`' + this.property + "` IS NULL";
      } else if (this.operator === '!=' && this.value === null) {
        return "`" + alias + '`.`' + this.property + "` IS NOT NULL";
      } else if (this.operator === 'in') {
        var vals = this.value;
        var qs = [];
        for(var i = 0; i < vals.length; i++) {
          qs.push('?');
          values.push(persistence.entityValToDbVal(vals[i]));
        }
        if(vals.length === 0) {
          // Optimize this a little
          return "1 = 0";
        } else {
          return "`" + alias + '`.`' + this.property + "` IN (" + qs.join(', ') + ")";
        }
      } else if (this.operator === 'not in') {
        var vals = this.value;
        var qs = [];
        for(var i = 0; i < vals.length; i++) {
          qs.push('?');
          values.push(persistence.entityValToDbVal(vals[i]));
        }

        if(vals.length === 0) {
          // Optimize this a little
          return "1 = 1";
        } else {
          return "`" + alias + '`.`' + this.property + "` NOT IN (" + qs.join(', ') + ")";
        }
      } else {
        var value = this.value;
        if(value === true || value === false) {
          value = value ? 1 : 0;
        }
        values.push(persistence.entityValToDbVal(value));
        return "`" + alias + '`.`' + this.property + "` " + this.operator + " ?";
      }
    };

    // QueryColleciton's list

    /**
     * Asynchronous call to actually fetch the items in the collection
     * @param tx transaction to use
     * @param callback function to be called taking an array with 
     *   result objects as argument
     */
    persistence.DbQueryCollection.prototype.list = function (tx, callback) {
      var args = argspec.getArgs(arguments, [
          { name: 'tx', optional: true, check: persistence.isTransaction, defaultValue: null },
          { name: 'callback', optional: false, check: argspec.isCallback() }
        ]);
      tx = args.tx;
      callback = args.callback;

      var that = this;
      var session = this._session;
      if(!tx) { // no transaction supplied
        session.transaction(function(tx) {
            that.list(tx, callback);
          });
        return;
      }
      var entityName = this._entityName;
      var meta = persistence.getMeta(entityName);

      function selectAll (meta, tableAlias, prefix) {
        var selectFields = [ "`" + tableAlias + "`.id AS " + prefix + "id" ];
        for ( var p in meta.fields) {
          if (meta.fields.hasOwnProperty(p)) {
            selectFields.push("`" + tableAlias + "`.`" + p + "` AS `"
              + prefix + p + "`");
          }
        }
        for ( var p in meta.hasOne) {
          if (meta.hasOne.hasOwnProperty(p)) {
            selectFields.push("`" + tableAlias + "`.`" + p + "` AS `"
              + prefix + p + "`");
          }
        }
        return selectFields;
      }
      var args = [];
      var mainPrefix = entityName + "_";

      var mainAlias = 'root';
      var selectFields = selectAll(meta, mainAlias, mainPrefix);

      var joinSql = this._additionalJoinSqls.join(' ');

      for ( var i = 0; i < this._prefetchFields.length; i++) {
        var prefetchField = this._prefetchFields[i];
        var thisMeta = meta.hasOne[prefetchField].type.meta;
        var tableAlias = thisMeta.name + '_' + prefetchField + "_tbl";
        selectFields = selectFields.concat(selectAll(thisMeta, tableAlias,
            prefetchField + "_"));
        joinSql += "LEFT JOIN `" + thisMeta.name + "` AS `" + tableAlias
        + "` ON `" + tableAlias + "`.`id` = `" + mainAlias + '`.`' + prefetchField + "` ";

      }

      var whereSql = "WHERE "
      + [ this._filter.sql(mainAlias, args) ].concat(
        this._additionalWhereSqls).join(' AND ');

      var sql = "SELECT " + selectFields.join(", ") + " FROM `" + entityName
      + "` AS `" + mainAlias + "` " + joinSql + " " + whereSql;

      if(this._additionalGroupSqls.length > 0) {
        sql += this._additionalGroupSqls.join(' ');
      }

      if(this._orderColumns.length > 0) {
        sql += " ORDER BY "
        + this._orderColumns.map(
          function (c) {
            return "`" + mainPrefix + c[0] + "` "
            + (c[1] ? "ASC" : "DESC");
          }).join(", ");
      }
      if(this._limit >= 0) {
        sql += " LIMIT " + this._limit;
      }
      if(this._skip > 0) {
        sql += " OFFSET " + this._skip;
      }
      session.flush(tx, function () {
          tx.executeSql(sql, args, function (rows) {
              var results = [];
              for ( var i = 0; i < rows.length; i++) {
                var r = rows[i];
                var e = session.rowToEntity(entityName, r, mainPrefix);
                for ( var j = 0; j < that._prefetchFields.length; j++) {
                  var prefetchField = that._prefetchFields[j];
                  var thisMeta = meta.hasOne[prefetchField].type.meta;
                  e[prefetchField] = session.rowToEntity(thisMeta.name, r, prefetchField + '_');
                }
                results.push(e);
                session.add(e);
              }
              callback(results);
              that.triggerEvent('list', that, results);
            });
        });
    };

    /**
     * Asynchronous call to remove all the items in the collection. 
     * Note: does not only remove the items from the collection, but
     * the items themselves.
     * @param tx transaction to use
     * @param callback function to be called when clearing has completed
     */
    persistence.DbQueryCollection.prototype.destroyAll = function (tx, callback) {
      var args = argspec.getArgs(arguments, [
          { name: 'tx', optional: true, check: persistence.isTransaction, defaultValue: null },
          { name: 'callback', optional: true, check: argspec.isCallback(), defaultValue: function(){} }
        ]);
      tx = args.tx;
      callback = args.callback;

      var that = this;
      var session = this._session;
      if(!tx) { // no transaction supplied
        session.transaction(function(tx) {
            that.destroyAll(tx, callback);
          });
        return;
      } 
      var entityName = this._entityName;

      var args = [];
      var whereSql = "WHERE "
      + [ this._filter.sql("", args) ].concat(
        this._additionalWhereSqls).join(' AND ');

      var sql = "DELETE FROM `" + entityName + "` " + whereSql;

      session.flush(tx, function () {
          tx.executeSql(sql, args, callback);
        });
    };

    /**
     * Asynchronous call to count the number of items in the collection.
     * @param tx transaction to use
     * @param callback function to be called when clearing has completed
     */
    persistence.DbQueryCollection.prototype.count = function (tx, callback) {
      var args = argspec.getArgs(arguments, [
          { name: 'tx', optional: true, check: persistence.isTransaction, defaultValue: null },
          { name: 'callback', optional: false, check: argspec.isCallback() }
        ]);
      tx = args.tx;
      callback = args.callback;

      var that = this;
      var session = this._session;
      if(tx && !tx.executeSql) { // provided callback as first argument
        callback = tx;
        tx = null;
      } 
      if(!tx) { // no transaction supplied
        session.transaction(function(tx) {
            that.count(tx, callback);
          });
        return;
      } 
      var entityName = this._entityName;

      var args = [];
      var whereSql = "WHERE "
      + [ this._filter.sql("root", args) ].concat(
        this._additionalWhereSqls).join(' AND ');

      var sql = "SELECT COUNT(*) AS cnt FROM `" + entityName + "` AS `root` " + whereSql;

      session.flush(tx, function () {
          tx.executeSql(sql, args, function(results) {
              callback(results[0].cnt);
            });
        });
    };

    persistence.ManyToManyDbQueryCollection.prototype.persistQueries = function() {
      var queries = [];
      var meta = persistence.getMeta(this._obj._type);
      var inverseMeta = meta.hasMany[this._coll].type.meta;
      // Added
      for(var i = 0; i < this._localAdded.length; i++) {
        queries.push(["INSERT INTO " + meta.hasMany[this._coll].tableName + 
              " (`" + meta.name + "_" + this._coll + "`, `" + 
              inverseMeta.name + '_' + meta.hasMany[this._coll].inverseProperty +
              "`) VALUES (?, ?)", [this._obj.id, this._localAdded[i].id]]);
      }
      this._localAdded = [];
      // Removed
      for(var i = 0; i < this._localRemoved.length; i++) {
        queries.push(["DELETE FROM  " + meta.hasMany[this._coll].tableName + 
              " WHERE `" + meta.name + "_" + this._coll + "` = ? AND `" + 
              inverseMeta.name + '_' + meta.hasMany[this._coll].inverseProperty +
              "` = ?", [this._obj.id, this._localRemoved[i].id]]);
      }
      this._localRemoved = [];
      return queries;
    };

    ////////// Low-level database interface, abstracting from HTML5 and Gears databases \\\\
    persistence.db = persistence.db || {};

    persistence.db.implementation = "unsupported";
    persistence.db.conn = null;
    persistence.db.log = true;

    // window object does not exist on Qt Declarative UI (http://doc.trolltech.org/4.7-snapshot/declarativeui.html)
    if (window && window.openDatabase) {
      persistence.db.implementation = "html5";
    } else if (window && window.google && google.gears) {
      persistence.db.implementation = "gears";
    } else {
      try {
        if (openDatabaseSync) {
          // TODO: find a browser that implements openDatabaseSync and check out if
          //       it is attached to the window or some other object
          persistence.db.implementation = "html5-sync";
        }
      } catch(e) {
      }
    }

    persistence.db.html5 = {};

    persistence.db.html5.connect = function (dbname, description, size) {
      var that = {};
      var conn = openDatabase(dbname, '1.0', description, size);

      that.transaction = function (fn) {
        return conn.transaction(function (sqlt) {
            return fn(persistence.db.html5.transaction(sqlt));
          });
      };
      return that;
    };

    persistence.db.html5.transaction = function (t) {
      var that = {};
      that.executeSql = function (query, args, successFn, errorFn) {
        if(persistence.db.log) {
          console.log(query, args);
        }
        t.executeSql(query, args, function (_, result) {
            if (successFn) {
              var results = [];
              for ( var i = 0; i < result.rows.length; i++) {
                results.push(result.rows.item(i));
              }
              successFn(results);
            }
          }, errorFn);
      };
      return that;
    };

    persistence.db.html5Sync = {};

    persistence.db.html5Sync.connect = function (dbname, description, size) {
      var that = {};
      var conn = openDatabaseSync(dbname, '1.0', description, size);

      that.transaction = function (fn) {
        return conn.transaction(function (sqlt) {
            return fn(persistence.db.html5Sync.transaction(sqlt));
          });
      };
      return that;
    };

    persistence.db.html5Sync.transaction = function (t) {
      var that = {};
      that.executeSql = function (query, args, successFn, errorFn) {
        if (args == null) args = [];

        if(persistence.db.log) {
          console.log(query, args);
        }

        var result = t.executeSql(query, args);
        if (result) {
          if (successFn) {
            var results = [];
            for ( var i = 0; i < result.rows.length; i++) {
              results.push(result.rows.item(i));
            }
            successFn(results);
          }
        }
      };
      return that;
    };

    persistence.db.gears = {};

    persistence.db.gears.connect = function (dbname) {
      var that = {};
      var conn = google.gears.factory.create('beta.database');
      conn.open(dbname);

      that.transaction = function (fn) {
        fn(persistence.db.gears.transaction(conn));
      };
      return that;
    };

    persistence.db.gears.transaction = function (conn) {
      var that = {};
      that.executeSql = function (query, args, successFn, errorFn) {
        if(persistence.db.log) {
          console.log(query, args);
        }
        var rs = conn.execute(query, args);
        if (successFn) {
          var results = [];
          while (rs.isValidRow()) {
            var result = {};
            for ( var i = 0; i < rs.fieldCount(); i++) {
              result[rs.fieldName(i)] = rs.field(i);
            }
            results.push(result);
            rs.next();
          }
          successFn(results);
        }
      };
      return that;
    };

    persistence.db.connect = function (dbname, description, size) {
      if (persistence.db.implementation == "html5") {
        return persistence.db.html5.connect(dbname, description, size);
      } else if (persistence.db.implementation == "html5-sync") {
        return persistence.db.html5Sync.connect(dbname, description, size);
      } else if (persistence.db.implementation == "gears") {
        return persistence.db.gears.connect(dbname);
      }
    };
  })();

try {
  exports.persistence = persistence;
} catch(e) {}
