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
  
  var M1 = persistence.defineMixin('M1', {
    seq: "INT",
    m1: "TEXT"
  });
  
  var M2 = persistence.defineMixin('M2', {
    seq: "INT",
    m2: "TEXT"
  });
  
  M1.hasOne('oneM2', M2);
  M1.hasMany('manyM2', M2, 'oneM1');
  M1.hasMany('manyManyM2', M2, 'manyManyM1');
  M2.hasMany('manyManyM1', M1, 'manyManyM2');
  
  var A1 = persistence.define('A1', {
    a1: 'TEXT'
  });
  var A2 = persistence.define('A2', {
    a2: 'TEXT'
  });
  var B1 = persistence.define('B1', {
    b1: 'TEXT'
  });
  var B2 = persistence.define('B2', {
    b2: 'TEXT'
  });
  
  A1.is(M1);
  A2.is(M2);
  B1.is(M1);
  B2.is(M2);
  
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

  
    asyncTest("basic mixin", 7, function(){
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
            });
          });     
        });
      });
    });
  
    asyncTest("many to many with mixins", 17, function(){
      var a1 = new A1({
        seq: 1,
        a1: "a1"
      });
      var b1 = new B1({
        seq: 2,
        b1: "b1"
      });
      var a2 = new A2({
        seq: 3,
        a2: "a2"
      });
      var a2x = new A2({
        seq: 4,
        a2: "a2x"
      });
      var a2y = new A2({
        seq: 5,
        a2: "a2y"
      });
      var b2x = new B2({
        seq: 6,
        b2: "b2x"
      });
      var b2y = new B2({
        seq: 7,
        b2: "b2y"
      });
      persistence.add(a1);
      a1.oneM2 = b2x;
      a1.manyM2.add(a2x);
      a1.manyM2.add(b2x);
      persistence.flush(function(){
        persistence.clean();
        A1.all().list(function(a1s){
          equals(a1s.length, 1, "A1 list ok")
          var a1 = a1s[0];
          a1.fetch("oneM2", function(m2){
            ok(m2 != null, "oneM2 not null");
            equals(m2.b2, "b2x", "oneM2 ok");
            a1.manyM2.order('seq', true).list(function(m2s){
              equals(m2s.length, 2, "manyM2 length ok");
              equals(m2s[0].a2, "a2x", "manyM2[0] ok");
              equals(m2s[1].b2, "b2x", "manyM2[1] ok");
              m2s[1].fetch("oneM1", function(m1){
                ok(m1 != null, "manyM2[1].oneM1 not null");
                ok(m1.a1, "a1", "manyM2[1].oneM1 ok");
                a1.manyManyM2.add(a2x);
                a1.manyManyM2.add(b2x);
                persistence.add(b2y);
                b2y.manyManyM1.add(a1);
                b2y.manyManyM1.add(b1);
                persistence.flush(function(){
                  persistence.clean();
                  A1.all().list(function(a1s){
                    equals(a1s.length, 1, "A1 list ok")
                    var a1 = a1s[0];
                    a1.manyManyM2.order('seq', true).list(function(m2s){
                      equals(m2s.length, 3, "manyManyM2 length ok");
                      equals(m2s[0].a2, "a2x", "manyManyM2[0] ok");
                      equals(m2s[1].b2, "b2x", "manyManyM2[1] ok");
                      equals(m2s[2].b2, "b2y", "manyManyM2[2] ok");
                      m2s[2].manyManyM1.order('seq', true).list(function(m1s){
                        equals(m1s.length, 2, "manyManyM1 length ok");
                        equals(m1s[0].a1, "a1", "manyManyM1[0] ok");
                        equals(m1s[1].b1, "b1", "manyManyM1[1] ok");
                        a1.manyManyM2.count(function(count){
                          equals(count, 3, "count ok on polymorphic list");
                          //a1.manyManyM2.destroyAll(function(){
                          start();
                        //})
                        });
                      })
                    });
                  });
                })
              });
            });
          });
        });
      });
    });
  

});
