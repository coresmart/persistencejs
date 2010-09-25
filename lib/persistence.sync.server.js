/**
 * Copyright (c) 2010 Zef Hemel <zef@zef.me>
 * 
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 *
 *
 * USAGE:
 * On first run, be sure to initialize the database first: http://localhost:8888/init
 * otherwise the application will hang (because the select query fails). After that,
 * just visit http://localhost:8888/
 */
var sys = require('sys');

function log(o) {
  sys.print(sys.inspect(o) + "\n");
}

function jsonToEntityVal(value, type) {
  if(type) {
    switch(type) {
    case 'DATE': 
      return new Date(value * 1000); 
      break;
    default:
      return value;
    }
  } else {
    return value;
  }
}

function getEpoch(date) {
  return date.getTime(); //Math.round(date.getTime()/1000);
}

function entityValToJson(value, type) {
  if(type) {
    switch(type) {
    case 'DATE': 
      return Math.round(date.getTime() / 1000);
      break;
    default:
      return value;
    }
  } else {
    return value;
  }
}

exports.pushUpdates = function(session, tx, Entity, since, includeProperties, callback) {
  var properties = Object.keys(includeProperties);
  var cheapProperties = [];
  var expensiveProperties = [];

  function buildJson(dbitem, includeProperties, callback) {
    var itemData = item._data;
    item = {id: item.id};
    cheapProperties.forEach(function(p) {
        item[p] = entityValToJson(itemData[p], fieldSpec[p]);
      });
    var properties = expensiveProperties.slice();
    function processOneProperty() {
      var p = properties.pop();

      if(meta.hasOne[p]) {
        dbitem.fetch(session, tx, p, function(obj) {
            buildJson(obj, includeProperties[p], function(result) {
                item[p] = result;
                if(properties.length > 0) {
                  processOneProperty();
                } else {
                  callback(item);
                }
              });
          });
      } else if(meta.hasMany[p]) {

      }
    }
    if(properties.length > 0) {
      processOneProperty();
    } else {
      callback(item);
    }
  }

  properties.forEach(function(p) {
      if(includeProperties[p] === true) { // simple, loaded field
        cheapProperties.push(p);
      } else {
        expensiveProperties.push(p);
      }
    });
  Entity.all(session).filter("_lastChange", ">", since).list(tx, function(items) {
      var results = [];
      var meta = Entity.meta;
      var fieldSpec = meta.fields;
      function processOneItem() {
        var item = items.pop();

        if(items.length > 0) {
          processOneItem();
        } else {
          callback({now: getEpoch(new Date()), updates: results});
        }
      }
    });
};

exports.receiveUpdates = function(session, tx, Entity, updates, validator, callback) {
  validator = validator || function() { return true; };
  var allIds = [];
  var updateLookup = {};
  var now = getEpoch(new Date());
  for(var i = 0; i < updates.length; i++) {
    allIds.push(updates[i].id);
    updateLookup[updates[i].id] = updates[i];
  }
  Entity.all(session).filter("id", "in", allIds).list(tx, function(existingItems) {
      var fieldSpec = Entity.meta.fields;

      for(var i = 0; i < existingItems.length; i++) {
        var existingItem = existingItems[i];
        var updateItem = updateLookup[existingItem.id];
        for(var p in updateItem) {
          if(updateItem.hasOwnProperty(p)) {
            if(updateItem[p] !== existingItem._data[p]) {
              existingItem[p] = jsonToEntityVal(updateItem[p], fieldSpec[p]);
              existingItem._lastChange = now;
            }
          }
        }
        delete updateLookup[existingItem.id];
      }
      // All new items
      for(var id in updateLookup) {
        if(updateLookup.hasOwnProperty(id)) {
          var update = updateLookup[id];
          delete update.id;
          var newItem = new Entity(session);
          newItem.id = id;
          for(var p in update) {
            if(update.hasOwnProperty(p)) {
              newItem[p] = jsonToEntityVal(update[p], fieldSpec[p]);
            }
          }
          newItem._lastChange = now;
          session.add(newItem);
        }
      }
      session.flush(tx, function() {
          callback({status: 'ok', now: now});
        });
    });
};

exports.config = function(persistence) {
    persistence.entityDecoratorHooks.push(function(Entity) {
        /**
         * Declares an entity to be tracked for changes
         */
        Entity.enableSync = function() {
          Entity.meta.enableSync = true;
          Entity.meta.fields['_lastChange'] = 'BIGINT';
        };
      });

    /**
     * Resets _lastChange property if the object has dirty project (i.e. the object has changed)
     */
    persistence.flushHooks.push(function(session, tx) {
        var queries = [];
        for (var id in session.getTrackedObjects()) {
          if (session.getTrackedObjects().hasOwnProperty(id)) {
            var obj = session.getTrackedObjects()[id];
            var meta = persistence.getEntityMeta()[obj._type];
            if(meta.enableSync) {
              var isDirty = obj._new;
              var lastChangeIsDirty = false;
              for ( var p in obj._dirtyProperties) {
                if (obj._dirtyProperties.hasOwnProperty(p)) {
                  isDirty = true;
                }
                if(p === '_lastChange') {
                  lastChangeIsDirty = true;
                }
              }
              if(isDirty && !lastChangeIsDirty) {
                // Only set _lastChange if it has not been set manually (during a sync)
                obj._lastChange = getEpoch(new Date());
              }
            }
          }
        }
      });
  };
