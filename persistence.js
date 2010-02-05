var persistence = window.persistence || {};

(function () {
    var conn = null;
    var entityMeta = {};
    var trackedObjects = {};

    persistence.trackedObjects = trackedObjects;

    /**
     * Retrieves metadata about entity, mostly for internal use
     */
    persistence.getMeta = function (entityName) {
      return entityMeta[entityName];
    };

    /**
     * Connect to a database
     * 
     * @param dbname
     *            the name of the database
     * @param description
     *            a human-readable description of the database
     * @param size
     *            the maximum size of the database in bytes
     */
    persistence.connect = function (dbname, description, size) {
      persistence._conn = persistence.db.connect(dbname, description, size);
    };

    /**
     * Create a transaction
     * 
     * @param callback,
     *            the callback function to be invoked when the transaction
     *            starts, taking the transaction object as argument
     */
    persistence.transaction = function (callback) {
      persistence._conn.transaction(callback);
    };

    /**
     * Define an entity
     * 
     * @param entityName
     *            the name of the entity (also the table name in the database)
     * @param fields
     *            an object with property names as keys and SQLite types as
     *            values, e.g. {name: "TEXT", age: "INT"}
     * @return the entity's constructor
     */
    persistence.define = function (entityName, fields) {
      if (entityMeta[entityName]) { // Already defined, ignore
        return getEntity(entityName);
      }
      var meta = {
        name: entityName,
        fields: fields,
        hasMany: {},
        hasOne: {}
      };
      entityMeta[entityName] = meta;
      return getEntity(entityName);
    };

    /**
     * Synchronize the data model with the database, creates table that had not
     * been defined before
     * 
     * @param callback
     *            function to be called when synchronization has completed,
     *            takes started transaction as argument
     */
    persistence.schemaSync = function (callback) {
      var queries = [];
      var generatedTables = {}; // set
      for ( var entityName in entityMeta) {
        if (entityMeta.hasOwnProperty(entityName)) {
          var meta = entityMeta[entityName];
          var rowDef = '';
          for ( var prop in meta.fields) {
            if (meta.fields.hasOwnProperty(prop)) {
              rowDef += prop + " " + meta.fields[prop] + ", ";
            }
          }
          for ( var rel in meta.hasOne) {
            if (meta.hasOne.hasOwnProperty(rel)) {
              var otherMeta = meta.hasOne[rel].type.meta;
              rowDef += rel + " VARCHAR(255), ";
              queries.push( [
                  "CREATE INDEX IF NOT EXISTS `" + meta.name + "_" + rel + "_" + otherMeta.name
                  + "` ON `" + meta.name + "` (`" + rel + "`)", null ]);
            }
          }
          for ( var rel in meta.hasMany) {
            if (meta.hasMany.hasOwnProperty(rel) && meta.hasMany[rel].manyToMany) {
              var tableName = meta.hasMany[rel].tableName;
              if (!generatedTables[tableName]) {
                var otherMeta = meta.hasMany[rel].type.meta;
                queries.push( [
                    "CREATE TABLE IF NOT EXISTS `" + tableName + "` (`" + meta.name + "_" + rel
                    + "` VARCHAR(32), `" + otherMeta.name + '_'
                    + meta.hasMany[rel].inverseProperty + "` VARCHAR(32))", null ]);
                queries.push( [
                    "CREATE INDEX IF NOT EXISTS `" + tableName + "_" + meta.name + "_" + rel + "` ON `"
                    + tableName + "` (`" + meta.name + "_" + rel + "`)", null ]);
                queries.push( [
                    "CREATE INDEX IF NOT EXISTS `" + tableName + "_" + otherMeta.name + "_"
                    + meta.hasMany[rel].inverseProperty + "` ON `" + tableName + "` (`"
                    + otherMeta.name + "_" + meta.hasMany[rel].inverseProperty + "`)", null ]);
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
      persistence.transaction(function (tx) {
          executeQueriesSeq(tx, queries, callback, tx);
        });
    };

    /**
     * Adds the object to tracked entities to be persisted
     * 
     * @param obj
     *            the object to be tracked
     */
    persistence.add = function (obj) {
      if (!trackedObjects[obj._id]) {
        trackedObjects[obj._id] = obj;
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
      var objArray = [];
      for ( var id in trackedObjects) {
        if (trackedObjects.hasOwnProperty(id)) {
          objArray.push(trackedObjects[id]);
        }
      }
      function persistOneEntity () {
        var obj = objArray.pop();
        save(obj, tx, function () {
            if (objArray.length > 0) {
              persistOneEntity();
            } else if (callback) {
              callback();
            }
          });
      }
      if (objArray.length > 0) {
        persistOneEntity();
      } else {
        callback();
      }
    }

    /**
     * Clean the persistence context of cached entities and such.
     */
    persistence.clean = function () {
      persistence.trackedObjects = {};
    }

    /**
     * Remove all tables in the database (as defined by the model)
     */
    persistence.reset = function (tx) {
      var tableArray = [];
      for (p in entityMeta) {
        if (entityMeta.hasOwnProperty(p)) {
          tableArray.push(p);
        }
      }
      function dropOneTable () {
        var tableName = tableArray.pop();
        tx.executeSql("DROP TABLE " + tableName, null, function () {
            if (tableArray.length > 0) {
              dropOneTable();
            }
          });
      }
      dropOneTable();
    }

    /**
     * Converts a database row into an entity object
     */
    persistence.rowToEntity = function (entityName, row, prefix) {
      prefix = prefix || '';
      if (trackedObjects[row[prefix + "id"]]) { // Cached version
        return trackedObjects[row[prefix + "id"]];
      }
      var rowMeta = entityMeta[entityName];
      var ent = getEntity(entityName);
      var o = new ent();
      o._id = row[prefix + 'id'];
      o._new = false;
      for ( var p in row) {
        if (row.hasOwnProperty(p)) {
          if (p.substring(0, prefix.length) === prefix) {
            var prop = p.substring(prefix.length);
            if (prop != 'id') {
              o[prop] = persistence.dbValToEntityVal(row[p], rowMeta.fields[prop]);
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
      switch (type) {
      case 'BOOL':
        return val === 1;
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
      if (val === undefined) {
        return null;
      } else if (val._id) {
        return val._id;
      } else if (type === 'BOOL') {
        return val ? 1 : 0;
      } else {
        return val;
      }
    }

    /**
     * Internal cache of entity constructor functions
     */
    var entityClassCache = {};

    /**
     * Retrieves or creates an enitty constructor function for a given
     * entity name
     * @return the entity constructor function to be invoked with `new fn()`
     */
    function getEntity (entityName) {
      if (entityClassCache[entityName]) {
        return persistence._entityClassCache[entityName];
      }
      var meta = entityMeta[entityName];

      /**
       * @constructor
       */
      function Entity (obj) {
        var that = this;
        this._id = createUUID();
        this._new = true;
        this._type = entityName;
        this._dirtyProperties = {};
        this._data = {};
        this._data_obj = {}; // references to objects

        for ( var field in meta.fields) {
          (function () {
              if (meta.fields.hasOwnProperty(field)) {
                var f = field; // Javascript scopes/closures SUCK
                that.__defineSetter__(f, function (val) {
                    that._data[f] = val;
                    that._dirtyProperties[f] = true;
                  });
                that.__defineGetter__(f, function () {
                    return that._data[f];
                  });
              }
            }());
        }

        for ( var it in meta.hasOne) {
          if (meta.hasOne.hasOwnProperty(it)) {
            (function () {
                var ref = it;
                that.__defineSetter__(ref, function (val) {
                    if (val == null) {
                      that._data[ref] = null;
                      that._data_obj[ref] = undefined;
                    } else if (val._id) {
                      that._data[ref] = val._id;
                      that._data_obj[ref] = val;
                      persistence.add(val);
                    } else { // let's assume it's an id
                      that._data[ref] = val;
                    }
                    that._dirtyProperties[ref] = true;
                  });
                that.__defineGetter__(ref, function () {
                    if (that._data[ref] === null || that._data_obj[ref] !== undefined) {
                      return that._data_obj[ref];
                    } else {
                      throw "Property '" + ref + "' with id: " + that._data[ref]
                      + " not fetched, either prefetch it or fetch it manually.";
                    }
                  });
              }());
          }
        }

        for ( var it in meta.hasMany) {
          if (meta.hasMany.hasOwnProperty(it)) {
            (function () {
                var coll = it;
                if (meta.hasMany[coll].manyToMany) {
                  that.__defineSetter__(coll, function (val) {
                      throw "Not yet supported.";
                    });
                  that.__defineGetter__(coll,
                    function () {
                      if (this._data[coll]) {
                        return that._data[coll];
                      } else {
                        var inverseMeta = meta.hasMany[coll].type.meta;

                        var queryColl = new ManyToManyDbQueryCollection(
                          meta.hasMany[coll].type.meta.name);
                        queryColl._additionalJoinSqls.push("LEFT JOIN `"
                          + meta.hasMany[coll].tableName + "` AS mtm ON mtm.`"
                          + inverseMeta.name + '_' + meta.hasMany[coll].inverseProperty
                          + "` = `" + inverseMeta.name + "`.`id` ");
                        queryColl._additionalWhereSqls.push("mtm.`" + meta.name + '_' + coll
                          + "` = '" + that._id + "'");
                        that._data[coll] = queryColl;
                        return queryColl;
                      }
                    });
                } else {
                  that.__defineSetter__(coll, function (val) {
                      throw "Not yet supported.";
                    });
                  that.__defineGetter__(coll, function () {
                      if (this._data[coll]) {
                        return that._data[coll];
                      } else {
                        // Return a query collection
                        // filtering on the
                        // inverse property, could be
                        // optimized
                        var queryColl = new DbQueryCollection(
                          meta.hasMany[coll].type.meta.name).filter(
                            meta.hasMany[coll].inverseProperty, '=', that);
                          that._data[coll] = queryColl;
                          return queryColl;
                        }
                      });
                  }
                }());
            }
          }

          for ( var f in obj) {
            if (obj.hasOwnProperty(f)) {
              that[f] = obj[f];
            }
          }
        } // Entity

        Entity.meta = meta;

        /**
         * Returns a QueryCollection implementation matching all instances
         * of this entity in the database
         */
        Entity.all = function () {
          return new DbQueryCollection(entityName);
        }

        /**
         * Declares a one-to-many or many-to-many relationship to another entity
         * Whether 1:N or N:M is chosed depends on the inverse declaration
         * @param collName the name of the collection (becomes a property of 
         *   Entity instances
         * @param otherEntity the constructor function of the entity to define 
         *   the relation to
         * @param inverseRel the name of the inverse property (to be) defined on otherEntity
         */
        Entity.hasMany = function (collName, otherEntity, invRel) {
          var otherMeta = otherEntity.meta;
          if (otherMeta.hasMany[invRel]) { 
            // other side has declared it as a one-to-many relation too -> it's in
            // fact many-to-many
            var tableName = meta.name + "_" + collName + "_" + otherMeta.name;
            var inverseTableName = otherMeta.name + '_' + invRel + '_' + meta.name;

            if (tableName > inverseTableName) { 
              // Some arbitrary way to deterministically decide which table to generate
              tableName = inverseTableName;
            }
            meta.hasMany[collName] = {
              type: otherEntity,
              inverseProperty: invRel,
              manyToMany: true,
              tableName: tableName
            };
            otherMeta.hasMany[invRel] = {
              type: Entity,
              inverseProperty: collName,
              manyToMany: true,
              tableName: tableName
            };
            delete meta.hasOne[collName];
          } else {
            meta.hasMany[collName] = {
              type: otherEntity,
              inverseProperty: invRel
            };
            otherMeta.hasOne[invRel] = {
              type: Entity,
              inverseProperty: collName
            };
          }
        }

        Entity.hasOne = function (refName, otherEntity) {
          meta.hasOne[refName] = {
            type: otherEntity
          };
        }

        entityClassCache[entityName] = Entity;
        return Entity;
      }

      /**
       * Internal function to persist an object to the database
       * this function is invoked by persistence.flush()
       */
      function save (obj, tx, callback) {
        var rowMeta = entityMeta[obj._type];
        var properties = [];
        var values = [];
        var qs = [];
        var propertyPairs = [];
        for ( var p in obj._dirtyProperties) {
          if (obj._dirtyProperties.hasOwnProperty(p)) {
            properties.push("`" + p + "`");
            values.push(persistence.entityValToDbVal(obj[p]));
            qs.push('?');
            propertyPairs.push("`" + p + "` = ?");
          }
        }
        if (properties.length === 0) { // Nothing changed
          callback();
          return;
        }
        obj._dirtyProperties = {};
        if (obj._new) {
          properties.push('id');
          values.push(obj._id);
          qs.push('?');
          var sql = "INSERT INTO `" + obj._type + "` (" + properties.join(", ") + ") VALUES (" + qs.join(', ') + ")";
          obj._new = false;
          tx.executeSql(sql, values, callback);
        } else {
          var sql = "UPDATE `" + obj._type + "` SET " + propertyPairs.join(',') + " WHERE id = '" + obj._id + "'";
          tx.executeSql(sql, values, callback);
        }
      }

      function remove (obj, tx, callback) {
        var sql = "DELETE FROM `" + obj._type + "` WHERE id = '" + obj._id + "'";
        tx.executeSql(sql, null, callback);
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
          tx.executeSql(queryTuple[0], queryTuple[1], function () {
              if (queries.length > 0) {
                executeOne();
              } else if (callback) {
                callback.apply(this, callbackArgs);
              }
            });
        }
        if (queries.length > 0) {
          executeOne();
        } else if (callback) {
          callback.apply(this, callbackArgs);
        }
      }

      /**
       * Generates a UUID according to http://www.ietf.org/rfc/rfc4122.txt
       */
      function createUUID () {
        var s = [];
        var hexDigits = "0123456789ABCDEF";
        for ( var i = 0; i < 32; i++) {
          s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
        }
        s[12] = "4";
        s[16] = hexDigits.substr((s[16] & 0x3) | 0x8, 1);

        var uuid = s.join("");
        return uuid;
      }

      ////////////////// QUERY COLLECTIONS \\\\\\\\\\\\\\\\\\\\\\\
      /*
       * Each filter has 4 methods:
       * - sql(prefix, values) -- returns a SQL representation of this filter,
       *     possibly pushing additional query arguments to `values` if ?'s are used
       *     in the query
       * - match(o) -- returns whether the filter matches the object o.
       * - makeFit(o) -- attempts to adapt the object o in such a way that it matches
       *     this filter.
       * - makeNotFit(o) -- the oppositive of makeFit, makes the object o NOT match
       *     this filter
       */

      /**
       * Default filter that does not filter on anything
       * currently it generates a 1=1 SQL query, which is kind of ugly
       */
      function NullFilter () {
        this.sql = function (prefix, values) {
          return "1=1";
        }

        this.match = function (o) {
          return true;
        }

        this.makeFit = function(o) {
        }

        this.makeNotFit = function(o) {
        }
      }

      /**
       * Filter that makes sure that both its left and right filter match
       * @param left left-hand filter object
       * @param right right-hand filter object
       */
      function AndFilter (left, right) {
        this.sql = function (prefix, values) {
          return "(" + left.sql(prefix, values) + " AND "
          + right.sql(prefix, values) + ")";
        }

        this.match = function (o) {
          return left.match(o) && right.match(o);
        }

        this.makeFit = function(o) {
          left.makeFit(o);
          right.makeFit(o);
        }

        this.makeNotFit = function(o) {
          left.makeNotFit(o);
          right.makeNotFit(o);
        }
      }

      /**
       * Filter that checks whether a certain property matches some value, based on an
       * operator. Supported operators are '=', '!=', '<', '<=', '>' and '>='.
       * @param property the property name
       * @param operator the operator to compare with
       * @param value the literal value to compare to
       */
      function PropertyFilter (property, operator, value) {
        this.sql = function (prefix, values) {
          if (operator === '=' && value === null) {
            return "`" + prefix + property + "` IS NULL";
          } else if (operator === '!=' && value === null) {
            return "`" + prefix + property + "` IS NOT NULL";
          } else {
            values.push(persistence.entityValToDbVal(value));
            return "`" + prefix + property + "` " + operator + " ?";
          }
        }

        this.match = function (o) {
          switch (operator) {
          case '=':
            return o[property] === value;
            break;
          case '!=':
            return o[property] !== value;
            break;
          case '<':
            return o[property] < value;
            break;
          case '<=':
            return o[property] <= value;
            break;
          case '>':
            return o[property] > value;
            break;
          case '>=':
            return o[property] >= value;
            break;
          }
        }

        this.makeFit = function(o) {
          if(operator === '=') {
            o[property] = value;
          } else {
            throw "Sorry, can't perform makeFit for other filters than =";
          }
        }

        this.makeNotFit = function(o) {
          if(operator === '=') {
            o[property] = null;
          } else {
            throw "Sorry, can't perform makeNotFit for other filters than =";
          }            
        }
      }

      /**
       * The constructor function of the _abstract_ QueryCollection
       * DO NOT INSTANTIATE THIS
       * @constructor
       */
      function QueryCollection () {
      }

      /**
       * Invoked by sub-classes to initialize the query collection
       */
      QueryCollection.prototype.init = function (entityName, constructor) {
        this._filter = new NullFilter();
        this._orderColumns = []; // tuples of [column, ascending?]
        this._prefetchFields = [];
        this._additionalJoinSqls = [];
        this._additionalWhereSqls = [];
        this._entityName = entityName;
        this._constructor = constructor;
      }

      /**
       * Creates a clone of this query collection
       * @return a clone of the collection
       */
      QueryCollection.prototype.clone = function () {
        var c = new (this._constructor)(this._entityName);
        c._filter = this._filter;
        c._prefetchFields = this._prefetchFields.slice(0); // clone
        c._orderColumns = this._orderColumns.slice(0);
        return c;
      };

      /**
       * Returns a new query collection with a property filter condition added
       * @param property the property to filter on
       * @param operator the operator to use
       * @param value the literal value that the property should match
       * @return the query collection with the filter added
       */
      QueryCollection.prototype.filter = function (property, operator, value) {
        var c = this.clone();
        c._filter = new AndFilter(this._filter, new PropertyFilter(property,
            operator, value));
        return c;
      };

      /**
       * Returns a new query collection with an ordering imposed on the collection
       * @param property the property to sort on
       * @param ascending should the order be ascending (= true) or descending (= false)
       * @return the query collection with imposed ordering
       */
      QueryCollection.prototype.order = function (property, ascending) {
        ascending = ascending || true;
        var c = this.clone();
        c._orderColumns.push( [ property, ascending ]);
        return c;
      };

      /*
       * Returns a new query collection which will prefetch a certain object relationship.
       * Only works with 1:1 and N:1 relations.
       * @param rel the relation name of the relation to prefetch
       * @return the query collection prefetching `rel`
       */
      QueryCollection.prototype.prefetch = function (rel) {
        var c = this.clone();
        c._prefetchFields.push(rel);
        return c;
      };

      /**
       * Adds an object to a collection
       * @param obj the object to add
       */
      QueryCollection.prototype.add = function(obj) {
        if(!obj._id || !obj._type) {
          throw "Cannot add object of non-entity type onto collection.";
        }
        persistence.add(obj);
        this._filter.makeFit(obj);
      }

      /**
       * Removes an object from a collection
       * @param obj the object to remove from the collection
       */
      QueryCollection.prototype.remove = function(obj) {
        if(!obj._id || !obj._type) {
          throw "Cannot remove object of non-entity type from collection.";
        }
        persistence.add(obj);
        this._filter.makeNotFit(obj);
      }


      /**
       * A database implementation of the QueryCollection
       * @param entityName the name of the entity to create the collection for
       * @constructor
       */
      function DbQueryCollection (entityName) {
        this.init(entityName, DbQueryCollection);
      }

      DbQueryCollection.prototype = new QueryCollection();

      /**
       * Asynchronous call to actually fetch the items in the collection
       * @param tx transaction to use
       * @param callback function to be called taking an array with 
       *   result objects as argument
       */
      DbQueryCollection.prototype.list = function (tx, callback) {
        var entityName = this._entityName;
        var meta = persistence.getMeta(entityName);
        var that = this;

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

        var selectFields = selectAll(meta, meta.name, mainPrefix);

        var joinSql = this._additionalJoinSqls.join(' ');

        for ( var i = 0; i < this._prefetchFields.length; i++) {
          var prefetchField = this._prefetchFields[i];
          var thisMeta = meta.hasOne[prefetchField].type.meta;
          var tableAlias = thisMeta.name + '_' + prefetchField + "_tbl";
          selectFields = selectFields.concat(selectAll(thisMeta, tableAlias,
              prefetchField + "_"));
          joinSql += "LEFT JOIN `" + thisMeta.name + "` AS `" + tableAlias
          + "` ON `" + tableAlias + "`.`id` = `" + mainPrefix
          + prefetchField + "` ";

        }

        var whereSql = "WHERE "
        + [ this._filter.sql(mainPrefix, args) ].concat(
          this._additionalWhereSqls).join(' AND ');

        var sql = "SELECT " + selectFields.join(", ") + " FROM `" + entityName
        + "` " + joinSql + " " + whereSql;
        if (this._orderColumns.length > 0) {
          sql += " ORDER BY "
          + this._orderColumns.map(
            function (c) {
              return "`" + mainPrefix + c[0] + "` "
              + (c[1] ? "ASC" : "DESC");
            }).join(", ");
        }
        persistence.flush(tx, function () {
            tx.executeSql(sql, args, function (rows) {
                var results = [];
                for ( var i = 0; i < rows.length; i++) {
                  var r = rows[i];
                  var e = persistence.rowToEntity(entityName, r, mainPrefix);
                  for ( var j = 0; j < that._prefetchFields.length; j++) {
                    var prefetchField = that._prefetchFields[j];
                    var thisMeta = meta.hasOne[prefetchField].type.meta;
                    e[prefetchField] = persistence.rowToEntity(
                      thisMeta.name, r, prefetchField + '_');
                  }
                  results.push(e);
                  persistence.add(e);
                }
                callback(results);
              });
          });
      };

      /**
       * A ManyToMany implementation of QueryCollection 
       * @constructor
       */
      function ManyToManyDbQueryCollection (entityName) {
        this.init(entityName, ManyToManyDbQueryCollection);
      }

      ManyToManyDbQueryCollection.prototype = new DbQueryCollection();

      ManyToManyDbQueryCollection.prototype.add = function(obj) {
        throw "Not yet implemented";
      }

      ManyToManyDbQueryCollection.prototype.remove = function(obj) {
        throw "Not yet implemented";
      }

      ManyToManyDbQueryCollection.prototype.persist = function() {
        console.log("Called persist!");
      }

      ////////// Low-level database interface, abstracting from HTML5 and Gears databases \\\\
      persistence.db = persistence.db || {};

      persistence.db.implementation = "unsupported";
      persistence.db.conn = null;
      persistence.db.log = true;

      if (window.google && google.gears) {
          persistence.db.implementation = "gears";
      } else if (window.openDatabase) {
          persistence.db.implementation = "html5";
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
                  console.log(query);
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
                  console.log(query);
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
          } else if (persistence.db.implementation == "gears") {
              return persistence.db.gears.connect(dbname);
          }
      };
}());

// Equals methods

Number.prototype.equals = function(other) {
  return this == other; 
}

Boolean.prototype.equals = function(other) {
  return this == other; 
}

String.prototype.equals = function(other) {
  return this == other; 
}

Array.prototype.equals = function(other) {
  if(this.length !== other.length) {
    return false;
  }
  for(var i = 0; i < this.length; i++) {
    if(!this[i].equals(other[i])) {
      return false;
    }
  }
  return true;
}

