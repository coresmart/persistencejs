var persistence = window.persistence || {};

(function (persistence) {
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
        var entityArray = [];
        for ( var entityName in entityMeta) {
            if (entityMeta.hasOwnProperty(entityName)) {
                entityArray.push(entityMeta[entityName]);
            }
        }
        function createOneEntityTable () {
            var meta = entityArray.pop();
            var rowDef = '';
            for ( var prop in meta.fields) {
                if (meta.fields.hasOwnProperty(prop)) {
                    rowDef += prop + " " + meta.fields[prop] + ", ";
                }
            }
            for ( var rel in meta.hasOne) {
                if (meta.hasOne.hasOwnProperty(rel)) {
                    rowDef += rel + " VARCHAR(255), ";
                }
            }
            /*
             * tx.executeSql("CREATE INDEX IF NOT EXISTS `" + meta.name + "_" +
             * collName + "_" + otherMeta.name + "` ON `" + otherMeta.name + "`
             * (`" + fkName + "`)"); });
             */
            rowDef = rowDef.substring(0, rowDef.length - 2);
            persistence._conn.transaction(function (tx) {
                tx.executeSql("CREATE TABLE IF NOT EXISTS `" + meta.name + "` ( id VARCHAR(32) PRIMARY KEY, " + rowDef
                        + ")", null, function () {
                    if (entityArray.length > 0) {
                        createOneEntityTable();
                    } else {
                        if (callback) {
                            callback(tx);
                        }
                    }
                });
            });
        }
        createOneEntityTable();
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
     * 
     * @internal
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
     * 
     * @internal
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
     * dbValToEntityVal)
     * 
     * @internal
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

    persistence._entityClassCache = {};

    function getEntity (entityName) {
        if (persistence._entityClassCache[entityName]) {
            return persistence._entityClassCache[entityName];
        }
        var meta = entityMeta[entityName];

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
                        that.__defineSetter__(coll, function (val) {
                            throw "Not yet supported.";
                        });
                        that.__defineGetter__(coll, function () {
                            if (this._data[coll]) {
                                return that._data[coll];
                            } else {
                                // Return a query collection filtering on the
                                // inverse property, could be optimized
                                var queryColl = new persistence.DbQueryCollection(meta.hasMany[coll].type.meta.name)
                                        .filter(meta.hasMany[coll].inverseProperty, '=', that);
                                that._data[coll] = queryColl;
                                return queryColl;
                            }
                        });
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

        Entity.all = function () {
            return new persistence.DbQueryCollection(entityName);
        }

        Entity.hasMany = function (collName, otherEntity, invCollName) {
            var otherMeta = otherEntity.meta;
            meta.hasMany[collName] = {
                type: otherEntity,
                inverseProperty: invCollName
            };
            otherMeta.hasOne[invCollName] = {
                type: Entity,
                inverseProperty: collName
            };
        }

        Entity.hasOne = function (refName, otherEntity) {
            meta.hasOne[refName] = {
                type: otherEntity
            };
        }

        persistence._entityClassCache[entityName] = Entity;
        return Entity;
    }

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
}(persistence));