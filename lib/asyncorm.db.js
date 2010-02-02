var asyncorm = window.asyncorm || {};

(function (asyncorm) {
    var conn = null;
    var entityMeta = {}; // fields: {}
    var trackedObjects = {};
    asyncorm.trackedObjects = trackedObjects;

    asyncorm.getMeta = function (entityName) {
        return entityMeta[entityName];
    };

    asyncorm.connect = function (dbname, description, size) {
        asyncorm._conn = asyncorm.db.connect(dbname, description, size);
    };

    asyncorm.transaction = function (callback) {
        asyncorm._conn.transaction(callback);
    };

    asyncorm.define = function (entityName, fields) {
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

    asyncorm.schemaSync = function (callback) {
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
            asyncorm._conn.transaction(function (tx) {
                tx.executeSql("CREATE TABLE IF NOT EXISTS `" + meta.name
                        + "` ( id VARCHAR(32) PRIMARY KEY, " + rowDef + ")",
                        null, function () {
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

    asyncorm.add = function (obj) {
        if (!trackedObjects[obj._id]) {
            trackedObjects[obj._id] = obj;
        }
    };

    asyncorm.flush = function (tx, callback) {
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
        persistOneEntity();
    }

    asyncorm.reset = function (tx) {
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

    asyncorm.rowToEntity = function (entityName, row, prefix) {
        prefix = prefix || '';
        if (trackedObjects[row[prefix + "id"]]) { // Cached version
            return trackedObjects[row[prefix + "id"]];
        }
        var rowMeta = entityMeta[entityName];
        var ent = getEntity(entityName);
        var o = new ent();
        o._id = row.id;
        o._new = false;
        for ( var p in row) {
            if (row.hasOwnProperty(p)) {
                if (p.substring(0, prefix.length) === prefix) {
                    var prop = p.substring(prefix.length);
                    if (prop != 'id') {
                        o[prop] = asyncorm.dbValToEntityVal(row[p],
                                rowMeta.fields[prop]);
                    }
                }
            }
        }
        return o;
    }

    asyncorm.dbValToEntityVal = function (val, type) {
        switch (type) {
        case 'BOOL':
            return val === 1;
            break;
        default:
            return val;
        }
    }

    asyncorm.entityValToDbVal = function (val, type) {
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

    asyncorm._entityClassCache = {};

    function getEntity (entityName) {
        if (asyncorm._entityClassCache[entityName]) {
            return asyncorm._entityClassCache[entityName];
        }
        var meta = entityMeta[entityName];

        var entity = function (obj) {
            var that = {};
            that._id = createUUID();
            that._new = true;
            that._type = entityName;
            that._dirtyProperties = {};
            var data = {};
            var data_obj = {}; // references to objects

            for ( var field in meta.fields) {
                (function () {
                    if (meta.fields.hasOwnProperty(field)) {
                        var f = field; // Javascript scopes/closures SUCK
                        that.__defineSetter__(f, function (val) {
                            data[f] = val;
                            that._dirtyProperties[f] = true;
                        });
                        that.__defineGetter__(f, function () {
                            return data[f];
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
                                data[ref] = null;
                            } else if (val._id) {
                                console.log("Setting: " + ref)
                                data[ref] = val._id;
                                data_obj[ref] = val;
                            } else {
                                data[ref] = val;
                            }
                            that._dirtyProperties[ref] = true;
                        });
                        that
                                .__defineGetter__(
                                        ref,
                                        function () {
                                            if (data_obj[ref]) {
                                                return data_obj[ref];
                                            } else {
                                                throw "Object with id: "
                                                        + data[ref]
                                                        + " not fetched, either prefetch it or, fetch it manually.";
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

            that.remove = function (tx, callback) {
                remove(that, tx, callback);
            };

            return that;
        }

        entity.meta = meta;

        entity.all = function () {
            return asyncorm.dbQueryCollection(entityName);
        }

        entity.hasMany = function (collName, otherEntity, invCollName) {
            var otherMeta = otherEntity.meta;
            meta.hasMany[collName] = otherEntity;
            otherMeta.hasOne[invCollName] = entity;
        }

        asyncorm._entityClassCache[entityName] = entity;
        return entity;
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
                values.push(asyncorm.entityValToDbVal(obj[p]));
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
            var sql = "INSERT INTO `" + obj._type + "` ("
                    + properties.join(", ") + ") VALUES (" + qs.join(', ')
                    + ")";
            obj._new = false;
            tx.executeSql(sql, values, callback);
        } else {
            var sql = "UPDATE `" + obj._type + "` SET "
                    + propertyPairs.join(',') + " WHERE id = '" + obj._id + "'";
            tx.executeSql(sql, values, callback);
        }
    }

    function remove (obj, tx, callback) {
        var sql = "DELETE FROM `" + obj._type + "` WHERE id = '" + obj._id
                + "'";
        tx.executeSql(sql, null, callback);
    }
}(asyncorm));