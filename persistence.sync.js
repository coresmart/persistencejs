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

    /**
     * Dumps the entire database to a JSON string 
     * @param tx transaction to use, use `null` to start a new one
     * @param entities a list of entity constructor functions to serialize, use `null` for all
     * @param callback (jsonDump) the callback function called with the results.
     */
    persistence.dumpToJson = function(tx, entities, callback) {
      persistence.dump(tx, entities, function(obj) {
          callback(JSON.stringify(obj));
        });
    };

    /**
     * Loads data from a JSON string (as dumped by `dumpToJson`)
     * @param tx transaction to use, use `null` to start a new one
     * @param entities a list of entity constructor functions to serialize, use `null` for all
     * @param callback (jsonDump) the callback function called with the results.
     */
    persistence.loadFromJson = function(tx, jsonDump, callback) {
      persistence.load(tx, JSON.parse(json), callback);
    };

  }());

// JSON2 library, source: http://www.JSON.org/js.html
// Relevant APIs:
//    JSON.stringify(value, replacer, space)
//    JSON.parse(text, reviver)

if (!this.JSON) {
  this.JSON = {};
  (function () {
      function f(n) {
        return n < 10 ? '0' + n : n;
      }
      if (typeof Date.prototype.toJSON !== 'function') {

        Date.prototype.toJSON = function (key) {

          return isFinite(this.valueOf()) ?
          this.getUTCFullYear()   + '-' +
            f(this.getUTCMonth() + 1) + '-' +
            f(this.getUTCDate())      + 'T' +
            f(this.getUTCHours())     + ':' +
            f(this.getUTCMinutes())   + ':' +
            f(this.getUTCSeconds())   + 'Z' : null;
        };

        String.prototype.toJSON =
          Number.prototype.toJSON =
          Boolean.prototype.toJSON = function (key) {
            return this.valueOf();
          };
      }

      var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
      escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
      gap, indent,
      meta = { 
        '\b': '\\b',
        '\t': '\\t',
        '\n': '\\n',
        '\f': '\\f',
        '\r': '\\r',
        '"' : '\\"',
        '\\': '\\\\'
      },
      rep;

      function quote(string) {
        escapable.lastIndex = 0;
        return escapable.test(string) ?
        '"' + string.replace(escapable, function (a) {
            var c = meta[a];
            return typeof c === 'string' ? c :
            '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
          }) + '"' :
        '"' + string + '"';
      }


      function str(key, holder) {
        var i, k, v, length, mind = gap, partial, value = holder[key];

        if (value && typeof value === 'object' &&
          typeof value.toJSON === 'function') {
          value = value.toJSON(key);
        }

        if (typeof rep === 'function') {
          value = rep.call(holder, key, value);
        }

        switch (typeof value) {
        case 'string':
          return quote(value);
        case 'number':
          return isFinite(value) ? String(value) : 'null';
        case 'boolean':
        case 'null':
          return String(value);
        case 'object':
          if (!value) {
            return 'null';
          }

          gap += indent;
          partial = [];

          if (Object.prototype.toString.apply(value) === '[object Array]') {
            length = value.length;
            for (i = 0; i < length; i += 1) {
              partial[i] = str(i, value) || 'null';
            }

            v = partial.length === 0 ? '[]' :
            gap ? '[\n' + gap +
              partial.join(',\n' + gap) + '\n' +
              mind + ']' :
            '[' + partial.join(',') + ']';
            gap = mind;
            return v;
          }

          if (rep && typeof rep === 'object') {
            length = rep.length;
            for (i = 0; i < length; i += 1) {
              k = rep[i];
              if (typeof k === 'string') {
                v = str(k, value);
                if (v) {
                  partial.push(quote(k) + (gap ? ': ' : ':') + v);
                }
              }
            }
          } else {
            for (k in value) {
              if (Object.hasOwnProperty.call(value, k)) {
                v = str(k, value);
                if (v) {
                  partial.push(quote(k) + (gap ? ': ' : ':') + v);
                }
              }
            }
          }

          v = partial.length === 0 ? '{}' :
          gap ? '{\n' + gap + partial.join(',\n' + gap) + '\n' +
            mind + '}' : '{' + partial.join(',') + '}';
          gap = mind;
          return v;
        }
      }

      if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function (value, replacer, space) {
          var i;
          gap = '';
          indent = '';
          if (typeof space === 'number') {
            for (i = 0; i < space; i += 1) {
              indent += ' ';
            }
          } else if (typeof space === 'string') {
            indent = space;
          }

          rep = replacer;
          if (replacer && typeof replacer !== 'function' &&
            (typeof replacer !== 'object' ||
              typeof replacer.length !== 'number')) {
            throw new Error('JSON.stringify');
          }

          return str('', {'': value});
        };
      }

      if (typeof JSON.parse !== 'function') {
        JSON.parse = function (text, reviver) {
          var j;
          function walk(holder, key) {
            var k, v, value = holder[key];
            if (value && typeof value === 'object') {
              for (k in value) {
                if (Object.hasOwnProperty.call(value, k)) {
                  v = walk(value, k);
                  if (v !== undefined) {
                    value[k] = v;
                  } else {
                    delete value[k];
                  }
                }
              }
            }
            return reviver.call(holder, key, value);
          }

          cx.lastIndex = 0;
          if (cx.test(text)) {
            text = text.replace(cx, function (a) {
                return '\\u' +
                  ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
              });
          }

          if (/^[\],:{}\s]*$/.
          test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@').
            replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').
            replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {
            j = eval('(' + text + ')');
            return typeof reviver === 'function' ?
            walk({'': j}, '') : j;
          }
          throw new SyntaxError('JSON.parse');
        };
      }
    }());
}
