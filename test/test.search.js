persistence.connect('searchtest', 'My search db', 5 * 1024 * 1024);

var Note = persistence.define('Note', {
    name: "TEXT",
    text: "TEXT"
});
Note.textIndex('name');
Note.textIndex('text');

persistence.schemaSync(function (tx) {
    var n = new Note();
    n.name = "Note 1";
    n.text = "This is my first note, it's quite cool!";
    persistence.add(n);
    n = new Note();
    n.name = "Note 2";
    n.text = "This another note, it's quite cool as well! I love these notes.";
    persistence.add(n);
    persistence.flush();
});
