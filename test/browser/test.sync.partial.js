//In theory, before doing any syncing, log in
//retrieve client identifier to use with sync requests
var teacher_id = 1;

$(document).ready(function(){
	persistence.store.websql.config(persistence, "teachereval", 'database', 5 * 1024 * 1024);
	Student = persistence.define('Student', {
		student_id : "INT",
		first_name : "TEXT",
		last_name : "TEXT",
	});

	Teacher = persistence.define('Teacher', {
		teacher_id : "INT",
		first_name : "TEXT",
		last_name : "TEXT",
	});

	Class = persistence.define('Class', {
		class_id : "INT",
		teacher_id : "INT",
		class_name : "TEXT",
	});

	StudentClass = persistence.define('student_class', {
		student_id : "INT",
		class_id : "INT",
	});
	
	Student.enableSync('/studentUpdates/'+teacher_id);
	Teacher.enableSync('/teacherUpdates/'+teacher_id);
	Class.enableSync('/classUpdates/'+teacher_id);
	StudentClass.enableSync('/studentclassUpdates/'+teacher_id);

	persistence.reset(function(){
		persistence.schemaSync(function(){
			persistence.sync.getJSON('/reset', function() {
				Teacher.syncAll(persistence.sync.preferRemoteConflictHandler, function(){
					Class.syncAll(persistence.sync.preferRemoteConflictHandler, function(){
						Student.syncAll(persistence.sync.preferRemoteConflictHandler, function(){
							StudentClass.syncAll(persistence.sync.preferRemoteConflictHandler, function(){});
						});
					});
				});
			});
		});
	});
});
