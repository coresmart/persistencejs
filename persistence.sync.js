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

persistence.sync.Change = persistence.define('_Change', {
    action: "VARCHAR(10)",
    date: "INT",
    data: "JSON"
});

persistence.sync.Sync = persistence.define('_Sync', {
    date: "INT"
});

(function() {

    // Keep old flush implementation to call later
    persistence.oldFlush = persistence.flush;

    /**
     * Overriding `persistence.flush` to track changes made
     */
    persistence.flush = function (tx, callback) {
      if(!tx) {
        persistence.transaction(function(tx) { persistence.flush(tx, callback); });
        return;
      }
      for (var id in persistence.getTrackedObjects()) {
        if (persistence.getTrackedObjects().hasOwnProperty(id)) {
          var obj = persistence.trackedObjects[id];
          if(obj._new) {
            var change = new persistence.sync.Change();
            change.date = new Date().getTime();
            change.action = 'new';
            var rec = {};
            var fields = persistence.define(obj._type).meta.fields;
            console.log(fields);
            for(var f in fields) {
              if(fields.hasOwnProperty(f)) {
                rec[f] = obj._data[f];
              }
            }
            console.log("New: " + id);
            var refs = persistence.define(obj._type).meta.hasOne;
            for(var r in refs) {
              if(refs.hasOwnProperty(r)) {
                rec[r] = obj._data[r];
              }
            }
            console.log("New 8: " + id);
            rec.id = obj.id;
            rec._type = obj._type;
            change.data = rec;
            persistence.add(change);
          } else {
            for ( var p in obj._dirtyProperties) {
              if (obj._dirtyProperties.hasOwnProperty(p)) {
                var change = new persistence.sync.Change();
                change.date = new Date().getTime();
                change.action = 'set-prop';
                change.data = {type: obj._type, id: obj.id, prop: p, value: obj[p]};
                persistence.add(change);
              }
            }
          }
        }
      }
      for (var id in persistence.getObjectsToRemove()) {
        if (persistence.getObjectsToRemove().hasOwnProperty(id)) {
          var change = new persistence.sync.Change();
          change.date = new Date().getTime();
          change.action = 'delete';
          change.data = id;
          persistence.add(change);
        }
      }
      persistence.oldFlush(tx, callback);
    }

  }());

