/**
 * Low level database interface, abstracts from Google Gears or HTML 5 db
 */

window.persistence = window.persistence || {};

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
