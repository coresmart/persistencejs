$(document).ready(function(){
  persistence.store.websql.config(persistence, 'searchtest', 'My db', 5 * 1024 * 1024);
  persistence.search.config(persistence, persistence.store.websql.sqliteDialect);
  persistence.debug = true;

  var Note = persistence.define('Note', {
      title: "TEXT",
      text: "TEXT"
    });

  Note.textIndex('title');
  Note.textIndex('text');

  module("Setup");

  asyncTest("setting up database", 1, function() {
      persistence.reset(function() {
          persistence.schemaSync(function(tx){
              ok(tx.executeSql, 'schemaSync passed transaction as argument to callback');
              start();
            });
        });
    });

  module("Search test");

  asyncTest("Create some sample data", function() {
      persistence.add(new Note({title: "My first note", text: "This is my first note. It has a rather high duplication quotient, or whatever."}));
      persistence.add(new Note({title: "My second note", text: "This is my second note. Isn't it a cool note? Third, fourth."}));
      persistence.add(new Note({title: "My third note", text: "Nothing here yet"}));
      persistence.add(new Note({title: "Unrelated", text: "Under contruction."}));
      persistence.flush(function() {
          start();
        });
    });

  asyncTest("Searching", function() {
      Note.search("note").list(function(results) {
          equals(results.length, 3, "returned correct number of results");
          equals(results[0].title, "My second note", "Found most relevant result");
          Note.search("title: third").list(function(results) {
              equals(results.length, 1, "returned correct number of results");
              equals(results[0].title, "My third note", "Searched in only title");
              Note.search("thi*").list(function(results) {
                  equals(results.length, 3, "wildcard search");
                  Note.search("thi*").limit(1).list(function(results) {
                      equals(results.length, 1, "limit number of search results");
                      start();
                    });
                });
            });
        });
    });

});
