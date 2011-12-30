var jdatastore = Packages.com.google.appengine.api.datastore,
    JDatastoreServiceFactory = jdatastore.DatastoreServiceFactory,
    JKeyFactory = jdatastore.KeyFactory,
    JDatastoreService = jdatastore.DatastoreService,
    JFilterOperator = jdatastore.Query.FilterOperator,
    JSortDirection = jdatastore.Query.SortDirection,
    JQuery = jdatastore.Query,
    JInteger = java.lang.Integer;

exports.config = function(persistence) {
  var argspec = persistence.argspec;

  exports.getSession = function() {
    var session = new persistence.Session();
    session.dsService = JDatastoreServiceFactory.getDatastoreService();
    session.transaction = function (fn) {
      fn({executeSql: function() {}});
    };

    session.close = function() { };
    return session;
  };

  /**
   * Converts a value from the data store to a value suitable for the entity
   * (also does type conversions, if necessary)
   */
  function dbValToEntityVal(val, type) {
    if (val === null || val === undefined) {
      return val;
    }
    switch (type) {
    case 'DATE':
      // SQL is in seconds and JS in miliseconds
        if (val > 1000000000000) {
          // usually in seconds, but sometimes it's milliseconds
          return new Date(parseInt(val, 10));
        } else {
          return new Date(parseInt(val, 10) * 1000);
        }
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
   * Converts an entity value to a data store value, inverse of
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
   * Converts a data store entity to an entity object
   */
  function aeEntityToEntity(session, aeEnt, Entity) {
    if(!aeEnt) return null;

    var o = new Entity(session);
    var meta = Entity.meta;
    o.id = aeEnt.key.name;
    var propMap = aeEnt.properties;
    for(var prop in Iterator(propMap.keySet())) {
      persistence.set(o, prop, dbValToEntityVal(propMap.get(prop), meta.fields[prop]));
    }
    return o;
  }

  /**
   * Converts a data store entity to an entity object
   */
  function entityToAEEntity(meta, o) {
    var ent = new jdatastore.Entity(o._type, o.id);
    for(var k in meta.fields) {
      if(meta.fields.hasOwnProperty(k)) {
        ent.setProperty(k, entityValToDbVal(o._data[k], meta.fields[k]));
      }
    }
    for(var k in meta.hasOne) {
      if(meta.hasOne.hasOwnProperty(k)) {
        ent.setProperty(k, entityValToDbVal(o._data[k], meta.fields[k]));
      }
    }
    return ent;
  }

  var allEntities = [];

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

  /////////////////////////// QueryCollection patches to work in AppEngine environment

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
      var values = new java.util.ArrayList();
      var type = meta.fields[this.property];
      for(var i = 0; i < value.length; i++) {
        values.add(entityValToDbVal(value[i], type));
      }
      value = values;
      filterOp = JFilterOperator.IN;
      break;
    };
    query.addFilter(this.property, filterOp, entityValToDbVal(value, meta.fields[this.property]));
  };


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

    var query = new JQuery(entityName); // Not tbe confused with jQuery
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

    // TODO: Check if filtering for 'id' property, then use key lookup
    //
    if(this._filter.right && this._filter.right.property && this._filter.right.property === 'id') {
      var idToLoad = this._filter.right.value;
      var obj;
      try {
        obj = session.dsService.get(JKeyFactory.createKey(entityName, idToLoad));
      } catch(e) { // com.google.appengine.api.datastore.EntityNotFoundException
        obj = null;
      }
      if(obj) {
        callback([aeEntityToEntity(session, obj, persistence.define(entityName))]);
      } else {
        callback([]);
      }
    } else {
      session.flush(function() {
          prepareQuery(that, function(preparedQuery) {
              if(that._limit === 1) {
                var row = preparedQuery.asSingleEntity();
                var e = aeEntityToEntity(session, row, persistence.define(entityName));
                callback([e]);
              } else {
                var rows = preparedQuery.asList(jdatastore.FetchOptions.Builder.withLimit(that._limit === -1 ? 1000 : that._limit).offset(that._skip));
                var results = [];

                var Entity = persistence.define(entityName);
                for (var i = 0; i < rows.size(); i++) {
                  var r = rows.get(i);
                  var e = aeEntityToEntity(session, r, Entity);
                  results.push(e);
                  session.add(e);
                }
                if(that._reverse) {
                  results.reverse();
                }
                that.triggerEvent('list', that, results);
                callback(results);
              }
            });
        });
    }
  };

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

  persistence.DbQueryCollection.prototype.count = function (tx, callback) {
    var args = argspec.getArgs(arguments, [
        { name: 'tx', optional: true, check: persistence.isTransaction, defaultValue: null },
        { name: 'callback', optional: false, check: argspec.isCallback() }
      ]);
    tx = args.tx;
    callback = args.callback;

    var that = this;
    var session = this._session;

    session.flush(function() {
        prepareQuery(that, function(preparedQuery) {
            var n = preparedQuery.countEntities(jdatastore.FetchOptions.Builder.withDefaults());
            callback(n);
          });
      });

  };

  persistence.isSession = function(obj) {
    var isSession = !obj || (obj && obj.schemaSync);
    if(!isSession) {
      throw Error("No session argument passed, you should!");
    }
    return isSession;
  };
};

