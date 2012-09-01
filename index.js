if (define != undefined) {
  define(['./lib/'], function (lib) { return lib; });
} else {
  module.exports = require('./lib/');
}
