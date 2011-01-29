var jdatastore = Packages.com.google.appengine.api.datastore,
    JDatastoreServiceFactory = jdatastore.DatastoreServiceFactory,
    JKeyFactory = jdatastore.KeyFactory,
    JDatastoreService = jdatastore.DatastoreService,
    JFilterOperator = jdatastore.Query.FilterOperator,
    JSortDirection = jdatastore.Query.SortDirection,
    JQuery = jdatastore.Query,
    JInteger = java.lang.Integer,
    logging = require('ringo/logging');

exports.config = function(persistence) {
  var argspec = persistence.argspec;

  exports.getSession = function() {
    var that = {};
    var session = new persistence.Session(that);
    session.dsService = JDatastoreServiceFactory.getDatastoreService();
    session.transaction = function (fn) {
      fn({executeSql: function() {}});
    };

    session.close = function() { };
    return session;
  };



  /**
   * Converts a value from the database to a value suitable for the entity
   * (also does type conversions, if necessary)
   */
  function dbValToEntityVal(val, type) {
    if (val === null || val === undefined) {
      return val;
    }
    switch (type) {
    case 'DATE':
      // SQL is in seconds and JS in miliseconds
      return new Date(parseInt(val, 10) * 1000);
    case 'BOOL':
      return val === 1 || val === '1';
      break;
    case 'INT':
      return +val;
      break;
    case 'BIGINT':
      return +val;
      break;
    case 'JSON':
      if (val) {
        return JSON.parse(val);
      }
      else {
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
      return (val === 'false') ? 0 : (val ? 1 : 0);
    } else if (type === 'DATE' || val.getTime) {
      val = new Date(val);
      return new JInteger(Math.round(val.getTime() / 1000));
    } else {
      return val;
    }
  }

  /**
   * Converts a database row into an entity object
   */
  function aeEntityToEntity(aeEnt, Entity) {
    var o = new Entity();
    o.id = aeEnt.key.name;
    var propMap = aeEnt.properties;
    for(prop in Iterator(propMap.keySet())) {
      persistence.set(o, prop, dbValToEntityVal(propMap.get(prop)));
    }
    return o;
  }

  /**
   * Converts a AE entity into an entity object
   */
  function entityToAEEntity(meta, o) {
    //throw Error("Keys: "+jdatastore.Entity);
    var ent = new jdatastore.Entity(o._type, o.id);
    for(var k in meta.fields) {
      if(meta.fields.hasOwnProperty(k)) {
        ent.setProperty(k, entityValToDbVal(o._data[k]));
      }
    }
    for(var k in meta.hasOne) {
      if(meta.hasOne.hasOwnProperty(k)) {
        ent.setProperty(k, entityValToDbVal(o._data[k]));
      }
    }
    return ent;
  }

  var allEntities = [];

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

    var entityMeta = persistence.getEntityMeta();
    for (var entityName in entityMeta) {
      if (entityMeta.hasOwnProperty(entityName)) {
        allEntities.push(persistence.define(entityName));
      }
    }

    callback();
  };

  /**
   * Persists all changes to the database transaction
   * 
   * @param tx
   *            transaction to use
   * @param callback
   *            function to be called when done
   */
  persistence.flush = function (tx, callback) {
    var args = argspec.getArgs(arguments, [
        { name: "tx", optional: true, check: persistence.isTransaction },
        { name: "callback", optional: true, check: argspec.isCallback(), defaultValue: null }
      ]);
    tx = args.tx;
    callback = args.callback;

    var session = this;
    var fns = persistence.flushHooks;
    persistence.asyncForEach(fns, function(fn, callback) {
        fn(session, tx, callback);
      }, function() {
        // After applying the hooks
        var entitiesToPersist = [];
        var removeArrayList = new java.util.ArrayList();

        for (var id in session.trackedObjects) {
          if (session.trackedObjects.hasOwnProperty(id)) {
            var ent = prepareDbEntity(session.trackedObjects[id]);
            if(ent) {
              entitiesToPersist.push(ent);
            }
          }
        }
        for (var id in session.objectsToRemove) {
          if (session.objectsToRemove.hasOwnProperty(id)) {
            removeArrayList.add(JKeyFactory.createKey(session.trackedObjects[id]._type, id));
            delete session.trackedObjects[id]; // Stop tracking
          }
        }
        if(entitiesToPersist.length > 0) {
          session.dsService.put(entitiesToPersist);
        }
        if(removeArrayList.size() > 0) {
          session.dsService['delete'](removeArrayList);
        }
        callback();
      });
  };
  
  /**
   * Remove all tables in the database (as defined by the model)
   */
  persistence.reset = function (tx, callback) {
    var args = argspec.getArgs(arguments, [
        { name: "tx", optional: true, check: persistence.isTransaction, defaultValue: null },
        { name: "callback", optional: true, check: argspec.isCallback(), defaultValue: function(){} }
      ]);
    callback = args.callback;

    var session = this;

    persistence.asyncParForEach(allEntities, function(Entity, callback) {
        Entity.all(session).destroyAll(callback);
      }, callback);
  };

  /**
   * Internal function to persist an object to the database
   * this function is invoked by persistence.flush()
   */
  function prepareDbEntity(obj) {
    var meta = persistence.getMeta(obj._type);
    var isDirty = obj._new;
    if(Object.keys(obj._dirtyProperties).length > 0) {
      isDirty = true;
    }
    if(isDirty) {
      return entityToAEEntity(meta, obj);
    } else {
      return null; // no saving required
    }
  }

  /////////////////////////// QueryCollection patches to work in SQL environment

  persistence.NullFilter.prototype.addFilter = function (meta, query) {
  };

  persistence.AndFilter.prototype.addFilter = function (meta, query) {
    this.left.addFilter(meta, query);
    this.right.addFilter(meta, query);
  };

  persistence.OrFilter.prototype.addFilter = function (meta, query) {
    throw new Error("OrFilter Not supported");
  };

  persistence.PropertyFilter.prototype.addFilter = function (meta, query) {
    var filterOp;
    var value = this.value;
    switch(this.operator) {
    case '=':
      filterOp = JFilterOperator.EQUAL;
      break;
    case '!=':
      filterOp = JFilterOperator.NOT_EQUAL;
      break;
    case '>':
      filterOp = JFilterOperator.GREATER_THAN;
      break;
    case '>=':
      filterOp = JFilterOperator.GREATER_THAN_OR_EQUAL;
      break;
    case '<':
      filterOp = JFilterOperator.LESS_THAN;
      break;
    case '<=':
      filterOp = JFilterOperator.LESS_THAN_OR_EQUAL;
      break;
    case 'in':
      var values = [];
      var type = meta.fields[this.property];
      for(var i = 0; i < value.length; i++) {
        values.push(entityValToDbVal(value[i], type));
      }
      value = values;
      filterOp = JFilterOperator.IN;
      break;
    };
    query.addFilter(this.property, filterOp, value);
  };

  // QueryColleciton's list


  function prepareQuery(coll, callback) {
    var session = coll._session;
    var entityName = coll._entityName;
    var meta = persistence.getMeta(entityName);
    
    // handles mixin case -- this logic is generic and could be in persistence.
    if (meta.isMixin) {
      var result = [];
      persistence.asyncForEach(meta.mixedIns, function(realMeta, next) {
        var query = coll.clone();
        query._entityName = realMeta.name;
        query.list(tx, function(array) {
          result = result.concat(array);
          next();
        });
      }, function() {
        var query = new persistence.LocalQueryCollection(result);
        query._orderColumns = coll._orderColumns;
        query._reverse = coll._reverse;
        // TODO: handle skip and limit -- do we really want to do it?
        query.list(null, callback);
      });
      return;
    }    

    var query = new JQuery(entityName);
    coll._filter.addFilter(meta, query);

    coll._orderColumns.forEach(function(col) {
        query.addSort(col[0], col[1] ? JSortDirection.ASCENDING : JSortDirection.DESCENDING);
      });

    callback(session.dsService.prepare(query));
  }


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
    callback = args.callback;
    var that = this;
    var entityName = this._entityName;
    var session = this._session;

    session.flush(function() {
      prepareQuery(that, function(preparedQuery) {
          var rows = preparedQuery.asList(jdatastore.FetchOptions.Builder.withLimit(that._limit === -1 ? 1000 : that._limit).offset(that._skip));
          var results = [];

          for (var i = 0; i < rows.size(); i++) {
            var r = rows.get(i);
            var e = aeEntityToEntity(r, persistence.define(entityName));
            results.push(e);
            session.add(e);
          }
          if(that._reverse) {
            results.reverse();
          }
          that.triggerEvent('list', that, results);
          callback(results);
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
    callback = args.callback;

    var that = this;
    var session = this._session;

    session.flush(function() {
        prepareQuery(that, function(preparedQuery) {
            var rows = preparedQuery.asList(jdatastore.FetchOptions.Builder.withLimit(that._limit === -1 ? 1000 : that._limit).offset(that._skip));
            var keys = new java.util.ArrayList();
            for (var i = 0; i < rows.size(); i++) {
              var r = rows.get(i);
              keys.add(r.getKey());
            }
            that._session.dsService['delete'](keys);
            that.triggerEvent('change', that);
            callback();
          });
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

    session.flush(function() {
        prepareQuery(that, function(preparedQuery) {
            var n = preparedQuery.countEntities(jdatastore.FetchOptions.Builder.withDefaults());
            callback(n);
          });
      });

  };
};

