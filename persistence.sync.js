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

(function() {

    persistence.sync.Sync = persistence.define('_Sync', {
        entity: "VARCHAR(255)",
        serverDate: "DATE",
        localDate: "DATE"
      });

    persistence.sync.synchronize = function(uri, Entity, conflictCallback, callback) {
      persistence.sync.Sync.findBy('entity', Entity.meta.name, function(sync) {
          var lastServerSyncTime = sync ? sync.serverDate.getTime() : 0;
          var lastLocalSyncTime = sync ? sync.serverDate.getTime() : 0;

          var xmlHttp = new XMLHttpRequest();
          xmlHttp.open("GET", uri + '?since=' + lastServerSyncTime, true);
          xmlHttp.send();
          xmlHttp.onreadystatechange = function() {
            if(xmlHttp.readyState==4 && xmlHttp.status==200) {
              var data = JSON.parse(xmlHttp.responseText);
              var ids = [];
              var lookupTbl = {};

              var conflicts = [];
              var updatesToPush = [];

              console.log(data);
              data.forEach(function(item) {
                  ids.push(item.id);
                  lookupTbl[item.id] = item;
                })
              console.log(ids);
              Entity.all().filter("id", "in", ids).list(function(existingItems) {
                  existingItems.forEach(function(localItem) {
                      var remoteItem = lookupTbl[localItem.id];
                      delete remoteItem.id;
                      remoteItem.lastChange = new Date(remoteItem.lastChange);
                      delete lookupTbl[localItem.id];
                      if(remoteItem.lastChange.getTime() === localItem.lastChange.getTime()) {
                        return; // not changed
                      }
                      var localChangedSinceSync = lastLocalSyncTime < localItem.lastChange.getTime();
                      var remoteChangedSinceSync = lastServerSyncTime < remoteItem.lastChange.getTime();

                      var itemUpdatedFields = { id: localItem.id };
                      var itemUpdated = false;
                      for(var p in remoteItem) {
                        if(remoteItem.hasOwnProperty(p)) {
                          if(localItem[p] !== remoteItem[p]) {
                            console.log("Property differs: " + p);
                            if(localChangedSinceSync && remoteChangedSinceSync) { // Conflict!
                              console.log("Conflict!");
                              conflicts.push({local: localItem, remote: remoteItem, property: p});
                            } else if(localChangedSinceSync) {
                              console.log("Push!");
                              itemUpdated = true;
                              itemUpdatedFields[p] = localItem[p];
                            } else {
                              console.log("Pull!");
                              localItem[p] = remoteItem[p];
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
                      localItem.lastChange = new Date(remoteItem.lastChange);
                      persistence.add(localItem);
                      console.log("Added: ", localItem);
                    }
                  }
                  // Find local new items
                  Entity.all().filter("id", "not in", ids).filter("lastChange", ">", lastLocalSyncTime).list(function(newItems) {
                      newItems.forEach(function(newItem) {
                          var update = { id: newItem.id };
                          for(var p in newItem._data) {
                            if(newItem._data.hasOwnProperty(p)) {
                              update[p] = newItem._data[p];
                            }
                          }
                          updatesToPush.push(update);
                        });
                      conflictCallback(conflicts, updatesToPush, function() {
                          console.log("Updates to push: ", updatesToPush);
                          persistence.flush(callback);
                        });
                    });
                });
            }
          }
        });
    }
  }());

