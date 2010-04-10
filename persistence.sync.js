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
      var persistObjArray = [];
      for (var id in trackedObjects) {
        if (trackedObjects.hasOwnProperty(id)) {
          persistObjArray.push(trackedObjects[id]);
        }
      }
      var removeObjArray = [];
      for (var id in objectsToRemove) {
        if (objectsToRemove.hasOwnProperty(id)) {
          removeObjArray.push(objectsToRemove[id]);
        }
      }
      persistence.oldFlush(tx, callback);
    }


  }());

