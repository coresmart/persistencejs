var sys = require('sys');
var connect = require('connect');
var express = require('express');

var persistence = require('../../lib/persistence').persistence;
var persistenceStore = require('../../lib/persistence.store.mysql');
var persistenceSync = require('../../lib/persistence.sync.server');

// Database configuration
persistenceStore.config(persistence, 'localhost', 3306, 'partialsync', 'psyncuser', 'psyncpass');

// Switch off query logging:
//persistence.db.log = false;

function log(o) {
  sys.print(sys.inspect(o) + "\n");
}

persistenceSync.config(persistence);

// Data model
Student = persistence.define('Student', {
	student_id : "INT",
	first_name : "TEXT",
	last_name : "TEXT",
});

Student.enableSync();

Teacher = persistence.define('Teacher', {
	teacher_id : "INT",
	first_name : "TEXT",
	last_name : "TEXT",
});

Teacher.enableSync();

Class = persistence.define('Class', {
	class_id : "INT",
	teacher_id : "INT",
	class_name : "TEXT",
});

Class.enableSync();

StudentClass = persistence.define('student_class', {
	student_id : "INT",
	class_id : "INT",
});

StudentClass.enableSync();


var app = express.createServer(
  connect.bodyDecoder(), 
  connect.staticProvider('.'),
  function(req, res, next) {
    var end = res.end;

    req.conn = persistenceStore.getSession();
    res.end = function() {
      req.conn.close();
      end.apply(res, arguments);
    };
    req.conn.transaction(function(tx) {
        req.tx = tx;
        next();
      });
  }
);


app.get('/reset', function(req, res) {
    req.conn.schemaSync(req.tx, function() {
        req.conn.flush(req.tx, function() {
            res.send({status: "ok"});
          });
      });
});

app.get('/classUpdates/:teacher_id',  function(req, res) {
	var filters = req.params.teacher_id ? {0:{property:'teacher_id',operator:'=',value:req.params.teacher_id}} : null;
    persistenceSync.pushUpdates(req.conn, req.tx, Class, req.query.since, filters, function(updates) {
        res.send(updates);
    });
});

app.post('/classUpdates/:teacher_id',  function(req, res) {
    persistenceSync.receiveUpdates(req.conn, req.tx, Class, req.body, function(result) {
        res.send(result);
    });
});

app.get('/studentUpdates/:teacher_id',  function(req, res) {
	var session = persistenceStore.getSession();
	if(req.params.teacher_id){
		var student_ids = new Array();
		var class_ids = new Array();
		Class.all(session).filter('teacher_id', '=', req.params.teacher_id).list(function(classes){
			for(i in classes){
				console.log('class_id = ' + classes[i].class_id);
				StudentClass.all(session).filter('class_id','=',classes[i].class_id).list(function(sc){
					for(j in sc){
						student_ids.push(sc[j].student_id);
						if(i==(classes.length-1) && j==(sc.length-1)){
							filters = {0:{property:'student_id', operator:'in', value:student_ids}}
							persistenceSync.pushUpdates(req.conn, req.tx, Student, req.query.since, filters, function(updates) {
								res.send(updates);
							});
						}
					}
				});
			}
		});
	}else{
		persistenceSync.pushUpdates(req.conn, req.tx, Student, req.query.since, null, function(updates) {
			res.send(updates);
		});
	}
    
});

app.post('/studentUpdates/:teacher_id',  function(req, res) {
    persistenceSync.receiveUpdates(req.conn, req.tx, Student, req.body, function(result) {
        res.send(result);
    });
});  
  
app.get('/teacherUpdates/:id',  function(req, res) {
	var filters = req.params.id ? {0:{property:'teacher_id',operator:'=',value:req.params.id}} : null;
    persistenceSync.pushUpdates(req.conn, req.tx, Teacher, req.query.since, filters, function(updates) {
		res.send(updates);
    });
});

app.post('/teacherUpdates/:id',  function(req, res) {
    persistenceSync.receiveUpdates(req.conn, req.tx, Teacher, req.body, function(result) {
        res.send(result);
	});
});  

app.get('/studentclassUpdates/:teacher_id',  function(req, res) {
	var session = persistenceStore.getSession();
	if(req.params.teacher_id){
		var class_ids = new Array();
		Class.all(session).filter('teacher_id', '=', req.params.teacher_id).list(function(classes){
			for(i in classes){
				class_ids.push(classes[i].class_id);
				if(i==(classes.length-1)){
					filters = {0:{property:'class_id', operator:'in', value:class_ids}}
					persistenceSync.pushUpdates(req.conn, req.tx, StudentClass, req.query.since, filters, function(updates) {
						res.send(updates);
					});
				}
			}
		});
	}else{
		persistenceSync.pushUpdates(req.conn, req.tx, Student, req.query.since, null, function(updates) {
			res.send(updates);
		});
	}
});

app.post('/studentclassUpdates/:teacher_id',  function(req, res) {
    persistenceSync.receiveUpdates(req.conn, req.tx, StudentClass, req.body, function(result) {
        res.send(result);
	});
});  


app.listen(80);

console.log('Server running at http://127.0.0.1:80');
