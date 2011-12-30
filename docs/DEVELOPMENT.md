Documentation for developers
============================

Constructor functions
---------------------

    var Task = persistence.define('Task', {
      name: "TEXT",
      done: "BOOL"
    });
    var Category = persistence.define('Category', {
      name: "TEXT"
    });
    Task.hasOne('category', Category);

`Task` is a constructor function that is used to create new instances of the `Task` entity, but also can be used to retrieve meta data from, using `Task.meta`. This `meta` field provides the following information:

* `name`, the name of the entity as set as first argument of `define`
* `fields`, the field object passed to the original `define`,
  consisting of property names as keys and textual column types as
  values.
* `hasOne`, an object with relation names as keys and relationship
  objects as values. The relationship object currently has one field:
  `type`: which links to the constructor function of the type of the
  relation. Example: `Task.hasOne.category.type` will equal the
  `Category` constructor.
* `hasMany`, an object with relation anmes as keys and relationship objects as values. The relationship has the following fields:
   * `type`: the constructor function of the relationship entity
   * `inverseProperty`: the property name of the inverse relation
   * `manyToMany`: a boolean value indicating if this is a manyToMany
     relationship or not (then it's a one-tomany)
    * `tableName`: name of the utility coupling table used for a
      many-to-many relationship

Extension hooks
----------------

* `persistence.entityDecoratorHooks`: a list of functions (with the
  constructor function as argument) to be called to decorate. Useful to
  add new functionality to constructo functions, such as `Task.index`.
* `persistence.flushHooks`: a list of functions to be called before flushing.
* `persistence.schemaSyncHooks`: a list of functions to be called before syncing the schema.

