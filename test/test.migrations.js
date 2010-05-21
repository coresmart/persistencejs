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
    
    Migrator.setup(function() {  
      
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

asyncTest("migrating up to some version in order", 6, function(){
    var actionsRan = 0;
    var totalActions = 5;
    
    for (var i = 1; i <= totalActions; i++)
        Migrator.migration(i, { 
            up: function() { 
                actionsRan++;
                equals(this.version, actionsRan, 'migration in order');
            }
        });
    
    Migrator.migrateUpTo(totalActions, function(){
        equals(actionsRan, totalActions, 'actions ran');
        start();
    });
});

asyncTest("migrating up to some version changes schema version", 1, function(){
    var totalActions = 5;    
    for (var i = 1; i <= totalActions; i++)
        Migrator.migration(i, { up: function() {} });
    
    Migrator.migrateUpTo(totalActions, function(){
        Migrator.version(function(v){
            equals(v, totalActions, 'version changed to');
            start();        
        });
    });
});

asyncTest("migrating down to some version in order", 6, function(){
    var actionsRan = 0;
    var totalActions = 5;
    
    for (var i = 1; i <= totalActions; i++)
        Migrator.migration(i, { 
            down: function() { 
                actionsRan++;
                equals(this.version, Math.abs(actionsRan - i), 'migration in order');
            }
        });
    
    Migrator.setVersion(totalActions, function(){
        Migrator.migrateDownTo(0, function(){
            equals(actionsRan, totalActions, 'actions ran');
            start();
        });
    });
});

asyncTest("migrating down to some version changes schema version", 1, function(){
    var totalActions = 5;
    for (var i = 1; i <= totalActions; i++)
        Migrator.migration(i, { down: function() {} });
    
    Migrator.setVersion(totalActions, function(){
        Migrator.migrateDownTo(0, function(){
            Migrator.version(function(v){
                equals(v, 0, 'version changed to');
                start();        
            });
        });
    });
});

    }); // end Migrator.setup()
});
