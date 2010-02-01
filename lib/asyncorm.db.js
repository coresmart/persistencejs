var asyncorm = window.asyncorm || {};

asyncorm._conn = null;
asyncorm._model = {};

asyncorm.connect = function (dbname, description, size) {
    asyncorm._conn = asyncorm.db.connect(dbname, description, size);
}

asyncorm.define = function (entityName, fields, callback) {
    if (asyncorm._model[entityName]) { // Already defined, ignore
        return;
    }
    asyncorm._model[entityName] = fields;
    var rowDef = '';
    for ( var prop in fields) {
        if (fields.hasOwnProperty(prop)) {
            rowDef += prop + " " + fields[prop] + ", ";
        }
    }
    rowDef = rowDef.substring(0, rowDef.length - 2);
    asyncorm._conn.transaction(function (t) {
        t.executeSql("CREATE TABLE IF NOT EXISTS `" + entityName
                + "` ( id VARCHAR(32) PRIMARY KEY, " + rowDef + ")", null,
                callback);
    });
}

asyncorm.save = function (obj, callback) {
    if (!obj._kind) {
        throw "Not an entity";
    }
    var kind = obj._kind;
    var model = asyncorm._model[kind];

    var properties = [];
    var values = [];
    var qs = [];
    var propertyPairs = [];
    for ( var p in model) {
        if (model.hasOwnProperty(p)) {
            properties.push("`" + p + "`");
            if (model[p] === 'BOOL') {
                values.push(obj[p] ? 1 : 0);
            } else if(obj[p] === undefined) {
                values.push(null);
            } else {
                values.push(obj[p]);
            }
            qs.push('?');
            propertyPairs.push("`" + p + "` = ?");
        }
    }
    asyncorm._conn.transaction(function (t) {
        if (obj._new) {
            properties.push('id');
            values.push(obj._id);
            qs.push('?');
            var sql = "INSERT INTO `" + kind + "` (" + properties.join(", ")
                    + ") VALUES (" + qs.join(', ') + ")";
            t.executeSql(sql, values, callback);
            obj._new = false;
        } else {
            var sql = "UPDATE `" + obj._kind + "` SET " + propertyPairs.join(',')
                    + " WHERE id = '" + obj._id + "'";
            t.executeSql(sql, values, callback);
        }
    });
}

asyncorm.remove = function(obj, callback) {
    asyncorm._conn.transaction(function (t) {
        var sql = "DELETE FROM `" + obj._kind + "` WHERE id = '" + obj._id + "'";
        t.executeSql(sql, null, callback);
    });
}

asyncorm._entityObjCache = {};

asyncorm.entity = function(entityName)
{
    if(asyncorm._entityObjCache[entityName]) {
        return asyncorm._entityObjCache[entityName];
    }
    var that = {};
    var meta = asyncorm._model[entityName];

    that.create = function (obj) {
        obj = obj || {};
        obj._id = createUUID();
        obj._kind = entityName;
        obj._new = true;
        obj.save = function (callback) {
            asyncorm.save(obj, callback);
        };
        obj.remove = function (callback) {
            asyncorm.remove(obj, callback);
        };
        return obj;
    }
    
    function rowToObj(row) {
        var o = asyncorm.entity(entityName).create();
        o._id = row.id;
        o._new = false;
        for(p in row) {
            if(row.hasOwnProperty(p) && p != 'id') {
                if(meta[p] === 'BOOL') {
                    o[p] = row[p] === 1;
                } else {
                    o[p] = row[p];
                }
            }
        }
        return o;
    }
    
    that.all = function(callback) {
        asyncorm._conn.transaction(function (t) {
            t.executeSql('SELECT * FROM `' + entityName + "`", null, function(results) {
                var l = [];
                for(var i = 0; i < results.length; i++) {
                    l.push(rowToObj(results[i]));
                }
                if(callback) {
                    callback(l);
                }
            });
        });
    }
    
    asyncorm._entityObjCache[entityName] = that;
    return that;
}

asyncorm.reset = function () {
    var tableArray = [];
    for(p in asyncorm._model) {
        if(asyncorm._model.hasOwnProperty(p)) {
            tableArray.push(p);
        }
    }
    asyncorm._conn.transaction(function (t) {
        function dropOneTable () {
            var tableName = tableArray.pop();
            t.executeSql("DROP TABLE " + tableName, function () {
                if (tableArray.length > 0) {
                    dropOneTable();
                }
            });
        }
        dropOneTable();
    });
}