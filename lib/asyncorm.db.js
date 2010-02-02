var asyncorm = window.asyncorm || {};

(function (asyncorm) {
    var conn = null;
    var meta = {};
    var trackedObjects = {};
    asyncorm.trackedObjects = trackedObjects;

    asyncorm.getMeta = function (entityName) {
        return meta[entityName];
    }

    asyncorm.connect = function (dbname, description, size) {
        asyncorm._conn = asyncorm.db.connect(dbname, description, size);
    }

    asyncorm.transaction = function (callback) {
        asyncorm._conn.transaction(callback);
    }

    asyncorm.define = function (entityName, fields) {
        if (meta[entityName]) { // Already defined, ignore
            return getEntity(entityName);
        }
        meta[entityName] = fields;
        var rowDef = '';
        for ( var prop in fields) {
            if (fields.hasOwnProperty(prop)) {
                rowDef += prop + " " + fields[prop] + ", ";
            }
        }
        rowDef = rowDef.substring(0, rowDef.length - 2);
        asyncorm._conn.transaction(function (t) {
            t.executeSql("CREATE TABLE IF NOT EXISTS `" + entityName
                    + "` ( id VARCHAR(32) PRIMARY KEY, " + rowDef + ")");
        });
        return getEntity(entityName);
    }

    asyncorm.add = function (obj) {
        if (!trackedObjects[obj._id]) {
            trackedObjects[obj._id] = obj;
        }
    }

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
        for (p in meta) {
            if (meta.hasOwnProperty(p)) {
                tableArray.push(p);
            }
        }
        function dropOneTable () {
            var tableName = tableArray.pop();
            tx.executeSql("DROP TABLE " + tableName, function () {
                if (tableArray.length > 0) {
                    dropOneTable();
                }
            });
        }
        dropOneTable();
    }

    asyncorm.rowToEntity = function (entityName, row, prefix) {
        prefix = prefix || '';
        if (trackedObjects[row.id]) { // Cached version
            return trackedObjects[row.id];
        }
        var rowMeta = meta[entityName];
        var ent = getEntity(entityName);
        var o = new ent();
        o._id = row.id;
        o._new = false;
        for ( var p in row) {
            if (p.substring(0, prefix.length) === prefix) {
                p = p.substring(prefix.length);
                if (row.hasOwnProperty(p) && p != 'id') {
                    o[p] = asyncorm.dbValToEntityVal(row[p], rowMeta[p]);
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
        }
        switch (type) {
        case 'BOOL':
            return val ? 1 : 0;
            break;
        default:
            return val;
        }
    }

    asyncorm._entityClassCache = {};

    function getEntity (entityName) {
        if (asyncorm._entityClassCache[entityName]) {
            return asyncorm._entityClassCache[entityName];
        }
        var m = meta[entityName];

        function Entity (obj) {
            this._id = createUUID();
            this._new = true;
            this._type = entityName;
            this._dirtyProperties = {};
            var that = this;
            var data = {};

            for ( var property in m) {
                (function () {
                    if (m.hasOwnProperty(property)) {
                        var p = property; // Javascript scopes/closures SUCK
                        that.__defineSetter__(p, function (val) {
                            data[p] = val;
                            that._dirtyProperties[p] = true;
                        });
                        that.__defineGetter__(p, function () {
                            return data[p];
                        });
                    }
                }());
            }

            for ( var p in obj) {
                if (obj.hasOwnProperty(p)) {
                    that[p] = obj[p];
                }
            }

            this.remove = function (tx, callback) {
                remove(that, tx, callback);
            };
        }

        Entity.all = function () {
            return new asyncorm.QueryCollection(entityName);
        }

        asyncorm._entityClassCache[entityName] = Entity;
        return Entity;
    }

    function save (obj, tx, callback) {
        var rowMeta = meta[obj._type];
        var properties = [];
        var values = [];
        var qs = [];
        var propertyPairs = [];
        for ( var p in obj._dirtyProperties) {
            if (rowMeta.hasOwnProperty(p)) {
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