persistence.search.js
==============
`persistence.search.js` is a light-weight extension of the
`persistence.js` library that adds full-text search through a simple
API.

Example usage:

    var Note = persistence.define('Note', {
        name: "TEXT",
        text: "TEXT",
        status: "TEXT"
    });
    Note.textIndex('name');
    Note.textIndex('text');

This sample defines a `Note` entity with three properties of which
`name` and `text` are full-text indexed. For this a new database table
will be created that stores the index.

Searching is done as follows:

    Note.search("note").list(tx, function(results) {
      console.log(results);
    });

or you can paginate your results using `limit` and `skip` (similar
to `limit` and `skip` in QueryCollections).

    Note.search("note").limit(10).skip(10).list(null, function(results) {
      console.log(results);
    });

Query language
--------------

Queries can contain regular words. In addition the `*` wildcard can be
used anywhere with a word. The `property:` notation can be used to
search only a particular field. Examples:

* `note`
* `name: note`
* `interesting` 
* `inter*`
* `important essential`

Note that currently a result is return when _any_ word matches.
Results are ranked by number of occurences of one of the words in the
text.
