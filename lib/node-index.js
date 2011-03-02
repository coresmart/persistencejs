exports.persistence = require('./persistence').persistence;
exports.store = {};
exports.store.mysql = require('./persistence.store.mysql');
exports.store.sqlite = require('./persistence.store.sqlite');
