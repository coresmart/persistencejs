/**
 * Low level database interface, abstracts from Google Gears or HTML 5 db
 */

window.asyncorm = window.asyncorm || {};

asyncorm.db = asyncorm.db || {};

asyncorm.db.implementation = "unsupported";
asyncorm.db.conn = null;
asyncorm.db.log = true;

if (window.google && google.gears) {
    asyncorm.db.implementation = "gears";
} else if (window.openDatabase) {
    asyncorm.db.implementation = "html5";
}

asyncorm.db.html5 = {};

asyncorm.db.html5.connect = function (dbname, description, size) {
    var that = {};
    var conn = openDatabase(dbname, '1.0', description, size);

    that.transaction = function (fn) {
        return conn.transaction(function (sqlt) {
            return fn(asyncorm.db.html5.transaction(sqlt));
        });
    };
    return that;
};

asyncorm.db.html5.transaction = function (t) {
    var that = {};
    that.executeSql = function (query, args, successFn, errorFn) {
        if(asyncorm.db.log) {
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

asyncorm.db.gears = {};

asyncorm.db.gears.connect = function (dbname) {
    var that = {};
    var conn = google.gears.factory.create('beta.database');
    conn.open(dbname);

    that.transaction = function (fn) {
        fn(asyncorm.db.gears.transaction(conn));
    };
    return that;
};

asyncorm.db.gears.transaction = function (conn) {
    var that = {};
    that.executeSql = function (query, args, successFn, errorFn) {
        if(asyncorm.db.log) {
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

asyncorm.db.connect = function (dbname, description, size) {
    if (asyncorm.db.implementation == "html5") {
        return asyncorm.db.html5.connect(dbname, description, size);
    } else if (asyncorm.db.implementation == "gears") {
        return asyncorm.db.gears.connect(dbname);
    }
};
