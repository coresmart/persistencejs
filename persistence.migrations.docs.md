# persistence.migrations.js

`persistence.migrations.js` is a plugin for `persistence.js` that provides
a simple API for altering your databases in a structured and organised manner
inpired by [Ruby on Rails migrations](http://guides.rubyonrails.org/migrations.html).

## Anatomy of a Migration

    persistence.defineMigration(1, {
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

This migration adds a table called `Task` with a string column called `name`,
a text column called `description` and a boolean column called `done`. 
A `id VARCHAR(32) PRIMARY KEY` collumn will also be added, however since
this is the default we do not need to ask for this. Reversing this migration
is as simple as dropping the table. The first argument passed to `defineMigration`
is the migration version which should be incremented when defining following
migrations

Migrations are not limited to changing the schema. You can also use them to
fix bad data in the database or populate new fields:

    persistence.defineMigration(2, {
      up: function() {
        this.addColumn('User', 'email', 'TEXT');

        // You can execute some raw SQL
        this.execute('UPDATE User SET email = username + "@domain.com"');

        // OR 

        // you can define a custom action to query for objects and manipulate them
        this.action(function(tx, nextAction){
          allUsers.list(tx, function(result){
            result.forEach(function(u){
              u.email = u.userName + '@domain.com';
              persistence.add(u);
            });
            persistence.flush(tx, function() {
              // Please remember to call this when you are done with an action,
              // otherwise the system will hang
              nextAction();
            });
          });
        });
      }
    });

This migration adds a `email` column to the `User` table and sets all emails
to `"{userName}@domain.com"`.

## API methods

    persistence.defineMigration(3, {
      up: function() {
        this.addColumn({table}, {column name}, {column type});
        this.removeColumn({table}, {column name});
        this.addIndex({table}, {column name});
        this.removeIndex({table}, {column name});
        this.executeSql({raw sql});
        this.dropTable({table name});

        this.createTable({table name}, function(table){
          table.text({column name});
          table.integer({column name});
          table.boolean({column name});
          table.json({column name});
          table.date({column name});
        });
      }
    });

## Running Migrations

After your migrations have been loaded, you can run `persistence.migrate()` to
run migrations until the most recent or you can pass a version number to migrate()
in case you need to rollback to some specific version.
