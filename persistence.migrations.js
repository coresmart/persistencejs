/**
 * @license
 * Copyright (c) 2010 Fábio Rehm <fgrehm@gmail.com>
 * 
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */

var Migrator = {
    migrations: [],

    version: function(callback) {
        persistence.transaction(function(t){
            t.executeSql('SELECT current_version FROM schema_version', null, function(result){
                if (result.length == 0) {
                    t.executeSql('INSERT INTO schema_version VALUES (0)', function(){
                        callback(0);
                    });
                } else {
                    callback(result[0].current_version);
                }
            });
        });
    },

    setVersion: function(v, callback) {
        persistence.transaction(function(t){
            t.executeSql('UPDATE schema_version SET current_version = ?', [v], function(){
                Migrator._version = v;
                if (callback) callback();
            });
        });
    },
    
    setup: function(callback) {
        persistence.transaction(function(t){
            t.executeSql('CREATE TABLE IF NOT EXISTS schema_version (current_version INTEGER)', null,
                function(){
                    // Creates a dummy migration just to force setting schema version when cleaning DB
                    Migrator.migration(0, { up: function() { }, down: function() { } });
                    if (callback) callback();
                });
        });
    },
    
    // Method should only be used for testing
    reset: function(callback) {
        // Creates a dummy migration just to force setting schema version when cleaning DB
        Migrator.migrations = [];
        Migrator.migration(0, { up: function() { }, down: function() { } });
        Migrator.setVersion(0, callback);
    },
    
    migration: function(version, actions) {
        Migrator.migrations[version] = new Migration(version, actions);
        return Migrator.migrations[version];
    },
    
    migrateUpTo: function(version, callback) {
        var migrationsToRun = [];
        
        function migrateOne() {
            var migration = migrationsToRun.pop();
            
            if (!migration) callback();
            
            migration.up(function(){
                if (migrationsToRun.length > 0) {
                    migrateOne();
                } else if (callback) {
                    callback();
                }
            });
        }
        
        this.version(function(currentVersion){
            for (var v = currentVersion+1; v <= version; v++)
                migrationsToRun.unshift(Migrator.migrations[v]);

            if (migrationsToRun.length > 0) {
                migrateOne();
            } else if (callback) {
                callback();
            }
        });
    },
    
    migrateDownTo: function(version, callback) {
        var migrationsToRun = [];
        
        function migrateOne() {
            var migration = migrationsToRun.pop();
            
            if (!migration) callback();
            
            migration.down(function(){
                if (migrationsToRun.length > 0) {
                    migrateOne();
                } else if (callback) {
                    callback();
                }
            });
        }
        
        this.version(function(currentVersion){
            for (var v = currentVersion; v >= version; v--)
                migrationsToRun.unshift(Migrator.migrations[v]);

            if (migrationsToRun.length > 0) {
                migrateOne();
            } else if (callback) {
                callback();
            }
        });
    },
    
    migrate: function(version, callback) {
        if ( arguments.length === 1 ) {
            callback = version;
            version = this.migrations.length-1;
        }
        
        this.version(function(curVersion){
            if (curVersion < version)
                Migrator.migrateUpTo(version, callback);
            else if (curVersion > version)
                Migrator.migrateDownTo(version, callback);
            else
                callback();
        });
    }
}

var Migration = function(version, actions) {
    this.version = version;
    // TODO check if actions contains up and down methods
    this.actions = actions;
    this.queue = [];
};


Migration.prototype.executeQueries = function(callback) {
    var queue = this.queue;
    persistence.transaction(function(tx) {
        persistence.executeQueriesSeq(tx, queue, callback);
    });
}

Migration.prototype.up = function(callback) {
    this.actions.up.apply(this);
    var version = this.version;
    
    this.executeQueries(function(){
        Migrator.setVersion(version, callback);
    });
}

Migration.prototype.down = function(callback) {
    this.actions.down.apply(this);
    var version = this.version;
    
    this.executeQueries(function(){
        Migrator.setVersion(version, callback);
    });
}

Migration.prototype.createTable = function(tableName, callback) {
    var table = new ColumnsHelper();
    
    if (callback) callback(table);
    
    var sql = 'CREATE TABLE ' + tableName + ' (id VARCHAR(32) PRIMARY KEY';
    for (var i = 0; i < table.columns.length; i++)
        sql += ', ' + table.columns[i];
        
    this.execute(sql + ')');    
}

Migration.prototype.dropTable = function(tableName) {
    console.log('drop table ' + tableName);
}

Migration.prototype.addColumn = function(tableName, columnName, columnType) {
    console.log('add column ' + columnName + ' (' + columnType + ') to ' + tableName);
}

Migration.prototype.removeColumn = function(tableName, columnName) {
    console.log('remove column ' + columnName + ' from ' + tableName);
}

Migration.prototype.addIndex = function(tableName, columnName, unique) {
    console.log('create index on ' + tableName + '.' + columnName + ' unique? ' + (unique ? 'true' : 'false'));
}

Migration.prototype.removeIndex = function(tableName, columnName) {
    console.log('remove index on ' + tableName + '.' + columnName);
}

Migration.prototype.execute = function(sql, args) {
    this.queue.push([sql, args]);
}

var ColumnsHelper = function() {
    this.columns = [];
}

ColumnsHelper.prototype.text = function(columnName) {
    this.columns.push(columnName + ' TEXT');
}

ColumnsHelper.prototype.integer = function(columnName) {
    this.columns.push(columnName + ' INT');
}

ColumnsHelper.prototype.boolean = function(columnName) {
    this.columns.push(columnName + ' BOOL');
}

ColumnsHelper.prototype.date = function(columnName) {
    this.columns.push(columnName + ' DATE');
}

ColumnsHelper.prototype.json = function(columnName) {
    this.columns.push(columnName + ' TEXT');
}
