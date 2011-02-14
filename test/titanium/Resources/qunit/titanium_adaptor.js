Titanium.include('qunit/qunit.js');

// =============================================================================
// Uncomment the following lines in order to get jsMockito support for mocking
// (after following jsMockito install instructions)
// =============================================================================

// Titanium.include('qunit/jshamcrest.js');
// Titanium.include('qunit/jsmockito-1.0.2.js');
// JsHamcrest.Integration.QUnit();
// JsMockito.Integration.importTo(this);

var logger = function(failures, message) {
	if (failures) {
		Titanium.API.error(message);
	} else {
		Titanium.API.info(message);
	}
};
// QUnit.testStart(name) is called whenever a new test batch of assertions starts running. name is the string name of the test batch.
QUnit.testStart = function(name) {
	logger(false, '>> >> >>TEST START: '+name);
};
// QUnit.testDone(name, failures, total) is called whenever a batch of assertions finishes running. name is the string name of the test batch. failures is the number of test failures that occurred. total is the total number of test assertions that occurred.
QUnit.testDone = function(name, failures, total) {
	logger(failures, '<< << <<TEST DONE : '+name+' FAILURES: '+failures+' out of TOTAL: '+total);
};
// QUnit.moduleStart(name) is called whenever a new module of tests starts running. name is the string name of the module.
QUnit.moduleStart = function(name) {
	logger(false, '>> >>MODULE START: '+name);
};
// QUnit.moduleDone(name, failures, total) is called whenever a module finishes running. name is the string name of the module. failures is the number of module failures that occurred. total is the total number of module assertions that occurred.
QUnit.moduleDone = function(name, failures, total) {
	logger(failures, '<< <<MODULE DONE : '+name+' FAILURES: '+failures+' out of TOTAL: '+total);
};
// QUnit.begin() is called once before running any tests. It should have been called QUnit.start, but thats already in use elsewhere and can't be changed.
QUnit.begin = function() {
	logger(false, 'BEGIN');
};
// QUnit.done(failures, total) is called whenever all the tests have finished running. failures is the number of failures that occurred. total is the total number of assertions that occurred.
QUnit.done = function(failures, total) {
	logger(failures, 'DONE : FAILURES: '+failures+' out of TOTAL: '+total);
};

// QUnit.log(result, message) is called whenever an assertion is completed. result is a boolean (true for passing, false for failing) and message is a string description provided by the assertion.

QUnit.log = function(result, message) {
	if (!result) {
	    logger(true, message);
	} else {
	    Titanium.API.info(message);
	}
};

// Tests to run
Titanium.include('test/tests_to_run.js');