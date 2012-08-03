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

if(!window.persistence) { // persistence.js not loaded!
  throw new Error("persistence.js should be loaded before persistence.migrations.js");
}

(function() {
  
    var Migrator = {
      migrations: [],
      
      version: function(callback) {
        persistence.transaction(function(t){
          t.executeSql('SELECT current_version FROM schema_version', null, function(result){
            if (result.length == 0) {
              t.executeSql('INSERT INTO schema_version VALUES (0)', null, function(){
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
          t.executeSql('CREATE TABLE IF NOT EXISTS schema_version (current_version INTEGER)', null, function(){
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
          for (var v = currentVersion; v > version; v--)
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
    
    var Migration = function(version, body) {
      this.version = version;
      // TODO check if actions contains up and down methods
      this.body = body;
      this.actions = [];
    };
    
    Migration.prototype.executeActions = function(callback, customVersion) {
      var actionsToRun = this.actions;
      var version = (customVersion!==undefined) ? customVersion : this.version;
      
      persistence.transaction(function(tx){
        function nextAction() {
          if (actionsToRun.length == 0)
            Migrator.setVersion(version, callback);
          else {
            var action = actionsToRun.pop();
            action(tx, nextAction);
          }
        }
        
        nextAction();
      });
    }
    
    Migration.prototype.up = function(callback) {
      if (this.body.up) this.body.up.apply(this);
      this.executeActions(callback);
    }
    
    Migration.prototype.down = function(callback) {
      if (this.body.down) this.body.down.apply(this);
      this.executeActions(callback, this.version-1);
    }
    
    Migration.prototype.createTable = function(tableName, callback) {
      var table = new ColumnsHelper();
      
      if (callback) callback(table);
      
      var column;
      var sql = 'CREATE TABLE ' + tableName + ' (id VARCHAR(32) PRIMARY KEY';
      while (column = table.columns.pop())
        sql += ', ' + column;
      
      this.executeSql(sql + ')');
    }
    
    Migration.prototype.dropTable = function(tableName) {
      var sql = 'DROP TABLE ' + tableName;
      this.executeSql(sql);
    }
    
    Migration.prototype.addColumn = function(tableName, columnName, columnType) {
      var sql = 'ALTER TABLE ' + tableName + ' ADD ' + columnName + ' ' + columnType;
      this.executeSql(sql);
    }
    
    Migration.prototype.removeColumn = function(tableName, columnName) {
      this.action(function(tx, nextCommand){
        var sql = 'select sql from sqlite_master where type = "table" and name == "'+tableName+'"';
        tx.executeSql(sql, null, function(result){
          var columns = new RegExp("CREATE TABLE `\\w+` |\\w+ \\((.+)\\)").exec(result[0].sql)[1].split(', ');
          var selectColumns = [];
          var columnsSql = [];
          
          for (var i = 0; i < columns.length; i++) {
            var colName = new RegExp("((`\\w+`)|(\\w+)) .+").exec(columns[i])[1];
            if (colName == columnName) continue;
            
            columnsSql.push(columns[i]);
            selectColumns.push(colName);
          }
          columnsSql = columnsSql.join(', ');
          selectColumns = selectColumns.join(', ');
          
          var queries = [];
          queries.unshift(["ALTER TABLE " + tableName + " RENAME TO " + tableName + "_bkp;", null]);
          queries.unshift(["CREATE TABLE " + tableName + " (" + columnsSql + ");", null]);
          queries.unshift(["INSERT INTO " + tableName + " SELECT " + selectColumns + " FROM " + tableName + "_bkp;", null]);
          queries.unshift(["DROP TABLE " + tableName + "_bkp;", null]);
          
          persistence.executeQueriesSeq(tx, queries, nextCommand);
        });
      });
    }
    
    Migration.prototype.addIndex = function(tableName, columnName, unique) {
      var sql = 'CREATE ' + (unique === true ? 'UNIQUE' : '') + ' INDEX ' + tableName + '_' + columnName + ' ON ' + tableName + ' (' + columnName + ')';
      this.executeSql(sql);
    }
    
    Migration.prototype.removeIndex = function(tableName, columnName) {
      var sql = 'DROP INDEX ' + tableName + '_' + columnName;
      this.executeSql(sql);
    }
    
    Migration.prototype.executeSql = function(sql, args) {
      this.action(function(tx, nextCommand){
        tx.executeSql(sql, args, nextCommand);
      });
    }
    
    Migration.prototype.action = function(callback) {
      this.actions.unshift(callback);
    }
    
    var ColumnsHelper = function() {
      this.columns = [];
    }
    
    ColumnsHelper.prototype.text = function(columnName) {
      this.columns.unshift(columnName + ' TEXT');
    }
    
    ColumnsHelper.prototype.integer = function(columnName) {
      this.columns.unshift(columnName + ' INT');
    }
    
    ColumnsHelper.prototype.real = function(columnName) {
      this.columns.unshift(columnName + ' REAL');
    }
    
    ColumnsHelper.prototype['boolean'] = function(columnName) {
      this.columns.unshift(columnName + ' BOOL');
    }
    
    ColumnsHelper.prototype.date = function(columnName) {
      this.columns.unshift(columnName + ' DATE');
    }
    
    ColumnsHelper.prototype.json = function(columnName) {
      this.columns.unshift(columnName + ' TEXT');
    }
    
    // Makes Migrator and Migration available to tests
    persistence.migrations = {};
    persistence.migrations.Migrator = Migrator;
    persistence.migrations.Migration = Migration;
    persistence.migrations.init = function() { Migrator.setup.apply(Migrator, Array.prototype.slice.call(arguments, 0))};
    
    persistence.migrate = function() { Migrator.migrate.apply(Migrator, Array.prototype.slice.call(arguments, 0))};
    persistence.defineMigration = function() { Migrator.migration.apply(Migrator, Array.prototype.slice.call(arguments, 0))};
    
}());
