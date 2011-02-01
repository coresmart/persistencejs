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
    
    persistence.defineMigration(i, newActions);
  }
}

var Migrator = persistence.migrations.Migrator;

$(document).ready(function(){
  persistence.store.websql.config(persistence, 'migrationstest', 'My db', 5 * 1024 * 1024);
  persistence.debug = true;
  
  persistence.migrations.init(function() {
    
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

asyncTest("addIndex", 1, function(){
  Migrator.migration(1, {
    up: function() {
      this.createTable('customer', function(t){
        t.integer('age');
      });
      this.addIndex('customer', 'age');
    }
  });
  
  Migrator.migrate(function(){
    indexExists('customer', 'age', start);
  });
});

asyncTest("removeIndex", 1, function(){
  Migrator.migration(1, {
    up: function() {
      this.createTable('customer', function(t){
        t.integer('age');
      });
      this.addIndex('customer', 'age');
      this.removeIndex('customer', 'age');
    }
  });
  
  Migrator.migrate(function(){
    indexNotExists('customer', 'age', start);
  });
});

module("Models", {
  setup: function() {
    
    stop();
    
    this.Task = persistence.define('Task', {
      name: "TEXT",
      description: "TEXT",
      done: "BOOL"
    });
    
    Migrator.migration(1, {
      up: function() {
        this.createTable('Task', function(t){
          t.text('name');
          t.text('description');
          t.boolean('done');
        });
      },
      down: function() {
        this.dropTable('Task');
      }
    });
    
    Migrator.migrate(function(){
      start();
    });
  },
  teardown: function() {
    stop();
    
    Migrator.migrate(0, function(){
      start();
    });
  }
});

asyncTest("Adding and retrieving Entity after migration", 1, function(){
  var task = new this.Task({name: 'test'});
  var allTasks = this.Task.all();
  
  persistence.add(task).flush(function() {
    persistence.clean(); delete task;
    allTasks.list(function(result){
      equals(result.length, 1, 'task found');
      start();
    });
  });
});

module("Custom actions", {
  setup: function() {
    stop();
    
    this.User = persistence.define('User', {
      userName: "TEXT",
      email: "TEXT"
    });
    
    Migrator.migration(1, {
      up: function() {
        this.createTable('User', function(t){
          t.text('userName');
        });
      },
      down: function() {
        this.dropTable('User');
      }
    });
    
    Migrator.migrate(function(){
      start();
    });
  },
  teardown: function() {
    stop();
    
    Migrator.migrate(0, function(){
      start();
    });
  }
});


asyncTest("Running custom actions", 2, function(){
  var user1 = new this.User({userName: 'user1'});
  var user2 = new this.User({userName: 'user2'});
  var allUsers = this.User.all();
  
  function addUsers() {
    persistence.add(user1).add(user2).flush(createAndRunMigration);
  }

  function createAndRunMigration() {
    Migrator.migration(2, {
      up: function() {
        this.addColumn('User', 'email', 'TEXT');
        this.action(function(tx, nextAction){
          allUsers.list(tx, function(result){
            result.forEach(function(u){
              u.email = u.userName + '@domain.com';
              persistence.add(u);
            });
            persistence.flush(tx, nextAction);
          });
        });
      }
    });
    Migrator.migrate(assertUpdated);
  }
  
  function assertUpdated() {
    allUsers.list(function(result){
      result.forEach(function(u){
        ok(u.email == u.userName + '@domain.com');
      });
      start();
    });
  }
  
  addUsers();
});
    
  }); // end persistence.migrations.init()
});
