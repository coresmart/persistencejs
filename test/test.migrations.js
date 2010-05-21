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
        Migrator.setVersion(0, function(){start();});
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
            start();
        }
    });
    
    migration.up();
    migration.down();
});

    }); // end Migrator.setup()
});
