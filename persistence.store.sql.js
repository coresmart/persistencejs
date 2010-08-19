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

persistence.store.sql = {};

persistence.store.sql.config = function(persistence, dialect) {
  var argspec = persistence.argspec;

  persistence.generatedTables = {}; // set

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
  persistence.schemaSync = function (tx, callback, emulate) {
    var args = argspec.getArgs(arguments, [
        { name: "tx", optional: true, check: persistence.isTransaction, defaultValue: null },
        { name: "callback", optional: true, check: argspec.isCallback(), defaultValue: function(){} },
        { name: "emulate", optional: true, check: argspec.hasType('boolean') }
      ]);
    tx = args.tx;
    callback = args.callback;
    emulate = args.emulate;

    if(!tx) {
      var session = this;
      this.transaction(function(tx) { session.schemaSync(tx, callback, emulate); });
      return;
    }
    var queries = [], meta, colDefs, otherMeta, tableName;

    var entityMeta = persistence.getEntityMeta();
    for (var entityName in entityMeta) {
      if (entityMeta.hasOwnProperty(entityName)) {
        meta = entityMeta[entityName];
        colDefs = [];
        for (var prop in meta.fields) {
          if (meta.fields.hasOwnProperty(prop)) {
            colDefs.push([prop, meta.fields[prop]]);
          }
        }
        for (var rel in meta.hasOne) {
          if (meta.hasOne.hasOwnProperty(rel)) {
            otherMeta = meta.hasOne[rel].type.meta;
            colDefs.push([rel, "VARCHAR(32)"]);
            queries.push([dialect.createIndex(meta.name, [rel]), null]);
          }
        }
        for (var rel in meta.hasMany) {
          if (meta.hasMany.hasOwnProperty(rel) && meta.hasMany[rel].manyToMany) {
            tableName = meta.hasMany[rel].tableName;
            if (!persistence.generatedTables[tableName]) {
              var otherMeta = meta.hasMany[rel].type.meta;
              queries.push([dialect.createIndex(tableName, [meta.name + "_" + rel]), null]);
              queries.push([dialect.createIndex(tableName, [otherMeta.name + "_" + meta.hasMany[rel].inverseProperty]), null]);
              queries.push([dialect.createTable(tableName, [[meta.name + "_" + rel, "VARCHAR(32)"], [otherMeta.name + "_" + meta.hasMany[rel].inverseProperty, "VARCHAR(32)"]]), null]);
              persistence.generatedTables[tableName] = true;
            }
          }
        }
        colDefs.push(["id", "VARCHAR(32)", "PRIMARY KEY"]);
        persistence.generatedTables[meta.name] = true;
        queries.push([dialect.createTable(meta.name, colDefs), null]);
      }
    }
    var fns = persistence.schemaSyncHooks;
    for(var i = 0; i < fns.length; i++) {
      fns[i](tx);
    }
    if(emulate) {
      // Done
      callback(tx);
    } else {
      executeQueriesSeq(tx, queries, function() {
          callback(tx);
        });
    }
  };

  /**
   * Persists all changes to the database
   * 
   * @param tx
   *            transaction to use
   * @param callback
   *            function to be called when done
   */
  persistence.flush = function (tx, callback) {
    var args = argspec.getArgs(arguments, [
        { name: "tx", optional: true, check: persistence.isTransaction },
        { name: "callback", optional: true, check: argspec.isCallback(), defaultValue: function(){} }
      ]);
    tx = args.tx;
    callback = args.callback;

    var session = this;
    if(!tx) {
      this.transaction(function(tx) { session.flush(tx, callback); });
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
        save(obj, tx, function () {
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
        save(persistObjArray[i], tx);
      }
      for(var i = 0; i < removeObjArray.length; i++) {
        remove(removeObjArray[i], tx);
      }
    }
  };

  /**
   * Remove all tables in the database (as defined by the model)
   */
  persistence.reset = function (tx, callback) {
    var args = argspec.getArgs(arguments, [
        { name: "tx", optional: true, check: persistence.isTransaction, defaultValue: null },
        { name: "callback", optional: true, check: argspec.isCallback(), defaultValue: function(){} }
      ]);
    tx = args.tx;
    callback = args.callback;

    var session = this;
    if(!tx) {
      session.transaction(function(tx) { session.reset(tx, callback); });
      return;
    }
    // First emulate syncing the schema (to know which tables were created)
    this.schemaSync(tx, function() {
        var tableArray = [];
        for (var p in persistence.generatedTables) {
          if (persistence.generatedTables.hasOwnProperty(p)) {
            tableArray.push(p);
          }
        }
        function dropOneTable () {
          var tableName = tableArray.pop();
          tx.executeSql("DROP TABLE IF EXISTS " + tableName, null, function () {
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
        persistence.generatedTables = {};
      }, true);
  };

  /**
   * Converts a database row into an entity object
   */
  function rowToEntity(session, entityName, row, prefix) {
    prefix = prefix || '';
    if (session.trackedObjects[row[prefix + "id"]]) { // Cached version
      return session.trackedObjects[row[prefix + "id"]];
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
            o._data[prop] = dbValToEntityVal(row[p], rowMeta.fields[prop]);
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
  function dbValToEntityVal(val, type) {
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
   * Converts an entity value to a database value, inverse of
   *   dbValToEntityVal
   */
  function entityValToDbVal(val, type) {
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
  }

  /**
   * Internal function to persist an object to the database
   * this function is invoked by persistence.flush()
   */
  function save(obj, tx, callback) {
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
        values.push(entityValToDbVal(obj._data[p], meta.fields[p]));
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

  /////////////////////////// QueryCollection patches to work in SQL environment

  /**
   * Function called when session is flushed, returns list of SQL queries to execute 
   * (as [query, arg] tuples)
   */
  persistence.QueryCollection.prototype.persistQueries = function() { return []; };

  var oldQCClone = persistence.QueryCollection.prototype.clone;

  persistence.QueryCollection.prototype.clone = function (cloneSubscribers) {
    var c = oldQCClone.call(this, cloneSubscribers);
    c._additionalJoinSqls = this._additionalJoinSqls.slice(0);
    c._additionalWhereSqls = this._additionalWhereSqls.slice(0);
    c._additionalGroupSqls = this._additionalGroupSqls.slice(0);
    c._manyToManyFetch = this._manyToManyFetch;
    return c;
  };

  var oldQCInit = persistence.QueryCollection.prototype.init;

  persistence.QueryCollection.prototype.init = function(session, entityName, constructor) {
    oldQCInit.call(this, session, entityName, constructor);
    this._manyToManyFetch = null;
    this._additionalJoinSqls = [];
    this._additionalWhereSqls = [];
    this._additionalGroupSqls = [];
  };

  var oldQCToUniqueString = persistence.QueryCollection.prototype.toUniqueString;

  persistence.QueryCollection.prototype.toUniqueString = function() {
    var s = oldQCToUniqueString.call(this);
    s += '|JoinSQLs:';
    for(var i = 0; i < this._additionalJoinSqls.length; i++) {
      s += this._additionalJoinSqls[i];
    }
    s += '|WhereSQLs:';
    for(var i = 0; i < this._additionalWhereSqls.length; i++) {
      s += this._additionalWhereSqls[i];
    }
    s += '|GroupSQLs:';
    for(var i = 0; i < this._additionalGroupSqls.length; i++) {
      s += this._additionalGroupSqls[i];
    }
    if(this._manyToManyFetch) {
      s += '|ManyToManyFetch:';
      s += JSON.stringify(this._manyToManyFetch); // TODO: Do something more efficient
    }
    return s;
  };

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
        values.push(entityValToDbVal(vals[i]));
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
        values.push(entityValToDbVal(vals[i]));
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
      values.push(entityValToDbVal(value));
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

    var joinSql = '';
    var additionalWhereSqls = this._additionalWhereSqls.slice(0);
    var mtm = this._manyToManyFetch;
    if(mtm) {
      joinSql += "LEFT JOIN `" + mtm.table + "` AS mtm ON mtm.`" + mtm.inverseProp + "` = `root`.`id` ";
      additionalWhereSqls.push("mtm.`" + mtm.prop + "` = '" + mtm.id + "'");
    }

    joinSql += this._additionalJoinSqls.join(' ');

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
    + [ this._filter.sql(mainAlias, args) ].concat(additionalWhereSqls).join(' AND ');

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
              var e = rowToEntity(session, entityName, r, mainPrefix);
              for ( var j = 0; j < that._prefetchFields.length; j++) {
                var prefetchField = that._prefetchFields[j];
                var thisMeta = meta.hasOne[prefetchField].type.meta;
                e[prefetchField] = rowToEntity(session, thisMeta.name, r, prefetchField + '_');
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

    var joinSql = '';
    var additionalWhereSqls = this._additionalWhereSqls.slice(0);
    var mtm = this._manyToManyFetch;
    if(mtm) {
      joinSql += "LEFT JOIN `" + mtm.table + "` AS mtm ON mtm.`" + mtm.inverseProp + "` = `root`.`id` ";
      additionalWhereSqls.push("mtm.`" + mtm.prop + "` = '" + mtm.id + "'");
    }

    joinSql += this._additionalJoinSqls.join(' ');

    var args = [];
    var whereSql = "WHERE "
    + [ this._filter.sql("", args) ].concat(additionalWhereSqls).join(' AND ');

    var sql = "DELETE FROM `" + entityName + "` " + joinSql + ' ' + whereSql;

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

    var joinSql = '';
    var additionalWhereSqls = this._additionalWhereSqls.slice(0);
    var mtm = this._manyToManyFetch;
    if(mtm) {
      joinSql += "LEFT JOIN `" + mtm.table + "` AS mtm ON mtm.`" + mtm.inverseProp + "` = `root`.`id` ";
      additionalWhereSqls.push("mtm.`" + mtm.prop + "` = '" + mtm.id + "'");
    }

    joinSql += this._additionalJoinSqls.join(' ');
    var args = [];
    var whereSql = "WHERE " + [ this._filter.sql("root", args) ].concat(additionalWhereSqls).join(' AND ');

    var sql = "SELECT COUNT(*) AS cnt FROM `" + entityName + "` AS `root` " + joinSql + " " + whereSql;

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
};

try {
  exports.config = persistence.store.sql.config;
} catch(e) {}
