/**
 * @license
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
 */

if(!window.persistence) { // persistence.js not loaded!
  throw "persistence.js should be loaded before persistence.sync.js"
}

persistence.sync = {};

persistence.sync.get = function(uri, successCallback, errorCallback) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", uri, true);
    xmlHttp.send();
    xmlHttp.onreadystatechange = function() {
      if(xmlHttp.readyState==4 && xmlHttp.status==200) {
        if (successCallback) successCallback(xmlHttp.responseText);
      } else {
        if (errorCallback) errorCallback();  
      }
    }; 
};

persistence.sync.post = function(uri, data, successCallback, errorCallback) { 
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("POST", uri, true);
    xmlHttp.setRequestHeader('Content-Type', 'application/json');
    xmlHttp.send(data);
    xmlHttp.onreadystatechange = function() {
      if(xmlHttp.readyState==4 && xmlHttp.status==200) {
        if (successCallback) successCallback(xmlHttp.responseText);
      } else {
        if (errorCallback) errorCallback();  
      }
    };  
}; 


(function() {

    persistence.sync.Sync = persistence.define('_Sync', {
        entity: "VARCHAR(255)",
        serverDate: "DATE",
        localDate: "DATE"
      });


    function sendResponse(uri, updatesToPush) {
      //console.log("Updates to push: ", JSON.stringify(updatesToPush));◊
      persistence.sync.post(uri, JSON.stringify(updatesToPush), function() {
        //alert("Yep!");  
      });
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

    function entityValToJson(value, type) {
      if(type) {
        switch(type) {
        case 'DATE': 
          return value.getTime()/1000;
          break;
        default:
          return value;
        }
      } else {
        return value;
      }
    }

    persistence.entityDecoratorHooks.push(function(Entity) {
        /**
         * Declares an entity to be tracked for changes
         */
        Entity.enableSync = function() {
          Entity.meta.enableSync = true;
          Entity.meta.fields['_lastChange'] = 'DATE';
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
              for ( var p in obj._dirtyProperties) {
                if (obj._dirtyProperties.hasOwnProperty(p)) {
                  isDirty = true;
                }
              }
              if(isDirty) {
                obj._lastChange = new Date();
              }
            }
          }
        }
      });

    persistence.sync.synchronize = function(uri, Entity, conflictCallback, callback) {
      // TODO: Add transaction and session support
      persistence.flush(function() {
          persistence.sync.Sync.findBy('entity', Entity.meta.name, function(sync) {
              var lastServerSyncTime = sync ? sync.serverDate : new Date(0);
              var lastLocalSyncTime = sync ? sync.serverDate : new Date(0);
              var meta = Entity.meta;
              var fieldSpec = meta.fields;
              if(!sync) {
                sync = new persistence.sync.Sync({entity: Entity.meta.name});
                persistence.add(sync);
              }

              persistence.sync.get(uri + '?since=' + entityValToJson(lastServerSyncTime, 'DATE'), function(responseText) { 
                  var result = JSON.parse(responseText);
                  var ids = [];
                  var lookupTbl = {};

                  var conflicts = [];
                  var updatesToPush = [];

                  console.log(result);
                  result.updates.forEach(function(item) {
                      ids.push(item.id);
                      lookupTbl[item.id] = item;
                    })
                  //console.log(ids);
                  Entity.all().filter("id", "in", ids).list(function(existingItems) {
                      existingItems.forEach(function(localItem) {
                          var remoteItem = lookupTbl[localItem.id];
                          delete remoteItem.id;
                          remoteItem._lastChange = jsonToEntityVal(remoteItem._lastChange, 'DATE');
                          delete lookupTbl[localItem.id];
                          if(remoteItem._lastChange.getTime() === localItem._lastChange.getTime()) {
                            return; // not changed
                          }
                          var localChangedSinceSync = lastLocalSyncTime.getTime() < localItem._lastChange.getTime();
                          var remoteChangedSinceSync = lastServerSyncTime.getTime() < remoteItem._lastChange.getTime();

                          var itemUpdatedFields = { id: localItem.id, _lastChange: remoteItem._lastChange };
                          var itemUpdated = false;
                          for(var p in remoteItem) {
                            if(remoteItem.hasOwnProperty(p) && p != '_lastChange') {
                              if(localItem._data[p] !== remoteItem[p]) {
                                //console.log("Property differs: " + p);
                                if(localChangedSinceSync && remoteChangedSinceSync) { // Conflict!
                                  //console.log("Conflict!");
                                  conflicts.push({local: localItem, remote: remoteItem, property: p});
                                } else if(localChangedSinceSync) {
                                  //console.log("Push:", fieldSpec[p]);
                                  itemUpdated = true;
                                  itemUpdatedFields[p] = entityValToJson(localItem._data[p], fieldSpec[p]);
                                } else {
                                  //console.log("Pull: ", fieldSpec[p]);
                                  localItem[p] = jsonToEntityVal(remoteItem[p], fieldSpec[p]);
                                }
                              }
                            }
                          }
                          if(itemUpdated) {
                            updatesToPush.push(itemUpdatedFields);
                          }
                        });
                      // Add new remote items
                      for(var id in lookupTbl) {
                        if(lookupTbl.hasOwnProperty(id)) {
                          var remoteItem = lookupTbl[id];
                          delete remoteItem.id;
                          var localItem = new Entity(remoteItem);
                          localItem.id = id;
                          localItem._lastChange = jsonToEntityVal(remoteItem._lastChange, 'DATE');
                          persistence.add(localItem);
                          //console.log("Added: ", localItem);
                        }
                      }
                      // Find local new/updated items
                      Entity.all().filter("id", "not in", ids).filter("_lastChange", ">", lastLocalSyncTime).list(function(newItems) {
                          console.log("Updated/new: ", newItems);
                          newItems.forEach(function(newItem) {
                              var update = { id: newItem.id };
                              for(var p in fieldSpec) {
                                if(fieldSpec.hasOwnProperty(p)) {
                                  update[p] = entityValToJson(newItem._data[p], fieldSpec[p]);
                                }
                              }
                              for(var p in meta.hasOne) {
                                if(meta.hasOne.hasOwnProperty(p)) {
                                  update[p] = entityValToJson(newItem._data[p], fieldSpec[p]);
                                }
                              }
                              updatesToPush.push(update);
                            });
                          function next() {
                            sendResponse(uri, updatesToPush);
                            sync.localDate = new Date();
                            sync.serverDate = jsonToEntityVal(result.now, 'DATE');
                            //console.log("Sync object:", sync);
                            persistence.flush(callback);
                          }
                          if(conflicts.length > 0) {
                            conflictCallback(conflicts, updatesToPush, next);
                          } else {
                            next();
                          }
                        });
                    });
                });
            });
        });
    }
  }());

