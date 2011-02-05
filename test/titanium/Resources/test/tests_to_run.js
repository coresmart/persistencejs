//setting up stuff so that the environment kind of looks like a browser
var window = {};
var console = {
  log: function() {
    Titanium.API.debug(arguments[0]);
  }
};
var document = null;
$ = function(document) {
  return {ready: function(f) {f();}};
};

//requiring persistencejs
Titanium.include('lib/persistence.js',
                 'lib/persistence.store.sql.js',
                 'lib/persistence.store.titanium.js');
var persistence = window.persistence;
//allows us to run unmodified browser tests in titanium
persistence.store.websql = persistence.store.titanium;


// Tests to run
Titanium.include('test/browser/test.persistence.js');
//Titanium.include('test/browser/util.js');
//Titanium.include('test/browser/test.migrations.js');
