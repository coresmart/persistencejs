window.asyncorm = window.asyncorm || {};

asyncorm.orm = asyncorm.orm || {};

asyncorm.orm.conn = null; // this has to be set by application

asyncorm.orm.ensureTables = function (tables, callback) {
    var db = asyncorm.orm.conn;
    var tableArray = [];
    for ( var table in tables) {
        if (tables.hasOwnProperty(table)) {
            tableArray.push( [ table, tables[table] ]);
        }
    }
    db.transaction(function (t) {
        function createOneTable () {
            var tableRecord = tableArray.pop();
            var tableName = tableRecord[0];
            var tableRows = tableRecord[1];
            var rowDef = '';
            for ( var prop in tableRows) {
                if (tableRows.hasOwnProperty(prop)) {
                    rowDef += prop + " " + tableRows[prop] + ", ";
                }
            }
            rowDef = rowDef.substring(0, rowDef.length - 2);
            t.executeSql("CREATE TABLE IF NOT EXISTS " + tableName
                    + " ( id VARCHAR(32) PRIMARY KEY, " + rowDef + ")", null, function () {
                if (tableArray.length > 0) {
                    createOneTable();
                } else {
                    if(callback) {
                        callback();
                    }
                }
            });
        }
        createOneTable();
    });
}

asyncorm.orm.dropTables = function (tableNames) {
    var db = asyncorm.orm.conn;
    db.transaction(function (t) {
        function dropOneTable () {
            var tableName = tableNames.pop();
            t.executeSql("DROP TABLE " + tableName, function () {
                if (tableArray.length > 0) {
                    dropOneTable();
                }
            });
        }
        dropOneTable();
    });
}

asyncorm.orm.create = function (kind) {
    var obj = {};
    obj._id = createUUID();
    obj._kind = kind;
    obj._new = true;
    obj.save = function(callback) {
        asyncorm.orm.save(obj, callback);
    };
    obj.remove = function(callback) {
        asyncorm.orm.remove(obj, callback);
    };
    return obj;
}

asyncorm.orm.all = function(kind, callback) {
    asyncorm.orm.conn.transaction(function (t) {
        t.executeSql('SELECT * FROM ' + kind, null, function(_, results) {
            var l = [];
            for(var i = 0; i < results.length; i++) {
                var r = results[i];
                var o = asyncorm.orm.create(kind);
                o._id = r.id;
                o._new = false;
                for(p in r) {
                    if(r.hasOwnProperty(p) && p != 'id') {
                        o[p] = r[p];
                    }
                }
                l.push(o);
            }
            callback(l);
        });
    });
}

asyncorm.orm.save = function (obj, callback) {
    var properties = [ ];
    var values = [ ];
    var qs = [];
    var propertyPairs = [];
    for ( var p in obj) {
        if (obj.hasOwnProperty(p) && typeof obj[p] != 'function' && p.substring(0, 1) != '_') {
            properties.push(p);
            if(typeof obj[p] === 'boolean') {
                values.push(obj[p] ? 1 : 0);
            } else {
                values.push(obj[p]);
            }
            qs.push('?');
            propertyPairs.push(p + " = ?");
        }
    }
    asyncorm.orm.conn.transaction(function (t) {
        if (obj._new) {
            properties.push('id');
            values.push(obj._id);
            qs.push('?');
            var sql = "INSERT INTO " + obj._kind + " (" + properties.join(", ")
                    + ") VALUES (" + qs.join(', ') + ")";
            console.log(sql);
            t.executeSql(sql, values, callback);
            obj._new = false;
        } else {
            var sql = "UPDATE " + obj._kind + " SET " + propertyPairs.join(',') + " WHERE id = '" + obj._id + "'";
            console.log(sql);
            t.executeSql(sql, values, callback);
        }
    });
}

asyncorm.orm.remove = function (obj, callback) {
    asyncorm.orm.conn.transaction(function (t) {
        var sql = "DELETE FROM " + obj._kind + " WHERE id = '" + obj._id + "'";
        console.log(sql);
        t.executeSql(sql, null, callback);
    });
}