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

/**
 * Default name for last-change-timestamp entity property
 */
persistence.sync.column = 'lastChange';

persistence.sync.getJSON = function(uri, callback) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", uri, true);
    xmlHttp.send();
    xmlHttp.onreadystatechange = function() {
      if(xmlHttp.readyState==4 && xmlHttp.status==200) {
        callback(JSON.parse(xmlHttp.responseText));
      }
    };
};

persistence.sync.postJSON = function(uri, data, callback) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("POST", uri, true);
    xmlHttp.setRequestHeader('Content-Type', 'application/json');
    xmlHttp.send(data);
    xmlHttp.onreadystatechange = function() {
      if(xmlHttp.readyState==4 && xmlHttp.status==200 && callback) {
        callback(xmlHttp.responseText);
      }
    };
};


(function() {

    persistence.sync.Sync = persistence.define('_Sync', {
        entity: "TEXT",
        serverDate: "DATE",
        localDate: "DATE"
      });


    function sendResponse(uri, updatesToPush) {
      //console.log("Updates to push: ", JSON.stringify(updatesToPush));
      persistence.sync.postJSON(uri, JSON.stringify(updatesToPush), function() {
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

    persistence.sync.synchronize = function(uri, Entity, conflictCallback, callback) {
      persistence.sync.Sync.findBy('entity', Entity.meta.name, function(sync) {
          var lastServerSyncTime = sync ? persistence.get(sync, 'serverDate') : new Date(0);
          var lastLocalSyncTime = sync ? persistence.get(sync, 'localDate') : new Date(0);
          if(!sync) {
            sync = new persistence.sync.Sync({entity: Entity.meta.name});
            persistence.add(sync);
          }  
          persistence.sync.getJSON(uri + '?since=' + entityValToJson(lastServerSyncTime, 'DATE'), function(result) {
              var ids = [];
              var lookupTbl = {};  
 
              var conflicts = [];
              var updatesToPush = [];
              var fieldSpec = Entity.meta.fields;
              
              for (var i=0; i<result.updates.length; i++) {
                  var item = result.updates[i];
                  ids.push(item.id);
                  lookupTbl[item.id] = item;
              }
              //console.log(ids);
              Entity.all().filter("id", "in", ids).list(function(existingItems) { 
                  for (var i=0; i<existingItems.length; i++) { 
                      var localItem = existingItems[i];   
                      var remoteItem = lookupTbl[localItem.id];
                      delete remoteItem.id;
                      persistence.set(remoteItem, persistence.sync.column,
                          jsonToEntityVal(persistence.get(remoteItem,  persistence.sync.column), 'DATE'));
                      delete lookupTbl[localItem.id];

                      var localItemLastChange = persistence.get(localItem, persistence.sync.column);
                      var remoteItemLastChange = persistence.get(remoteItem, persistence.sync.column);
                      if(remoteItemLastChange.getTime() === localItemLastChange.getTime()) {
                        return; // not changed
                      }
                      var localChangedSinceSync = lastLocalSyncTime.getTime() < localItemLastChange.getTime();
                      var remoteChangedSinceSync = lastServerSyncTime.getTime() < remoteItemLastChange.getTime();

                      var itemUpdatedFields = {
                          id: localItem.id,
                          lastChange: remoteItemLastChange
                      };
                      var itemUpdated = false;
                      for(var p in remoteItem) {
                        if(remoteItem.hasOwnProperty(p) && p != persistence.sync.column) {
                          if(localItem[p] !== remoteItem[p]) {
                            //console.log("Property differs: " + p);
                            if(localChangedSinceSync && remoteChangedSinceSync) { // Conflict!
                              //console.log("Conflict!");
                              conflicts.push({local: localItem, remote: remoteItem, property: p});
                            } else if(localChangedSinceSync) {
                              //console.log("Push:", fieldSpec[p]);
                              itemUpdated = true;
                              itemUpdatedFields[p] = entityValToJson(persistence.get(localItem, p), fieldSpec[p]);
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
                    };
                  // Add new remote items
                  for(var id in lookupTbl) {
                    if(lookupTbl.hasOwnProperty(id)) {
                      var remoteItem = lookupTbl[id];
                      delete remoteItem.id;
                      var localItem = new Entity(remoteItem);
                      localItem.id = id; // also with getter / setter ???
                      persistence.set(localItem, persistence.sync.column,
                          jsonToEntityVal(persistence.get(remoteItem,  persistence.sync.column), 'DATE'));
                      persistence.add(localItem);  
                      //console.log("Added: ", localItem);
                    }
                  }
                  // Find local new items
                  Entity.all().filter("id", "not in", ids).filter("lastChange", ">", lastLocalSyncTime).list(function(newItems) {
                      //newItems.forEach(function(newItem) {
                      for (var i=0; i<newItems.length; i++) {
                          var newItem = newItems[i];
                          var update = { id: newItem.id };
                          for(var p in newItem._data) {
                            if(newItem._data.hasOwnProperty(p)) {
                              update[p] = entityValToJson(persistence.get(newItem, p), fieldSpec[p]);
                            }
                          }
                          updatesToPush.push(update);
                      }
                      conflictCallback(conflicts, updatesToPush, function() {
                          sendResponse(uri, updatesToPush);
                          persistence.set(sync, 'localDate', new Date());
                          persistence.set(sync, 'serverDate', jsonToEntityVal(result.now, 'DATE'));
                          persistence.flush(callback);
                      });
                    });
                });
            });
        });
    }
}());
