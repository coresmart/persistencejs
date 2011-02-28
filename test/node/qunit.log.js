var util = require('util');
var qunit = require('../browser/qunit/qunit');
for (k in qunit) {
  if (qunit.hasOwnProperty(k)) global[k] = qunit[k];
}
var startTime = Date.now();

QUnit.testStart = function(name) {
  console.log(name + ':');
};

// qunit-tap (https://github.com/twada/qunit-tap)

// prototype.js
var stripTags = function (str) {
  if (!str) return str;
  return str.replace(/<\w+(\s+("[^"]*"|'[^']*'|[^>])+)?>|<\/\w+>/gi, "");
};

QUnit.log = function(result, message, details) {
  message = details ? details.message : stripTags(message);
  if (result) {
    //util.puts('\x1B[32m' + 'OK' + '\x1B[0m: ' + message);
  } else {
    util.error(' \x1B[31m' + 'FAILED' + '\x1B[0m: ' + message);
  }
};

QUnit.done = function(failures, total) {
  if (failures) {
    console.error('\n[ \x1B[31m' + failures + '\x1B[0m / ' + total + ' ] Failed');
  }
  console.log('(' + (Date.now() - startTime) + 'ms)');
};
