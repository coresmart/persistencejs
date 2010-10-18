$(document).ready(function(){
  persistence.store.websql.config(persistence, 'persistencetest', 'My db', 5 * 1024 * 1024);
  //persistence.store.memory.config(persistence);
  persistence.debug = true;
  //persistence.debug = false;
  
  var startTime = new Date().getTime();
  
  var Project = persistence.define('Project', {
    name: "TEXT"
  });
  
  var Task = persistence.define('Task', {
    name: "TEXT"
  });
  
  var Tag = persistence.define('Tag', {
    name: "TEXT"
  });
  
  Task.hasMany('tags', Tag, 'tasks');
  Tag.hasMany('tasks', Task, 'tags');
  
  Project.hasMany('tasks', Task, 'project');
  
  var Note = persistence.define('Note', {
    text: "TEXT"
  });
  
  var Annotatable = persistence.defineMixin('Annotatable', {
    lastAnnotated: "DATE"
  });
  
  Annotatable.hasMany('notes', Note, 'annotated');
  
  Task.hasMany('tags', Tag, 'tasks');
  Tag.hasMany('tasks', Task, 'tags');
  
  Project.hasMany('tasks', Task, 'project');
  
  Task.is(Annotatable);
  Project.is(Annotatable);
  
  window.Project = Project;
  window.Task = Task
  window.Project = Project;
  
  module("Setup");
  
  asyncTest("setting up database", 1, function(){
    persistence.schemaSync(function(tx){
      ok(true, 'schemaSync called callback function');
      start();
    });
  });
  
  module("Annotatable mixin", {
      setup: function() {
        stop();
        persistence.reset(function() {
            persistence.schemaSync(start);
          });
      }
    });

  
    asyncTest("creating mixin", 7, function(){
      var now = new Date();
      now.setMilliseconds(0);
      
      var p = new Project({
        name: "project p"
      });
      persistence.add(p);
      var n1 = new Note({
        text: "note 1"
      });
      var n2 = new Note({
        text: "note 2"
      });
      p.notes.add(n1);
      n2.annotated = p;
      p.lastAnnotated = now;
      persistence.flush(function(){
      
      })
      Project.all().list(function(projects){
        persistence.clean();
        equals(projects.length, 1)
        var p = projects[0];
        p.notes.order('text', true).list(function(notes){
          equals(notes.length, 2);
          equals(notes[0].text, "note 1");
          equals(notes[1].text, "note 2");
          notes[0].fetch("annotated", function(source){
            equals(p.id, source.id);
            equals(typeof source.lastAnnotated, typeof now);
            equals(source.lastAnnotated.getTime(), now.getTime());
            start();
          })
        });
      });
    });
  

});
