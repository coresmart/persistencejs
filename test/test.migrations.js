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

    }); // end Migrator.setup()
});
