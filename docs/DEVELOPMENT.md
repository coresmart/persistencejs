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

Idioms
------

Because persistence.js is an asynchronous library, a lot happens
asynchronously (shocker). The way I typically handle an unknown
sequence of asynchronous calls is as follows, I know it's expensive on
the stack (it makes a lot of recursive calls), but it's the best I've
been able to come up with.

Let's say we have an array `myArray` of values and we have to invoke a
function `someAsyncFunction` on each item sequentially. Except, the
function is asynchronous, and thus does not return a value
immediately, but instead has a callback that is called with the
result. This is how I typically implement that in persistence.js, note
that this destroys `myArray`, at the end the array is empty, so if you 
care about its value, `.slice(0)` it first.

    var myArray = [1, 2, 3, 4, 5];

    function processOne() {
      var item = myArray.pop(); // pop (last) item from the array
      someAsyncFunction(item, function(result) {
        // do something with result
        if(myArray.length > 0) {
          processOne();
        } else {
          // Do whatever you need when you're completely done
        }
      });
    }

    if(myArray.length > 0) {
      processOne();
    } else {
      // Do whatever you need when you're completely done
    }
