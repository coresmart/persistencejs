//new Migration(1, {
//    up: function() {
//        this.createTable('posts', function(t) {
//            t.column('title', 'VARCHAR');
//            t.column('date', 'DATE');
//        });
//    },
//    down: function() {
//        this.dropTable('posts');
//    }
//});

//persistence.migrate();  // latest version
//persistence.migrate(3);
//persistence.migrate(0); // clears schema


$(document).ready(function(){
    persistence.connect('migrationstest', 'My migrations db', 5 * 1024 * 1024);    
    persistence.db.log = false;
    
    Migrator.setup(function() {  


function createMigrations(starting, amount, actions){
    var amount = starting+amount;
    
    for (var i = starting; i < amount; i++) {
        var newActions = {
            up: actions.up,
            down: actions.down
        };
        
        if (actions.createDown) 
            newActions.down = actions.createDown(i);
            
        if (actions.createUp)
            newActions.up = actions.createUp(i);
        
        Migrator.migration(i, newActions);
    }
}

module("Migrator", {
    setup: function() {
        
    },
    teardown: function() {
        stop();
        Migrator.reset(start);
    }
});

asyncTest("getting and setting db version", 2, function() {        
    Migrator.version(function(v){
        equals(v, 0, 'initial db version');
    });           
    
    var newVersion = 100;
    
    Migrator.setVersion(newVersion, function() {
        Migrator.version(function(v){
            equals(v, newVersion, 'checking if version was set');
            start();
        });
    });
});

asyncTest("migrations scope", 2, function(){
    var migration = Migrator.migration(1, {
        up: function() {
            same(this, migration, 'up');
        },
        down: function() {
            same(this, migration, 'down');
        }
    });
    
    migration.up(function(){
        migration.down(function(){
            start();
        });
    });
});

asyncTest("migrating up to some version", 7, function(){
    var actionsRan = 0;
    var totalActions = 5;
    
    createMigrations(1, totalActions, { 
        up: function() { 
            actionsRan++;
            equals(this.version, actionsRan, 'running migration in order');
        }
    });
    
    Migrator.migrate(totalActions, function(){
        equals(actionsRan, totalActions, 'actions ran');
        Migrator.version(function(v){
            equals(v, totalActions, 'version changed to');
            start();        
        });
    });
});

asyncTest("migrating down to some version", 7, function(){
    var actionsRan = 0;
    var totalActions = 5;
    
    createMigrations(1, totalActions, { 
        createDown: function(i) {
            var position = Math.abs(actionsRan - i);
            return function () {
                actionsRan++;
                equals(this.version, position, 'running migration in order');
            };
        }
    });
    
    Migrator.setVersion(totalActions, function(){
        Migrator.migrate(0, function(){
            equals(actionsRan, totalActions, 'actions ran');
            Migrator.version(function(v){
                equals(v, 0, 'version changed to');
                start();        
            });
        });
    });
});

asyncTest("migrate to latest", 1, function(){
    var totalActions = 3;
    
    createMigrations(1, totalActions, { up: function() { } });

    Migrator.migrate(function() {
        Migrator.version(function(v){
            equals(v, totalActions, 'latest version');
            start();
        }); 
    });
});

module("Migration", {
    setup: function() {
        
    },
    teardown: function() {
        stop();
        // DROPS ALL TABLES
        var query = "select 'drop table ' || name || ';' AS dropTable from sqlite_master where type = 'table' and name not in ('__WebKitDatabaseInfoTable__', 'schema_version')";
        
        persistence.transaction(function(tx){
            tx.executeSql(query, null, function(result){
                var dropTablesSql = [];
                for (var i = 0; i < result.length; i++)
                    dropTablesSql.push([result[i].dropTable, null]);
                
                persistence.executeQueriesSeq(tx, dropTablesSql, function(){
                    Migrator.setVersion(0, function(){Migrator.reset(start);});
                });
            });
        });
    }
});

asyncTest("API", 12, function(){    
    var m = Migrator.migration(1, {
        up: function() { 
            ok(typeof(this.addColumn) == "function", 'addColumn');
            ok(typeof(this.removeColumn) == "function", 'removeColumn');
            ok(typeof(this.addIndex) == "function", 'addIndex');
            ok(typeof(this.removeIndex) == "function", 'removeIndex');
            ok(typeof(this.executeSql) == "function", 'execute');
            ok(typeof(this.dropTable) == "function", 'dropTable');
            ok(typeof(this.createTable) == "function", 'createTable');
            
            this.createTable('posts', function(table){
                ok(typeof(table.text) == "function", 'text column');
                ok(typeof(table.integer) == "function", 'integer column');
                ok(typeof(table.boolean) == "function", 'boolean column');
                ok(typeof(table.json) == "function", 'json column');
                ok(typeof(table.date) == "function", 'date column');
            });
        } 
    });
    
    m.up(start);
});

asyncTest("execute", 1, function(){    
    Migrator.migration(1, {
        up: function() { 
            this.executeSql('CREATE TABLE test (id INTEGER)');
        }
    });
    
    Migrator.migrate(function(){
        var sql = 'select name from sqlite_master where type = "table" and name == "test"';
        persistence.transaction(function(tx){
            tx.executeSql(sql, null, function(result){
                ok(result.length == 1, 'sql command ran');
                start();
            });
        });
    });
});

function tableExists(name, callback){
    var sql = 'select name from sqlite_master where type = "table" and name == "'+name+'"';
    persistence.transaction(function(tx){
        tx.executeSql(sql, null, function(result){
            ok(result.length == 1, name + ' table exists');
            if (callback) callback();
        });
    });
}

function tableNotExists(name, callback){
    var sql = 'select name from sqlite_master where type = "table" and name == "'+name+'"';
    persistence.transaction(function(tx){
        tx.executeSql(sql, null, function(result){
            ok(result.length == 0, name + ' table not exists');
            if (callback) callback();
        });
    });
}

function columnExists(table, column, type, callback) {
    var sql = 'select sql from sqlite_master where type = "table" and name == "'+table+'"';
    type = type.replace('(', '\\(').replace(')', '\\)');
    var regex = "CREATE TABLE \\w+ \\((\\w|[\\(\\), ])*" + column + " " + type + "(\\w|[\\(\\), ])*\\)";
    persistence.transaction(function(tx){
        tx.executeSql(sql, null, function(result){
            ok(result[0].sql.match(regex), column + ' colum exist');
            if (callback) callback();
        });
    });
}

function columnNotExists(table, column, type, callback) {
    var sql = 'select sql from sqlite_master where type = "table" and name == "'+table+'"';
    type = type.replace('(', '\\(').replace(')', '\\)');
    var regex = "CREATE TABLE \\w+ \\((\\w|[\\(\\), ])*" + column + " " + type + "(\\w|[\\(\\), ])*\\)";
    persistence.transaction(function(tx){
        tx.executeSql(sql, null, function(result){
            ok(!result[0].sql.match(regex), column + ' colum does note exist');
            if (callback) callback();
        });
    });
}

asyncTest("createTable", 1, function(){    
    Migrator.migration(1, {
        up: function() {
            this.createTable('testing');
        }
    });
    
    Migrator.migrate(function(){
        tableExists('testing', start)
    });
});

asyncTest("createTable adds id by default", 1, function(){    
    Migrator.migration(1, {
        up: function() {
            this.createTable('testing');
        }
    });
    
    Migrator.migrate(function(){
        columnExists('testing', 'id', 'VARCHAR(32) PRIMARY KEY', start);
    });
});

asyncTest("createTable with text column", 1, function(){    
    Migrator.migration(1, {
        up: function() {
            this.createTable('customer', function(t){
                t.text('name');
            });
        }
    });
    
    Migrator.migrate(function(){
        columnExists('customer', 'name', 'TEXT', start);
    });
});

asyncTest("createTable with integer column", 1, function(){    
    Migrator.migration(1, {
        up: function() {
            this.createTable('customer', function(t){
                t.integer('age');
            });
        }
    });
    
    Migrator.migrate(function(){
        columnExists('customer', 'age', 'INT', start);
    });
});

asyncTest("createTable with boolean column", 1, function(){    
    Migrator.migration(1, {
        up: function() {
            this.createTable('customer', function(t){
                t.boolean('married');
            });
        }
    });
    
    Migrator.migrate(function(){
        columnExists('customer', 'married', 'BOOL', start);
    });
});

asyncTest("createTable with date column", 1, function(){    
    Migrator.migration(1, {
        up: function() {
            this.createTable('customer', function(t){
                t.date('birth');
            });
        }
    });
    
    Migrator.migrate(function(){
        columnExists('customer', 'birth', 'DATE', start);
    });
});

asyncTest("createTable with json column", 1, function(){    
    Migrator.migration(1, {
        up: function() {
            this.createTable('customer', function(t){
                t.json('sample_json');
            });
        }
    });
    
    Migrator.migrate(function(){
        columnExists('customer', 'sample_json', 'TEXT', start);
    });
});

asyncTest("addColumn", 1, function(){    
    Migrator.migration(1, {
        up: function() {
            this.createTable('customer');
            this.addColumn('customer', 'name', 'TEXT');
        }
    });
    
    Migrator.migrate(function(){
        columnExists('customer', 'name', 'TEXT', start);
    });
});

asyncTest("removeColumn", 2, function(){    
    Migrator.migration(1, {
        up: function() {
            this.createTable('customer', function(t){
                t.json('sample_json');
            });
            this.removeColumn('customer', 'sample_json');
        }
    });
    
    Migrator.migrate(function(){
        columnExists('customer', 'id', 'VARCHAR(32) PRIMARY KEY');
        columnNotExists('customer', 'sample_json', 'TEXT', start);
    });
});

asyncTest("dropTable", 1, function(){    
    Migrator.migration(1, {
        up: function() {
            this.createTable('customer');
            this.dropTable('customer');
        }
    });
    
    Migrator.migrate(function(){
        tableNotExists('customer', start);
    });
});

    }); // end Migrator.setup()
});
