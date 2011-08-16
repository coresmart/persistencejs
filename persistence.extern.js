// This file is for Google Closure Compiler to prevent renaming third-party API

var persistence = {};

/** @type {boolean} */
persistence.debug;

persistence.flush = function(tx, callback){};

persistence.define = function(entityName, fields){};

persistence.schemaSync = function(tx, callback, emulate){};

persistence.migrate = function(){};

/** @type {object} */
persistence.migrations;

persistence.migrations.init = function(){};

/** @type {object} */
persistence.store;

/** @type {object} */
persistence.store.sql;

/** @type {object} */
persistence.store.websql;

persistence.store.websql.config = function(persistence, dbname, description, size){};

/** @type {object} */
persistence.store.titanium;

persistence.store.titanium.config = function(persistence, dbname, description, size){};


function QueryCollection(){}

QueryCollection.prototype.oldAddEventListener = function(eventType, fn){};

QueryCollection.prototype.setupSubscriptions = function(){};

QueryCollection.prototype.teardownSubscriptions = function(){};

QueryCollection.prototype.addEventListener = function(eventType, fn){};

QueryCollection.prototype.persistQueries = function(){};

QueryCollection.prototype.init = function (session, entityName, constructor){};

QueryCollection.prototype.toUniqueString = function(){};

QueryCollection.prototype.clone = function (cloneSubscribers){};

QueryCollection.prototype.filter = function (property, operator, value){};

QueryCollection.prototype.or = function (filter){};

QueryCollection.prototype.and = function (filter){};

QueryCollection.prototype.order = function (property, ascending){};

QueryCollection.prototype.limit = function(n){};

QueryCollection.prototype.skip = function(n){};

QueryCollection.prototype.reverse = function(){};

QueryCollection.prototype.prefetch = function (rel){};

QueryCollection.prototype.selectJSON = function(tx, props, callback){};

QueryCollection.prototype.add = function(obj){};

QueryCollection.prototype.addAll = function(objs){};

QueryCollection.prototype.remove = function(obj){};

QueryCollection.prototype.each = function(tx, eachFn){};

QueryCollection.prototype.forEach = function(tx, eachFn){};

QueryCollection.prototype.one = function(tx, oneFn){};


function LocalQueryCollection(){}

LocalQueryCollection.prototype.count = function(tx, callback){};

LocalQueryCollection.prototype.destroyAll = function(callback){};

LocalQueryCollection.prototype.list = function(tx, callback){};

LocalQueryCollection.prototype.count = function(tx, callback){};

LocalQueryCollection.prototype.remove = function(obj){};

LocalQueryCollection.prototype.addAll = function(objs){};

LocalQueryCollection.prototype.add = function(obj){};

LocalQueryCollection.prototype.clone = function(){};


function ManyToManyDbQueryCollection(session, entityName){}

ManyToManyDbQueryCollection.prototype.initManyToMany = function(obj, coll){};

ManyToManyDbQueryCollection.prototype.add = function(obj){};

ManyToManyDbQueryCollection.prototype.addAll = function(objs){};

ManyToManyDbQueryCollection.prototype.clone = function(){};

ManyToManyDbQueryCollection.prototype.remove = function(obj){};


function AllDbQueryCollection(session, entityName){}

AllDbQueryCollection.prototype.add = function(obj){};

AllDbQueryCollection.prototype.remove = function(obj){};
